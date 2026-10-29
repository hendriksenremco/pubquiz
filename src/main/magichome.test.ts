import { createServer, type AddressInfo } from 'net'
import { describe, expect, it, vi } from 'vitest'
import { createQuiz, createRound, createShowState, createSlide } from '@shared/factory'
import { setLight } from '@shared/light'
import type { ShowState } from '@shared/types'
import { MagicHomePlugin } from './magichome'

const hex = (data: Uint8Array) => [...data].map((b) => b.toString(16).padStart(2, '0')).join(' ')
const STATE = Uint8Array.from([
  0x81, 0xa1, 0x23, 0x00, 0x61, 0x64, 0x00, 0xff, 0x00, 0x00, 0x03, 0x00, 0xfa, 0x06
])
const ON = '71 23 0f a3'
const RED = '31 ff 00 00 00 00 f0 0f 2f'

/** Nep-controller op localhost: onthoudt wat elke verbinding stuurde en beantwoordt de statusvraag. */
async function fakeController() {
  const received: string[] = []
  const server = createServer((socket) => {
    const bytes: number[] = []
    socket.on('data', (chunk) => {
      bytes.push(...chunk)
      if (chunk[0] === 0x81) socket.write(STATE)
    })
    socket.on('end', () => {
      received.push(hex(Uint8Array.from(bytes)))
      socket.end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    host: `127.0.0.1:${port}`,
    received,
    close: () => new Promise((resolve) => server.close(resolve))
  }
}

function setup() {
  const quiz = createQuiz('Test')
  const round = createRound('normal', 1)
  round.slides = [createSlide('title', 'Ronde 1'), createSlide('question', 'Vraag 1')]
  quiz.rounds = [round]
  setLight(round, { type: 'color', color: '#ff0000' })
  setLight(round.slides[1], { type: 'effect', effect: 1, speed: 50 })
  const state = (patch: Partial<ShowState> = {}): ShowState => ({
    ...createShowState(),
    live: true,
    activeRoundId: round.id,
    slideIndex: 0,
    ...patch
  })
  return { quiz, state }
}

describe('MagicHomePlugin', () => {
  it('stuurt tijdens de show het licht van de ronde en de slide, en niets dubbel', async () => {
    const device = await fakeController()
    const notify = vi.fn()
    const plugin = new MagicHomePlugin(notify)
    const { quiz, state } = setup()
    try {
      plugin.configure({ host: device.host })
      plugin.update(quiz, { ...state(), live: false })
      plugin.update(quiz, state())
      await vi.waitFor(() => expect(device.received).toEqual([`${ON} ${RED}`]))

      // Zelfde licht: niets. Andere slide: zijn eigen effect.
      plugin.update(quiz, state())
      plugin.update(quiz, state({ slideIndex: 1 }))
      await vi.waitFor(() => expect(device.received).toHaveLength(2))
      expect(device.received[1]).toBe(`${ON} 61 00 64 32 0f 06`)
      expect(notify).not.toHaveBeenCalled()
    } finally {
      plugin.stop()
      await device.close()
    }
  })

  it('stuurt van snel na elkaar gevraagde lichten alleen het laatste nog', async () => {
    const device = await fakeController()
    const plugin = new MagicHomePlugin(vi.fn())
    const { quiz, state } = setup()
    try {
      plugin.configure({ host: device.host })
      plugin.update(quiz, state())
      plugin.update(quiz, state({ slideIndex: 1 }))
      plugin.update(quiz, state({ slideIndex: 0 }))
      plugin.update(quiz, state({ slideIndex: 1 }))
      await vi.waitFor(() => expect(device.received).toHaveLength(2))
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(device.received).toEqual([`${ON} ${RED}`, `${ON} 61 00 64 32 0f 06`])
    } finally {
      plugin.stop()
      await device.close()
    }
  })

  it('test de verbinding met alleen de statusvraag', async () => {
    const device = await fakeController()
    const plugin = new MagicHomePlugin(vi.fn())
    try {
      expect(await plugin.invoke('probe', device.host)).toEqual({
        ok: true,
        state: { model: 0xa1, on: true, effect: null, speed: 100, color: '#00ff00', firmware: 3 }
      })
      await vi.waitFor(() => expect(device.received).toEqual(['81 8a 8b 96']))
      expect(await plugin.invoke('probe', 'geen adres')).toMatchObject({ ok: false })
    } finally {
      await device.close()
    }
  })

  it('meldt een onbereikbare controller één keer', async () => {
    const device = await fakeController()
    const host = device.host
    await device.close()
    const notify = vi.fn()
    const plugin = new MagicHomePlugin(notify)
    const { quiz, state } = setup()
    plugin.configure({ host })
    plugin.update(quiz, state())
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1))
    plugin.update(quiz, state({ slideIndex: 1 }))
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][1]).toContain('weigert de verbinding')
    expect(await plugin.invoke('probe', host)).toMatchObject({ ok: false })
  })
})
