import { describe, expect, it } from 'vitest'
import { createFragment, createQuiz, createRound, createShowState, createSlide } from './factory'
import type { Light } from './light'
import { remoteCommand, remoteView, RemoteActionSchema } from './remote'
import type { ShowState } from './types'

const RED: Light = { type: 'color', color: '#ff0000' }
const PARTY: Light = { type: 'effect', effect: 299, speed: 60 }

function setup() {
  const quiz = createQuiz('Kroegquiz')
  const first = createRound('normal', 1)
  first.slides.push({
    ...createSlide('question', 'Vraag 1'),
    body: 'Hoofdstad van Peru?',
    numberOnly: true,
    answer: 'Lima'
  })
  const music = createRound('music', 2)
  const channel = quiz.channels[1].id
  music.fragments = [1, 2, 3].map((n) => createFragment('a', channel, n, `Liedje ${n}`))
  quiz.rounds = [first, music]
  const answers = createRound('answers', 3, quiz)
  quiz.rounds.push(answers)
  const live = (patch: Partial<ShowState> = {}): ShowState => ({
    ...createShowState(),
    live: true,
    ...patch
  })
  return { quiz, first, music, answers, live }
}

describe('remoteView', () => {
  it('toont de ronde, de slide in beeld met de vraag, en waar je heen kunt', () => {
    const { quiz, first, live } = setup()
    const view = remoteView(
      quiz,
      live({ activeRoundId: first.id, lastRoundId: first.id, slideIndex: 1 })
    )
    expect(view).toMatchObject({
      quiz: 'Kroegquiz',
      live: true,
      round: { title: 'Ronde 1', number: 1 },
      rounds: 3,
      prevRound: null,
      nextRound: 'Ronde 2: muziek',
      restartRound: 'Ronde 1',
      step: {
        target: 'slides',
        label: 'Slide 2 van 2',
        text: 'Hoofdstad van Peru?',
        prev: true,
        next: false
      },
      screen: { slide: { id: first.slides[1].id, numberOnly: true }, number: 1 },
      screens: true,
      blackout: false,
      muted: false,
      plugins: []
    })
  })

  it('tussen twee rondes: geen stappen, en de vorige is de ronde van net', () => {
    const { quiz, first, live } = setup()
    const view = remoteView(quiz, live({ lastRoundId: first.id }))
    expect(view).toMatchObject({
      round: null,
      step: null,
      screen: null,
      prevRound: 'Ronde 1',
      nextRound: 'Ronde 2: muziek',
      restartRound: 'Ronde 1'
    })
  })

  it('in een muziekronde bladeren vorige en volgende door de fragmenten', () => {
    const { quiz, music, live } = setup()
    const round = { activeRoundId: music.id, slideIndex: 0 }
    expect(remoteView(quiz, live(round)).step).toMatchObject({
      target: 'fragments',
      label: '3 fragmenten',
      text: null,
      prev: false,
      next: true
    })
    const second = music.fragments[1]
    const playing = live({
      ...round,
      lastFragmentId: second.id,
      fragment: { key: 'k', roundId: music.id, fragmentId: second.id, startedAt: 0, duration: 10 }
    })
    expect(remoteView(quiz, playing)).toMatchObject({
      step: { label: 'Fragment 2 van 3', text: 'Liedje 2', playing: true, prev: true, next: true },
      screen: { slide: { layout: 'title', title: 'Ronde 2' } }
    })
  })

  it('in een antwoordenronde lopen ze de antwoorden langs, met het antwoord zodra het in beeld is', () => {
    const { quiz, answers, live } = setup()
    const at = (index: number, revealed: boolean) =>
      remoteView(
        quiz,
        live({ activeRoundId: answers.id, answer: { roundId: answers.id, index, revealed } })
      ).step
    expect(at(0, false)).toMatchObject({
      target: 'answers',
      label: 'Vraag 1, Ronde 1',
      text: 'Hoofdstad van Peru?',
      answer: null
    })
    expect(at(0, true)).toMatchObject({ answer: 'Lima', next: true })
    expect(at(3, true)).toMatchObject({
      label: 'Fragment 3, Ronde 2: muziek',
      answer: 'Liedje 3',
      next: false
    })
  })

  it('de preview toont de slide ook als het beeld op zwart staat', () => {
    const { quiz, first, live } = setup()
    const beamer = quiz.screens[0].id
    const view = remoteView(
      quiz,
      live({
        activeRoundId: first.id,
        slideIndex: 0,
        blackout: [beamer],
        backgroundEnabled: false
      })
    )
    expect(view).toMatchObject({
      blackout: true,
      muted: true,
      screen: { slide: { title: 'Ronde 1' } }
    })
  })

  it('geeft de plug-ins voor de telefoon door, maar niet zonder quiz', () => {
    const { quiz, live } = setup()
    const plugins = [
      { id: 'magichome' as const, status: { light: PARTY, manual: true, quiz: [RED, PARTY] } }
    ]
    expect(remoteView(quiz, live(), plugins).plugins).toEqual(plugins)
    expect(remoteView(null, live(), plugins).plugins).toEqual([])
  })

  it('zonder quiz', () => {
    expect(remoteView(null, createShowState())).toMatchObject({
      quiz: null,
      live: false,
      rounds: 0,
      step: null,
      screen: null,
      screens: false,
      blackout: false
    })
  })
})

