import { describe, expect, it } from 'vitest'
import { hasQuizExtension, quizBaseName, quizTitle } from './quiz-name'

describe('quizBaseName', () => {
  it('haalt de extensie eraf, nieuw en oud', () => {
    expect(quizBaseName('/q/Vrijdag.quiznote')).toBe('Vrijdag')
    expect(quizBaseName('/q/Oktober.pubquiz/')).toBe('Oktober')
    expect(quizBaseName('/q/Los')).toBe('Los')
    expect(hasQuizExtension('/q/Oktober.pubquiz/')).toBe(true)
  })
})

describe('quizTitle', () => {
  it('geeft de titel, of de naam van de map als die leeg is', () => {
    expect(quizTitle('Kroegquiz', '/q/Vrijdag.quiznote')).toBe('Kroegquiz')
    expect(quizTitle('', '/q/Vrijdag.quiznote')).toBe('Vrijdag')
    expect(quizTitle('   ', '/q/Oktober.pubquiz')).toBe('Oktober')
    expect(quizTitle('', null)).toBe('')
  })
})
