import { describe, expect, it } from 'vitest'
import { createShowState } from './factory'
import {
  findAssetUsages,
  findBrokenReferences,
  resolveAudio,
  resolveScreen,
  screenHasSound
} from './resolve'
import type { Quiz, ShowState } from './types'
import { SCHEMA_VERSION } from './version'

function makeQuiz(): Quiz {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'q',
    title: 'Test',
    folders: [],
    assets: [
      { id: 'loop', kind: 'video', file: 'media/loop.mp4', name: 'loop.mp4' },
      { id: 'loop2', kind: 'video', file: 'media/loop2.mp4', name: 'loop2.mp4' },
      { id: 'music', kind: 'video', file: 'media/music.mp4', name: 'music.mp4' },
      { id: 'logo', kind: 'image', file: 'media/logo.png', name: 'logo.png' },
      { id: 'bg', kind: 'audio', file: 'media/bg.m4a', name: 'bg.m4a' },
      { id: 'bg2', kind: 'audio', file: 'media/bg2.m4a', name: 'bg2.m4a' },
      { id: 'f1', kind: 'audio', file: 'media/f1.m4a', name: 'f1.m4a' },
      { id: 'f2', kind: 'audio', file: 'media/f2.m4a', name: 'f2.m4a' }
    ],
    screens: [
      { id: 'beamer', name: 'Beamer', default: { type: 'video', assetId: 'loop' } },
      { id: 'tv', name: 'TV bar', default: { type: 'image', assetId: 'logo' } }
    ],
    channels: [
      { id: 'zaal', name: 'Zaal', volume: 0.8 },
      { id: 'frag', name: 'Fragmenten', volume: 1 }
    ],
    background: { assetId: 'bg', channelId: 'zaal', volume: 0.5, duckTo: 0.2 },
    rounds: [
      {
        id: 'r1',
        title: 'Algemeen',
        screens: {},
        mutedScreens: [],
        fragmentScreens: [],
        answersFor: [],
        slideLoopSeconds: null,
        slides: [
          {
            id: 's1',
            layout: 'title',
            title: 'Ronde 1',
            targetScreens: 'all',
            backdrop: 'dim'
          },
          {
            id: 's2',
            layout: 'question',
            title: 'Vraag 1',
            targetScreens: ['tv'],
            backdrop: 'over-video'
          }
        ],
        background: 'continue',
        fragments: [],
        autoplay: { gapSeconds: 5, countdownOnScreen: true }
      },
      {
        id: 'r2',
        title: 'Muziek',
        screens: { beamer: { type: 'video', assetId: 'music' } },
        mutedScreens: [],
        fragmentScreens: ['beamer'],
        answersFor: [],
        slideLoopSeconds: null,
        slides: [],
        background: 'duck',
        fragments: [
          { id: 'fa', label: 'Fragment 1', assetId: 'f1', channelId: 'frag' },
          { id: 'fb', label: 'Fragment 2', assetId: 'f2', channelId: 'frag' }
        ],
        autoplay: { gapSeconds: 5, countdownOnScreen: true }
      },
      {
        id: 'r3',
        title: 'Stil',
        screens: { tv: { type: 'black' } },
        mutedScreens: [],
        fragmentScreens: [],
        answersFor: [],
        slideLoopSeconds: null,
        slides: [],
        background: { replaceAssetId: 'bg2' },
        fragments: [],
        autoplay: { gapSeconds: 0, countdownOnScreen: false }
      }
    ]
  }
}

function state(patch: Partial<ShowState> = {}): ShowState {
  return { ...createShowState(), live: true, ...patch }
}

