import { promises as fs } from 'fs'
import { join } from 'path'
import {
  exceptionProperties,
  POSTHOG_HOST,
  POSTHOG_KEY,
  type AnalyticsEvent,
  type ErrorReport
} from '@shared/analytics'
import { readJson, writeJson } from './json-store'

/** Langer bewaren heeft geen zin: dan klopt het beeld niet meer. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_QUEUE = 500
/** Per start; een fout die in een lus zit, stuurt zo geen honderden rapporten. */
const MAX_ERRORS = 20
const SEND_DELAY_MS = 10_000
const RETRY_MS = 5 * 60_000
const TIMEOUT_MS = 10_000

export interface AnalyticsOptions {
  /** Waar de wachtrij staat (userData). */
  dir: string
  /** Toestemming en anoniem id; null = geen toestemming (of nog niet gevraagd). */
  identity: () => string | null
  /** Vast bij elk event: versie, macOS-versie, processor. */
  base: Record<string, unknown>
  /** Voor tests. */
  fetch?: typeof fetch
  now?: () => number
}

/**
 * Stuurt anonieme events naar PostHog, alleen met toestemming. Zonder internet wachten ze in
 * `analytics-queue.json` tot er weer verbinding is, hooguit een week. Versturen gebeurt los van
 * de show en mag nooit iets laten haperen: fouten worden ingeslikt.
 */
export class Analytics {
  private queue: AnalyticsEvent[] = []
  private loaded: Promise<void>
  private timer: ReturnType<typeof setTimeout> | null = null
  private sending: Promise<void> | null = null
  private saving: Promise<void>
  private errors = new Set<string>()
  private readonly fetch: typeof fetch
  private readonly now: () => number

  constructor(private readonly options: AnalyticsOptions) {
    this.fetch = options.fetch ?? globalThis.fetch
    this.now = options.now ?? Date.now
    this.loaded = readJson<AnalyticsEvent[]>(this.file).then((stored) => {
      if (Array.isArray(stored) && options.identity()) this.queue = [...stored, ...this.queue]
    })
    // Pas opslaan als de oude wachtrij gelezen is, anders overschrijft hij die.
    this.saving = this.loaded
  }

  private get file(): string {
    return join(this.options.dir, 'analytics-queue.json')
  }

  capture(event: string, properties: Record<string, unknown> = {}): void {
    const id = this.options.identity()
    if (!id) return
    this.queue.push({
      event,
      properties: {
        ...this.options.base,
        ...properties,
        distinct_id: id,
        // Anoniem: geen persoonsprofiel en geen locatie uit het IP-adres.
        $process_person_profile: false,
        $geoip_disable: true
      },
      timestamp: new Date(this.now()).toISOString()
    })
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE)
    void this.save()
    this.schedule(SEND_DELAY_MS)
  }

  /** Een onverwerkte fout; dezelfde melding gaat maar één keer per start. */
  captureError(report: ErrorReport, source: 'main' | 'renderer'): void {
    const key = `${source}:${report.name}:${report.message}`
    if (this.errors.has(key) || this.errors.size >= MAX_ERRORS) return
    this.errors.add(key)
    this.capture('$exception', exceptionProperties(report, source))
  }

  /** Toestemming ingetrokken: wat nog wacht, gaat weg. */
  clear(): void {
    this.queue = []
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.saving = this.saving.then(() => fs.rm(this.file, { force: true })).catch(() => {})
  }

  /** Probeert alles wat wacht te versturen; klaar als dat gelukt of mislukt is. */
  flush(): Promise<void> {
    this.sending ??= this.send().finally(() => (this.sending = null))
    return this.sending
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private schedule(delay: number): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, delay)
    this.timer.unref?.()
  }

  private async send(): Promise<void> {
    await this.loaded
    const cutoff = this.now() - MAX_AGE_MS
    this.queue = this.queue.filter((e) => Date.parse(e.timestamp) >= cutoff)
    if (!this.options.identity()) {
      this.queue = []
      return this.save()
    }
    if (!this.queue.length) return
    const batch = this.queue.slice()
    try {
      const response = await this.fetch(`${POSTHOG_HOST}/batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: POSTHOG_KEY, batch }),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      // 4xx (behalve te veel verzoeken): opnieuw sturen helpt niet, dus weggooien.
      if (!response.ok && (response.status >= 500 || response.status === 429)) {
        throw new Error(`PostHog ${response.status}`)
      }
      this.queue = this.queue.filter((e) => !batch.includes(e))
    } catch {
      // Geen verbinding of PostHog onbereikbaar: later nog eens.
      this.schedule(RETRY_MS)
    }
    await this.save()
  }

  private save(): Promise<void> {
    this.saving = this.saving
      .then(() =>
        this.queue.length ? writeJson(this.file, this.queue) : fs.rm(this.file, { force: true })
      )
      .catch(() => {})
    return this.saving
  }

  /** Klaar als de wachtrij is weggeschreven (voor tests en bij afsluiten). */
  whenSaved(): Promise<void> {
    return this.saving
  }
}
