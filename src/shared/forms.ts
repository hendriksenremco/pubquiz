/**
 * Pdf's voor op tafel: het antwoordformulier voor de teams (genummerde regels per ronde), het
 * nakijkformulier (dezelfde opmaak met de antwoorden erop) en vragenkaarten voor de quizmaster.
 */
import { answerSlides } from './factory'
import { roundItems, type AnswerItem } from './resolve'
import type { Quiz, Round } from './types'

export type FormDoc = 'sheet' | 'key' | 'cards'

export interface FormOptions {
  doc: FormDoc
  /** Welke rondes erop komen; de volgorde is die van de quiz. */
  roundIds: string[]
}

export interface FormSection {
  round: Round
  items: AnswerItem[]
  /** Vragen én fragmenten in één ronde: dan staat erbij wat elk nummer is. */
  mixed: boolean
}

/** Rondes met iets om in te vullen: vragen, afbeeldingen of fragmenten. */
export function formRounds(quiz: Quiz): Round[] {
  return quiz.rounds.filter((r) => roundItems(r).length > 0)
}

export function formSections(quiz: Quiz, roundIds: string[]): FormSection[] {
  return formRounds(quiz)
    .filter((r) => roundIds.includes(r.id))
    .map((round) => {
      const items = roundItems(round)
      const kinds = new Set(items.map((item) => (item.fragment ? 'fragment' : 'slide')))
      return { round, items, mixed: kinds.size > 1 }
    })
}

/** "2 vragen, 8 fragmenten" */
export function itemSummary(round: Round): string {
  const slides = answerSlides(round)
  const images = slides.filter((s) => s.layout === 'image').length
  const parts = [
    [slides.length - images, 'vraag', 'vragen'],
    [images, 'afbeelding', 'afbeeldingen'],
    [round.fragments.length, 'fragment', 'fragmenten']
  ] as const
  return parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(', ')
}

const FILE_NAMES: Record<FormDoc, string> = {
  sheet: 'antwoordformulier',
  key: 'nakijkformulier',
  cards: 'vragenkaarten'
}

/** Regels die in een vak (een kwart A4) passen; een grotere ronde krijgt een hele rij. */
export const SHEET_BLOCK_LINES = 16
const SLOTS_PER_PAGE = 4

/** Een ronde op het formulier: vak 0–3 (links-rechts, boven-onder); breed = de hele rij. */
export interface SheetBlock {
  section: FormSection
  slot: number
  wide: boolean
}

/**
 * Verdeelt de rondes over A4-bladen: maximaal vier vakken per blad, in de volgorde van de quiz.
 * Antwoordformulier en nakijkformulier gebruiken dezelfde indeling, zodat ze naast elkaar passen.
 */
export function sheetPages(sections: FormSection[]): SheetBlock[][] {
  const pages: SheetBlock[][] = []
  let page: SheetBlock[] = []
  let used = 0
  for (const section of sections) {
    const wide = section.items.length > SHEET_BLOCK_LINES
    // Een brede ronde begint altijd links, op een nieuwe rij.
    let slot = wide && used % 2 === 1 ? used + 1 : used
    if (slot + (wide ? 2 : 1) > SLOTS_PER_PAGE) {
      pages.push(page)
      page = []
      slot = 0
    }
    page.push({ section, slot, wide })
    used = slot + (wide ? 2 : 1)
  }
  if (page.length) pages.push(page)
  return pages
}

/** "Pubquiz november – antwoordformulier.pdf", zonder tekens die in een bestandsnaam niet mogen. */
export function formFileName(quiz: Quiz, doc: FormDoc): string {
  const title = quiz.title.replace(/[/\\:]/g, '-').trim() || 'Pubquiz'
  return `${title} – ${FILE_NAMES[doc]}.pdf`
}

/** Wat de quizmaster bij een nummer ziet: de vraag, het bijschrift of de naam van het fragment. */
export function itemText(item: AnswerItem): string {
  if (item.fragment) return item.fragment.label
  const slide = item.slide
  if (slide?.layout === 'question') return slide.body || slide.title || ''
  // Een nummerslide heeft als titel alleen het nummer; dat staat al vooraan.
  if (slide?.layout === 'number') return slide.body ?? ''
  return slide?.title ?? ''
}
