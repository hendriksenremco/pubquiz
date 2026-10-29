import { describe, expect, it } from 'vitest'
import { createQuiz, createRound, createShowState, createSlide } from './factory'
import { lightLabel, lightOf, quizUsesLight, resolveLight, setLight, type Light } from './light'
import { QuizSchema } from './quiz-schema'
import type { ShowState } from './types'

const RED: Light = { type: 'color', color: '#ff0000' }
const BLUE: Light = { type: 'color', color: '#0000ff' }
const PARTY: Light = { type: 'effect', effect: 299, speed: 60 }

function setup() {
  const quiz = createQuiz('Test')
  const round = createRound('normal', 1)
  round.slides = [createSlide('title', 'Ronde 1'), createSlide('question', 'Vraag 1')]
  quiz.rounds = [round, createRound('normal', 2)]
  const live = (patch: Partial<ShowState> = {}): ShowState => ({
    ...createShowState(),
    live: true,
    activeRoundId: round.id,
    slideIndex: 0,
    ...patch
  })
  return { quiz, round, live }
}

describe('resolveLight', () => {
  it('slide gaat voor ronde, ronde voor de standaard van de quiz', () => {
    const { quiz, round, live } = setup()
    setLight(quiz, BLUE)
    setLight(round, RED)
    setLight(round.slides[1], PARTY)

    expect(resolveLight(quiz, live())).toEqual(RED)
    expect(resolveLight(quiz, live({ slideIndex: 1 }))).toEqual(PARTY)
    expect(resolveLight(quiz, live({ activeRoundId: null, slideIndex: -1 }))).toEqual(BLUE)
    expect(resolveLight(quiz, live({ activeRoundId: quiz.rounds[1].id }))).toEqual(BLUE)
  })

  it('verandert niets als nergens licht staat, of buiten de show', () => {
    const { quiz, round, live } = setup()
    expect(resolveLight(quiz, live())).toBeNull()
    setLight(round, RED)
    expect(resolveLight(quiz, { ...live(), live: false })).toBeNull()
  })
})

describe('setLight', () => {
  it('bewaart het licht bij de plug-in en laat andere plug-ins staan', () => {
    const { quiz, round } = setup()
    round.plugins = { ander: { x: 1 } }
    setLight(round, RED)
    expect(round.plugins).toEqual({ ander: { x: 1 }, magichome: { light: RED } })
    setLight(round, undefined)
    expect(round.plugins).toEqual({ ander: { x: 1 } })

    setLight(quiz, BLUE)
    setLight(quiz, undefined)
    expect('plugins' in quiz).toBe(false)
  })

  it('blijft bewaard in de quiz en negeert ongeldige gegevens', () => {
    const { quiz, round } = setup()
    setLight(round.slides[0], PARTY)
    const parsed = QuizSchema.parse(JSON.parse(JSON.stringify(quiz)))
    expect(lightOf(parsed.rounds[0].slides[0])).toEqual(PARTY)
    expect(quizUsesLight(parsed)).toBe(true)

    round.plugins = { magichome: { light: { type: 'color', color: 'rood' } } }
    expect(lightOf(round)).toBeUndefined()
  })
})

describe('lightLabel', () => {
  it('noemt bekende kleuren en effecten bij naam', () => {
    expect(lightLabel(RED)).toBe('Rood')
    expect(lightLabel({ type: 'color', color: '#123456' })).toBe('#123456')
    expect(lightLabel(PARTY)).toBe('Alles door elkaar')
    expect(lightLabel({ type: 'effect', effect: 37, speed: 50 })).toBe('Effect 37')
    expect(lightLabel({ type: 'off' })).toBe('Uit')
  })
})
