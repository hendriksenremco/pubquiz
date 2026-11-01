import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createQuiz, createRound, createShowState, createSlide } from './factory'
import { MAGICHOME } from './light'
import {
  action,
  definePlugin,
  parseAction,
  pluginConfig,
  pluginData,
  resolvePluginData,
  setPluginData,
  typeOnly
} from './plugin'
import { configOf } from './plugins'
import type { ShowState } from './types'

const PLAYLIST = definePlugin({
  id: 'proef',
  text: {
    nl: { name: 'Proef', description: 'Alleen voor de tests.' },
    en: { name: 'Test', description: 'Only for the tests.' }
  },
  config: z.object({ volume: z.number().catch(50).default(50) }).catch({ volume: 50 }),
  data: z.object({ playlist: z.string() }),
  status: typeOnly<{ playing: boolean }>(),
  actions: {
    play: action<{ ok: boolean }>()(z.object({ track: z.number().int() })),
    stop: action<null>()(z.undefined())
  },
  remoteActions: ['stop']
})

function setup() {
  const quiz = createQuiz('Test')
  const round = createRound('normal', 1)
  round.slides = [createSlide('title', 'Ronde 1'), createSlide('question', 'Vraag 1')]
  quiz.rounds = [round, createRound('normal', 2)]
  const at = (patch: Partial<ShowState> = {}): ShowState => ({
    ...createShowState(),
    live: true,
    activeRoundId: round.id,
    slideIndex: 0,
    ...patch
  })
  return { quiz, round, at }
}

describe('pluginData', () => {
  it('leest de gegevens van de plug-in', () => {
    const { round } = setup()
    round.plugins = { proef: { playlist: 'rock' }, ander: { x: 1 } }
    expect(pluginData(PLAYLIST, round)).toEqual({ playlist: 'rock' })
  })

  it('ongeldige of ontbrekende gegevens tellen als niets', () => {
    const { round } = setup()
    expect(pluginData(PLAYLIST, round)).toBeUndefined()
    expect(pluginData(PLAYLIST, null)).toBeUndefined()
    round.plugins = { proef: { playlist: 3 } }
    expect(pluginData(PLAYLIST, round)).toBeUndefined()
    round.plugins = { proef: 'rock' }
    expect(pluginData(PLAYLIST, round)).toBeUndefined()
  })

  it('zonder schema voor gegevens is er niets', () => {
    const { round } = setup()
    const bare = definePlugin({
      id: 'kaal',
      text: { nl: { name: '', description: '' }, en: { name: '', description: '' } },
      config: z.object({}),
      status: typeOnly<null>(),
      actions: {}
    })
    round.plugins = { kaal: { x: 1 } }
    expect(pluginData(bare, round)).toBeUndefined()
  })
})

describe('setPluginData', () => {
  it('laat andere plug-ins staan en ruimt `plugins` op als het leeg is', () => {
    const { quiz, round } = setup()
    round.plugins = { ander: { x: 1 } }
    setPluginData(PLAYLIST, round, { playlist: 'rock' })
    expect(round.plugins).toEqual({ ander: { x: 1 }, proef: { playlist: 'rock' } })
    setPluginData(PLAYLIST, round, undefined)
    expect(round.plugins).toEqual({ ander: { x: 1 } })

    setPluginData(PLAYLIST, quiz, { playlist: 'pop' })
    setPluginData(PLAYLIST, quiz, undefined)
    expect('plugins' in quiz).toBe(false)
  })
})

describe('resolvePluginData', () => {
  it('slide gaat voor ronde, ronde voor de quiz', () => {
    const { quiz, round, at } = setup()
    setPluginData(PLAYLIST, quiz, { playlist: 'quiz' })
    setPluginData(PLAYLIST, round, { playlist: 'ronde' })
    setPluginData(PLAYLIST, round.slides[1], { playlist: 'slide' })

    expect(resolvePluginData(PLAYLIST, quiz, at())).toEqual({ playlist: 'ronde' })
    expect(resolvePluginData(PLAYLIST, quiz, at({ slideIndex: 1 }))).toEqual({ playlist: 'slide' })
    expect(resolvePluginData(PLAYLIST, quiz, at({ slideIndex: -1 }))).toEqual({ playlist: 'ronde' })
    expect(resolvePluginData(PLAYLIST, quiz, at({ activeRoundId: quiz.rounds[1].id }))).toEqual({
      playlist: 'quiz'
    })
    expect(resolvePluginData(PLAYLIST, quiz, at({ activeRoundId: null }))).toEqual({
      playlist: 'quiz'
    })
  })

  it('slaat ongeldige gegevens over en valt terug op de volgende plek', () => {
    const { quiz, round, at } = setup()
    setPluginData(PLAYLIST, quiz, { playlist: 'quiz' })
    round.plugins = { proef: { playlist: 42 } }
    round.slides[0].plugins = { proef: null }
    expect(resolvePluginData(PLAYLIST, quiz, at())).toEqual({ playlist: 'quiz' })
  })

  it('niets als nergens iets staat', () => {
    const { quiz, at } = setup()
    expect(resolvePluginData(PLAYLIST, quiz, at())).toBeUndefined()
  })
})

