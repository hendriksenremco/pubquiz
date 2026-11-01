import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { createServer, request } from 'http'
import type { AddressInfo } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createQuiz, createRound, createShowState, createSlide } from '@shared/factory'
import type { Locale } from '@shared/i18n'
import type { RemoteLink, RemoteView } from '@shared/remote'
import type { ShowState } from '@shared/types'
import type { PluginConfig } from '@shared/plugins'
import type { PluginHost } from './plugins'
import { lanAddress, RemotePlugin } from './remote'

/** Een build met alleen de pagina voor de telefoon en één bestand in assets/. */
function fakeBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pubquiz-remote-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'remote.html'), '<!doctype html><title>Afstandsbediening</title>')
  writeFileSync(join(dir, 'index.html'), 'de app zelf')
  writeFileSync(join(dir, 'assets', 'remote.js'), 'console.log(1)')
  mkdirSync(join(dir, 'quiz', 'media'), { recursive: true })
  writeFileSync(join(dir, 'quiz', 'media', 'kaart.png'), 'png')
  writeFileSync(join(dir, 'quiz', 'media', 'liedje.m4a'), 'm4a')
  return dir
}

let plugin: RemotePlugin | null = null
afterEach(() => plugin?.stop())

async function setup(light: unknown = null, locale?: Locale) {
  const dir = fakeBuild()
  const host = {
    mediaFile: (file: string) => join(dir, 'quiz', file),
    notify: vi.fn(),
    command: vi.fn(),
    saveConfig: vi.fn((config: PluginConfig<'remote'>) => plugin!.configure(config)),
    publish: vi.fn(),
    status: vi.fn((): any => light),
    act: vi.fn(async (): Promise<any> => ({ ok: true })),
    remoteAct: vi.fn(async (): Promise<unknown> => ({ ok: true }))
  } satisfies PluginHost<'remote'>
  plugin = new RemotePlugin(host, { page: { dir }, host: '127.0.0.1', port: 0, locale })
  plugin.configure({})
  const url = new URL((await published(host)).url!)
  const key = url.searchParams.get('key')!
  const quiz = createQuiz('Kroegquiz')
  const round = createRound('normal', 1)
  round.slides.push(createSlide('question', 'Vraag 1'))
  quiz.rounds = [round]
  quiz.assets = [
    { id: 'kaart', kind: 'image', file: 'media/kaart.png', name: 'kaart.png' },
    { id: 'liedje', kind: 'audio', file: 'media/liedje.m4a', name: 'liedje.m4a' }
  ]
  const live = (patch: Partial<ShowState> = {}): ShowState => ({
    ...createShowState(),
    live: true,
    activeRoundId: round.id,
    slideIndex: 0,
    ...patch
  })
  const api = (path: string, k = key) => `${url.origin}${path}?key=${encodeURIComponent(k)}`
  const act = (body: unknown, k = key) =>
    fetch(api('/api/action', k), { method: 'POST', body: JSON.stringify(body) })
  return { host, plugin, url, key, quiz, live, api, act }
}

/** Wat de plug-in het laatst publiceerde (adres en apparaten), zodra er iets is. */
async function published(
  host: { publish: Mock },
  check: (link: RemoteLink) => boolean = () => true
) {
  let link: RemoteLink | undefined
  await vi.waitFor(() => {
    link = host.publish.mock.lastCall?.[0]
    expect(link && check(link)).toBe(true)
  })
  return link!
}

/** Leest de server-sent events: elke `next()` is de volgende toestand. */
async function subscribe(url: string) {
  const res = await fetch(url)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  return {
    res,
    async next(): Promise<RemoteView> {
      for (;;) {
        const match = /^data: (.*)$/m.exec(buffer)
        if (match) {
          buffer = buffer.slice(match.index + match[0].length)
          return JSON.parse(match[1])
        }
        const { value, done } = await reader.read()
        if (done) throw new Error('gesloten')
        buffer += decoder.decode(value)
      }
    },
    async closed(): Promise<boolean> {
      for (;;) if ((await reader.read()).done) return true
    },
    cancel: () => reader.cancel()
  }
}