describe('resolveScreen', () => {
  const quiz = makeQuiz()

  it('toont de standaard zonder actieve ronde', () => {
    expect(resolveScreen(quiz, state(), 'beamer').content).toEqual({
      type: 'video',
      assetId: 'loop'
    })
    expect(resolveScreen(quiz, state(), 'tv').content).toEqual({ type: 'image', assetId: 'logo' })
  })

  it('past de override van de actieve ronde toe, alleen op dat scherm', () => {
    const s = state({ activeRoundId: 'r2' })
    expect(resolveScreen(quiz, s, 'beamer').content).toEqual({ type: 'video', assetId: 'music' })
    expect(resolveScreen(quiz, s, 'tv').content).toEqual({ type: 'image', assetId: 'logo' })
  })

  it('valt na einde ronde terug naar de standaard', () => {
    const during = state({ activeRoundId: 'r2' })
    const after = { ...during, activeRoundId: null }
    expect(resolveScreen(quiz, during, 'beamer').content).toMatchObject({ assetId: 'music' })
    expect(resolveScreen(quiz, after, 'beamer').content).toMatchObject({ assetId: 'loop' })
  })

  it('geeft zwart voor een onbekend scherm', () => {
    expect(resolveScreen(quiz, state(), 'bestaat-niet').content).toEqual({ type: 'black' })
  })

  it('toont slides alleen op de doelschermen', () => {
    const first = state({ activeRoundId: 'r1', slideIndex: 0 })
    expect(resolveScreen(quiz, first, 'beamer').slide?.id).toBe('s1')
    expect(resolveScreen(quiz, first, 'tv').slide?.id).toBe('s1')

    const second = state({ activeRoundId: 'r1', slideIndex: 1 })
    expect(resolveScreen(quiz, second, 'beamer').slide).toBeNull()
    expect(resolveScreen(quiz, second, 'tv').slide?.id).toBe('s2')

    expect(resolveScreen(quiz, state({ activeRoundId: 'r1' }), 'tv').slide).toBeNull()
  })

  it('blackout overschrijft content, slide en overlay maar bewaart programContent', () => {
    const s = state({ activeRoundId: 'r1', slideIndex: 0, blackout: ['beamer'] })
    const beamer = resolveScreen(quiz, s, 'beamer')
    expect(beamer.content).toEqual({ type: 'black' })
    expect(beamer.programContent).toEqual({ type: 'video', assetId: 'loop' })
    expect(beamer.slide).toBeNull()
    expect(resolveScreen(quiz, s, 'tv').blackout).toBe(false)
  })

  it('laat videogeluid horen als de video een volume heeft', () => {
    const q = makeQuiz()
    q.screens[0].default = { type: 'video', assetId: 'loop', volume: 0.8 }
    expect(resolveScreen(q, state(), 'beamer').sound).toEqual({ gain: 0.8, ducked: false })
    // Zonder volume, niet live of op zwart: stil.
    expect(resolveScreen(makeQuiz(), state(), 'beamer').sound).toBeNull()
    expect(resolveScreen(q, state({ live: false }), 'beamer').sound).toBeNull()
    expect(resolveScreen(q, state({ blackout: ['beamer'] }), 'beamer').sound).toBeNull()
    // Een ronde met een andere video zonder geluid maakt het scherm stil.
    expect(resolveScreen(q, state({ activeRoundId: 'r2' }), 'beamer').sound).toBeNull()
  })

  it('een ronde kan het geluid van de standaardvideo uitzetten', () => {
    const q = makeQuiz()
    q.screens[0].default = { type: 'video', assetId: 'loop', volume: 0.8 }
    q.rounds[0].mutedScreens = ['beamer']
    const during = resolveScreen(q, state({ activeRoundId: 'r1' }), 'beamer')
    expect(during.content).toEqual(q.screens[0].default)
    expect(during.sound).toBeNull()
    expect(resolveScreen(q, state(), 'beamer').sound?.gain).toBe(0.8)
    // Met een eigen video in de ronde telt het geluid van die video.
    q.rounds[1].mutedScreens = ['beamer']
    q.rounds[1].screens['beamer'] = { type: 'video', assetId: 'music', volume: 1 }
    expect(resolveScreen(q, state({ activeRoundId: 'r2' }), 'beamer').sound?.gain).toBe(1)
  })

  it('duckt videogeluid tijdens een fragment en volgt de fader van het scherm', () => {
    const q = makeQuiz()
    q.screens[0].default = { type: 'video', assetId: 'loop', volume: 0.8 }
    const fragment = {
      key: 'k',
      roundId: 'r2',
      fragmentId: 'fa',
      startedAt: 0,
      duration: null
    }
    const ducked = resolveScreen(q, state({ fragment }), 'beamer').sound
    expect(ducked?.ducked).toBe(true)
    expect(ducked?.gain).toBeCloseTo(0.8 * 0.2)
    const fader = resolveScreen(q, state({ volumes: { beamer: 0.5 } }), 'beamer').sound
    expect(fader?.gain).toBeCloseTo(0.4)
  })

  it('weet welke schermen ergens geluid hebben', () => {
    const q = makeQuiz()
    expect(screenHasSound(q, 'beamer')).toBe(false)
    q.rounds[1].screens['beamer'] = { type: 'video', assetId: 'music', volume: 1 }
    expect(screenHasSound(q, 'beamer')).toBe(true)
    expect(screenHasSound(q, 'tv')).toBe(false)
  })

  it('toont fragmentnummer en countdown tijdens autoplay', () => {
    const playing = state({
      activeRoundId: 'r2',
      autoplay: { status: 'playing', roundId: 'r2', index: 1, holdAfter: false }
    })
    expect(resolveScreen(quiz, playing, 'beamer').overlay).toEqual({
      kind: 'fragment',
      number: 2,
      label: 'Fragment 2'
    })

    const gap = state({
      activeRoundId: 'r2',
      autoplay: { status: 'gap', roundId: 'r2', nextIndex: 1, until: 10_000 }
    })
    expect(resolveScreen(quiz, gap, 'beamer', 7_500).overlay).toEqual({
      kind: 'countdown',
      seconds: 3,
      nextNumber: 2,
      remaining: 0.5
    })
    // Alleen op de gekozen schermen.
    expect(resolveScreen(quiz, playing, 'tv').overlay).toBeNull()
    expect(resolveScreen(quiz, gap, 'tv', 7_500).overlay).toBeNull()
  })

  it('loopt in een antwoordenronde de fragmenten van een eerdere ronde langs', () => {
    const q = makeQuiz()
    q.rounds.push({
      ...q.rounds[0],
      id: 'ans',
      title: 'Antwoorden',
      answersFor: ['r2'],
      fragmentScreens: ['tv']
    })
    q.rounds[1].fragments[1].answer = 'Queen – Bohemian Rhapsody'
    const answering = (index: number, revealed: boolean) =>
      state({ activeRoundId: 'ans', slideIndex: 0, answer: { roundId: 'ans', index, revealed } })

    expect(resolveScreen(q, answering(1, false), 'tv').overlay).toEqual({
      kind: 'fragment',
      number: 2,
      label: 'Fragment 2',
      context: 'Muziek'
    })
    expect(resolveScreen(q, answering(1, true), 'tv').overlay).toEqual({
      kind: 'answer',
      number: 2,
      answer: 'Queen – Bohemian Rhapsody',
      round: 'Muziek',
      noun: 'fragment',
      placement: 'center'
    })
    // Zonder antwoord valt hij terug op de naam van het fragment.
    expect(resolveScreen(q, answering(0, true), 'tv').overlay).toMatchObject({
      answer: 'Fragment 1'
    })
    // De titelslide maakt plaats op het antwoordscherm, niet op de andere schermen.
    expect(resolveScreen(q, answering(1, true), 'tv').slide).toBeNull()
    expect(resolveScreen(q, answering(1, true), 'beamer').slide?.id).toBe('s1')
    expect(resolveScreen(q, answering(1, true), 'beamer').overlay).toBeNull()
  })

  it('loopt ook vragen en afbeeldingen langs: eerst de slide, dan het antwoord eronder', () => {
    const q = makeQuiz()
    q.rounds[0].slides[1].answer = 'Canberra'
    q.rounds.push({
      ...q.rounds[2],
      id: 'ans',
      title: 'Antwoorden',
      answersFor: ['r1', 'r2'],
      fragmentScreens: ['beamer']
    })
    const answering = (index: number, revealed: boolean) =>
      state({ activeRoundId: 'ans', answer: { roundId: 'ans', index, revealed } })

    // De vraag (in r1 alleen voor de TV) staat op het antwoordscherm, nog zonder antwoord. Ook
    // als de ronde zelf alleen het nummer toonde: bij de antwoorden staat de vraag erbij.
    q.rounds[0].slides[1].numberOnly = true
    const question = resolveScreen(q, answering(0, false), 'beamer')
    expect(question.slide?.id).toBe('s2')
    expect(question.slide?.numberOnly).toBe(false)
    expect(
      resolveScreen(q, state({ activeRoundId: 'r1', slideIndex: 1 }), 'tv').slide?.numberOnly
    ).toBe(true)
    expect(question.slideNumber).toBe(1)
    expect(question.overlay).toBeNull()

    expect(resolveScreen(q, answering(0, true), 'beamer').overlay).toEqual({
      kind: 'answer',
      number: 1,
      answer: 'Canberra',
      round: 'Algemeen',
      noun: 'vraag',
      placement: 'bottom'
    })
    // Met een eigen afbeelding bij het antwoord vervangt die de vraag, het antwoord staat eronder.
    q.rounds[0].slides[1].answerImageAssetId = 'logo'
    expect(resolveScreen(q, answering(0, false), 'beamer').slide?.id).toBe('s2')
    const withImage = resolveScreen(q, answering(0, true), 'beamer')
    expect(withImage.slide).toMatchObject({ layout: 'image', imageAssetId: 'logo' })
    expect(withImage.slideNumber).toBe(1)
    expect(withImage.overlay).toMatchObject({ answer: 'Canberra', placement: 'bottom' })

    // Daarna de fragmenten van de muziekronde: geen slide, wel het nummer.
    const fragment = resolveScreen(q, answering(1, false), 'beamer')
    expect(fragment.slide).toBeNull()
    expect(fragment.overlay).toMatchObject({ kind: 'fragment', number: 1, context: 'Muziek' })
  })

  it('toont het nummer ook bij een handmatig gestart fragment, alleen op de gekozen schermen', () => {
    const fragment = { key: 'k', roundId: 'r2', fragmentId: 'fb', startedAt: 0, duration: null }
    const manual = state({ activeRoundId: 'r2', fragment })
    expect(resolveScreen(quiz, manual, 'beamer').overlay).toEqual({
      kind: 'fragment',
      number: 2,
      label: 'Fragment 2'
    })
    expect(resolveScreen(quiz, manual, 'tv').overlay).toBeNull()
    // Afgelopen: het nummer verdwijnt.
    expect(resolveScreen(quiz, state({ activeRoundId: 'r2' }), 'beamer').overlay).toBeNull()
  })
})

