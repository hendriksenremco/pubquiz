import { describe, expect, it } from 'vitest'
import { createFragment, createQuiz, createRound, createShowState, createSlide } from './factory'
import type { Light } from './light'
import { remoteCommand, remoteStep, remoteView, RemoteActionSchema } from './remote'
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

describe('remoteStep', () => {
  it('noemt → in een antwoordenronde naar wat hij doet, zoals AnswersPad', () => {
    const { quiz, answers, live } = setup()
    const at = (answer: ShowState['answer'], locale: 'nl' | 'en' = 'nl') =>
      remoteStep(quiz, answers, live({ activeRoundId: answers.id, answer }), locale).names
    expect(at(null)).toEqual(['Vorige stap', 'Start antwoorden'])
    expect(at({ roundId: answers.id, index: 0, revealed: false })).toEqual([
      'Vorige stap',
      'Toon antwoord'
    ])
    expect(at({ roundId: answers.id, index: 0, revealed: true })[1]).toBe('Volgend fragment')
    expect(at({ roundId: answers.id, index: 0, revealed: true }, 'en')[1]).toBe('Next clip')
    expect(at({ roundId: answers.id, index: 3, revealed: true })[1]).toBe('Volgende stap')
  })

  it('noemt ← en → anders naar slides of fragmenten', () => {
    const { quiz, first, music, live } = setup()
    expect(remoteStep(quiz, first, live()).names).toEqual(['Vorige slide', 'Volgende slide'])
    expect(remoteStep(quiz, music, live(), 'en').names).toEqual(['Previous clip', 'Next clip'])
  })
})

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
      notes: null,
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
      timer: null,
      loop: null,
      sequence: null,
      fragments: [],
      answering: false,
      answers: [],
      plugins: []
    })
  })

  it('geeft de notities van de ronde die loopt mee, zoals onder de rondes op de Mac', () => {
    const { quiz, first, live } = setup()
    first.hostNotes = '  Let op: vraag 3 is een strikvraag.\n'
    expect(remoteView(quiz, live({ activeRoundId: first.id })).notes).toBe(
      'Let op: vraag 3 is een strikvraag.'
    )
    expect(remoteView(quiz, live({ lastRoundId: first.id })).notes).toBeNull()
    first.hostNotes = '   '
    expect(remoteView(quiz, live({ activeRoundId: first.id })).notes).toBeNull()
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
    expect(remoteView(quiz, timing).timer).toEqual({ seconds: 30, until: 31_000 })
    expect(remoteView(quiz, inRound).timer).toBeNull()
  })

  it('wisselen pauzeren of hervatten is een stand, en kan alleen in een ronde die wisselt', () => {
    const { quiz, first, live } = setup()
    first.slideLoopSeconds = 8
    const between = live()
    const inRound = live({ activeRoundId: first.id })
    const paused = live({ activeRoundId: first.id, loopPaused: true })
    const counting = live({ activeRoundId: first.id, slideIndex: 1, loopUntil: 5000 })
    expect(remoteView(quiz, inRound).loop).toEqual({ paused: false, seconds: 8, until: null })
    expect(remoteView(quiz, paused).loop).toEqual({ paused: true, seconds: 8, until: null })
    expect(remoteView(quiz, counting).loop).toEqual({ paused: false, seconds: 8, until: 5000 })
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

    // Wat er naast Fragmenten staat, zoals op de Mac.
    music.autoplay.gapSeconds = 5
    const stepOf = (state: ShowState) => remoteView(quiz, state).sequence?.step
    expect(stepOf(idle)).toBeNull()
    expect(stepOf(elsewhere)).toBeNull()
    expect(stepOf(playing)).toEqual({ kind: 'playing', number: 1 })
    expect(stepOf(last)).toEqual({ kind: 'last', number: 3 })
    expect(stepOf(gap)).toEqual({ kind: 'gap', number: 2, until: 5000, seconds: 5 })
    expect(stepOf(paused)).toEqual({ kind: 'paused', number: 2 })

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
    two.answer = 'Artiest 2'
    three.answer = ''
    const playing = {
      fragment: { key: 'k', roundId: music.id, fragmentId: two.id, startedAt: 0, duration: 10 },
      lastFragmentId: two.id,
      played: [one.id, two.id]
    }
    const state = live({ activeRoundId: music.id, ...playing })
    expect(remoteView(quiz, state).fragments).toEqual([
      {
        id: one.id,
        number: 1,
        label: 'Liedje 1',
        answer: null,
        playing: false,
        ends: null,
        played: true,
        upcoming: false
      },
      {
        id: two.id,
        number: 2,
        label: 'Liedje 2',
        answer: 'Artiest 2',
        playing: true,
        ends: { at: 10000, seconds: 10 },
        played: false,
        upcoming: false
      },
      {
        id: three.id,
        number: 3,
        label: 'Liedje 3',
        answer: null,
        playing: false,
        ends: null,
        played: false,
        upcoming: true
      }
    ])
    // De lengte is nog niet bekend: dan geen resterende tijd, alleen Speelt.
    const unknown = live({
      activeRoundId: music.id,
      ...playing,
      fragment: { ...playing.fragment, duration: null }
    })
    expect(remoteView(quiz, unknown).fragments[1].ends).toBeNull()
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

  it('één slide kiezen, of Geen slide, zoals bij Slides op de Mac', () => {
    const { quiz, first, music, live } = setup()
    const [title, question] = first.slides
    first.slides.push(createSlide('image'), { ...createSlide('number'), title: '2' })
    const state = live({ activeRoundId: first.id, slideIndex: 1 })
    expect(remoteView(quiz, state).slides).toEqual([
      { id: title.id, label: 'Ronde 1', on: false },
      { id: question.id, label: 'Vraag 1', on: true },
      { id: first.slides[2].id, label: 'Afbeelding 2', on: false },
      { id: first.slides[3].id, label: 'Nummer 2', on: false }
    ])
    expect(remoteView(quiz, state, [], 'en').slides[2].label).toBe('Picture 2')
    expect(remoteView(quiz, live({ activeRoundId: first.id })).slides.some((s) => s.on)).toBe(false)
    expect(remoteView(quiz, live()).slides).toEqual([])

    const pick = (s: ShowState, index: number) => remoteCommand(quiz, s, { type: 'slide', index })
    expect(pick(state, 0)).toEqual({ type: 'setSlide', index: 0 })
    expect(pick(state, -1)).toEqual({ type: 'setSlide', index: -1 })
    expect(pick(state, 1)).toBeNull()
    expect(pick(state, 4)).toBeNull()
    expect(pick(live(), 0)).toBeNull()
    music.slides = []
    expect(pick(live({ activeRoundId: music.id }), -1)).toBeNull()
    expect(RemoteActionSchema.safeParse({ type: 'slide', index: -2 }).success).toBe(false)
    expect(RemoteActionSchema.safeParse({ type: 'slide', index: 1.5 }).success).toBe(false)
  })

  it('elke ronde starten, zoals in de lijst Rondes op de Mac', () => {
    const { quiz, first, music, answers, live } = setup()
    const state = live({ activeRoundId: first.id, lastRoundId: first.id })
    expect(remoteView(quiz, state).roundList).toEqual([
      { id: first.id, number: 1, title: 'Ronde 1', on: true, next: false },
      { id: music.id, number: 2, title: 'Ronde 2: muziek', on: false, next: true },
      { id: answers.id, number: 3, title: answers.title, on: false, next: false }
    ])
    // Tussen twee rondes is de ronde na die van net de volgende.
    const between = live({ lastRoundId: music.id })
    expect(remoteView(quiz, between).roundList.map((r) => [r.on, r.next])).toEqual([
      [false, false],
      [false, false],
      [false, true]
    ])
    expect(remoteView(null, createShowState()).roundList).toEqual([])

    const start = (s: ShowState, id: string) => remoteCommand(quiz, s, { type: 'startRound', id })
    expect(start(state, answers.id)).toEqual({ type: 'startRound', roundId: answers.id })
    expect(start(between, first.id)).toEqual({ type: 'startRound', roundId: first.id })
    expect(start(state, first.id)).toBeNull()
    expect(start(state, 'onbekend')).toBeNull()
  })

  it('één scherm op zwart of terug, zoals onder elk scherm op de Mac', () => {
    const { quiz, live } = setup()
    const [beamer] = quiz.screens
    expect(remoteView(quiz, live()).screenList).toEqual([])
    quiz.screens.push({ ...beamer, id: 'tv', name: 'Tv bar' })
    const state = live({ blackout: ['tv'] })
    expect(remoteView(quiz, state).screenList).toEqual([
      { id: beamer.id, name: beamer.name, black: false },
      { id: 'tv', name: 'Tv bar', black: true }
    ])
    expect(remoteView(quiz, state).blackout).toBe(false)

    const black = (screenId: string, on: boolean) =>
      remoteCommand(quiz, state, { type: 'blackout', screenId, on })
    expect(black(beamer.id, true)).toEqual({ type: 'blackout', screenId: beamer.id, on: true })
    expect(black('tv', false)).toEqual({ type: 'blackout', screenId: 'tv', on: false })
    expect(black('tv', true)).toBeNull()
    expect(black(beamer.id, false)).toBeNull()
    expect(black('onbekend', true)).toBeNull()
  })

  it('Stop antwoorden: alleen als er een stap van deze antwoordenronde in beeld staat', () => {
    const { quiz, first, answers, live } = setup()
    const showing = live({
      activeRoundId: answers.id,
      answer: { roundId: answers.id, index: 1, revealed: true }
    })
    const before = live({ activeRoundId: answers.id })
    expect(remoteView(quiz, showing).answering).toBe(true)
    expect(remoteView(quiz, before).answering).toBe(false)
    expect(remoteView(quiz, live({ activeRoundId: first.id })).answering).toBe(false)

    const stop = { type: 'stopAnswers' } as const
    expect(remoteCommand(quiz, showing, stop)).toEqual({ type: 'answers', action: 'stop' })
    expect(remoteCommand(quiz, before, stop)).toBeNull()
    expect(remoteCommand(quiz, live({ activeRoundId: first.id }), stop)).toBeNull()
  })

  it('meldt een antwoordenronde zonder scherm voor de antwoorden, zoals Niet in beeld op de Mac', () => {
    const { quiz, first, answers, live } = setup()
    const state = live({ activeRoundId: answers.id })
    expect(answers.fragmentScreens.length).toBeGreaterThan(0)
    expect(remoteView(quiz, state).answersOffScreen).toBe(false)
    answers.fragmentScreens = []
    expect(remoteView(quiz, state).answersOffScreen).toBe(true)
    // Een gewone ronde zonder scherm voor de antwoorden heeft geen Antwoorden.
    first.fragmentScreens = []
    expect(remoteView(quiz, live({ activeRoundId: first.id })).answersOffScreen).toBe(false)
    expect(remoteView(quiz, live()).answersOffScreen).toBe(false)
  })

  it('geeft een antwoord de afbeelding van zijn slide, zoals het tegeltje op de Mac', () => {
    const { quiz, first, answers, live } = setup()
    const state = live({ activeRoundId: answers.id })
    const question = first.slides[1]
    const image = (kind: 'image' | 'video') => {
      const asset = { id: `${kind}-1`, kind, file: `media/${kind}`, name: kind }
      quiz.assets.push(asset)
      return asset.id
    }
    question.imageAssetId = image('image')
    expect(remoteView(quiz, state).answers[0].image).toBe('image-1')
    // Een video haalt de telefoon niet op; een id dat niet bestaat ook niet.
    question.imageAssetId = image('video')
    expect(remoteView(quiz, state).answers[0].image).toBeNull()
    question.imageAssetId = 'weg'
    expect(remoteView(quiz, state).answers[0].image).toBeNull()
  })

  it('één antwoord kiezen: in beeld zetten, dan het antwoord tonen of verbergen', () => {
    const { quiz, first, music, answers, live } = setup()
    const [one, two] = music.fragments
    const question = first.slides[1]
    const state = live({
      activeRoundId: answers.id,
      answer: { roundId: answers.id, index: 1, revealed: false },
      fragment: { key: 'k', roundId: answers.id, fragmentId: two.id, startedAt: 0, duration: 10 },
      answered: [question.id, one.id]
    })
    const list = remoteView(quiz, state).answers
    expect(list.map((a) => [a.round, a.number, a.noun, a.answer, a.state, a.on])).toEqual([
      ['Ronde 1', 1, 'vraag', 'Lima', 'done', false],
      ['Ronde 2: muziek', 1, 'fragment', '', 'shown', true],
      ['Ronde 2: muziek', 2, 'fragment', '', 'playing', false],
      ['Ronde 2: muziek', 3, 'fragment', '', null, false]
    ])
    // Het fragment in beeld speelt opnieuw: dan staat er Speelt, maar hij blijft in beeld.
    const replay = { ...state, fragment: { ...state.fragment!, fragmentId: one.id } }
    expect(remoteView(quiz, replay).answers[1]).toMatchObject({ state: 'playing', on: true })
    const revealed = live({
      activeRoundId: answers.id,
      answer: { roundId: answers.id, index: 0, revealed: true }
    })
    expect(remoteView(quiz, revealed).answers[0]).toMatchObject({
      state: 'answer',
      on: true,
      revealed: true
    })
    // De vraag zelf staat erbij, zoals op de Mac; een fragment heeft er geen.
    expect(list.map((a) => a.question)).toEqual(['Hoofdstad van Peru?', null, null, null])
    // Geen afbeelding bij deze vragen en fragmenten.
    expect(list.map((a) => a.image)).toEqual([null, null, null, null])
    expect(remoteView(quiz, live({ activeRoundId: first.id })).answers).toEqual([])
    expect(remoteView(quiz, live()).answers).toEqual([])

    const pick = (s: ShowState, id: string, revealed: boolean) =>
      remoteCommand(quiz, s, { type: 'answer', id, revealed })
    // Een andere vraag: eerst zonder antwoord; twee keer tikken mag.
    expect(pick(state, question.id, false)).toEqual({ type: 'answerAt', index: 0 })
    expect(pick(state, question.id, true)).toBeNull()
    // De vraag in beeld: het antwoord tonen, of weer verbergen.
    expect(pick(state, one.id, true)).toEqual({ type: 'answerAt', index: 1 })
    expect(pick(state, one.id, false)).toBeNull()
    expect(pick(revealed, question.id, false)).toEqual({ type: 'answerAt', index: 0 })
    expect(pick(revealed, question.id, true)).toBeNull()
    expect(pick(state, 'onbekend', false)).toBeNull()
    expect(pick(live({ activeRoundId: first.id }), question.id, false)).toBeNull()
  })

  it('Geluid: de muziek, haar stand en het volume per kanaal en scherm met videogeluid', () => {
    const { quiz, first, music, live } = setup()
    const [room, clips] = quiz.channels
    const [beamer] = quiz.screens
    expect(remoteView(quiz, live()).sound).toEqual({
      music: null,
      levels: [
        { id: room.id, name: room.name, kind: 'channel', volume: room.volume, status: null },
        { id: clips.id, name: clips.name, kind: 'channel', volume: clips.volume, status: null }
      ]
    })
    expect(remoteView(null, createShowState()).sound).toBeNull()

    quiz.assets.push(
      { id: 'bg', kind: 'audio', file: 'media/bg.mp3', name: 'Kroegmuziek.mp3' },
      { id: 'clip', kind: 'video', file: 'media/clip.mp4', name: 'Loop.mp4' }
    )
    quiz.background = { assetId: 'bg', channelId: room.id, volume: 0.8, duckTo: 0.3 }
    beamer.default = { type: 'video', assetId: 'clip', volume: 1 }
    const state = live({ volumes: { [room.id]: 0.5 } })
    const sound = remoteView(quiz, state).sound!
    expect(sound.music).toEqual({ name: 'Kroegmuziek.mp3', status: 'playing' })
    expect(sound.levels.map((l) => [l.id, l.kind, l.volume, l.status])).toEqual([
      [room.id, 'channel', 0.5, null],
      [clips.id, 'channel', clips.volume, null],
      [beamer.id, 'screen', 1, null]
    ])

    // Een fragment speelt: muziek en videogeluid zachter. Uitgezet: Uit.
    const fragment = {
      key: 'k',
      roundId: music.id,
      fragmentId: music.fragments[0].id,
      startedAt: 0,
      duration: 10
    }
    const playing = live({ activeRoundId: first.id, fragment })
    expect(remoteView(quiz, playing).sound!.music!.status).toBe('ducked')
    expect(remoteView(quiz, playing).sound!.levels[2].status).toBe('ducked')
    expect(remoteView(quiz, live({ backgroundEnabled: false })).sound!.music!.status).toBe('off')

    // Muziek aan of uit is een stand; zonder muziek in de quiz kan het niet.
    expect(remoteCommand(quiz, state, { type: 'music', on: false })).toEqual({
      type: 'toggleBackground'
    })
    expect(remoteCommand(quiz, state, { type: 'music', on: true })).toBeNull()
    const off = live({ backgroundEnabled: false })
    expect(remoteCommand(quiz, off, { type: 'music', on: true })).toEqual({
      type: 'toggleBackground'
    })

    // Volume: alleen van een kanaal of een scherm met videogeluid, en alleen als het verandert.
    const volume = (id: string, v: number) =>
      remoteCommand(quiz, state, { type: 'volume', id, volume: v })
    expect(volume(clips.id, 0.4)).toEqual({ type: 'setVolume', id: clips.id, volume: 0.4 })
    expect(volume(beamer.id, 0.2)).toEqual({ type: 'setVolume', id: beamer.id, volume: 0.2 })
    expect(volume(room.id, 0.5)).toBeNull()
    expect(volume('onbekend', 0.5)).toBeNull()
    quiz.background = null
    expect(remoteCommand(quiz, off, { type: 'music', on: true })).toBeNull()
    expect(RemoteActionSchema.safeParse({ type: 'volume', id: 'x', volume: 1.5 }).success).toBe(
      false
    )
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
