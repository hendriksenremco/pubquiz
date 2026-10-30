import { describe, expect, it } from 'vitest'
import { freshDemoQuiz } from '../main/demo-fixture'
import {
  cardSheets,
  formFileName,
  formRounds,
  formSections,
  itemText,
  sheetPages,
  type CardFit,
  type FormSection
} from './forms'
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
    expect(formFileName({ ...demo, title: ' ' }, 'key')).toBe('Pubquiz – nakijkformulier.pdf')
    expect(formFileName(demo, 'cards')).toBe('Demo-pubquiz – vragenkaarten.pdf')
  })

  it('zet maximaal vier rondes op een A4, een grote ronde over een hele rij', () => {
    const [algemeen, muziek] = formSections(demo, ['r1', 'r2'])
    const big: FormSection = {
      ...muziek,
      items: [...muziek.items, ...muziek.items, ...muziek.items]
    }
    const slots = (pages: ReturnType<typeof sheetPages>) =>
      pages.map((page) => page.map((b) => `${b.slot}${b.wide ? 'w' : ''}`))

    expect(slots(sheetPages([algemeen, muziek, algemeen]))).toEqual([['0', '1', '2']])
    expect(slots(sheetPages([algemeen, muziek, algemeen, muziek, algemeen]))).toEqual([
      ['0', '1', '2', '3'],
      ['0']
    ])
    // 24 regels passen niet in een vak: hele rij, en dus op de volgende rij of het volgende blad.
    expect(slots(sheetPages([algemeen, big, muziek]))).toEqual([['0', '2w'], ['0']])
    expect(slots(sheetPages([big, big, big]))).toEqual([['0w', '2w'], ['0w']])
  })

  it('zet vier vragenkaarten op een A4 en laat een volle ronde doorlopen', () => {
    const [algemeen, muziek, intros] = formSections(demo, ['r1', 'r2', 'r4'])
    const fit = (s: FormSection, room = 100): CardFit => ({ room, rows: s.items.map(() => 10) })
    const cards = (sheets: ReturnType<typeof cardSheets>) =>
      sheets.map((sheet) => sheet.map((c) => `${c.section.round.id}:${c.items.length}`))

    expect(cards(cardSheets([algemeen, muziek], [fit(algemeen), fit(muziek)]))).toEqual([
      ['r1:2', 'r2:8']
    ])
    // Ruimte voor drie regels: de acht intro's worden 3 + 3 + 2.
    const all = [algemeen, muziek, intros]
    expect(cards(cardSheets(all, [fit(algemeen), fit(muziek), fit(intros, 35)]))).toEqual([
      ['r1:2', 'r2:8', 'r4:3', 'r4:3'],
      ['r4:2']
    ])
    // Een regel hoger dan de kaart staat op een eigen kaart, en schuift de rest niet weg.
    expect(cards(cardSheets([algemeen], [{ room: 30, rows: [50, 10] }]))).toEqual([
      ['r1:1', 'r1:1']
    ])
  })

  it('geeft per nummer de tekst voor de quizmaster', () => {
    const [algemeen, muziek] = formSections(demo, ['r1', 'r2'])
    expect(algemeen.items.map(itemText)).toEqual(['Wat is de hoofdstad van Australië?', ''])
    expect(itemText(muziek.items[0])).toBe('Fragment 1')
  })
})
