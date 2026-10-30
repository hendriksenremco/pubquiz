import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQuiz, createRound, createShowState, createSlide } from '@shared/factory'
import type { RemoteView } from '@shared/remote'
import type { ShowState } from '@shared/types'
import type { PluginHost } from './plugins'
import { lanAddress, RemotePlugin } from './remote'

/** Een build met alleen de pagina voor de telefoon en één bestand in assets/. */
function fakeBuild(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pubquiz-remote-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'remote.html'), '<!doctype html><title>Afstandsbediening</title>')
  writeFileSync(join(dir, 'index.html'), 'de app zelf')
  writeFileSync(join(dir, 'assets', 'remote.js'), 'console.log(1)')
  return dir
}

let plugin: RemotePlugin | null = null
afterEach(() => plugin?.stop())

async function setup(light: unknown = null) {
  const host = {
    notify: vi.fn(),
    command: vi.fn(),
    saveConfig: vi.fn((config: Record<string, unknown>) => plugin!.configure(config)),
    invoke: vi.fn(async (_id: string, action: string) =>
      action === 'status' ? light : { ok: true }
    )
  } satisfies PluginHost
  plugin = new RemotePlugin(host, { page: { dir: fakeBuild() }, host: '127.0.0.1', port: 0 })
  plugin.configure({})
  const link = (await plugin.invoke('link'))!
  const url = new URL(link.url!)
  const key = url.searchParams.get('key')!
  const quiz = createQuiz('Kroegquiz')
  const round = createRound('normal', 1)
  round.slides.push(createSlide('question', 'Vraag 1'))
  quiz.rounds = [round]
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
    expect(await page.text()).toContain('Afstandsbediening')
    const script = await fetch(`${url.origin}/assets/remote.js`)
    expect(script.headers.get('content-encoding')).toBe('gzip')
    expect(await script.text()).toBe('console.log(1)')
    expect((await fetch(`${url.origin}/index.html`)).status).toBe(404)
    expect((await fetch(`${url.origin}/assets/..%2Findex.html`)).status).toBe(404)
  })

  it('weigert wie de sleutel niet heeft', async () => {
    const { api, act } = await setup()
    expect((await fetch(api('/api/events', 'fout'))).status).toBe(401)
    expect((await fetch(api('/api/check', 'fout'))).status).toBe(401)
    expect((await fetch(api('/api/check'))).status).toBe(200)
    expect((await act({ type: 'slide', direction: 'next' }, '')).status).toBe(401)
  })

  it('stuurt de toestand en elke wijziging', async () => {
    const { plugin, quiz, live, api } = await setup()
    const events = await subscribe(api('/api/events'))
    expect(events.res.headers.get('content-type')).toBe('text/event-stream')
    expect(await events.next()).toMatchObject({ quiz: null, live: false })

    plugin.update(quiz, live())
    expect(await events.next()).toMatchObject({
      quiz: 'Kroegquiz',
      live: true,
      round: { title: 'Ronde 1', number: 1 },
      slide: { index: 0, count: 2, next: true }
    })
    expect(await plugin.invoke('link')).toMatchObject({ devices: 1 })
    await events.cancel()
  })

  it('geeft knoppen door aan de show, alleen als die loopt', async () => {
    const { host, plugin, quiz, live, act } = await setup()
    const blocked = await act({ type: 'slide', direction: 'next' })
    expect(blocked.status).toBe(409)
    expect(await blocked.json()).toEqual({ ok: false, error: 'Start eerst de show op de Mac' })

    plugin.update(quiz, live())
    expect((await act({ type: 'slide', direction: 'next' })).status).toBe(200)
    await act({ type: 'round', direction: 'prev' })
    await act({ type: 'blackout', on: true })
    await act({ type: 'mute', on: true })
    expect(host.command.mock.calls.map(([c]) => c)).toEqual([
      { type: 'nextSlide' },
      { type: 'prevRound' },
      { type: 'blackout', on: true },
      { type: 'stopAll' }
    ])
    expect((await act({ type: 'stopShow' })).status).toBe(400)
    expect((await act('geen json')).status).toBe(400)
  })

  it('kiest het licht via MagicHome, en meldt als die uit staat', async () => {
    const red = { type: 'color', color: '#ff0000' }
    const on = await setup({ light: null, manual: false })
    on.plugin.update(on.quiz, on.live())
    expect((await on.act({ type: 'light', light: red })).status).toBe(200)
    expect(on.host.invoke).toHaveBeenCalledWith('magichome', 'choose', red)
    on.plugin.stop()

    const off = await setup()
    off.host.invoke.mockResolvedValue(null)
    off.plugin.update(off.quiz, off.live())
    const result = await off.act({ type: 'light', light: red })
    expect(await result.json()).toEqual({ ok: false, error: 'Het licht staat uit op de Mac' })
  })

  it('een nieuwe code sluit verbonden telefoons buiten', async () => {
    const { plugin, api, key } = await setup()
    const events = await subscribe(api('/api/events'))
    await events.next()
    const renewed = await plugin.invoke('renew')
    expect(renewed?.url).not.toContain(key)
    expect(await events.closed()).toBe(true)
    expect((await fetch(api('/api/events'))).status).toBe(401)
  })
})

describe('RemotePlugin tijdens het ontwikkelen', () => {
  it('haalt de pagina bij de Vite-server, met diens eigen hostnaam', async () => {
    const seen: { url?: string; host?: string }[] = []
    const vite = createServer((req, res) => {
      seen.push({ url: req.url, host: req.headers.host })
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('van vite')
    })
    await new Promise<void>((resolve) => vite.listen(0, '127.0.0.1', resolve))
    const devServer = `http://localhost:${(vite.address() as AddressInfo).port}`
    const host = { notify: vi.fn(), command: vi.fn(), saveConfig: vi.fn(), invoke: vi.fn() }
    plugin = new RemotePlugin(host, { page: { devServer }, host: '127.0.0.1', port: 0 })
    try {
      plugin.configure({ key: 'k'.repeat(22) })
      const { origin } = new URL((await plugin.invoke('link'))!.url!)
      expect(await (await fetch(`${origin}/?key=${'k'.repeat(22)}`)).text()).toBe('van vite')
      await fetch(`${origin}/src/remote/main.ts?t=1`)
      expect(seen).toEqual([
        { url: '/remote.html', host: new URL(devServer).host },
        { url: '/src/remote/main.ts?t=1', host: new URL(devServer).host }
      ])
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
