import { describe, expect, it, vi } from 'vitest'
import { createQuiz, createRound, createShowState, createSlide } from '@shared/factory'
import { setLight } from '@shared/light'
import type { ShowState } from '@shared/types'
import { command, fakeController } from '../../e2e/fake-magichome'
import { MagicHomePlugin } from './magichome'

const ON = command.on
const RED = command.color(0xff, 0, 0)
const GREEN = command.color(0, 0xff, 0)
const FLASH = command.effect(1, 50)

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
  it('stuurt tijdens de show het licht van de ronde en de slide, over één verbinding', async () => {
    const device = await fakeController()
    const notify = vi.fn()
    const plugin = new MagicHomePlugin(notify)
    const { quiz, state } = setup()
    try {
      plugin.configure({ host: device.host })
      plugin.update(quiz, { ...state(), live: false })
      plugin.update(quiz, state())
      await vi.waitFor(() => expect(device.log).toEqual([ON, RED]))

      // Zelfde licht: niets. Andere slide: zijn eigen effect.
      plugin.update(quiz, state())
      plugin.update(quiz, state({ slideIndex: 1 }))
      await vi.waitFor(() => expect(device.log).toEqual([ON, RED, ON, FLASH]))
      // De controller laat vallen wat hij nog niet verwerkt had als je meteen sluit; de
      // verbinding blijft dus open, en wordt hergebruikt.
      expect(device.stats.connections).toBe(1)
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
      await vi.waitFor(() => expect(device.log).toEqual([ON, RED, ON, FLASH]))
      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(device.log).toHaveLength(4)
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
      expect(device.log).toEqual([])
      expect(await plugin.invoke('probe', 'geen adres')).toMatchObject({ ok: false })
    } finally {
      await device.close()
    }
  })

  it('laat buiten de show een voorbeeld zien en zet daarna terug hoe het was', async () => {
    const device = await fakeController()
    const plugin = new MagicHomePlugin(vi.fn())
    const { quiz, state } = setup()
    try {
      plugin.configure({ host: device.host })
      expect(await plugin.invoke('preview', { type: 'color', color: '#ff0000' })).toEqual({
        ok: true
      })
      await vi.waitFor(() => expect(device.log).toEqual([ON, RED]))
      await plugin.invoke('preview', { type: 'effect', effect: 1, speed: 50 })
      await vi.waitFor(() => expect(device.log).toEqual([ON, RED, ON, FLASH]))

      // Voor het voorbeeld stond hij aan, in vast groen.
      await plugin.invoke('preview', null)
      expect(device.log.slice(-2)).toEqual([ON, GREEN])
      expect(device.stats.connections).toBe(1)

      // Tijdens de show bepaalt de show het licht.
      plugin.update(quiz, state())
      expect(await plugin.invoke('preview', { type: 'off' })).toMatchObject({ ok: false })
    } finally {
      plugin.stop()
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

    plugin.update(quiz, { ...state(), live: false })
    expect(await plugin.invoke('preview', { type: 'off' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('weigert de verbinding')
    })
    plugin.stop()
  })
})
