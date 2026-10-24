/** Piekwaardes (0–1) van een heel geluidsbestand, gelijk verdeeld over de tijd. */
export interface Peaks {
  peaks: Float32Array
  duration: number
}

/**
 * `count` balkjes (0–1) voor het stuk start–end, elk de hoogste piek in zijn stukje. Geschaald
 * op het hoogste balkje, zodat ook een zacht fragment een volle vorm heeft.
 */
export function barsFor(p: Peaks, count: number, start = 0, end = p.duration): number[] {
  const n = p.peaks.length
  const from = (Math.max(0, start) / p.duration) * n
  const to = (Math.min(p.duration, Math.max(start, end)) / p.duration) * n
  const bars: number[] = []
  for (let b = 0; b < count; b++) {
    const a = Math.floor(from + ((to - from) * b) / count)
    const z = Math.max(a + 1, Math.floor(from + ((to - from) * (b + 1)) / count))
    let max = 0
    for (let i = a; i < z && i < n; i++) max = Math.max(max, p.peaks[i])
    bars.push(max)
  }
  const top = Math.max(...bars)
  return top > 0 ? bars.map((v) => v / top) : bars
}
