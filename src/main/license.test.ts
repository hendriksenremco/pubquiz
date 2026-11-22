import { describe, expect, it } from 'vitest'
import { LicenseClient, type FetchLike } from './license'
import { NoticeError } from './messages'

const store = { storeId: 7, productId: 42, buyUrl: 'https://quiznote.app/pro' }
const meta = { store_id: 7, product_id: 42 }

/** Een nep-Lemon Squeezy: geeft per actie een vast antwoord, en onthoudt wat er gevraagd werd. */
function fake(replies: Record<string, { status?: number; body: unknown } | 'offline'>) {
  const calls: { action: string; body: URLSearchParams }[] = []
  const fetchFn: FetchLike = async (url, init) => {
    const action = url.split('/').pop()!
    calls.push({ action, body: new URLSearchParams(String(init.body)) })
    const reply = replies[action]
    if (!reply || reply === 'offline') throw new TypeError('fetch failed')
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
  }
  return { client: new LicenseClient(fetchFn, store, 'https://licenties.test/v1'), calls }
}

const errorKey = async (p: Promise<unknown>) => {
  try {
    await p
    return null
  } catch (err) {
    return err instanceof NoticeError ? err.key : String(err)
  }
}

describe('LicenseClient', () => {
  it('activeert een code en bewaart de activatie van deze Mac', async () => {
    const { client, calls } = fake({
      activate: {
        body: {
          activated: true,
          error: null,
          license_key: { status: 'active', expires_at: '2027-01-01T00:00:00.000000Z' },
          instance: { id: 'inst-1' },
          meta
        }
      }
    })
    const license = await client.activate('KEY-1', 'QuizNote (Mac)', 1000)
    expect(license).toEqual({
      key: 'KEY-1',
      instanceId: 'inst-1',
      status: 'active',
      checkedAt: 1000,
      expiresAt: Date.parse('2027-01-01T00:00:00Z')
    })
    expect(calls[0]!.body.get('license_key')).toBe('KEY-1')
    expect(calls[0]!.body.get('instance_name')).toBe('QuizNote (Mac)')
  })

  it('legt uit waarom een code niet werkt', async () => {
    const wrong = fake({
      activate: { status: 404, body: { activated: false, error: 'license_key not found.' } }
    })
    expect(await errorKey(wrong.client.activate('x', 'Mac'))).toBe('licenseInvalid')

    const limit = fake({
      activate: {
        status: 400,
        body: {
          activated: false,
          error: 'This license key has reached the activation limit.',
          meta
        }
      }
    })
    expect(await errorKey(limit.client.activate('x', 'Mac'))).toBe('licenseLimit')

    const other = fake({
      activate: {
        body: { activated: true, instance: { id: 'i' }, meta: { store_id: 7, product_id: 1 } }
      }
    })
    expect(await errorKey(other.client.activate('x', 'Mac'))).toBe('licenseNotPro')

    const offline = fake({ activate: 'offline' })
    expect(await errorKey(offline.client.activate('x', 'Mac'))).toBe('licenseOffline')
  })

  const stored = {
    key: 'KEY-1',
    instanceId: 'inst-1',
    status: 'active' as const,
    checkedAt: 0,
    expiresAt: null
  }

  it('controleert een code opnieuw, en houdt de oude als er geen internet is', async () => {
    const ok = fake({
      validate: { body: { valid: true, license_key: { status: 'active' }, meta } }
    })
    expect(await ok.client.validate(stored, 5000)).toMatchObject({
      status: 'active',
      checkedAt: 5000
    })
    expect(ok.calls[0]!.body.get('instance_id')).toBe('inst-1')

    const expired = fake({
      validate: { body: { valid: false, license_key: { status: 'expired' }, meta } }
    })
    expect((await expired.client.validate(stored, 5000))?.status).toBe('expired')

    const gone = fake({ validate: { status: 404, body: { valid: false, error: 'not found' } } })
    expect((await gone.client.validate(stored, 5000))?.status).toBe('disabled')

    const offline = fake({ validate: 'offline' })
    expect(await offline.client.validate(stored, 5000)).toBeNull()
  })

  it('haalt een code van deze Mac, ook zonder verbinding zonder fout', async () => {
    const ok = fake({ deactivate: { body: { deactivated: true, meta } } })
    await ok.client.deactivate(stored)
    expect(ok.calls[0]!.action).toBe('deactivate')
    await fake({ deactivate: 'offline' }).client.deactivate(stored)
  })
})
