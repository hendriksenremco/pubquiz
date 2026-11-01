import { z } from 'zod'
import { buildRound, draftFiles, RoundDraftSchema, type RoundDraft } from './draft'
import { fragmentChannel } from './factory'
import type { Locale } from './i18n'
import { addImported, createFolder } from './media-folders'
import type { MediaAsset, Quiz, Round } from './types'

/**
 * Een rondebestand (issue #99): een of meer rondes om in een quiz te importeren, bijvoorbeeld uit
 * de bibliotheek op quiznote.app. Het is een zip met `ronde.json` en eventueel `media/`.
 * `ronde.json` volgt `RoundDraftSchema` (de vorm van de AI-koppeling), met een `formatVersion`;
 * bestanden staan er als pad in de zip in (`media/…`). Het formaat staat in docs/rondebestand.md.
 */

export const ROUND_FILE_EXT = '.quiznoteronde'
export const ROUND_FILE_JSON = 'ronde.json'
export const ROUND_FILE_VERSION = 1
/** Groter wordt het niet: een ronde met liedjes is hooguit enkele tientallen MB. */
export const ROUND_FILE_MAX_BYTES = 1024 * 1024 * 1024

/** De fouten; de sleutels staan ook in NOTICE_MESSAGES in main. */
export type RoundFileProblem =
  | 'notRoundFile'
  | 'newerRoundFile'
  | 'invalidRoundFile'
  | 'unsafeRoundPath'
  | 'missingRoundMedia'
  | 'notAPicture'
  | 'notAudio'
  | 'noAudioChannel'
  | 'roundFileTooBig'

export class RoundFileError extends Error {
  constructor(
    readonly key: RoundFileProblem,
    readonly params?: Record<string, string>
  ) {
    super(params ? `${key}: ${Object.values(params).join(', ')}` : key)
  }
}

/** Een pad in de zip zonder `..`, zonder begin-`/` en zonder `\`: blijft altijd binnen de zip. */
export function isSafeZipPath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || /^[a-zA-Z]:/.test(path)) return false
  return path.split('/').every((part) => part !== '..' && part !== '.' && part !== '')
}

const VersionSchema = z.object({ formatVersion: z.number().int().min(1) })

/**
 * Leest `ronde.json`: één ronde (`{ formatVersion, type, … }`) of meer (`{ formatVersion,
 * rounds: [...] }`). Gooit een `RoundFileError` als er iets niet klopt.
 */
export function parseRoundFile(json: string): RoundDraft[] {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new RoundFileError('notRoundFile')
  }
  const version = VersionSchema.safeParse(data)
  if (!version.success) throw new RoundFileError('notRoundFile')
  if (version.data.formatVersion > ROUND_FILE_VERSION) throw new RoundFileError('newerRoundFile')

  // Een antwoordenronde heeft zelf ook `rounds`; één ronde herken je aan `type`.
  const { formatVersion: _, ...rest } = data as Record<string, unknown>
  const drafts = 'type' in rest ? [rest] : rest.rounds
  const parsed = z.array(RoundDraftSchema).min(1).safeParse(drafts)
  if (!parsed.success) {
    throw new RoundFileError('invalidRoundFile', { error: z.prettifyError(parsed.error) })
  }
  for (const f of parsed.data.flatMap(draftFiles)) {
    if (!isSafeZipPath(f.path) || !f.path.startsWith('media/')) {
      throw new RoundFileError('unsafeRoundPath', { file: f.path })
    }
  }
  return parsed.data
}

/** Alle bestanden in de rondes, één keer per pad, met het soort dat er hoort te staan. */
export function roundFileMedia(drafts: RoundDraft[]): { path: string; kind: 'image' | 'audio' }[] {
  const seen = new Map<string, 'image' | 'audio'>()
  for (const f of drafts.flatMap(draftFiles)) if (!seen.has(f.path)) seen.set(f.path, f.kind)
  return [...seen].map(([path, kind]) => ({ path, kind }))
}

/**
 * Voegt de rondes in op plek `at`, met hun bestanden (pad in de zip → geïmporteerd bestand).
 * Elke ronde krijgt een eigen map in Media, net als bij de AI-koppeling. Geeft de nieuwe rondes.
 * Kan een `DraftError` gooien (een antwoordenronde die naar een onbekende ronde verwijst).
 */
export function addRounds(
  quiz: Quiz,
  drafts: RoundDraft[],
  assets: Record<string, MediaAsset>,
  at: number,
  locale: Locale
): Round[] {
  if (drafts.some((d) => d.type === 'music') && !fragmentChannel(quiz)) {
    throw new RoundFileError('noAudioChannel')
  }
  const ids = new Map<string, string>()
  for (const draft of drafts) {
    const name = draft.title?.trim() || 'Media'
    for (const f of draftFiles(draft)) {
      if (ids.has(f.path)) continue
      const asset = assets[f.path]
      if (!asset) throw new RoundFileError('missingRoundMedia', { file: f.path })
      const folder = quiz.folders.find((x) => x.name === name) ?? createFolder(quiz, name)
      const [added] = addImported(quiz, { assets: [asset], skipped: [], folders: [] }, folder.id)
      ids.set(f.path, added.id)
    }
  }
  const rounds: Round[] = []
  drafts.forEach((draft, i) => {
    const earlier = { ...quiz, rounds: quiz.rounds.slice(0, at + i) }
    const round = buildRound(earlier, draft, (path) => ids.get(path)!, locale)
    quiz.rounds.splice(at + i, 0, round)
    rounds.push(round)
  })
  return rounds
}

/** Wat main teruggeeft na het lezen van een rondebestand; de editor voegt de rondes toe. */
export interface RoundImport {
  /** Naam van het bestand, voor de melding. */
  file: string
  drafts: RoundDraft[]
  /** Pad in de zip → het bestand zoals het nu in `media/` van de quiz staat. */
  assets: Record<string, MediaAsset>
}
