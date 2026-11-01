import { randomBytes, timingSafeEqual } from 'crypto'
import { createReadStream, promises as fs } from 'fs'
import {
  createServer,
  request,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type Server,
  type ServerResponse
} from 'http'
import type { AddressInfo } from 'net'
import { networkInterfaces, type NetworkInterfaceInfo } from 'os'
import { extname, relative, resolve, sep } from 'path'
import { createGzip } from 'zlib'
import { createShowState } from '@shared/factory'
import {
  RemoteActionSchema,
  remoteCommand,
  remoteView,
  type RemoteAction,
  type RemotePlugin as RemotePluginView,
  type RemoteResult,
  type RemoteView
} from '@shared/remote'
import type { Locale, Translate } from '@shared/i18n'
import type { Quiz, ShowState } from '@shared/types'
import { parseAction } from '@shared/plugin'
import { PLUGINS, type PluginConfig, type PluginId } from '@shared/plugins'
import { REMOTE_ERRORS } from '@shared/show-messages'
import type { ActionHandlers, MainPlugin, PluginHost } from './plugins'
import { NOTICE_MESSAGES } from './messages'
import { mimeType } from './range'

/** "QUIZ" op een telefoontoetsenbord. Vast, zodat een bladwijzer op de telefoon blijft werken. */
export const REMOTE_PORT = 7849
const MAX_CLIENTS = 16
const MAX_BODY = 4096
/** Houdt de verbinding open via wifi en routers die stille verbindingen sluiten. */
const PING_MS = 20_000
/** Een ander netwerk (andere locatie) geeft een ander adres in de QR-code. */
const NETWORK_MS = 3000

/** Waar de pagina voor de telefoon vandaan komt: de build, of tijdens het ontwikkelen Vite. */
export type RemotePage = { dir: string } | { devServer: string }

export interface RemoteOptions {
  page: RemotePage
  /** Waar de server luistert; standaard op alle netwerken. Tests gebruiken 127.0.0.1. */
  host?: string
  /** Standaard REMOTE_PORT, en is die bezet een willekeurige; 0 = meteen een willekeurige. */
  port?: number
  /** De taal van de app; de telefoon neemt hem over. Standaard Nederlands. */
  locale?: Locale
}

type RemoteConfig = PluginConfig<'remote'>
type RemoteErrorKey = Parameters<ReturnType<typeof REMOTE_ERRORS.in>>[0]

/** Plug-ins met knoppen op de telefoon: die iets in `remoteActions` hebben staan. */
const PHONE_PLUGINS = (
  PLUGINS as readonly { id: PluginId; remoteActions?: readonly string[] }[]
).filter((p) => p.remoteActions?.length)

/**
 * Plug-in Afstandsbediening: een webserver op het lokale netwerk met de pagina voor de telefoon
 * (src/renderer/remote.html), de toestand van de show als server-sent events en een adres voor
 * de knoppen. Alleen wie de sleutel uit de QR-code heeft, mag iets; een nieuwe code sluit alle
 * telefoons buiten. Andere plug-ins kunnen knoppen op de telefoon hebben (`remoteActions`); deze
 * plug-in kent ze niet bij naam.
 */
