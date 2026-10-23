import { describe, expect, it } from 'vitest'
import { mediaUrl, recentMediaUrl } from '@shared/ipc'
import { locateMedia, type MediaRoots } from './media-path'

const roots = (current: string | null, recent: string[] = []): MediaRoots => ({
  current: () => current,
  isRecent: (dir) => recent.includes(dir)
})

describe('locateMedia', () => {
  it('vindt bestanden in de geopende quiz', () => {
    expect(locateMedia(mediaUrl('media/a b.mp4'), roots('/q/Demo.pubquiz'))).toEqual({
      file: '/q/Demo.pubquiz/media/a b.mp4'
    })
  })

  it('geeft 404 zonder geopende quiz', () => {
    expect(locateMedia(mediaUrl('media/a.mp4'), roots(null))).toMatchObject({ status: 404 })
  })

  it('serveert previews alleen uit recente quizzen', () => {
    const dir = '/Users/x/Mijn quizzen/Vrijdag #3.pubquiz'
    const url = recentMediaUrl(dir, 'media/loop.mp4')
    expect(locateMedia(url, roots(null, [dir]))).toEqual({ file: `${dir}/media/loop.mp4` })
    expect(locateMedia(url, roots(null, []))).toMatchObject({ status: 403 })
  })

  it('weigert paden buiten de quizmap', () => {
    const r = roots('/q/Demo.pubquiz', ['/q/Demo.pubquiz'])
    expect(locateMedia('pq-media://quiz/..%2F..%2Fetc%2Fpasswd', r)).toMatchObject({ status: 403 })
    expect(
      locateMedia(`pq-media://recent/${encodeURIComponent('/q/Demo.pubquiz')}/..%2Fgeheim`, r)
    ).toMatchObject({ status: 403 })
  })
})
