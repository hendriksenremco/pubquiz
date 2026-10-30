import { describe, expect, it } from 'vitest'
import { createQuiz, createRound, createShowState, createSlide } from './factory'
import { quizLights, setLight, type Light } from './light'
import { remoteCommand, remoteView, RemoteActionSchema } from './remote'
import type { ShowState } from './types'

const RED: Light = { type: 'color', color: '#ff0000' }
const PARTY: Light = { type: 'effect', effect: 299, speed: 60 }

function setup() {
  const quiz = createQuiz('Kroegquiz')
  const first = createRound('normal', 1)
  first.slides.push(createSlide('question', 'Hoofdstad van Peru?'))
  const second = createRound('normal', 2)
  second.slides = []
  quiz.rounds = [first, second]
  const live = (patch: Partial<ShowState> = {}): ShowState => ({
    ...createShowState(),
    live: true,
    ...patch
  })
  return { quiz, first, second, live }
}

describe('remoteView', () => {
  it('toont de ronde, de slide en waar je heen kunt', () => {
    const { quiz, first, live } = setup()
    const view = remoteView(
      quiz,
      live({ activeRoundId: first.id, lastRoundId: first.id, slideIndex: 1 }),
      null
    )
    expect(view).toMatchObject({
      quiz: 'Kroegquiz',
      live: true,
      round: { title: 'Ronde 1', number: 1 },
      rounds: 2,
      prevRound: null,
      nextRound: 'Ronde 2',
      slide: { index: 1, count: 2, text: 'Hoofdstad van Peru?', prev: true, next: false },
      screens: true,
      blackout: false,
      muted: false,
      light: null
    })
  })

  it('tussen twee rondes: geen slide, en de vorige is de ronde van net', () => {
    const { quiz, first, live } = setup()
    const view = remoteView(quiz, live({ lastRoundId: first.id }), null)
    expect(view).toMatchObject({
      round: null,
      slide: null,
      prevRound: 'Ronde 1',
      nextRound: 'Ronde 2'
    })
  })

  it('een ronde zonder slides heeft geen slideknoppen', () => {
    const { quiz, second, live } = setup()
    expect(remoteView(quiz, live({ activeRoundId: second.id }), null).slide).toBeNull()
  })

  it('beeld op zwart als alle schermen zwart zijn, geluid uit als de achtergrond uit staat', () => {
    const { quiz, live } = setup()
    const beamer = quiz.screens[0].id
    expect(
      remoteView(quiz, live({ blackout: [beamer], backgroundEnabled: false }), null)
    ).toMatchObject({
      blackout: true,
      muted: true
    })
  })

  it('geeft het licht met de lichten uit de quiz, als de plug-in aan staat', () => {
    const { quiz, first, live } = setup()
    setLight(quiz, RED)
    setLight(first, PARTY)
    setLight(first.slides[1], RED)
    expect(quizLights(quiz)).toEqual([RED, PARTY])
    expect(remoteView(quiz, live(), { light: PARTY, manual: true }).light).toEqual({
      light: PARTY,
      manual: true,
      quiz: [RED, PARTY]
    })
  })

  it('zonder quiz', () => {
    expect(remoteView(null, createShowState(), null)).toMatchObject({
      quiz: null,
      live: false,
      rounds: 0,
      screens: false,
      blackout: false
    })
  })
})

describe('remoteCommand', () => {
  it('vertaalt knoppen naar opdrachten voor de show', () => {
    const state = createShowState()
    expect(remoteCommand(state, { type: 'round', direction: 'prev' })).toEqual({
      type: 'prevRound'
    })
    expect(remoteCommand(state, { type: 'slide', direction: 'next' })).toEqual({
      type: 'nextSlide'
    })
    expect(remoteCommand(state, { type: 'blackout', on: true })).toEqual({
      type: 'blackout',
      on: true
    })
    expect(remoteCommand(state, { type: 'light', light: RED })).toBeNull()
  })

  it('geluid aan of uit is een stand, geen wissel', () => {
    const on = createShowState()
    const off = { ...on, backgroundEnabled: false }
    expect(remoteCommand(on, { type: 'mute', on: true })).toEqual({ type: 'stopAll' })
    expect(remoteCommand(off, { type: 'mute', on: false })).toEqual({ type: 'toggleBackground' })
    expect(remoteCommand(on, { type: 'mute', on: false })).toBeNull()
  })

  it('weigert onbekende acties', () => {
    expect(RemoteActionSchema.safeParse({ type: 'stopShow' }).success).toBe(false)
    expect(
      RemoteActionSchema.safeParse({ type: 'light', light: { type: 'color', color: 'red' } })
        .success
    ).toBe(false)
    expect(RemoteActionSchema.safeParse({ type: 'light', light: null }).success).toBe(true)
  })
})