export class RemotePlugin implements MainPlugin<'remote'> {
  private config: RemoteConfig = {}
  private key = ''
  private server: Server | null = null
  /** De poort waarop de server luistert, zodra hij luistert; null = hij kon niet starten. */
  private port: Promise<number | null> | null = null
  /** Telt bij elke stop: een server die daarna nog start, is niet meer nodig. */
  private generation = 0
  private readonly clients = new Set<ServerResponse>()
  private quiz: Quiz | null = null
  private state: ShowState = createShowState()
  /** Wat de telefoons het laatst kregen. */
  private sent = ''
  private pushing: ReturnType<typeof setTimeout> | null = null
  private ping: ReturnType<typeof setInterval> | null = null
  private network: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly host: PluginHost<'remote'>,
    private readonly options: RemoteOptions
  ) {}

  /** Foutmeldingen voor de telefoon, in de taal van de app. */
  private readonly say: Translate<RemoteErrorKey> = (key, params) =>
    REMOTE_ERRORS.in(this.options.locale ?? 'nl')(key, params)

  readonly actions: ActionHandlers<'remote'> = {
    renew: () => {
      this.disconnect()
      this.key = newKey()
      this.host.saveConfig({ ...this.config, key: this.key })
      void this.publishLink()
      return { ok: true }
    }
  }

  configure(config: RemoteConfig): void {
    this.config = config
    const key = config.key ?? null
    if (!key) {
      this.key = newKey()
      this.host.saveConfig({ ...config, key: this.key })
    } else if (key !== this.key) {
      // Een andere sleutel: telefoons met de oude moeten opnieuw scannen.
      this.disconnect()
      this.key = key
    }
    this.port ??= this.listen()
    this.network ??= setInterval(() => void this.publishLink(), NETWORK_MS)
    void this.publishLink()
  }

  update(quiz: Quiz | null, state: ShowState): void {
    this.quiz = quiz
    this.state = state
    this.schedule()
  }

  /** Een andere plug-in heeft een nieuwe status, bv. het licht met de hand gekozen op de Mac. */
  statusChanged(): void {
    this.schedule()
  }

  /** Het adres voor de QR-code en wie er verbonden is; main stuurt alleen een verandering. */
  private async publishLink(): Promise<void> {
    const generation = this.generation
    const port = await this.port
    if (generation !== this.generation) return
    const address = this.options.host ?? lanAddress()
    this.host.publish({
      url: port && address ? `http://${address}:${port}/?key=${this.key}` : null,
      devices: this.clients.size
    })
  }

  stop(): void {
    this.generation++
    this.disconnect()
    if (this.pushing) clearTimeout(this.pushing)
    this.pushing = null
    if (this.network) clearInterval(this.network)
    this.network = null
    this.server?.close()
    this.server?.closeAllConnections()
    this.server = null
    this.port = null
  }

  private async listen(): Promise<number | null> {
    const generation = this.generation
    let error: unknown
    for (const port of new Set([this.options.port ?? REMOTE_PORT, 0])) {
      const server = createServer((req, res) => void this.handle(req, res))
      try {
        const bound = await bind(server, port, this.options.host)
        if (generation !== this.generation) {
          server.close()
          return null
        }
        this.server = server
        return bound
      } catch (err) {
        error = err
      }
    }
    this.host.notify(
      'error',
      NOTICE_MESSAGES.in(this.options.locale ?? 'nl')('remoteFailed', {
        error: (error as Error).message
      })
    )
    return null
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://remote')
    try {
      if (url.pathname === '/api/events') this.events(url, res)
      else if (url.pathname === '/api/check') this.check(url, res)
      else if (url.pathname === '/api/action') await this.action(url, req, res)
      else if (url.pathname.startsWith('/media/')) await this.media(url, req, res)
      else if ('devServer' in this.options.page)
        this.dev(this.options.page.devServer, url, req, res)
      else await servePage(this.options.page.dir, url, req, res, this.say)
    } catch {
      if (res.headersSent) res.destroy()
      else reply(res, 500, { ok: false, error: this.say('failed') })
    }
  }

  /** De toestand van de show, nu en bij elke wijziging. */
  private events(url: URL, res: ServerResponse): void {
    if (!this.authorized(url)) return reply(res, 401, { ok: false, error: this.say('scanAgain') })
    if (this.clients.size >= MAX_CLIENTS) {
      return reply(res, 503, { ok: false, error: this.say('tooMany') })
    }
    res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream' })
    res.write('retry: 2000\n\n')
    this.clients.add(res)
    res.on('close', () => {
      this.clients.delete(res)
      this.keepAlive()
      void this.publishLink()
    })
    this.keepAlive()
    void this.publishLink()
    // Iedereen opnieuw: wie al verbonden was, kan iets gemist hebben dat de nieuwe wel krijgt.
    this.sent = ''
    this.schedule()
  }

  /** Klopt de sleutel nog? Voor de telefoon als zijn verbinding gesloten werd. */
  private check(url: URL, res: ServerResponse): void {
    if (!this.authorized(url)) return reply(res, 401, { ok: false, error: this.say('scanAgain') })
    reply(res, 200, { ok: true })
  }

  /** Een afbeelding uit de quiz voor de preview: alleen op id, en alleen afbeeldingen. */
  private async media(url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this.authorized(url)) return reply(res, 401, { ok: false, error: this.say('scanAgain') })
    const id = decodeURIComponent(url.pathname.slice('/media/'.length))
    const asset = this.quiz?.assets.find((a) => a.id === id && a.kind === 'image')
    const file = asset ? this.host.mediaFile(asset.file) : null
    await sendFile(file, file ? mimeType(file) : '', 'private, max-age=3600', req, res)
  }

  private async action(url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST')
      return reply(res, 405, { ok: false, error: this.say('onlyMethod', { method: 'POST' }) })
    if (!this.authorized(url)) return reply(res, 401, { ok: false, error: this.say('scanAgain') })
    const parsed = RemoteActionSchema.safeParse(parseJson(await readBody(req)))
    if (!parsed.success) return reply(res, 400, { ok: false, error: this.say('unknownCommand') })
    if (parsed.data.type === 'plugin' && !phoneAction(parsed.data)) {
      return reply(res, 403, { ok: false, error: this.say('notFromPhone') })
    }
    const result = await this.perform(parsed.data)
    reply(res, result.ok ? 200 : 409, result)
  }

  private async perform(action: RemoteAction): Promise<RemoteResult> {
    if (!this.state.live) return { ok: false, error: this.say('startShow') }
    if (action.type === 'plugin') {
      const result = await this.host.remoteAct(action.id as PluginId, action.action, action.input)
      if (result === null) {
        const text = PLUGINS.find((p) => p.id === action.id)?.text[this.options.locale ?? 'nl']
        const name = text?.name ?? this.say('unknownPlugin')
        return { ok: false, error: this.say('pluginOff', { name }) }
      }
      return pluginResult(result, this.say)
    }
    const command = this.quiz && remoteCommand(this.quiz, this.state, action)
    if (command) this.host.command(command)
    return { ok: true }
  }

  /**
   * Tijdens het ontwikkelen (pnpm dev): de pagina komt van de Vite-server. Die serveert ook de
   * broncode en bestanden via /@fs/, dus alleen voor wie de sleutel heeft. De pagina zelf krijgt
   * hem in de URL en zet hem in een cookie, voor de scripts en stijlen die de browser daarna haalt.
   */
  private dev(devServer: string, url: URL, req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return reply(res, 405, { ok: false, error: this.say('onlyMethod', { method: 'GET' }) })
    }
    const page = url.pathname === '/'
    if (!this.matches(page ? url.searchParams.get('key') : cookie(req, DEV_COOKIE))) {
      return reply(res, 401, { ok: false, error: this.say('scanAgain') })
    }
    // De sleutel hoeft Vite niet te zien; zijn eigen query's (?v=, ?vue&type=) wel.
    const target = new URL(page ? '/remote.html' : url.pathname + url.search, devServer)
    const extra: OutgoingHttpHeaders = page
      ? { 'Set-Cookie': `${DEV_COOKIE}=${this.key}; Path=/; HttpOnly; SameSite=Strict` }
      : {}
    proxy(target, req, res, extra)
  }

  private authorized(url: URL): boolean {
    return this.matches(url.searchParams.get('key'))
  }

  private matches(value: string | null | undefined): boolean {
    const given = Buffer.from(value ?? '')
    const key = Buffer.from(this.key)
    return key.length > 0 && given.length === key.length && timingSafeEqual(given, key)
  }

  private view(): RemoteView {
    const plugins = PHONE_PLUGINS.flatMap(({ id }) => {
      const status = this.host.status(id)
      return status === null ? [] : [{ id, status } as RemotePluginView]
    })
    return remoteView(this.quiz, this.state, plugins, this.options.locale)
  }

  /** De telefoons bijwerken; één keer voor alles wat tegelijk verandert. */
  private schedule(): void {
    if (this.pushing || this.clients.size === 0) return
    this.pushing = setTimeout(() => this.push(), 0)
  }

  private push(): void {
    this.pushing = null
    const json = JSON.stringify(this.view())
    if (json === this.sent) return
    this.sent = json
    for (const res of this.clients) res.write(`data: ${json}\n\n`)
  }

  private keepAlive(): void {
    if (this.clients.size > 0 && !this.ping) {
      this.ping = setInterval(() => {
        for (const res of this.clients) res.write(': ping\n\n')
      }, PING_MS)
    } else if (this.clients.size === 0 && this.ping) {
      clearInterval(this.ping)
      this.ping = null
    }
  }

  private disconnect(): void {
    for (const res of this.clients) res.end()
    this.clients.clear()
    this.keepAlive()
  }
}