describe('resolveAudio', () => {
  const quiz = makeQuiz()

  it('speelt niets als de show niet live is', () => {
    const audio = resolveAudio(quiz, state({ live: false }))
    expect(audio.background).toBeNull()
    expect(audio.fragment).toBeNull()
  })

  it('speelt de achtergrond op normaal volume', () => {
    expect(resolveAudio(quiz, state()).background).toEqual({
      assetId: 'bg',
      channelId: 'zaal',
      gain: 0.5,
      playing: true,
      ducked: false
    })
  })

  it('duckt tijdens een fragment en tijdens een duck-ronde', () => {
    const fragment = state({
      activeRoundId: 'r1',
      fragment: { key: 'k', roundId: 'r2', fragmentId: 'fa', startedAt: 0, duration: null }
    })
    expect(resolveAudio(quiz, fragment).background).toMatchObject({ gain: 0.1, ducked: true })
    expect(resolveAudio(quiz, fragment).fragment?.asset.id).toBe('f1')

    expect(resolveAudio(quiz, state({ activeRoundId: 'r2' })).background).toMatchObject({
      gain: 0.1,
      ducked: true
    })
  })

  it('vervangt de achtergrond in een ronde en herstelt hem daarna', () => {
    expect(resolveAudio(quiz, state({ activeRoundId: 'r3' })).background?.assetId).toBe('bg2')
    expect(resolveAudio(quiz, state({ activeRoundId: null })).background?.assetId).toBe('bg')
  })

  it('respecteert pauze-modus en handmatig uitzetten', () => {
    const paused = { ...quiz, rounds: [{ ...quiz.rounds[0], background: 'pause' as const }] }
    expect(resolveAudio(paused, state({ activeRoundId: 'r1' })).background?.playing).toBe(false)
    expect(resolveAudio(quiz, state({ backgroundEnabled: false })).background?.playing).toBe(false)
  })

  it('gebruikt runtime-volumes boven quiz-volumes', () => {
    const audio = resolveAudio(quiz, state({ volumes: { zaal: 0.3 } }))
    expect(audio.channelVolumes).toEqual({ zaal: 0.3, frag: 1 })
  })
})

