/** Luidheid van een heel geluidsbestand: de gemiddelde energie per stukje van WINDOW seconden. */
export interface Levels {
  energy: Float32Array
  duration: number
}

/** Kort genoeg om een beat te zien. */
export const WINDOW = 0.02
/** Zachter dan dit (dB) is stilte. */
const FLOOR = -60
/** Zoveel dB tussen zacht en luid, ook als een fragment nauwelijks wisselt. */
const MIN_RANGE = 8

/** Luidheid van alle kanalen samen, per WINDOW seconden. */
export function measure(channels: Float32Array[], sampleRate: number): Levels {
  const length = channels[0]?.length ?? 0
  const size = Math.max(1, Math.round(sampleRate * WINDOW))
  const energy = new Float32Array(Math.ceil(length / size))
  for (let w = 0; w < energy.length; w++) {
    const from = w * size
    const to = Math.min(length, from + size)
    let sum = 0
    for (const samples of channels) for (let i = from; i < to; i++) sum += samples[i] * samples[i]
    energy[w] = sum / ((to - from) * channels.length)
  }
  return { energy, duration: length / sampleRate }
}

/**
 * `count` balkjes (0–1) voor het stuk start–end, elk de luidheid van zijn stukje. Geschaald in
 * decibel van zacht (het tiende percentiel) tot het luidste balkje: gemasterde muziek zit bijna
 * overal tegen de top, dus op pieken of lineair geschaald wordt het één blok.
 */
export function barsFor(l: Levels, count: number, start = 0, end = l.duration): number[] {
  const n = l.energy.length
  const from = (Math.max(0, start) / l.duration) * n
  const to = (Math.min(l.duration, Math.max(start, end)) / l.duration) * n
  const db: number[] = []
  for (let b = 0; b < count; b++) {
    const a = Math.floor(from + ((to - from) * b) / count)
    const z = Math.max(a + 1, Math.floor(from + ((to - from) * (b + 1)) / count))
    let sum = 0
    let windows = 0
    for (let i = a; i < z && i < n; i++, windows++) sum += l.energy[i]
    db.push(sum > 0 ? Math.max(FLOOR, 10 * Math.log10(sum / windows)) : FLOOR)
  }
  const sorted = [...db].sort((x, y) => x - y)
  const top = sorted[sorted.length - 1]
  if (!(top > FLOOR)) return db.map(() => 0)
  const low = Math.max(FLOOR, Math.min(sorted[Math.floor(sorted.length / 10)], top - MIN_RANGE))
  return db.map((v) => Math.max(0, (v - low) / (top - low)))
}
