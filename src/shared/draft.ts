import { z } from 'zod'
import {
  answerScreens,
  createFragment,
  createImageSlide,
  createRound,
  createSlide,
  hasAnswers
} from './factory'
import type { Quiz, Round, Slide } from './types'

/**
 * Een ronde in grote lijnen, zoals een AI hem aanlevert (via de MCP-server): vragen met antwoorden,
 * en liedjes en plaatjes als bestanden op deze Mac. `buildRound` maakt er een echte ronde van,
 * met dezelfde opbouw als in de editor.
 *
 * De beschrijvingen zijn Engels: die lezen AI-assistenten het best. Ze vragen de inhoud wel in de
 * taal van de gebruiker te schrijven.
 */

const text = z.string().trim().min(1)
const file = z.string().trim().min(1).describe('Absolute path to a file on this Mac')

const common = {
  intro: z
    .string()
    .optional()
    .describe('Short text on the title slide under the round title, shown to the audience'),
  notes: z.string().optional().describe('Notes for the quizmaster only (never on screen)')
}

export const QuestionsRoundSchema = z.object({
  type: z.literal('questions'),
  title: text.describe('Round title, e.g. "Ronde 1: geschiedenis"'),
  ...common,
  questions: z
    .array(
      z.object({
        question: text.describe('The question as the audience sees it'),
        answer: text.describe('The correct answer (answer sheet, answer key, answers round)'),
        readAloud: z
          .boolean()
          .optional()
          .describe('Show only the question number on screen; the quizmaster reads it aloud'),
        image: file.optional().describe('Picture shown next to the question'),
        answerImage: file.optional().describe('Picture shown with the answer in the answers round')
      })
    )
    .min(1)
})

export const PicturesRoundSchema = z.object({
  type: z.literal('pictures'),
  title: text,
  ...common,
  loopSeconds: z
    .number()
    .min(1)
    .optional()
    .describe('Show the pictures automatically, one every so many seconds, endlessly'),
  pictures: z
    .array(
      z.object({
        image: file.describe('The picture (jpg, png, …)'),
        answer: text,
        caption: z.string().optional().describe('Short text on screen under the picture'),
        answerImage: file.optional().describe('Different picture for the answers round')
      })
    )
    .min(1)
})

export const MusicRoundSchema = z.object({
  type: z.literal('music'),
  title: text,
  ...common,
  songs: z
    .array(
      z.object({
        audio: file.describe('Audio file on this Mac (mp3, m4a, wav, …)'),
        answer: text.describe('E.g. "Artist – Title"'),
        start: z.number().min(0).optional().describe('Start in seconds'),
        end: z.number().min(0).optional().describe('End in seconds (default: end of the file)')
      })
    )
    .min(1)
})

export const BreakRoundSchema = z.object({
  type: z.literal('break'),
  title: z.string().optional().describe('Default "Pauze"'),
  ...common
})

export const AnswersRoundSchema = z.object({
  type: z.literal('answers'),
  title: z.string().optional().describe('Default "Antwoorden"'),
  ...common,
  rounds: z
    .array(text)
    .optional()
    .describe('Titles of earlier rounds to go through; default: all earlier rounds with answers')
})

export const RoundDraftSchema = z.discriminatedUnion('type', [
  QuestionsRoundSchema,
  PicturesRoundSchema,
  MusicRoundSchema,
  BreakRoundSchema,
  AnswersRoundSchema
])

export type RoundDraft = z.infer<typeof RoundDraftSchema>

/** Een fout in wat de AI aanlevert; de boodschap gaat terug naar de AI. */
export class DraftError extends Error {}

/** Alle bestanden in een ronde, met het soort dat er hoort te staan. */
export function draftFiles(draft: RoundDraft): { path: string; kind: 'image' | 'audio' }[] {
  switch (draft.type) {
    case 'questions':
      return draft.questions.flatMap((q) =>
        [q.image, q.answerImage]
          .filter((p) => p !== undefined)
          .map((path) => ({ path, kind: 'image' as const }))
      )
    case 'pictures':
      return draft.pictures.flatMap((p) =>
        [p.image, p.answerImage]
          .filter((x) => x !== undefined)
          .map((path) => ({ path, kind: 'image' as const }))
      )
    case 'music':
      return draft.songs.map((s) => ({ path: s.audio, kind: 'audio' as const }))
    default:
      return []
  }
}

/**
 * Bouwt een ronde. `assetFor` geeft de id van een al geïmporteerd bestand. De rondes ervoor
 * moeten al in `quiz.rounds` staan: een antwoordenronde verwijst ernaar.
 */
