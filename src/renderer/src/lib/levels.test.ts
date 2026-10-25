import { describe, expect, it } from 'vitest'
import { barsFor, measure } from './levels'

/** Eén stukje per seconde, met deze luidheid in dB. */
const levels = (db: number[]) => ({
  energy: Float32Array.from(db, (d) => 10 ** (d / 10)),
  duration: db.length
})
// -40, -38 … -22 dB.
const ramp = levels(Array.from({ length: 10 }, (_, i) => -40 + 2 * i))
const close = (values: number[]) => values.map((v) => expect.closeTo(v, 5))

describe('measure', () => {
  it('meet de luidheid, niet de pieken', () => {
    // Vier seconden: eerst zacht, dan hard, en overal tikken tot 1, zoals bij gemasterde muziek.
    const rate = 1000
    const samples = Float32Array.from({ length: 4 * rate }, (_, i) =>
      i % 100 === 0 ? 1 : (i < 2 * rate ? 0.1 : 0.8) * Math.sin(i / 3)
    )
    const l = measure([samples, samples], rate)
    expect(l.duration).toBe(4)
    expect(barsFor(l, 2)).toEqual([0, 1])
  })
})

describe('barsFor', () => {
  it('schaalt in decibel van het zachtste naar het luidste balkje', () => {
    // Het zachtste tiende telt als bodem (-38 dB), het luidste als top (-22 dB).
    expect(barsFor(ramp, 10)).toEqual(close([0, 0, 1, 2, 3, 4, 5, 6, 7, 8].map((v) => v / 8)))
  })

  it('laat een fragment dat nauwelijks wisselt ook zo zien', () => {
    // 1 dB verschil op minstens 8 dB bereik.
    expect(barsFor(levels([-10, -11, -10, -11]), 4)).toEqual(close([1, 7 / 8, 1, 7 / 8]))
  })

  it('toont alleen het stuk tussen begin en eind', () => {
    // 2–4 s: -36 en -34 dB.
    expect(barsFor(ramp, 2, 2, 4)).toEqual(close([0.75, 1]))
  })

  it('blijft binnen het bestand en houdt stilte stil', () => {
    expect(barsFor(ramp, 2, 8, 99)).toEqual(close([0.75, 1]))
    expect(barsFor(levels([-90, -90, -90]), 3)).toEqual([0, 0, 0])
    expect(barsFor({ energy: new Float32Array(10), duration: 10 }, 3)).toEqual([0, 0, 0])
  })
})
