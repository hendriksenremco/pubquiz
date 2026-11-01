import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createQuiz, createRound, createShowState, createSlide } from './factory'
import { definePlugin, pluginConfig, pluginData, resolvePluginData, setPluginData } from './plugin'
import { configOf } from './plugins'
import type { ShowState } from './types'

const PLAYLIST = definePlugin({
  id: 'proef',
  name: 'Proef',
  description: 'Alleen voor de tests.',
  config: z.object({ volume: z.number().catch(50).default(50) }).catch({ volume: 50 }),
  data: z.object({ playlist: z.string() })
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
    const bare = definePlugin({ id: 'kaal', name: '', description: '', config: z.object({}) })
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
