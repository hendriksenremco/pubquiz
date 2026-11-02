import type { Params } from './i18n'
import { FORMAT_MESSAGES, type FormatProblem } from './quiz-messages'
import { QuizSchema, SCHEMA_VERSION } from './quiz-schema'
import type { Quiz } from './types'

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

// Ongeldige structuren blijven staan, zodat de schemacontrole ze daarna netjes meldt.
const each = (list: unknown, fn: (item: Record<string, unknown>) => unknown) =>
  Array.isArray(list) ? list.map(fn) : list

/** `migrations[n]` zet een quiz van schemaVersion n om naar n + 1. */
const migrations: Record<number, Migration> = {
  // 1 → 2: videogeluid ging naar een audiokanaal; nu via de speakers van het scherm met een volume.
  1: (raw) => {
    const convert = (content: unknown) => {
      if (typeof content !== 'object' || content === null) return content
      const { audioChannelId, ...rest } = content as Record<string, unknown>
      return audioChannelId ? { ...rest, volume: 1 } : rest
    }
    return {
      ...raw,
      screens: each(raw.screens, (slot) => ({ ...slot, default: convert(slot.default) })),
      rounds: each(raw.rounds, (round) => ({
        ...round,
        screens: Object.fromEntries(
          Object.entries((round.screens as Record<string, unknown>) ?? {}).map(([id, c]) => [
            id,
            convert(c)
          ])
        )
      }))
    }
  },
  // 2 → 3: het fragmentnummer stond aan of uit voor alle schermen; nu per scherm, ook bij handmatig.
  2: (raw) => {
    const screenIds = Array.isArray(raw.screens)
      ? raw.screens.map((slot: Record<string, unknown>) => slot?.id).filter(Boolean)
      : []
    return {
      ...raw,
      rounds: each(raw.rounds, (round) => {
        const { showFragmentNumber, ...autoplay } = (round.autoplay ?? {}) as Record<
          string,
          unknown
        >
        return { ...round, autoplay, fragmentScreens: showFragmentNumber ? screenIds : [] }
      })
    }
  }
}

/**
 * Een quiz.json die niet te openen is. `message` is Nederlands (voor logs); de app vertaalt de
 * fout met `key` en `params` (`errorText` in `src/main/messages.ts`).
 */
export class QuizFormatError extends Error {
  constructor(
    readonly key: FormatProblem,
    readonly params?: Params
  ) {
    super(FORMAT_MESSAGES.in('nl')(key, params))
  }
}

export function migrateQuiz(input: unknown): Quiz {
  if (typeof input !== 'object' || input === null) {
    throw new QuizFormatError('notAnObject')
  }
  let raw = input as Record<string, unknown>
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : NaN

  if (!Number.isInteger(version) || version < 1) {
    throw new QuizFormatError('noSchemaVersion')
  }
  if (version > SCHEMA_VERSION) {
    throw new QuizFormatError('newerVersion', { version })
  }
  while (version < SCHEMA_VERSION) {
    const migrate = migrations[version]
    if (!migrate) throw new QuizFormatError('noMigration', { version })
    raw = { ...migrate(raw), schemaVersion: version + 1 }
    version++
  }

  const parsed = QuizSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new QuizFormatError('invalid', {
      path: issue?.path.join('.') || '(root)',
      error: issue?.message ?? ''
    })
  }
  return parsed.data
}
