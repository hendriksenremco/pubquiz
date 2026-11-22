import { z } from 'zod'
import { LICENSE_STORE, type LicenseStatus, type StoredLicense } from '@shared/license'
import { NoticeError } from './messages'

/**
 * De License API van Lemon Squeezy (issue #384): activeren, controleren en weghalen van een
 * code, zonder API-sleutel en zonder eigen server. Alleen de code en een naam voor deze Mac gaan
 * naar Lemon Squeezy; geen quizinhoud.
 * https://docs.lemonsqueezy.com/api/license-api
 *
 * PUBQUIZ_LICENSE_URL: een andere server (tests).
 */
const BASE = process.env['PUBQUIZ_LICENSE_URL'] ?? 'https://api.lemonsqueezy.com/v1/licenses'
const TIMEOUT_MS = 15_000

const KeySchema = z.object({
  status: z.enum(['active', 'inactive', 'expired', 'disabled']),
  expires_at: z.string().nullable().optional()
})
const MetaSchema = z.object({ store_id: z.number(), product_id: z.number() })
const ReplySchema = z.object({
  activated: z.boolean().optional(),
  valid: z.boolean().optional(),
  deactivated: z.boolean().optional(),
  error: z.string().nullable().optional(),
  license_key: KeySchema.nullable().optional(),
  instance: z.object({ id: z.string() }).nullable().optional(),
  meta: MetaSchema.nullable().optional()
})
type Reply = z.infer<typeof ReplySchema>

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export class LicenseClient {
  constructor(
    private readonly fetchFn: FetchLike = fetch,
    private readonly store = LICENSE_STORE,
    private readonly base = BASE
  ) {}

  /** Zet de code aan voor deze Mac. Gooit een `NoticeError` met een uitleg als het niet lukt. */
  async activate(key: string, instanceName: string, now = Date.now()): Promise<StoredLicense> {
    const reply = await this.call('activate', { license_key: key, instance_name: instanceName })
    this.checkProduct(reply)
    if (!reply.activated || !reply.instance) throw this.refusal(reply)
    return this.stored(key, reply.instance.id, reply, now)
  }

  /**
   * Controleert een code opnieuw. Geeft de bijgewerkte licentie, of null als er geen verbinding
   * is (dan blijft de oude gelden tot `OFFLINE_DAYS` voorbij is).
   */
  async validate(license: StoredLicense, now = Date.now()): Promise<StoredLicense | null> {
    let reply: Reply
    try {
      reply = await this.call('validate', {
        license_key: license.key,
        instance_id: license.instanceId
      })
    } catch (err) {
      if (err instanceof NoticeError && err.key === 'licenseOffline') return null
      throw err
    }
    this.checkProduct(reply)
    const status: LicenseStatus = reply.valid
      ? (reply.license_key?.status ?? 'active')
      : reply.license_key?.status && reply.license_key.status !== 'active'
        ? reply.license_key.status
        : 'disabled'
    return { ...this.stored(license.key, license.instanceId, reply, now), status }
  }

  /** Haalt de code van deze Mac af, zodat hij op een andere Mac kan. Zonder verbinding: niets. */
  async deactivate(license: StoredLicense): Promise<void> {
    await this.call('deactivate', {
      license_key: license.key,
      instance_id: license.instanceId
    }).catch(() => {})
  }

  private stored(key: string, instanceId: string, reply: Reply, now: number): StoredLicense {
    const expires = reply.license_key?.expires_at
    return {
      key,
      instanceId,
      status: reply.license_key?.status ?? 'active',
      checkedAt: now,
      expiresAt: expires ? Date.parse(expires) : null
    }
  }

  private checkProduct(reply: Reply): void {
    const meta = reply.meta
    if (
      meta &&
      (meta.store_id !== this.store.storeId || meta.product_id !== this.store.productId)
    ) {
      throw new NoticeError('licenseNotPro')
    }
  }

  private refusal(reply: Reply): NoticeError {
    const status = reply.license_key?.status
    if (status === 'expired') return new NoticeError('licenseExpired')
    if (/limit/i.test(reply.error ?? '')) return new NoticeError('licenseLimit')
    return new NoticeError('licenseInvalid')
  }

  private async call(action: string, body: Record<string, string>): Promise<Reply> {
    let response: Response
    try {
      response = await this.fetchFn(`${this.base}/${action}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(body).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    } catch {
      throw new NoticeError('licenseOffline')
    }
    // Een onbekende code geeft 404 of 400, met dezelfde vorm van antwoord.
    if (response.status >= 500) throw new NoticeError('licenseOffline')
    const parsed = ReplySchema.safeParse(await response.json().catch(() => null))
    if (!parsed.success) throw new NoticeError('licenseInvalid')
    return parsed.data
  }
}
