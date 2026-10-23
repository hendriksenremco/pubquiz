import { describe, expect, it } from 'vitest'
import { mimeType, parseRange } from './range'

describe('parseRange', () => {
  it('geeft null zonder header of bij ongeldige syntax', () => {
    expect(parseRange(undefined, 1000)).toBeNull()
    expect(parseRange('', 1000)).toBeNull()
    expect(parseRange('items=0-1', 1000)).toBeNull()
    expect(parseRange('bytes=-', 1000)).toBeNull()
  })

  it('ondersteunt open en gesloten ranges', () => {
    expect(parseRange('bytes=0-', 1000)).toEqual({ start: 0, end: 999 })
    expect(parseRange('bytes=100-199', 1000)).toEqual({ start: 100, end: 199 })
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 })
  })

  it('ondersteunt suffix-ranges', () => {
    expect(parseRange('bytes=-200', 1000)).toEqual({ start: 800, end: 999 })
    expect(parseRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 })
  })

  it('gebruikt alleen de eerste van meerdere ranges', () => {
    expect(parseRange('bytes=0-9, 20-29', 1000)).toEqual({ start: 0, end: 9 })
  })

  it('meldt onvervulbare ranges', () => {
    expect(parseRange('bytes=1000-', 1000)).toBe('unsatisfiable')
    expect(parseRange('bytes=500-100', 1000)).toBe('unsatisfiable')
    expect(parseRange('bytes=-0', 1000)).toBe('unsatisfiable')
    expect(parseRange('bytes=0-', 0)).toBe('unsatisfiable')
  })
})

describe('mimeType', () => {
  it('herkent gangbare mediatypes', () => {
    expect(mimeType('media/abc.MP4')).toBe('video/mp4')
    expect(mimeType('a.m4a')).toBe('audio/mp4')
    expect(mimeType('a.unknown')).toBe('application/octet-stream')
  })
})
