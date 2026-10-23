import { protocol } from 'electron'
import { createReadStream, promises as fs } from 'fs'
import { Readable } from 'stream'
import { MEDIA_SCHEME } from '@shared/ipc'
import { locateMedia, type MediaRoots } from './media-path'
import { mimeType, parseRange } from './range'

/** Moet vóór `app.ready` draaien. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
  ])
}

/**
 * Serveert mediabestanden uit de geopende quiz (en previews uit recente quizzen, zie locateMedia).
 * Range-requests handelen we zelf af: `net.fetch(file://)` geeft 200 zonder `Content-Range`,
 * waardoor seeken en loopen van video breekt (electron/electron#38749).
 */
export function handleMediaProtocol(roots: MediaRoots): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const location = locateMedia(request.url, roots)
    if (!('file' in location)) {
      return new Response(location.message, { status: location.status })
    }
    const filePath = location.file

    const stat = await fs.stat(filePath).catch(() => null)
    if (!stat?.isFile()) return new Response('Niet gevonden', { status: 404 })

    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Content-Type': mimeType(filePath),
      'Access-Control-Allow-Origin': '*'
    })
    if (stat.size === 0) return new Response(null, { status: 200, headers })

    const range = parseRange(request.headers.get('range'), stat.size)
    if (range === 'unsatisfiable') {
      headers.set('Content-Range', `bytes */${stat.size}`)
      return new Response(null, { status: 416, headers })
    }

    const { start, end } = range ?? { start: 0, end: stat.size - 1 }
    const status = range ? 206 : 200
    headers.set('Content-Length', String(end - start + 1))
    if (range) headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`)
    if (request.method === 'HEAD') return new Response(null, { status, headers })

    const body = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream
    return new Response(body, { status, headers })
  })
}
