import { describe, expect, it } from 'vitest'
import { barsFor } from './peaks'

// Tien seconden, een piek per seconde: 0,1 0,2 … 1,0.
const ramp = { peaks: Float32Array.from({ length: 10 }, (_, i) => (i + 1) / 10), duration: 10 }

describe('barsFor', () => {
  it('neemt per balkje de hoogste piek, geschaald op het hoogste balkje', () => {
    expect(barsFor(ramp, 5)).toEqual([0.2, 0.4, 0.6, 0.8, 1].map((v) => expect.closeTo(v, 5)))
  })

  it('toont alleen het stuk tussen begin en eind', () => {
    // 2–4 s: de pieken 0,3 en 0,4; geschaald op 0,4.
    expect(barsFor(ramp, 2, 2, 4)).toEqual([expect.closeTo(0.75, 5), 1])
  })

  it('blijft binnen het bestand en houdt stilte stil', () => {
    expect(barsFor(ramp, 2, 8, 99)).toEqual([expect.closeTo(0.9, 5), 1])
    const silence = { peaks: new Float32Array(10), duration: 10 }
    expect(barsFor(silence, 3)).toEqual([0, 0, 0])
  })
})
