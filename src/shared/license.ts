import type { HardwareMapping, Quiz } from './types'

/**
 * QuizNote Pro (issue #384): freemium. Gratis is alles voor een gewone pubquiz met één scherm en
 * één geluidsuitgang; Pro voegt meer schermen en uitgangen, de plug-ins en de AI-koppeling toe.
 * Betalen loopt via Stripe; de licentieserver op quiznote.app (`functions/` in de site-repo) maakt
 * de codes en vraagt Stripe of een abonnement loopt. De app activeert een code één keer online en
 * werkt daarna `OFFLINE_DAYS` dagen zonder internet.
 */

/**
 * Pro staat pas aan als de winkel live is (Stripe geverifieerd, de licentieserver gedeployd).
 * Tot dan staat alles open: zo kan de code al mee zonder dat iemand iets kwijtraakt.
 */
const STORE_LIVE = false

/** PUBQUIZ_LICENSE_READY=1: de winkel aan, voor de tests (alleen in main). */
function testReady(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  return env?.['PUBQUIZ_LICENSE_READY'] === '1'
}

export const LICENSE_STORE = {
  ready: STORE_LIVE || testReady(),
  /** De pagina met de prijzen en de knoppen om te kopen. */
  buyUrl: 'https://quiznote.app/pro'
}

export const storeReady = (store: { ready: boolean } = LICENSE_STORE) => store.ready

/** Zo lang werkt Pro zonder dat de app de code opnieuw heeft kunnen controleren. */
export const OFFLINE_DAYS = 30
/** Wie de app al gebruikte voordat Pro er was, krijgt Pro zo lang gratis. */
export const EARLY_DAYS = 90
/** Zo vaak controleert de app een code opnieuw, als er internet is. */
export const CHECK_EVERY_MS = 24 * 3600_000

export const DAY_MS = 24 * 3600_000

export type LicenseStatus = 'active' | 'inactive' | 'expired' | 'disabled'

/** Wat de app per Mac van een geactiveerde code bewaart (in settings.json). */
export interface StoredLicense {
  key: string
  /** De activatie van deze Mac bij de licentieserver; nodig om te controleren en weg te halen. */
  instanceId: string
  status: LicenseStatus
  /** Laatste geslaagde controle bij de licentieserver (ms sinds epoch). */
  checkedAt: number
  /** Einde van de code volgens Stripe; null = loopt door zolang het abonnement loopt. */
  expiresAt: number | null
}

export interface ProState {
  pro: boolean
  /**
   * Waarom: `license` een geldige code, `early` de gratis tijd voor wie de app al gebruikte,
   * `open` de winkel is nog niet ingesteld, `none` geen Pro.
   */
  source: 'license' | 'early' | 'open' | 'none'
  /** De laatste vier tekens van de code, om te laten zien welke er op staat. */
  keyHint: string | null
  /** Tot wanneer: het einde van de gratis tijd, of van de code. */
  until: number | null
  /** Waarom een code niet (meer) telt. */
  problem: 'expired' | 'disabled' | 'offline' | null
}

export const keyHint = (key: string) =>
  key
    .replace(/[^a-z0-9]/gi, '')
    .slice(-4)
    .toUpperCase()

export function proState({
  license,
  earlyUntil,
  now,
  ready = storeReady()
}: {
  license: StoredLicense | null
  earlyUntil: number | null
  now: number
  ready?: boolean
}): ProState {
  if (!ready) return { pro: true, source: 'open', keyHint: null, until: null, problem: null }

  let problem: ProState['problem'] = null
  if (license) {
    const ended = license.expiresAt !== null && license.expiresAt <= now
    if (license.status === 'disabled') problem = 'disabled'
    else if (license.status === 'expired' || ended) problem = 'expired'
    else if (now - license.checkedAt > OFFLINE_DAYS * DAY_MS) problem = 'offline'
    if (!problem && license.status === 'active') {
      return {
        pro: true,
        source: 'license',
        keyHint: keyHint(license.key),
        until: license.expiresAt,
        problem: null
      }
    }
  }
  const hint = license ? keyHint(license.key) : null
  if (earlyUntil !== null && earlyUntil > now) {
    return { pro: true, source: 'early', keyHint: hint, until: earlyUntil, problem }
  }
  return { pro: false, source: 'none', keyHint: hint, until: null, problem }
}

/**
 * Wat de show zonder Pro gebruikt: alleen het eerste scherm, en alle geluidskanalen op de uitgang
 * van het eerste kanaal. Er verdwijnt niets uit de quiz of uit de bewaarde koppeling.
 */
export function limitMapping(quiz: Quiz, mapping: HardwareMapping, pro: boolean): HardwareMapping {
  if (pro) return mapping
  const [first, ...others] = quiz.screens
  const screens = { ...mapping.screens }
  for (const slot of others) screens[slot.id] = { kind: 'off' }
  const output = quiz.channels.map((c) => mapping.audio[c.id]).find(Boolean)
  const audio = output
    ? Object.fromEntries(quiz.channels.map((c) => [c.id, output]))
    : mapping.audio
  const screenSound =
    first && mapping.screenSound[first.id] ? { [first.id]: mapping.screenSound[first.id]! } : {}
  return { screens, audio, screenSound }
}

/** true als `limitMapping` zonder Pro iets aan deze koppeling verandert. */
export function needsPro(quiz: Quiz, mapping: HardwareMapping): boolean {
  const limited = limitMapping(quiz, mapping, false)
  return (
    quiz.screens.slice(1).some((s) => mapping.screens[s.id]?.kind !== 'off') ||
    quiz.channels.some((c) => limited.audio[c.id]?.deviceId !== mapping.audio[c.id]?.deviceId) ||
    Object.keys(mapping.screenSound).length > Object.keys(limited.screenSound).length
  )
}