/**
 * Het IPv4-adres van deze Mac op het lokale netwerk, voor in de QR-code: wifi en ethernet
 * (en0, en1…) gaan voor VPN's en virtuele netwerken, privéadressen voor andere.
 */
export function lanAddress(
  interfaces: NodeJS.Dict<NetworkInterfaceInfo[]> = networkInterfaces()
): string | null {
  const candidates = Object.entries(interfaces).flatMap(([name, infos]) =>
    (infos ?? [])
      .filter((i) => i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
      .map((i) => ({
        address: i.address,
        rank: (/^en\d+$/.test(name) ? 0 : 2) + (isPrivate(i.address) ? 0 : 1)
      }))
  )
  candidates.sort((a, b) => a.rank - b.rank)
  return candidates[0]?.address ?? null
}

/** Bestaat de plug-in, mag de telefoon deze actie en klopt de invoer? Main controleert het nog eens. */
function phoneAction(action: Extract<RemoteAction, { type: 'plugin' }>): boolean {
  const definition = PLUGINS.find((p) => p.id === action.id)
  return !!definition && parseAction(definition, action.action, action.input, 'remote') !== null
}

/** Wat een plug-in teruggeeft, voor de telefoon: alleen een fout met uitleg telt als fout. */
function pluginResult(result: unknown, say: Translate<RemoteErrorKey>): RemoteResult {
  if (typeof result === 'object' && result && 'ok' in result && result.ok === false) {
    const error = 'error' in result && typeof result.error === 'string' ? result.error : null
    return { ok: false, error: error ?? say('didNotWork') }
  }
  return { ok: true }
}

const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)

