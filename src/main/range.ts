/** Inclusief bytebereik, zoals in `Content-Range`. */
export interface ByteRange {
  start: number
  end: number
}

/**
 * Parseert een HTTP `Range`-header voor een bestand van `size` bytes.
 * null = geen (bruikbare) range → hele bestand; 'unsatisfiable' = 416.
 * Bij meerdere ranges wordt alleen de eerste gebruikt.
 */
export function parseRange(
  header: string | null | undefined,
  size: number
): ByteRange | null | 'unsatisfiable' {
  if (!header) return null
  const match = /^bytes=\s*(\d*)\s*-\s*(\d*)\s*(?:,.*)?$/i.exec(header.trim())
  if (!match) return null
  const [, startText, endText] = match
  if (startText === '' && endText === '') return null

  if (startText === '') {
    const suffix = Number(endText)
    if (suffix === 0 || size === 0) return 'unsatisfiable'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }

  const start = Number(startText)
  const end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1)
  if (start >= size || start > end) return 'unsatisfiable'
  return { start, end }
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml'
}

export function mimeType(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  return MIME[ext] ?? 'application/octet-stream'
}
