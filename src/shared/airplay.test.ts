import { describe, expect, it } from 'vitest'
import { isMac, parseBrowseLine, parseTxt, sameDisplayName } from './airplay'

describe('AirPlay', () => {
  it('leest Bonjour-regels', () => {
    expect(
      parseBrowseLine(
        '11:31:14.124  Add        3   7 local.               _airplay._tcp.       BEAMER-KANTINE'
      )
    ).toEqual({ event: 'add', name: 'BEAMER-KANTINE' })
    expect(
      parseBrowseLine(
        '11:31:20.001  Rmv        0   7 local.               _airplay._tcp.       MacBook Pro 16" van Daan (4)'
      )
    ).toEqual({ event: 'remove', name: 'MacBook Pro 16" van Daan (4)' })
    expect(parseBrowseLine('Browsing for _airplay._tcp.local.')).toBeNull()
  })

  // Echte TXT-records van het netwerk waarop dit gebouwd is.
  it('herkent schermen en speakers aan de feature-bits', () => {
    const appleTv = parseTxt(
      'BEAMER-KANTINE',
      ' deviceid=B4:6B features=0x5a7fdfd1 model=AppleTV3,2'
    )
    expect(appleTv).toEqual({
      name: 'BEAMER-KANTINE',
      model: 'AppleTV3,2',
      screen: true,
      audio: true
    })

    const samsung = parseTxt('Het-Bruine-Cafe', 'features=0x7F8AD0,0x38BCF46 model=DU7000')
    expect(samsung).toMatchObject({ screen: true, audio: true })

    const sonos = parseTxt('Studio', 'features=0x445F8A00,0x801C340 model=Bookshelf')
    expect(sonos).toMatchObject({ screen: false, audio: true })

    expect(parseTxt('Leeg', '')).toEqual({ name: 'Leeg', model: null, screen: false, audio: false })
  })

  it('herkent Macs', () => {
    expect(isMac('MacBookAir10,1')).toBe(true)
    expect(isMac('iMac21,1')).toBe(true)
    expect(isMac('AppleTV6,2')).toBe(false)
    expect(isMac(null)).toBe(false)
  })

  it('vergelijkt displaynamen ruim', () => {
    expect(sameDisplayName('BRUIN-CAFE', 'Bruin Cafe')).toBe(true)
    expect(sameDisplayName('BEAMER-KANTINE', 'BEAMER-KANTINE (AirPlay)')).toBe(true)
    expect(sameDisplayName('DELL U2719D', 'DELL S3423DWC')).toBe(false)
    expect(sameDisplayName('TV', 'TV bar')).toBe(false)
  })
})
