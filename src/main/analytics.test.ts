import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Analytics } from './analytics'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pubquiz-analytics-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const ok = () => vi.fn(async () => new Response('{}', { status: 200 }))
const sentBatches = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.map(
    (call) => JSON.parse((call[1] as RequestInit).body as string).batch as { event: string }[]
  )

function make(fetch: ReturnType<typeof vi.fn>, id: () => string | null = () => 'anon') {
  return new Analytics({
    dir,
    identity: id,
    base: { app_version: '0.1.0' },
    fetch: fetch as unknown as typeof globalThis.fetch
  })
}

describe('Analytics', () => {
  it('stuurt niets zonder toestemming, en bewaart ook niets', async () => {
    const fetch = ok()
    const analytics = make(fetch, () => null)
    analytics.capture('app_started')
    analytics.captureError({ name: 'Error', message: 'kapot' }, 'main')
    await analytics.flush()
    await analytics.whenSaved()
    analytics.stop()
    expect(fetch).not.toHaveBeenCalled()
    expect(existsSync(join(dir, 'analytics-queue.json'))).toBe(false)
  })

  it('stuurt anonieme events met de vaste eigenschappen', async () => {
    const fetch = ok()
    const analytics = make(fetch)
    analytics.capture('show_started', { rounds: 3 })
    await analytics.flush()
    analytics.stop()
    const [batch] = sentBatches(fetch)
    expect(batch).toHaveLength(1)
    expect(batch![0]).toMatchObject({
      event: 'show_started',
      properties: {
        rounds: 3,
        app_version: '0.1.0',
        distinct_id: 'anon',
        $process_person_profile: false,
        $geoip_disable: true
      }
    })
    await analytics.whenSaved()
    expect(existsSync(join(dir, 'analytics-queue.json'))).toBe(false)
  })

  it('bewaart events zonder verbinding en stuurt ze bij de volgende start', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    const first = make(offline)
    first.capture('app_started')
    await first.flush()
    first.stop()
    await first.whenSaved()
    expect(JSON.parse(readFileSync(join(dir, 'analytics-queue.json'), 'utf8'))).toHaveLength(1)

    const fetch = ok()
    const second = make(fetch)
    second.capture('app_started')
    await second.flush()
    second.stop()
    expect(sentBatches(fetch)[0]).toHaveLength(2)
  })

  it('gooit events weg die ouder zijn dan een week', async () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    writeFileSync(
      join(dir, 'analytics-queue.json'),
      JSON.stringify([{ event: 'oud', properties: {}, timestamp: old }])
    )
    const fetch = ok()
    const analytics = make(fetch)
    await analytics.flush()
    analytics.stop()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('vergeet de wachtrij als de toestemming wordt ingetrokken', async () => {
    let id: string | null = 'anon'
    const offline = vi.fn(async () => new Response('', { status: 503 }))
    const analytics = make(offline, () => id)
    analytics.capture('app_started')
    await analytics.flush()
    id = null
    analytics.clear()
    await analytics.whenSaved()
    analytics.stop()
    expect(existsSync(join(dir, 'analytics-queue.json'))).toBe(false)
  })

  it('stuurt dezelfde fout maar één keer', async () => {
    const fetch = ok()
    const analytics = make(fetch)
    for (let i = 0; i < 5; i++)
      analytics.captureError({ name: 'Error', message: 'lus' }, 'renderer')
    await analytics.flush()
    analytics.stop()
    const [batch] = sentBatches(fetch)
    expect(batch!.map((e) => e.event)).toEqual(['$exception'])
  })
})