describe('referenties', () => {
  it('vindt waar een asset gebruikt wordt', () => {
    const quiz = makeQuiz()
    expect(findAssetUsages(quiz, 'music')).toEqual(['Ronde "Muziek": scherm'])
    expect(findAssetUsages(quiz, 'bg')).toEqual(['Achtergrondmuziek'])
    expect(findAssetUsages(quiz, 'loop2')).toEqual([])
  })

  it('meldt ontbrekende media en kanalen', () => {
    const quiz = makeQuiz()
    expect(findBrokenReferences(quiz)).toEqual([])
    quiz.assets = quiz.assets.filter((a) => a.id !== 'f2')
    quiz.channels = quiz.channels.filter((c) => c.id !== 'frag')
    expect(findBrokenReferences(quiz)).toEqual([
      'Ronde "Muziek", Fragment 1: kanaal ontbreekt',
      'Ronde "Muziek", Fragment 2: media ontbreekt',
      'Ronde "Muziek", Fragment 2: kanaal ontbreekt'
    ])
    expect(findBrokenReferences(quiz, 'en')).toEqual([
      'Round "Muziek", Fragment 1: channel missing',
      'Round "Muziek", Fragment 2: media missing',
      'Round "Muziek", Fragment 2: channel missing'
    ])
  })
})
