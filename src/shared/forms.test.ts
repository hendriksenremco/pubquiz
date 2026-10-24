import { describe, expect, it } from 'vitest'
import { freshDemoQuiz } from '../main/demo-fixture'
import { formFileName, formRounds, formSections, itemText } from './forms'
import { migrateQuiz } from './migrate'

const demo = migrateQuiz(freshDemoQuiz())

describe('formulieren', () => {
  it('neemt alleen rondes met vragen, afbeeldingen of fragmenten', () => {
    // De pauze heeft alleen een titelslide.
    expect(formRounds(demo).map((r) => r.id)).toEqual(['r1', 'r2', 'r4'])
  })

  it('volgt de volgorde van de quiz, met de regels van elke ronde', () => {
    const sections = formSections(demo, ['r4', 'r1'])
    expect(sections.map((s) => s.round.id)).toEqual(['r1', 'r4'])
    expect(sections[0].items.map((i) => [i.noun, i.number, i.answer])).toEqual([
      ['vraag', 1, 'Canberra'],
      ['vraag', 2, 'Mount Everest']
    ])
    expect(sections[1].items).toHaveLength(8)
    expect(sections.some((s) => s.mixed)).toBe(false)
  })

  it('maakt een bruikbare bestandsnaam', () => {
    expect(formFileName({ ...demo, title: 'Quiz 24/10' }, 'sheet')).toBe(
      'Quiz 24-10 – antwoordformulier.pdf'
    )
    expect(formFileName({ ...demo, title: ' ' }, 'key')).toBe('Pubquiz – antwoorden.pdf')
    expect(formFileName(demo, 'cards')).toBe('Demo-pubquiz – vragenkaarten.pdf')
  })

  it('geeft per nummer de tekst voor de quizmaster', () => {
    const [algemeen, muziek] = formSections(demo, ['r1', 'r2'])
    expect(algemeen.items.map(itemText)).toEqual(['Wat is de hoofdstad van Australië?', ''])
    expect(itemText(muziek.items[0])).toBe('Fragment 1')
  })
})
