import { describe, expect, it } from 'vitest'
import { stepAnswers, type AnswerState } from './answers'

const at = (index: number, revealed: boolean): AnswerState => ({ roundId: 'a', index, revealed })
const step = (current: AnswerState | null, action: Parameters<typeof stepAnswers>[1]) =>
  stepAnswers(current, action, 'a', 3)

describe('stepAnswers', () => {
  it('loopt per fragment: nummer met fragment, dan antwoord, dan het volgende', () => {
    expect(step(null, 'next')).toEqual({ answer: at(0, false), play: 0, stopCurrent: true })
    expect(step(at(0, false), 'next')).toEqual({
      answer: at(0, true),
      play: null,
      stopCurrent: false
    })
    expect(step(at(0, true), 'next')).toEqual({ answer: at(1, false), play: 1, stopCurrent: true })
    // Na het laatste antwoord gebeurt er niets meer.
    expect(step(at(2, true), 'next')).toEqual({
      answer: at(2, true),
      play: null,
      stopCurrent: false
    })
  })

  it('gaat terug: antwoord verbergen, vorig antwoord, en tot slot naar het begin', () => {
    expect(step(at(1, true), 'prev').answer).toEqual(at(1, false))
    expect(step(at(1, false), 'prev')).toEqual({
      answer: at(0, true),
      play: null,
      stopCurrent: true
    })
    expect(step(at(0, false), 'prev').answer).toBeNull()
    expect(step(null, 'prev').answer).toBeNull()
  })

  it('springt naar een fragment en wisselt bij nogmaals klikken het antwoord', () => {
    expect(step(at(0, true), { goto: 2 })).toEqual({
      answer: at(2, false),
      play: 2,
      stopCurrent: true
    })
    expect(step(at(2, false), { goto: 2 }).answer).toEqual(at(2, true))
    expect(step(at(2, true), { goto: 2 }).answer).toEqual(at(2, false))
    expect(step(at(2, true), { goto: 9 }).answer).toEqual(at(2, true))
  })

  it('stopt, en doet niets zonder fragmenten', () => {
    expect(step(at(1, true), 'stop')).toEqual({ answer: null, play: null, stopCurrent: true })
    expect(stepAnswers(null, 'next', 'a', 0).answer).toBeNull()
  })
})
