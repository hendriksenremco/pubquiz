import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ROUND_FILE_EXT, ROUND_FILE_MAX_BYTES } from '@shared/round-file'
import { isAllowedSource } from '@shared/round-link'
import { NoticeError } from './messages'

/** Zoveel doorverwijzingen volgen we, en alleen binnen de toegestane oorsprong. */
const MAX_REDIRECTS = 5

/**
 * Haalt een rondebestand op (de link vanaf de site, issue #99) en zet het in een eigen tijdelijke
 * map. Geeft het pad terug; de editor importeert het daarna net als een bestand uit Finder.
 * Elke doorverwijzing moet ook van `origin` komen. Fouten zijn een `NoticeError`.
 */
export async function downloadRoundFile(
  source: string,
  origin: string,
  fetcher: typeof fetch = fetch
): Promise<string> {
  let url = source
  let response: Response
  for (let hop = 0; ; hop++) {
    if (!isAllowedSource(url, origin)) throw new NoticeError('badRoundLink')
    try {
      response = await fetcher(url, { redirect: 'manual' })
    } catch (err) {
      throw new NoticeError('roundDownloadFailed', { error: reason(err) })
    }
    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location) break
    if (hop >= MAX_REDIRECTS) {
      throw new NoticeError('roundDownloadFailed', { error: `HTTP ${response.status}` })
    }
    url = new URL(location, url).href
  }
  if (!response.ok) {
    throw new NoticeError('roundDownloadFailed', { error: `HTTP ${response.status}` })
  }
  if (Number(response.headers.get('content-length') ?? 0) > ROUND_FILE_MAX_BYTES) {
    throw new NoticeError('roundFileTooBig')
  }

  const data = await readLimited(response)
  const dir = await fs.mkdtemp(join(tmpdir(), 'quiznote-ronde-'))
  const path = join(dir, fileName(url))
  await fs.writeFile(path, data)
  return path
}

/** Leest de body, maar stopt boven `ROUND_FILE_MAX_BYTES`. */
async function readLimited(response: Response): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    if (response.body) {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.byteLength
        if (size > ROUND_FILE_MAX_BYTES) throw new NoticeError('roundFileTooBig')
        chunks.push(chunk)
      }
    }
  } catch (err) {
    if (err instanceof NoticeError) throw err
    throw new NoticeError('roundDownloadFailed', { error: reason(err) })
  }
  return Buffer.concat(chunks)
}

/** De naam uit het adres, zonder mappen of vreemde tekens; altijd met `.quiznoteronde`. */
export function fileName(url: string): string {
  let last = new URL(url).pathname.split('/').pop() ?? ''
  try {
    last = decodeURIComponent(last)
  } catch {
    // Laat de naam zoals hij is.
  }
  const base = last
    .replace(new RegExp(`${ROUND_FILE_EXT.replace('.', '\\.')}$`, 'i'), '')
    .replace(/[/\\:\0]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 100)
  return `${base || 'Ronde'}${ROUND_FILE_EXT}`
}

function reason(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    return cause instanceof Error ? cause.message : err.message
  }
  return String(err)
}
