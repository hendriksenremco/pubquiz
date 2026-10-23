/** Een AirPlay-ontvanger op het netwerk (Apple TV, AirPlay-tv, Sonos, …). */
export interface AirPlayDevice {
  name: string
  model: string | null
  /** Kan als (uitgebreid) beeldscherm gebruikt worden. */
  screen: boolean
  /** Kan geluid ontvangen. */
  audio: boolean
}

/** AirPlay-feature-bits (TXT-record `features`, laagste 32 bits). */
const FEATURE_SCREEN = 1 << 7
const FEATURE_AUDIO = 1 << 9

/**
 * Eén regel uit `dns-sd -B _airplay._tcp`, bv.
 * `11:31:14.124  Add        3   7 local.               _airplay._tcp.       BEAMER-KANTINE`
 */
export function parseBrowseLine(line: string): { event: 'add' | 'remove'; name: string } | null {
  const match = /^\S+\s+(Add|Rmv)\s+\d+\s+\d+\s+\S+\s+_airplay\._tcp\.\s+(.+?)\s*$/.exec(line)
  if (!match) return null
  return { event: match[1] === 'Add' ? 'add' : 'remove', name: match[2] }
}

/** TXT-record uit `dns-sd -L` → model en wat het apparaat kan. */
export function parseTxt(name: string, txt: string): AirPlayDevice {
  const model = /(?:^|\s)model=(\S+)/.exec(txt)?.[1] ?? null
  const featuresText = /(?:^|\s)features=(0x[0-9a-f]+)/i.exec(txt)?.[1]
  const features = featuresText ? parseInt(featuresText, 16) : 0
  return {
    name,
    model,
    screen: (features & FEATURE_SCREEN) !== 0,
    audio: (features & FEATURE_AUDIO) !== 0
  }
}

/** Macs zijn ook AirPlay-ontvanger, maar horen niet in de lijst met schermen en speakers. */
export function isMac(model: string | null): boolean {
  return !!model && /^(Mac|iMac)/.test(model)
}

/** "BRUIN-CAFE" en "Bruin Cafe (AirPlay)" zijn hetzelfde display. */
export function sameDisplayName(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)))
}
