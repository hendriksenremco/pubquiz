/**
 * Pdf's voor op tafel: het antwoordformulier voor de teams (genummerde lege regels per ronde),
 * de antwoorden om na te kijken, en vragenkaarten (ansichtkaartformaat) voor de quizmaster.
 */
import { answerSlides } from './factory'
import { roundItems, type AnswerItem } from './resolve'
import type { Quiz, Round } from './types'

export type FormDoc = 'sheet' | 'key' | 'cards'

export interface FormOptions {
  doc: FormDoc
  /** Welke rondes erop komen; de volgorde is die van de quiz. */
  roundIds: string[]
  /** Elke ronde op een eigen blad, zodat je de formulieren per ronde kunt ophalen. */
  pagePerRound: boolean
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
  key: 'antwoorden',
  cards: 'vragenkaarten'
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
