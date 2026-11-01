import type { Quiz, Round } from './types'

/**
 * Anoniem meten met PostHog (issue #40). Alleen met toestemming, en nooit quizinhoud,
 * bestandsnamen, media of IP-adressen. De sleutel is openbaar: hij mag alleen events sturen.
 */
export const POSTHOG_KEY = 'phc_rGB9TQNdexJ5szAgvnfGbFJkH5CDxNWHA8H3JLoUrYfL'
export const POSTHOG_HOST = 'https://eu.i.posthog.com'

/** Een event zoals PostHog het in `/batch/` verwacht. */
export interface AnalyticsEvent {
  event: string
  properties: Record<string, unknown>
  /** ISO-tijd van het moment zelf, niet van het versturen. */
  timestamp: string
}

/** Een fout uit main of een venster, zonder iets wat naar de quiz of de Mac wijst. */
export interface ErrorReport {
  name: string
  message: string
  stack?: string
}

export type RoundKind = 'normal' | 'music' | 'pictures' | 'break' | 'answers'

/**
 * De soort van een ronde, afgeleid uit wat erin zit (er is geen veld voor; zie `createRound`):
 * antwoorden, fragmenten (muziek), afbeeldingsslides, alleen titelslides (pauze), of gewoon.
 */
export function roundKind(round: Round): RoundKind {
  if (round.answersFor.length) return 'answers'
  if (round.fragments.length) return 'music'
  if (round.slides.some((s) => s.layout === 'image')) return 'pictures'
  if (round.slides.every((s) => s.layout === 'title')) return 'break'
  return 'normal'
}

/** Wat een show_started-event over de quiz zegt: alleen aantallen. */
export function quizShape(quiz: Quiz): Record<string, number> {
  const kinds: Record<RoundKind, number> = {
    normal: 0,
    music: 0,
    pictures: 0,
    break: 0,
    answers: 0
  }
  for (const round of quiz.rounds) kinds[roundKind(round)]++
  return {
    rounds: quiz.rounds.length,
    screens: quiz.screens.length,
    channels: quiz.channels.length,
    ...Object.fromEntries(Object.entries(kinds).map(([kind, n]) => [`rounds_${kind}`, n]))
  }
}

/**
 * Haalt uit een foutmelding wat naar een persoon of plek wijst: paden (met de gebruikersnaam en
 * quiznamen), URL's met een pad en IP-adressen.
 */
export function scrub(text: string): string {
  return (
    text
      // URL's met een schema (file://, pq-media://, http://): alles tot een spatie of aanhalingsteken.
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"`)]+/gi, '<url>')
      // Paden tussen aanhalingstekens (zoals in fouten van Node) mogen spaties bevatten.
      .replace(/(['"`])\/[^'"`\n]*\1/g, '$1<pad>$1')
      // Absolute paden: vanaf een / aan het begin of na een spatie, haakje of aanhalingsteken.
      .replace(/(^|[\s'"`(=])\/[^\s'"`)]*[^\s'"`).,:;]/g, '$1<pad>')
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
  )
}

interface Frame {
  function: string
  filename: string
  lineno?: number
  colno?: number
  platform: 'node:javascript' | 'web:javascript'
  in_app: boolean
}

/** Stackregels van V8 (`at fn (pad:regel:kolom)`) naar frames, met alleen de bestandsnaam. */
export function parseStack(stack: string, platform: Frame['platform']): Frame[] {
  const frames: Frame[] = []
  for (const line of stack.split('\n')) {
    const match = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line)
    if (!match) continue
    const [, fn, location, lineno, colno] = match
    const file = location!.split(/[/\\]/).pop() ?? ''
    frames.push({
      function: fn ?? '?',
      filename: file.split('?')[0]!,
      lineno: Number(lineno),
      colno: Number(colno),
      platform,
      in_app: !location!.includes('node_modules') && !location!.startsWith('node:')
    })
  }
  // PostHog verwacht de oudste aanroep eerst, net als Sentry.
  return frames.reverse()
}

/** De eigenschappen van een `$exception`-event (PostHog error tracking). */
export function exceptionProperties(
  report: ErrorReport,
  source: 'main' | 'renderer'
): Record<string, unknown> {
  const platform = source === 'main' ? 'node:javascript' : 'web:javascript'
  const frames = report.stack ? parseStack(report.stack, platform) : []
  return {
    source,
    $exception_list: [
      {
        type: scrub(report.name || 'Error').slice(0, 200),
        value: scrub(report.message).slice(0, 1000),
        mechanism: { handled: false, synthetic: false },
        ...(frames.length ? { stacktrace: { type: 'raw', frames } } : {})
      }
    ]
  }
}