const newKey = () => randomBytes(16).toString('base64url')

/** Het cookie met de sleutel, alleen tijdens het ontwikkelen. */
const DEV_COOKIE = 'quiznote-remote'

function cookie(req: IncomingMessage, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

/** De sleutel staat in de URL; die hoort niet in een Referer naar buiten. */
const HEADERS: OutgoingHttpHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  // Een andere site mag de pagina niet in een frame zetten en de knoppen laten indrukken.
  'X-Frame-Options': 'DENY'
}

function reply(res: ServerResponse, status: number, body: RemoteResult): void {
  res.writeHead(status, { ...HEADERS, 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function bind(server: Server, port: number, host?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolve((server.address() as AddressInfo).port)
    })
  })
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        req.destroy()
        reject(new Error('te groot'))
      } else {
        chunks.push(chunk)
      }
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

/** De pagina zelf op `/`, en wat Vite ervoor bouwde in assets/; verder niets. */
async function servePage(
  dir: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
  say: Translate<RemoteErrorKey>
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return reply(res, 405, { ok: false, error: say('onlyMethod', { method: 'GET' }) })
  }
  const path = url.pathname === '/' ? '/remote.html' : url.pathname
  const file = resolve(dir, `.${decodeURIComponent(path)}`)
  const inside = relative(dir, file)
  const allowed = inside === 'remote.html' || inside.startsWith(`assets${sep}`)
  await sendFile(
    allowed ? file : null,
    TYPES[extname(file)] ?? 'application/octet-stream',
    // Bestanden in assets/ hebben een hash in hun naam.
    inside === 'remote.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    req,
    res
  )
}

/** Een bestand, of 404 als het er niet is (null: niet toegestaan). */
async function sendFile(
  file: string | null,
  type: string,
  cache: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const stat = file ? await fs.stat(file).catch(() => null) : null
  if (!file || !stat?.isFile()) {
    res.writeHead(404, HEADERS)
    return void res.end()
  }
  // Tekst ingepakt: de telefoon laadt Vue en de effectnamen zo in een kwart van de tijd.
  const gzip = type.includes('charset') && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')
  res.writeHead(200, {
    ...HEADERS,
    'Content-Type': type,
    ...(gzip ? { 'Content-Encoding': 'gzip' } : { 'Content-Length': stat.size }),
    Vary: 'Accept-Encoding',
    'Cache-Control': cache
  })
  if (req.method === 'HEAD') return void res.end()
  const stream = createReadStream(file)
  if (gzip) stream.pipe(createGzip()).pipe(res)
  else stream.pipe(res)
}

/** Een verzoek doorgeven aan de Vite-server, die alleen op localhost luistert; zonder ons cookie. */
function proxy(
  target: URL,
  req: IncomingMessage,
  res: ServerResponse,
  extra: OutgoingHttpHeaders
): void {
  const { cookie: _, ...headers } = req.headers
  const upstream = request(
    target,
    { method: req.method, headers: { ...headers, host: target.host } },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, { ...answer.headers, ...extra })
      answer.pipe(res)
    }
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502)
    res.end()
  })
  upstream.end()
}