describe('RemotePlugin', () => {
  it('maakt een sleutel en geeft een adres voor de QR-code', async () => {
    const { host, url, key } = await setup()
    expect(host.saveConfig).toHaveBeenCalledWith({ key })
    expect(key).toMatch(/^[\w-]{22}$/)
    expect(url.hostname).toBe('127.0.0.1')
    expect(url.pathname).toBe('/')
  })

  it('serveert alleen de pagina voor de telefoon en zijn assets', async () => {
    const { url } = await setup()
    const page = await fetch(`${url.origin}/`)
    expect(page.headers.get('content-type')).toContain('text/html')
    expect(page.headers.get('x-frame-options')).toBe('DENY')
    expect(page.headers.get('referrer-policy')).toBe('no-referrer')
    expect(await page.text()).toContain('Afstandsbediening')
    const script = await fetch(`${url.origin}/assets/remote.js`)
    expect(script.headers.get('content-encoding')).toBe('gzip')
    expect(await script.text()).toBe('console.log(1)')
    expect((await fetch(`${url.origin}/index.html`)).status).toBe(404)
    expect((await fetch(`${url.origin}/assets/..%2Findex.html`)).status).toBe(404)
  })

  it('geeft afbeeldingen uit de quiz voor de preview, en verder niets', async () => {
    const { plugin, quiz, live, api } = await setup()
    plugin.update(quiz, live())
    const image = await fetch(api('/media/kaart'))
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(await image.text()).toBe('png')
    expect((await fetch(api('/media/liedje'))).status).toBe(404)
    expect((await fetch(api('/media/bestaat-niet'))).status).toBe(404)
    expect((await fetch(api('/media/kaart', 'fout'))).status).toBe(401)
  })

  it('weigert wie de sleutel niet heeft', async () => {
    const { api, act } = await setup()
    expect((await fetch(api('/api/events', 'fout'))).status).toBe(401)
    expect((await fetch(api('/api/check', 'fout'))).status).toBe(401)
    expect((await fetch(api('/api/check'))).status).toBe(200)
    expect((await act({ type: 'step', direction: 'next' }, '')).status).toBe(401)
  })

  it('stuurt de toestand en elke wijziging', async () => {
    const { host, plugin, quiz, live, api } = await setup()
    const events = await subscribe(api('/api/events'))
    expect(events.res.headers.get('content-type')).toBe('text/event-stream')
    expect(await events.next()).toMatchObject({ quiz: null, live: false })

    plugin.update(quiz, live())
    expect(await events.next()).toMatchObject({
      quiz: 'Kroegquiz',
      live: true,
      round: { title: 'Ronde 1', number: 1 },
      step: { target: 'slides', label: 'Slide 1 van 2', next: true },
      screen: { slide: { layout: 'title', title: 'Ronde 1' } }
    })
    expect(await published(host, (link) => link.devices === 1)).toMatchObject({ devices: 1 })
    await events.cancel()
  })

  it('meldt fouten in de taal van de app', async () => {
    const { act } = await setup(null, 'en')
    expect(await (await act({ type: 'step', direction: 'next' })).json()).toEqual({
      ok: false,
      error: 'Start the show on the Mac first'
    })
    expect(await (await act({ type: 'step', direction: 'next' }, 'fout')).json()).toEqual({
      ok: false,
      error: 'Scan the QR code again'
    })
  })

  it('geeft knoppen door aan de show, alleen als die loopt', async () => {
    const { host, plugin, quiz, live, act } = await setup()
    const blocked = await act({ type: 'step', direction: 'next' })
    expect(blocked.status).toBe(409)
    expect(await blocked.json()).toEqual({ ok: false, error: 'Start eerst de show op de Mac' })

    plugin.update(quiz, live())
    expect((await act({ type: 'step', direction: 'next' })).status).toBe(200)
    await act({ type: 'round', direction: 'prev' })
    await act({ type: 'restartRound' })
    await act({ type: 'endRound' })
    await act({ type: 'blackout', on: true })
    await act({ type: 'mute', on: true })
    expect(host.command.mock.calls.map(([c]) => c)).toEqual([
      { type: 'nextSlide' },
      { type: 'prevRound' },
      { type: 'restartRound' },
      { type: 'endRound' },
      { type: 'blackout', on: true },
      { type: 'stopAll' }
    ])
    expect((await act({ type: 'stopShow' })).status).toBe(400)
    expect((await act('geen json')).status).toBe(400)
  })

  it('geeft een actie van een plug-in door aan main, en meldt als die uit staat', async () => {
    const red = { type: 'color', color: '#ff0000' }
    const choose = { type: 'plugin', id: 'magichome', action: 'choose', input: red }
    const on = await setup({ light: null, manual: false, quiz: [] })
    on.plugin.update(on.quiz, on.live())
    expect((await on.act(choose)).status).toBe(200)
    expect(on.host.remoteAct).toHaveBeenCalledWith('magichome', 'choose', red)
    on.host.remoteAct.mockResolvedValueOnce({ ok: false, error: 'Geen controller' })
    expect(await (await on.act(choose)).json()).toEqual({ ok: false, error: 'Geen controller' })
    on.plugin.stop()

    const off = await setup()
    off.host.remoteAct.mockResolvedValue(null)
    off.plugin.update(off.quiz, off.live())
    const result = await off.act(choose)
    expect(await result.json()).toEqual({ ok: false, error: 'MagicHome-licht staat uit op de Mac' })
    off.plugin.stop()

    // In het Engels ook de naam van de plug-in.
    const en = await setup(null, 'en')
    en.host.remoteAct.mockResolvedValue(null)
    en.plugin.update(en.quiz, en.live())
    expect(await (await en.act(choose)).json()).toEqual({
      ok: false,
      error: 'MagicHome lights is off on the Mac'
    })
  })

  it('weigert een actie die de telefoon niet mag', async () => {
    const { host, plugin, quiz, live, act } = await setup({ light: null, manual: false, quiz: [] })
    plugin.update(quiz, live())
    const red = { type: 'color', color: '#ff0000' }
    for (const body of [
      { type: 'plugin', id: 'magichome', action: 'probe', input: '192.168.1.10' },
      { type: 'plugin', id: 'magichome', action: 'preview', input: red },
      {
        type: 'plugin',
        id: 'magichome',
        action: 'choose',
        input: { type: 'color', color: 'rood' }
      },
      { type: 'plugin', id: 'remote', action: 'renew', input: undefined },
      { type: 'plugin', id: 'onbekend', action: 'choose', input: red }
    ]) {
      const refused = await act(body)
      expect(refused.status).toBe(403)
      expect(await refused.json()).toEqual({ ok: false, error: 'Dat kan niet vanaf de telefoon' })
    }
    expect(host.remoteAct).not.toHaveBeenCalled()
  })

  it('toont meteen een licht dat op de Mac met de hand gekozen is', async () => {
    const red = { type: 'color', color: '#ff0000' }
    const status = { light: null as unknown, manual: false, quiz: [] }
    const { plugin, quiz, live, api } = await setup(status)
    plugin.update(quiz, live())
    const events = await subscribe(api('/api/events'))
    expect(await events.next()).toMatchObject({
      plugins: [{ id: 'magichome', status: { light: null, manual: false } }]
    })
    Object.assign(status, { light: red, manual: true })
    plugin.statusChanged()
    expect(await events.next()).toMatchObject({
      plugins: [{ id: 'magichome', status: { light: red, manual: true } }]
    })
    await events.cancel()
  })

  it('zonder plug-ins met knoppen voor de telefoon is de lijst leeg', async () => {
    const { plugin, quiz, live, api } = await setup()
    plugin.update(quiz, live())
    const events = await subscribe(api('/api/events'))
    expect(await events.next()).toMatchObject({ plugins: [] })
    await events.cancel()
  })

  it('een nieuwe code sluit verbonden telefoons buiten', async () => {
    const { host, plugin, api, key } = await setup()
    const events = await subscribe(api('/api/events'))
    await events.next()
    expect(await plugin.actions.renew(undefined)).toEqual({ ok: true })
    const renewed = await published(host, (link) => !link.url?.includes(key))
    expect(renewed.url).toContain('?key=')
    expect(await events.closed()).toBe(true)
    expect((await fetch(api('/api/events'))).status).toBe(401)
  })
})