describe('remoteCommand', () => {
  it('vorige en volgende doen wat ← → op de Mac doen', () => {
    const { quiz, first, music, answers, live } = setup()
    const next = { type: 'step', direction: 'next' } as const
    expect(remoteCommand(quiz, live({ activeRoundId: first.id }), next)).toEqual({
      type: 'nextSlide'
    })
    expect(remoteCommand(quiz, live({ activeRoundId: music.id }), next)).toEqual({
      type: 'stepFragment',
      direction: 'next'
    })
    expect(remoteCommand(quiz, live({ activeRoundId: answers.id }), next)).toEqual({
      type: 'answers',
      action: 'next'
    })
  })

  it('vertaalt de andere knoppen naar opdrachten voor de show', () => {
    const { quiz } = setup()
    const state = createShowState()
    expect(remoteCommand(quiz, state, { type: 'round', direction: 'prev' })).toEqual({
      type: 'prevRound'
    })
    expect(remoteCommand(quiz, state, { type: 'restartRound' })).toEqual({ type: 'restartRound' })
    expect(remoteCommand(quiz, state, { type: 'endRound' })).toEqual({ type: 'endRound' })
    expect(remoteCommand(quiz, state, { type: 'blackout', on: true })).toEqual({
      type: 'blackout',
      on: true
    })
    expect(
      remoteCommand(quiz, state, { type: 'plugin', id: 'magichome', action: 'choose', input: RED })
    ).toBeNull()
  })

  it('geluid aan of uit is een stand, geen wissel', () => {
    const { quiz } = setup()
    const on = createShowState()
    const off = { ...on, backgroundEnabled: false }
    expect(remoteCommand(quiz, on, { type: 'mute', on: true })).toEqual({ type: 'stopAll' })
    expect(remoteCommand(quiz, off, { type: 'mute', on: false })).toEqual({
      type: 'toggleBackground'
    })
    expect(remoteCommand(quiz, on, { type: 'mute', on: false })).toBeNull()
  })

  it('weigert onbekende acties', () => {
    expect(RemoteActionSchema.safeParse({ type: 'stopShow' }).success).toBe(false)
    expect(RemoteActionSchema.safeParse({ type: 'slide', direction: 'next' }).success).toBe(false)
    expect(RemoteActionSchema.safeParse({ type: 'light', light: null }).success).toBe(false)
    expect(RemoteActionSchema.safeParse({ type: 'plugin', id: 'magichome' }).success).toBe(false)
    expect(
      RemoteActionSchema.safeParse({
        type: 'plugin',
        id: 'magichome',
        action: 'choose',
        input: null
      }).success
    ).toBe(true)
  })
})
