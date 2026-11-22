import { describe, expect, it } from 'vitest'
import { LicenseClient, type FetchLike } from './license'
import { NoticeError } from './messages'

/** Een nep-licentieserver: geeft per actie een vast antwoord, en onthoudt wat er gevraagd werd. */
function fake(replies: Record<string, { status?: number; body: unknown } | 'offline'>) {
  const calls: { action: string; body: Record<string, string> }[] = []
  const fetchFn: FetchLike = async (url, init) => {
    const action = url.split('/').pop()!
    calls.push({ action, body: JSON.parse(String(init.body)) })
    const reply = replies[action]
    if (!reply || reply === 'offline') throw new TypeError('fetch failed')
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
  }
  return { client: new LicenseClient(fetchFn, 'https://licenties.test/api/licenses'), calls }
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
      activate: { body: { instanceId: 'mac-1', status: 'active', expiresAt: 5000 } }
    })
    expect(await client.activate('QNP-1-ABC', 'QuizNote (Mac)', 1000)).toEqual({
      key: 'QNP-1-ABC',
      instanceId: 'mac-1',
      status: 'active',
      checkedAt: 1000,
      expiresAt: 5000
    })
    expect(calls[0]!.body).toEqual({ key: 'QNP-1-ABC', name: 'QuizNote (Mac)' })
  })

  it('legt uit waarom een code niet werkt', async () => {
    const cases: [number, string, string][] = [
      [404, 'invalid', 'licenseInvalid'],
      [409, 'limit', 'licenseLimit'],
      [403, 'expired', 'licenseExpired'],
      [403, 'disabled', 'licenseNotPro']
    ]
    for (const [status, error, key] of cases) {
      const { client } = fake({ activate: { status, body: { error } } })
      expect(await errorKey(client.activate('x', 'Mac'))).toBe(key)
    }
    expect(await errorKey(fake({ activate: 'offline' }).client.activate('x', 'Mac'))).toBe(
      'licenseOffline'
    )
    const broken = fake({ activate: { status: 502, body: { error: 'stripe' } } })
    expect(await errorKey(broken.client.activate('x', 'Mac'))).toBe('licenseOffline')
  })

  const stored = {
    key: 'QNP-1-ABC',
    instanceId: 'mac-1',
    status: 'active' as const,
    checkedAt: 0,
    expiresAt: null
  }

  it('controleert een code opnieuw, en houdt de oude als de server niet te bereiken is', async () => {
    const ok = fake({ validate: { body: { status: 'active', expiresAt: null } } })
    expect(await ok.client.validate(stored, 5000)).toMatchObject({
      status: 'active',
      checkedAt: 5000
    })
    expect(ok.calls[0]!.body).toEqual({ key: 'QNP-1-ABC', instanceId: 'mac-1' })

    const expired = fake({ validate: { body: { status: 'expired', expiresAt: 4000 } } })
    expect(await expired.client.validate(stored, 5000)).toMatchObject({
      status: 'expired',
      expiresAt: 4000
    })

    expect(await fake({ validate: 'offline' }).client.validate(stored, 5000)).toBeNull()
    const broken = fake({ validate: { status: 502, body: { error: 'stripe' } } })
    expect(await broken.client.validate(stored, 5000)).toBeNull()
  })

  it('haalt een code van deze Mac, ook zonder verbinding zonder fout', async () => {
    const ok = fake({ deactivate: { body: { deactivated: true } } })
    await ok.client.deactivate(stored)
    expect(ok.calls[0]!.action).toBe('deactivate')
    await fake({ deactivate: 'offline' }).client.deactivate(stored)
  })
})
