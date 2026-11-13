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
      timer: false,
      loop: null,
      sequence: null,
      fragments: [],
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

  it('zegt waar je staat in de taal van de Mac', () => {
    const { quiz, first, music, answers, live } = setup()
    const step = (patch: Partial<ShowState>) => remoteView(quiz, live(patch), [], 'en').step
    expect(step({ activeRoundId: first.id, slideIndex: 1 })?.label).toBe('Slide 2 of 2')
    expect(step({ activeRoundId: music.id, lastFragmentId: music.fragments[1].id })?.label).toBe(
      'Clip 2 of 3'
    )
    expect(
      step({
        activeRoundId: answers.id,
        answer: { roundId: answers.id, index: 0, revealed: false }
      })?.label
    ).toBe('Question 1, Ronde 1')
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

  it('geeft de taal van de Mac door, standaard Nederlands', () => {
    expect(remoteView(null, createShowState()).locale).toBe('nl')
    expect(remoteView(null, createShowState(), [], 'en').locale).toBe('en')
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

  it('noemt een ronde zonder titel "Naamloze ronde", ook bij vorige en volgende', () => {
    const { quiz, first, live } = setup()
    first.title = ''
    quiz.rounds[1].title = ' '
    const view = remoteView(quiz, live({ activeRoundId: first.id, lastRoundId: first.id }))
    expect(view.round?.title).toBe('Naamloze ronde')
    expect(view.nextRound).toBe('Naamloze ronde')
    expect(view.restartRound).toBe('Naamloze ronde')
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

  it('aftellen aan of uit is een stand, en kan alleen in een ronde', () => {
    const { quiz, first, live } = setup()
    const between = live()
    const inRound = live({ activeRoundId: first.id })
    const timing = live({
      activeRoundId: first.id,
      timer: { roundId: first.id, seconds: 30, until: 31_000 }
    })
    expect(remoteCommand(quiz, inRound, { type: 'timer', on: true })).toEqual({ type: 'timer' })
    expect(remoteCommand(quiz, between, { type: 'timer', on: true })).toBeNull()
    expect(remoteCommand(quiz, inRound, { type: 'timer', on: false })).toBeNull()
    expect(remoteCommand(quiz, timing, { type: 'timer', on: false })).toEqual({ type: 'timer' })
    expect(remoteCommand(quiz, timing, { type: 'timer', on: true })).toBeNull()
    expect(remoteView(quiz, timing).timer).toBe(true)
  })

  it('wisselen pauzeren of hervatten is een stand, en kan alleen in een ronde die wisselt', () => {
    const { quiz, first, live } = setup()
    first.slideLoopSeconds = 8
    const between = live()
    const inRound = live({ activeRoundId: first.id })
    const paused = live({ activeRoundId: first.id, loopPaused: true })
    expect(remoteView(quiz, inRound).loop).toEqual({ paused: false })
    expect(remoteView(quiz, paused).loop).toEqual({ paused: true })
    expect(remoteView(quiz, between).loop).toBeNull()
    expect(remoteCommand(quiz, inRound, { type: 'slideLoop', paused: true })).toEqual({
      type: 'slideLoop',
      paused: true
    })
    expect(remoteCommand(quiz, paused, { type: 'slideLoop', paused: false })).toEqual({
      type: 'slideLoop',
      paused: false
    })
    expect(remoteCommand(quiz, paused, { type: 'slideLoop', paused: true })).toBeNull()
    expect(remoteCommand(quiz, between, { type: 'slideLoop', paused: true })).toBeNull()
    first.slideLoopSeconds = null
    expect(remoteView(quiz, inRound).loop).toBeNull()
    expect(remoteCommand(quiz, inRound, { type: 'slideLoop', paused: true })).toBeNull()
  })

  it('de reeks en Fragmenten opnieuw, alleen in een ronde met fragmenten en als het kan', () => {
    const { quiz, first, music, live } = setup()
    const at = (autoplay: ShowState['autoplay']) => live({ activeRoundId: music.id, autoplay })
    const idle = at({ status: 'idle' })
    const playing = at({ status: 'playing', roundId: music.id, index: 0, holdAfter: false })
    const gap = at({ status: 'gap', roundId: music.id, nextIndex: 1, until: 5000 })
    const last = at({ status: 'playing', roundId: music.id, index: 2, holdAfter: true })
    const paused = at({ status: 'paused', roundId: music.id, nextIndex: 1, remainingMs: 0 })
    const elsewhere = at({ status: 'paused', roundId: first.id, nextIndex: 1, remainingMs: 0 })
    const status = (state: ShowState) => remoteView(quiz, state).sequence?.status
    expect(status(idle)).toBe('idle')
    expect(status(playing)).toBe('running')
    expect(status(gap)).toBe('running')
    expect(status(last)).toBe('paused')
    expect(status(paused)).toBe('paused')
    expect(status(elsewhere)).toBe('idle')
    expect(remoteView(quiz, live({ activeRoundId: first.id })).sequence).toBeNull()

    const command = (state: ShowState, action: 'start' | 'pause' | 'resume' | 'skip' | 'stop') =>
      remoteCommand(quiz, state, { type: 'sequence', action })
    expect(command(idle, 'start')).toEqual({ type: 'autoplay', action: 'start' })
    expect(command(playing, 'start')).toBeNull()
    expect(command(playing, 'pause')).toEqual({ type: 'autoplay', action: 'pause' })
    expect(command(paused, 'pause')).toBeNull()
    expect(command(paused, 'resume')).toEqual({ type: 'autoplay', action: 'resume' })
    expect(command(last, 'resume')).toEqual({ type: 'autoplay', action: 'resume' })
    expect(command(playing, 'resume')).toBeNull()
    expect(command(gap, 'skip')).toEqual({ type: 'autoplay', action: 'skip' })
    expect(command(paused, 'stop')).toEqual({ type: 'autoplay', action: 'stop' })
    expect(command(idle, 'stop')).toBeNull()
    expect(command(live({ activeRoundId: first.id }), 'start')).toBeNull()

    expect(remoteCommand(quiz, idle, { type: 'resetPlayed' })).toEqual({ type: 'resetPlayed' })
    expect(
      remoteCommand(quiz, live({ activeRoundId: first.id }), { type: 'resetPlayed' })
    ).toBeNull()
    expect(remoteCommand(quiz, live(), { type: 'resetPlayed' })).toBeNull()
  })

  it('één fragment kiezen: spelen of stoppen, alleen een fragment van de ronde die loopt', () => {
    const { quiz, first, music, live } = setup()
    const [one, two, three] = music.fragments
    const playing = {
      fragment: { key: 'k', roundId: music.id, fragmentId: two.id, startedAt: 0, duration: 10 },
      lastFragmentId: two.id,
      played: [one.id, two.id]
    }
    const state = live({ activeRoundId: music.id, ...playing })
    expect(remoteView(quiz, state).fragments).toEqual([
      { id: one.id, number: 1, label: 'Liedje 1', playing: false, played: true, upcoming: false },
      { id: two.id, number: 2, label: 'Liedje 2', playing: true, played: false, upcoming: false },
      { id: three.id, number: 3, label: 'Liedje 3', playing: false, played: false, upcoming: true }
    ])
    expect(remoteView(quiz, live({ activeRoundId: first.id })).fragments).toEqual([])
    expect(remoteView(quiz, live()).fragments).toEqual([])

    const pick = (s: ShowState, id: string, play: boolean) =>
      remoteCommand(quiz, s, { type: 'fragment', id, play })
    expect(pick(state, three.id, true)).toEqual({ type: 'playFragment', fragmentId: three.id })
    expect(pick(state, two.id, true)).toBeNull()
    expect(pick(state, two.id, false)).toEqual({ type: 'stopFragment' })
    expect(pick(state, three.id, false)).toBeNull()
    expect(pick(state, 'onbekend', true)).toBeNull()
    expect(pick(live({ activeRoundId: first.id }), one.id, true)).toBeNull()
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
