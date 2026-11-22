import { z } from 'zod'
import type { LicenseStatus, StoredLicense } from '@shared/license'
import { NoticeError } from './messages'

/**
 * De licentieserver van QuizNote Pro (issue #384) op quiznote.app: een Firebase Function in de
 * site-repo (`functions/licenses.js`), die bij Stripe nagaat of een abonnement loopt. Alleen de
 * code en een naam voor deze Mac gaan erheen; geen quizinhoud.
 *
 * PUBQUIZ_LICENSE_URL: een andere server (tests).
 */
const BASE = process.env['PUBQUIZ_LICENSE_URL'] ?? 'https://quiznote.app/api/licenses'
const TIMEOUT_MS = 15_000

const StatusSchema = z.enum(['active', 'inactive', 'expired', 'disabled'])
const LicenseSchema = z.object({
  status: StatusSchema,
  expiresAt: z.number().nullable().optional()
})
const ActivatedSchema = LicenseSchema.extend({ instanceId: z.string() })
const ErrorSchema = z.object({ error: z.string() })

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export class LicenseClient {
  constructor(
    private readonly fetchFn: FetchLike = fetch,
    private readonly base = BASE
  ) {}

  /** Zet de code aan voor deze Mac. Gooit een `NoticeError` met een uitleg als het niet lukt. */
  async activate(key: string, instanceName: string, now = Date.now()): Promise<StoredLicense> {
    const reply = await this.call('activate', { key, name: instanceName })
    const error = ErrorSchema.safeParse(reply.body)
    if (!reply.ok || error.success) throw refusal(error.success ? error.data.error : null)
    const parsed = ActivatedSchema.safeParse(reply.body)
    if (!parsed.success) throw new NoticeError('licenseOffline')
    return {
      key,
      instanceId: parsed.data.instanceId,
      status: parsed.data.status,
      checkedAt: now,
      expiresAt: parsed.data.expiresAt ?? null
    }
  }

  /**
   * Controleert een code opnieuw. Geeft de bijgewerkte licentie, of null als de server niet te
   * bereiken is (dan blijft de oude gelden tot `OFFLINE_DAYS` voorbij is).
   */
  async validate(license: StoredLicense, now = Date.now()): Promise<StoredLicense | null> {
    let reply: { ok: boolean; body: unknown }
    try {
      reply = await this.call('validate', { key: license.key, instanceId: license.instanceId })
    } catch {
      return null
    }
    const parsed = LicenseSchema.safeParse(reply.body)
    if (!reply.ok || !parsed.success) return null
    const status: LicenseStatus = parsed.data.status
    return { ...license, status, checkedAt: now, expiresAt: parsed.data.expiresAt ?? null }
  }

  /** Haalt de code van deze Mac af, zodat hij op een andere Mac kan. Zonder verbinding: niets. */
  async deactivate(license: StoredLicense): Promise<void> {
    await this.call('deactivate', { key: license.key, instanceId: license.instanceId }).catch(
      () => {}
    )
  }

  /** Een POST naar de server. Geen verbinding of een storing (5xx): `licenseOffline`. */
  private async call(
    action: string,
    body: Record<string, string>
  ): Promise<{ ok: boolean; body: unknown }> {
    let response: Response
    try {
      response = await this.fetchFn(`${this.base}/${action}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    } catch {
      throw new NoticeError('licenseOffline')
    }
    if (response.status >= 500) throw new NoticeError('licenseOffline')
    return { ok: response.ok, body: await response.json().catch(() => null) }
  }
}

function refusal(error: string | null): NoticeError {
  if (error === 'limit') return new NoticeError('licenseLimit')
  if (error === 'expired') return new NoticeError('licenseExpired')
  if (error === 'disabled') return new NoticeError('licenseNotPro')
  return new NoticeError('licenseInvalid')
}
