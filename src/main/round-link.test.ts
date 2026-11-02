import { readFileSync } from 'fs'
import { basename } from 'path'
import { describe, expect, it } from 'vitest'
import { NoticeError } from './messages'
import { downloadRoundFile, fileName } from './round-link'

const ORIGIN = 'https://quiznote.app'

/** Een nep-`fetch` met vaste antwoorden per adres. */
function fakeFetch(routes: Record<string, () => Response>) {
  const asked: string[] = []
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input)
    asked.push(url)
    const route = routes[url]
    if (!route) throw new TypeError('fetch failed', { cause: new Error('ENOTFOUND') })
    return route()
  }) as typeof fetch
  return { fetcher, asked }
}

const redirect = (to: string) => () =>
  new Response(null, { status: 302, headers: { location: to } })

async function noticeKey(promise: Promise<unknown>): Promise<string> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  )
  expect(err).toBeInstanceOf(NoticeError)
  return (err as NoticeError).key
}

describe('downloadRoundFile', () => {
  it('haalt het bestand op en bewaart het onder zijn eigen naam', async () => {
    const { fetcher } = fakeFetch({
      [`${ORIGIN}/bibliotheek/sport.quiznoteronde`]: () => new Response('zip')
    })
    const path = await downloadRoundFile(
      `${ORIGIN}/bibliotheek/sport.quiznoteronde`,
      ORIGIN,
      fetcher
    )
    expect(basename(path)).toBe('sport.quiznoteronde')
    expect(readFileSync(path, 'utf8')).toBe('zip')
  })

  it('volgt een doorverwijzing binnen de site', async () => {
    const { fetcher, asked } = fakeFetch({
      [`${ORIGIN}/a.quiznoteronde`]: redirect('/b.quiznoteronde'),
      [`${ORIGIN}/b.quiznoteronde`]: () => new Response('b')
    })
    const path = await downloadRoundFile(`${ORIGIN}/a.quiznoteronde`, ORIGIN, fetcher)
    expect(asked).toEqual([`${ORIGIN}/a.quiznoteronde`, `${ORIGIN}/b.quiznoteronde`])
    expect(basename(path)).toBe('b.quiznoteronde')
  })

  it('weigert een doorverwijzing naar een andere site', async () => {
    const { fetcher, asked } = fakeFetch({
      [`${ORIGIN}/a.quiznoteronde`]: redirect('https://evil.example/a.quiznoteronde')
    })
    expect(await noticeKey(downloadRoundFile(`${ORIGIN}/a.quiznoteronde`, ORIGIN, fetcher))).toBe(
      'badRoundLink'
    )
    expect(asked).toHaveLength(1)
  })

  it('stopt na te veel doorverwijzingen', async () => {
    const { fetcher } = fakeFetch({ [`${ORIGIN}/a`]: redirect('/a') })
    expect(await noticeKey(downloadRoundFile(`${ORIGIN}/a`, ORIGIN, fetcher))).toBe(
      'roundDownloadFailed'
    )
  })

  it('meldt een HTTP-fout of een netwerkfout', async () => {
    const { fetcher } = fakeFetch({
      [`${ORIGIN}/weg.quiznoteronde`]: () => new Response('nee', { status: 404 })
    })
    const err = await downloadRoundFile(`${ORIGIN}/weg.quiznoteronde`, ORIGIN, fetcher).catch(
      (e: NoticeError) => e
    )
    expect(err).toMatchObject({ key: 'roundDownloadFailed', params: { error: 'HTTP 404' } })
    expect(await noticeKey(downloadRoundFile(`${ORIGIN}/elders`, ORIGIN, fetcher))).toBe(
      'roundDownloadFailed'
    )
  })

  it('weigert een te groot bestand', async () => {
    const { fetcher } = fakeFetch({
      [`${ORIGIN}/groot.quiznoteronde`]: () =>
        new Response('x', { headers: { 'content-length': String(2 * 1024 ** 3) } })
    })
    expect(
      await noticeKey(downloadRoundFile(`${ORIGIN}/groot.quiznoteronde`, ORIGIN, fetcher))
    ).toBe('roundFileTooBig')
  })

  it('weigert een adres buiten de site', async () => {
    const { fetcher, asked } = fakeFetch({})
    expect(await noticeKey(downloadRoundFile('https://evil.example/a', ORIGIN, fetcher))).toBe(
      'badRoundLink'
    )
    expect(asked).toHaveLength(0)
  })
})

describe('fileName', () => {
  it('neemt de naam uit het adres, veilig', () => {
    expect(fileName(`${ORIGIN}/x/Jaren%2080.quiznoteronde`)).toBe('Jaren 80.quiznoteronde')
    expect(fileName(`${ORIGIN}/x/sport.QUIZNOTERONDE`)).toBe('sport.quiznoteronde')
    expect(fileName(`${ORIGIN}/x/..%2F..%2Fetc.quiznoteronde`)).toBe('etc.quiznoteronde')
    expect(fileName(`${ORIGIN}/x/`)).toBe('Ronde.quiznoteronde')
    expect(fileName(`${ORIGIN}/download?id=3`)).toBe('download.quiznoteronde')
  })
})
