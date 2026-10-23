import { resolve, sep } from 'path'

export interface MediaRoots {
  /** Map van de geopende quiz, of null. */
  current(): string | null
  /** Mag deze (niet geopende) quizmap previews leveren? Alleen recente quizzen. */
  isRecent(dir: string): boolean
}

export type MediaLocation = { file: string } | { status: 403 | 404; message: string }

/**
 * Vertaalt een `pq-media://` URL naar een bestand op schijf.
 * - `pq-media://quiz/<pad>` → uit de geopende quiz
 * - `pq-media://recent/<gecodeerde quizmap>/<pad>` → uit een recente quiz (dashboard-previews)
 * Alles buiten de quizmap (bv. via `..`) wordt geweigerd.
 */
export function locateMedia(url: string, roots: MediaRoots): MediaLocation {
  const parsed = new URL(url)
  const segments = parsed.pathname.split('/').filter(Boolean)
  let root: string | null = null

  if (parsed.host === 'quiz') {
    root = roots.current()
    if (!root) return { status: 404, message: 'Geen quiz geopend' }
  } else if (parsed.host === 'recent') {
    const dir = decodeURIComponent(segments.shift() ?? '')
    if (!dir || !roots.isRecent(dir)) return { status: 403, message: 'Geen recente quiz' }
    root = dir
  } else {
    return { status: 404, message: 'Onbekende bron' }
  }

  const file = resolve(root, segments.map(decodeURIComponent).join('/'))
  if (!file.startsWith(resolve(root) + sep)) return { status: 403, message: 'Verboden pad' }
  return { file }
}
