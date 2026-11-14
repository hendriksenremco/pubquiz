import { describe, expect, it } from 'vitest'
import { createQuiz, createRound, createScreenSlot, createSlide } from './factory'
import { deleteScreen, screenUsedByRounds } from './screen-slots'

function quizWithTwoScreens() {
  const quiz = createQuiz('Test')
  quiz.screens.push(createScreenSlot('Zaal'))
  quiz.rounds.push(createRound('normal', 1, quiz))
  return { quiz, beamer: quiz.screens[0].id, zaal: quiz.screens[1].id }
}

describe('schermen verwijderen', () => {
  it('een scherm dat geen ronde of slide noemt, is niet in gebruik', () => {
    const { quiz, zaal } = quizWithTwoScreens()
    expect(screenUsedByRounds(quiz, zaal)).toBe(false)
  })

  it('ziet afwijkingen, stil, fragmentnummers en slides per scherm', () => {
    const cases = [
      (q: ReturnType<typeof quizWithTwoScreens>) =>
        (q.quiz.rounds[0].screens[q.zaal] = { type: 'black' }),
      (q: ReturnType<typeof quizWithTwoScreens>) => q.quiz.rounds[0].mutedScreens.push(q.zaal),
      (q: ReturnType<typeof quizWithTwoScreens>) => q.quiz.rounds[0].fragmentScreens.push(q.zaal),
      (q: ReturnType<typeof quizWithTwoScreens>) =>
        (q.quiz.rounds[0].slides[0].targetScreens = [q.zaal])
    ]
    for (const use of cases) {
      const q = quizWithTwoScreens()
      use(q)
      expect(screenUsedByRounds(q.quiz, q.zaal)).toBe(true)
      expect(screenUsedByRounds(q.quiz, q.beamer)).toBe(false)
    }
  })

  it('haalt het scherm overal weg; een slide zonder scherm komt weer op alle schermen', () => {
    const { quiz, beamer, zaal } = quizWithTwoScreens()
    const round = quiz.rounds[0]
    round.screens[zaal] = { type: 'black' }
    round.mutedScreens.push(zaal)
    round.fragmentScreens.push(beamer, zaal)
    const both = createSlide('title')
    both.targetScreens = [beamer, zaal]
    round.slides[0].targetScreens = [zaal]
    round.slides.push(both)

    deleteScreen(quiz, zaal)

    expect(quiz.screens.map((s) => s.id)).toEqual([beamer])
    expect(round.screens).toEqual({})
    expect(round.mutedScreens).toEqual([])
    expect(round.fragmentScreens).toEqual([beamer])
    expect(round.slides.map((s) => s.targetScreens)).toEqual(['all', [beamer]])
    expect(screenUsedByRounds(quiz, zaal)).toBe(false)
  })
})