describe('pluginConfig', () => {
  it('ongeldige instellingen worden de standaard', () => {
    expect(pluginConfig(PLAYLIST, { volume: 80 })).toEqual({ volume: 80 })
    expect(pluginConfig(PLAYLIST, { volume: 'hard' })).toEqual({ volume: 50 })
    expect(pluginConfig(PLAYLIST, undefined)).toEqual({ volume: 50 })
    expect(pluginConfig(PLAYLIST, 'onzin')).toEqual({ volume: 50 })
  })

  it('de echte plug-ins: adres van de controller en sleutel van de afstandsbediening', () => {
    expect(configOf({}, 'magichome')).toEqual({ host: '' })
    expect(configOf({ magichome: { enabled: true, config: { host: 7 } } }, 'magichome')).toEqual({
      host: ''
    })
    expect(
      configOf({ magichome: { enabled: true, config: { host: '10.0.0.5' } } }, 'magichome')
    ).toEqual({ host: '10.0.0.5' })

    const key = 'k'.repeat(22)
    expect(configOf({ remote: { enabled: true, config: { key } } }, 'remote')).toEqual({ key })
    expect(configOf({ remote: { enabled: true, config: { key: 'kort' } } }, 'remote').key).toBe(
      undefined
    )
    expect(configOf({}, 'remote').key).toBeUndefined()
  })
})

describe('parseAction', () => {
  it('geeft de gecontroleerde invoer van een bekende actie', () => {
    expect(parseAction(PLAYLIST, 'play', { track: 3, extra: true })).toEqual({
      input: { track: 3 }
    })
    expect(parseAction(PLAYLIST, 'stop', undefined)).toEqual({ input: undefined })
  })

  it('weigert een onbekende actie of foute invoer', () => {
    expect(parseAction(PLAYLIST, 'pause', undefined)).toBeNull()
    expect(parseAction(PLAYLIST, 'toString', undefined)).toBeNull()
    expect(parseAction(PLAYLIST, 'play', { track: 'drie' })).toBeNull()
    expect(parseAction(PLAYLIST, 'stop', { track: 1 })).toBeNull()
  })

  it('weigert vanaf de telefoon wat niet in remoteActions staat', () => {
    expect(parseAction(PLAYLIST, 'stop', undefined, 'remote')).toEqual({ input: undefined })
    expect(parseAction(PLAYLIST, 'play', { track: 3 }, 'remote')).toBeNull()
    expect(parseAction(PLAYLIST, 'play', { track: 3 }, 'app')).toEqual({ input: { track: 3 } })
  })

  it('zonder remoteActions mag de telefoon niets', () => {
    const quiet = definePlugin({
      id: 'stil',
      text: { nl: { name: '', description: '' }, en: { name: '', description: '' } },
      config: z.object({}),
      status: typeOnly<null>(),
      actions: { go: action<null>()(z.undefined()) }
    })
    expect(parseAction(quiet, 'go', undefined, 'remote')).toBeNull()
    expect(parseAction(quiet, 'go', undefined)).toEqual({ input: undefined })
  })

  it('de telefoon mag bij MagicHome alleen het licht kiezen', () => {
    const red = { type: 'color', color: '#ff0000' }
    expect(parseAction(MAGICHOME, 'choose', red, 'remote')).toEqual({ input: red })
    expect(parseAction(MAGICHOME, 'preview', red, 'remote')).toBeNull()
    expect(parseAction(MAGICHOME, 'probe', '10.0.0.1', 'remote')).toBeNull()
  })
})