export function buildRound(
  quiz: Quiz,
  draft: RoundDraft,
  assetFor: (path: string) => string
): Round {
  const number = quiz.rounds.length + 1
  const titleSlide = (title: string): Slide => ({
    ...createSlide('title', title),
    body: draft.intro?.trim() ?? ''
  })
  const notes = draft.notes?.trim() ? { hostNotes: draft.notes.trim() } : {}

  switch (draft.type) {
    case 'questions': {
      const round = createRound('normal', number)
      return {
        ...round,
        ...notes,
        title: draft.title,
        slides: [
          titleSlide(draft.title),
          ...draft.questions.map((q, i) => ({
            ...createSlide('question', `Vraag ${i + 1}`),
            body: q.question,
            answer: q.answer,
            ...(q.readAloud ? { numberOnly: true } : {}),
            ...(q.image ? { imageAssetId: assetFor(q.image) } : {}),
            ...(q.answerImage ? { answerImageAssetId: assetFor(q.answerImage) } : {})
          }))
        ]
      }
    }
    case 'pictures': {
      const round = createRound('pictures', number)
      return {
        ...round,
        ...notes,
        title: draft.title,
        slideLoopSeconds: draft.loopSeconds ?? null,
        slides: [
          titleSlide(draft.title),
          ...draft.pictures.map((p) => ({
            ...createImageSlide(assetFor(p.image)),
            title: p.caption?.trim() ?? '',
            answer: p.answer,
            ...(p.answerImage ? { answerImageAssetId: assetFor(p.answerImage) } : {})
          }))
        ]
      }
    }
    case 'music': {
      const round = createRound('music', number)
      const channel = quiz.channels.find((c) => c.name === 'Fragmenten') ?? quiz.channels.at(-1)
      if (!channel) throw new DraftError('This quiz has no audio channel for the songs')
      return {
        ...round,
        ...notes,
        title: draft.title,
        slides: [titleSlide(draft.title)],
        // Het nummer van het liedje op het eerste scherm, niet op alle.
        fragmentScreens: quiz.screens.slice(0, 1).map((s) => s.id),
        fragments: draft.songs.map((s, i) => ({
          ...createFragment(assetFor(s.audio), channel.id, i + 1),
          answer: s.answer,
          ...(s.start !== undefined ? { start: s.start } : {}),
          ...(s.end !== undefined ? { end: s.end } : {})
        }))
      }
    }
    case 'break': {
      const title = draft.title?.trim() || 'Pauze'
      return { ...createRound('break', number), ...notes, title, slides: [titleSlide(title)] }
    }
    case 'answers': {
      const title = draft.title?.trim() || 'Antwoorden'
      const sources = draft.rounds
        ? draft.rounds.map((name) => {
            const found = quiz.rounds.find((r) => r.title.toLowerCase() === name.toLowerCase())
            if (!found) throw new DraftError(`There is no earlier round called "${name}"`)
            return found
          })
        : quiz.rounds.filter(hasAnswers)
      return {
        ...createRound('answers', number, quiz),
        ...notes,
        title,
        slides: [titleSlide(title)],
        answersFor: sources.map((r) => r.id),
        fragmentScreens: answerScreens(quiz, sources)
      }
    }
  }
}

/** Korte samenvatting van een quiz voor de AI: wat erin staat, om op voort te bouwen. */
export function describeQuiz(quiz: Quiz, path: string) {
  return {
    title: quiz.title,
    path,
    screens: quiz.screens.map((s) => s.name),
    rounds: quiz.rounds.map((r, i) => ({
      number: i + 1,
      title: r.title,
      kind: roundKind(r),
      ...(r.hostNotes ? { notes: r.hostNotes } : {}),
      ...(r.slides.some((s) => s.layout === 'question')
        ? {
            questions: r.slides
              .filter((s) => s.layout === 'question')
              .map((s) => ({ question: s.body ?? '', answer: s.answer ?? '' }))
          }
        : {}),
      ...(r.slides.some((s) => s.layout === 'image')
        ? {
            pictures: r.slides
              .filter((s) => s.layout === 'image')
              .map((s) => ({ file: assetName(quiz, s.imageAssetId), answer: s.answer ?? '' }))
          }
        : {}),
      ...(r.fragments.length
        ? {
            songs: r.fragments.map((f) => ({
              file: assetName(quiz, f.assetId),
              answer: f.answer ?? ''
            }))
          }
        : {}),
      ...(r.answersFor.length
        ? {
            answersFor: r.answersFor.map((id) => quiz.rounds.find((x) => x.id === id)?.title ?? '')
          }
        : {})
    })),
    media: quiz.assets.map((a) => ({ name: a.name, kind: a.kind }))
  }
}

/** Soort ronde zoals de AI hem kent; 'slides' = alleen titelslides (pauze, welkom, …). */
function roundKind(r: Round): RoundDraft['type'] | 'slides' {
  if (r.answersFor.length) return 'answers'
  if (r.fragments.length) return 'music'
  if (r.slides.some((s) => s.layout === 'image')) return 'pictures'
  if (r.slides.some((s) => s.layout === 'question' || s.layout === 'number')) return 'questions'
  return 'slides'
}

const assetName = (quiz: Quiz, id: string | undefined) =>
  quiz.assets.find((a) => a.id === id)?.name ?? ''

// ── Gereedschappen voor de AI ──────────────────────────────────────────────────

const quizRef = text.describe('The quiz: its path or its exact title (see list_quizzes)')
const roundNumber = z.number().int().min(1).describe('Round number; 1 is the first round')

/** Parameters per gereedschap; de MCP-server en de app gebruiken dezelfde. */
export const AGENT_PARAMS = {
  list_quizzes: z.object({}),
  get_quiz: z.object({ quiz: quizRef }),
  create_quiz: z.object({
    title: text.describe('Title of the quiz, e.g. "Pubquiz Italië"'),
    rounds: z.array(RoundDraftSchema).describe('The rounds, in order'),
    basedOn: quizRef
      .optional()
      .describe('Copy the screens, background music and look of this existing quiz')
  }),
  add_rounds: z.object({
    quiz: quizRef,
    rounds: z.array(RoundDraftSchema).min(1),
    position: roundNumber
      .optional()
      .describe('Insert before this round number; default: at the end')
  }),
  replace_round: z.object({ quiz: quizRef, round: roundNumber, with: RoundDraftSchema }),
  remove_round: z.object({ quiz: quizRef, round: roundNumber })
}

export type AgentTool = keyof typeof AGENT_PARAMS