/** Vraagt een websocket aan; geeft de socket bij 101, anders de statuscode. */
function upgrade(url: string, cookie?: string) {
  return new Promise<{ status: number; socket?: import('net').Socket }>((resolve, reject) => {
    const req = request(url, {
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', ...(cookie ? { cookie } : {}) }
    })
    req.on('upgrade', (res, socket) => resolve({ status: res.statusCode!, socket }))
    req.on('response', (res) => resolve({ status: res.statusCode! }))
    req.on('error', reject)
    req.end()
  })
}

describe('RemotePlugin tijdens het ontwikkelen', () => {
  async function devSetup() {
    const seen: { url?: string; host?: string; cookie?: string }[] = []
    const vite = createServer((req, res) => {
      seen.push({ url: req.url, host: req.headers.host, cookie: req.headers.cookie })
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('van vite')
    })
    // De websocket voor het herladen (HMR): Vite antwoordt met 101 en stuurt terug wat hij krijgt.
    vite.on('upgrade', (req, socket) => {
      seen.push({ url: req.url, host: req.headers.host, cookie: req.headers.cookie })
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n'
      )
      socket.pipe(socket)
    })
    await new Promise<void>((resolve) => vite.listen(0, '127.0.0.1', resolve))
    const devServer = `http://localhost:${(vite.address() as AddressInfo).port}`
    const host = {
      notify: vi.fn(),
      command: vi.fn(),
      saveConfig: vi.fn(),
      mediaFile: vi.fn(),
      publish: vi.fn(),
      status: vi.fn(() => null),
      act: vi.fn(async () => null),
      remoteAct: vi.fn(async () => null)
    }
    plugin = new RemotePlugin(host, { page: { devServer }, host: '127.0.0.1', port: 0 })
    const key = 'k'.repeat(22)
    plugin.configure({ key })
    const { origin } = new URL((await published(host)).url!)
    return { seen, vite, devServer, origin, key }
  }

  it('haalt de pagina bij de Vite-server, met diens eigen hostnaam', async () => {
    const { seen, vite, devServer, origin, key } = await devSetup()
    try {
      const page = await fetch(`${origin}/?key=${key}`)
      expect(await page.text()).toBe('van vite')
      const cookie = page.headers.get('set-cookie')!
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Strict')
      await fetch(`${origin}/src/remote/main.ts?t=1`, {
        headers: { cookie: cookie.split(';')[0] }
      })
      expect(seen).toEqual([
        { url: '/remote.html', host: new URL(devServer).host, cookie: undefined },
        { url: '/src/remote/main.ts?t=1', host: new URL(devServer).host, cookie: undefined }
      ])
    } finally {
      vite.close()
    }
  })

  it('geeft Vite niet vrij zonder sleutel', async () => {
    const { seen, vite, origin, key } = await devSetup()
    try {
      expect((await fetch(`${origin}/`)).status).toBe(401)
      expect((await fetch(`${origin}/?key=fout`)).status).toBe(401)
      expect((await fetch(`${origin}/@fs/etc/passwd`)).status).toBe(401)
      const wrong = { headers: { cookie: 'quiznote-remote=fout' } }
      expect((await fetch(`${origin}/src/remote/main.ts`, wrong)).status).toBe(401)
      const right = { headers: { cookie: `quiznote-remote=${key}` } }
      expect(
        (await fetch(`${origin}/src/remote/main.ts`, { ...right, method: 'POST' })).status
      ).toBe(405)
      expect(seen).toEqual([])
    } finally {
      vite.close()
    }
  })

  it('geeft de websocket voor het herladen door aan Vite, zonder ons cookie', async () => {
    const { seen, vite, devServer, origin, key } = await devSetup()
    try {
      const { status, socket } = await upgrade(`${origin}/?token=abc`, `quiznote-remote=${key}`)
      expect(status).toBe(101)
      const echo = new Promise<string>((resolve) => socket!.once('data', (d) => resolve(`${d}`)))
      socket!.write('hallo')
      expect(await echo).toBe('hallo')
      expect(seen).toEqual([
        { url: '/?token=abc', host: new URL(devServer).host, cookie: undefined }
      ])
      // Stopt de plug-in, dan gaat de websocket ook dicht.
      const closed = new Promise((resolve) => socket!.once('close', resolve))
      plugin!.stop()
      await closed
    } finally {
      vite.close()
    }
  })

  it('geen websocket in de gebouwde app, ook niet met de sleutel', async () => {
    const { url, key } = await setup()
    await expect(upgrade(`${url.origin}/?key=${key}`, `quiznote-remote=${key}`)).rejects.toThrow()
  })

  it('geen websocket zonder sleutel', async () => {
    const { seen, vite, origin } = await devSetup()
    try {
      expect((await upgrade(`${origin}/?token=abc`)).status).toBe(401)
      expect((await upgrade(`${origin}/?token=abc`, 'quiznote-remote=fout')).status).toBe(401)
      expect(seen).toEqual([])
    } finally {
      vite.close()
    }
  })
})

describe('lanAddress', () => {
  const v4 = (address: string, internal = false) => ({
    address,
    family: 'IPv4' as const,
    internal,
    netmask: '255.255.255.0',
    mac: '00:00:00:00:00:00',
    cidr: null
  })

  it('kiest wifi of ethernet boven VPN en virtuele netwerken', () => {
    expect(
      lanAddress({
        lo0: [v4('127.0.0.1', true)],
        utun4: [v4('10.8.0.2')],
        bridge100: [v4('192.168.64.1')],
        en7: [v4('169.254.10.2')],
        en0: [v4('192.168.14.120')]
      })
    ).toBe('192.168.14.120')
  })

  it('geen netwerk: geen adres', () => {
    expect(lanAddress({ lo0: [v4('127.0.0.1', true)] })).toBeNull()
  })
})
