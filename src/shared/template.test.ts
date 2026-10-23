import { describe, expect, it } from 'vitest'
import { freshDemoQuiz } from '../main/demo-fixture'
import { migrateQuiz } from './migrate'
import { quizFromTemplate, usedAssetIds } from './template'

const demo = migrateQuiz(freshDemoQuiz())

describe('quizFromTemplate', () => {
  it('neemt standaard de opbouw over, zonder fragmenten en hun liedjes', () => {
    const quiz = quizFromTemplate(demo, 'November', { rounds: true, fragments: false })
    expect(quiz.title).toBe('November')
    expect(quiz.id).not.toBe(demo.id)
    expect(quiz.screens).toEqual(demo.screens)
    expect(quiz.channels).toEqual(demo.channels)
    expect(quiz.background).toEqual(demo.background)
    expect(quiz.rounds.map((r) => r.title)).toEqual(demo.rounds.map((r) => r.title))
    expect(quiz.rounds.every((r) => r.fragments.length === 0)).toBe(true)
    // Beeld blijft, geluid alleen als het nog gebruikt wordt (achtergrond en pauzemuziek).
    expect(quiz.assets.map((a) => a.id).sort()).toEqual(
      ['bg', 'bg-break', 'logo', 'loop', 'music-loop', 'pause-loop'].sort()
    )
    expect(quiz.folders.map((f) => f.name)).toEqual(['Loops'])
  })

  it('neemt fragmenten en hun bestanden mee als dat gevraagd is', () => {
    const quiz = quizFromTemplate(demo, 'Kopie', { rounds: true, fragments: true })
    expect(quiz.rounds).toEqual(demo.rounds)
    expect(quiz.assets).toHaveLength(demo.assets.length)
    expect(quiz.folders).toEqual(demo.folders)
  })

  it('kan ook zonder rondes', () => {
    const quiz = quizFromTemplate(demo, 'Leeg', { rounds: false, fragments: true })
    expect(quiz.rounds).toEqual([])
    expect(quiz.assets.map((a) => a.id)).not.toContain('bg-break')
    expect(quiz.assets.map((a) => a.id)).toContain('music-loop')
  })

  it('laat de bron ongemoeid', () => {
    const before = structuredClone(demo)
    quizFromTemplate(demo, 'X', { rounds: false, fragments: false })
    expect(demo).toEqual(before)
  })

  it('weet welke assets gebruikt worden', () => {
    const used = usedAssetIds(demo)
    expect(used.has('frag1')).toBe(true)
    expect(used.has('logo')).toBe(true)
  })
})
