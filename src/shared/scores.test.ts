import { describe, expect, it } from 'vitest'
import { createQuiz, createRound } from './factory'
import { QuizSchema } from './quiz-schema'
import {
  addTeam,
  clearPoints,
  removeTeam,
  renameTeam,
  scoredRounds,
  scoresOf,
  setPoints,
  standings
} from './scores'

function setup() {
  const quiz = createQuiz('Test')
  const one = createRound('normal', 1)
  const two = createRound('normal', 2)
  const answers = createRound('answers', 3)
  answers.answersFor = [one.id]
  quiz.rounds = [one, two, answers]
  return { quiz, one, two, answers }
}

describe('tussenstand', () => {
  it('begint leeg, en laat dan niets achter in de quiz', () => {
    const { quiz } = setup()
    expect(scoresOf(quiz)).toEqual({ teams: [], points: {} })
    const team = addTeam(quiz, 'De Slimmeriken')
    removeTeam(quiz, team.id)
    expect(quiz.plugins).toBeUndefined()
  })

  it('bewaart teams en punten, en de quiz blijft geldig', () => {
    const { quiz, one } = setup()
    const team = addTeam(quiz, 'Team A')
    renameTeam(quiz, team.id, 'Team Alpha')
    setPoints(quiz, one.id, team.id, 7.5)
    expect(scoresOf(quiz)).toEqual({
      teams: [{ id: team.id, name: 'Team Alpha' }],
      points: { [one.id]: { [team.id]: 7.5 } }
    })
    expect(scoresOf(QuizSchema.parse(JSON.parse(JSON.stringify(quiz))))).toEqual(scoresOf(quiz))
  })

  it('leeg of ongeldig = niet ingevuld', () => {
    const { quiz, one } = setup()
    const team = addTeam(quiz, 'A')
    setPoints(quiz, one.id, team.id, 4)
    setPoints(quiz, one.id, team.id, null)
    expect(scoresOf(quiz).points).toEqual({})
    setPoints(quiz, one.id, team.id, -1)
    setPoints(quiz, one.id, team.id, Number.NaN)
    expect(scoresOf(quiz).points).toEqual({})
    setPoints(quiz, one.id, 'onbekend', 3)
    expect(scoresOf(quiz).points).toEqual({})
  })

  it('een team weghalen haalt ook zijn punten weg', () => {
    const { quiz, one } = setup()
    const a = addTeam(quiz, 'A')
    const b = addTeam(quiz, 'B')
    setPoints(quiz, one.id, a.id, 3)
    setPoints(quiz, one.id, b.id, 5)
    removeTeam(quiz, b.id)
    expect(scoresOf(quiz).points).toEqual({ [one.id]: { [a.id]: 3 } })
  })

  it('punten wissen laat de teams staan', () => {
    const { quiz, one } = setup()
    const a = addTeam(quiz, 'A')
    setPoints(quiz, one.id, a.id, 3)
    clearPoints(quiz)
    expect(scoresOf(quiz)).toEqual({ teams: [a], points: {} })
  })

  it('antwoordenrondes krijgen geen punten', () => {
    const { quiz, one, two } = setup()
    expect(scoredRounds(quiz)).toEqual([one, two])
  })

  it('de stand: meeste punten bovenaan, gelijk deelt een plaats', () => {
    const { quiz, one, two } = setup()
    const a = addTeam(quiz, 'A')
    const b = addTeam(quiz, 'B')
    const c = addTeam(quiz, 'C')
    const d = addTeam(quiz, 'D')
    setPoints(quiz, one.id, a.id, 5)
    setPoints(quiz, two.id, a.id, 2.5)
    setPoints(quiz, one.id, b.id, 8)
    setPoints(quiz, one.id, c.id, 7.5)
    // Een ronde die niet meer bestaat telt niet mee.
    setPoints(quiz, 'weg', d.id, 100)
    expect(standings(quiz).map((s) => [s.team.name, s.total, s.place])).toEqual([
      ['B', 8, 1],
      ['A', 7.5, 2],
      ['C', 7.5, 2],
      ['D', 0, 4]
    ])
  })
})
