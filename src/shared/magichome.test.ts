import { describe, expect, it } from 'vitest'
import {
  checksum,
  color,
  effect,
  lightMessages,
  parseAddress,
  parseState,
  power,
  queryState,
  readStates
} from './magichome'

const bytes = (text: string) => Uint8Array.from(text.split(' ').map((b) => parseInt(b, 16)))
const text = (data: Uint8Array) => [...data].map((b) => b.toString(16).padStart(2, '0')).join(' ')

/** Op 2026-10-29 ontvangen van de controller op kantoor: aan, vaste kleur groen. */
const STATE = '81 a1 23 00 61 64 00 ff 00 00 03 00 fa 06'

describe('berichten', () => {
  it('eindigen op de som van hun bytes', () => {
    expect(checksum([0x81, 0x8a, 0x8b])).toBe(0x96)
    expect(text(queryState())).toBe('81 8a 8b 96')
    expect(text(power(true))).toBe('71 23 0f a3')
    expect(text(power(false))).toBe('71 24 0f a4')
  })

  it('zetten een kleur en een effect', () => {
    expect(text(color('#ff0000'))).toBe('41 ff 00 00 00 00 f0 0f 3f')
    expect(text(effect(1, 50))).toBe('61 00 64 32 0f 06')
    // Boven de 255 loopt het nummer over twee bytes.
    expect(text(effect(300, 100)).slice(0, 8)).toBe('61 01 8f')
  })

  it('zetten de controller eerst aan, behalve bij uit', () => {
    expect(lightMessages({ type: 'off' }).map(text)).toEqual(['71 24 0f a4'])
    expect(lightMessages({ type: 'color', color: '#ff0000' }).map(text)).toEqual([
      '71 23 0f a3',
      '41 ff 00 00 00 00 f0 0f 3f'
    ])
    expect(lightMessages({ type: 'effect', effect: 1, speed: 50 }).map(text)).toEqual([
      '71 23 0f a3',
      '61 00 64 32 0f 06'
    ])
  })
})

describe('toestand', () => {
  it('leest het antwoord van de controller', () => {
    // Een kleur zonder opslaan staat als modus 00 62 in de toestand.
    expect(parseState(bytes('81 a1 23 00 62 3c ff 00 00 00 03 00 fa df'))).toMatchObject({
      effect: null,
      color: '#ff0000'
    })
    expect(parseState(bytes(STATE))).toEqual({
      model: 0xa1,
      on: true,
      effect: null,
      speed: 100,
      color: '#00ff00',
      firmware: 3
    })
    expect(parseState(bytes('81 a1 24 00 64 32 00 00 00 00 03 00 fa d9'))).toMatchObject({
      on: false,
      effect: 1,
      speed: 50
    })
  })

  it('weigert een verkeerde checksum of lengte', () => {
    expect(parseState(bytes(STATE.replace(/06$/, '07')))).toBeNull()
    expect(parseState(bytes('81 8a 8b 96'))).toBeNull()
  })

  it('vindt berichten tussen andere bytes en bewaart een begonnen bericht', () => {
    const half = STATE.split(' ').slice(0, 6).join(' ')
    const { states, rest } = readStates(bytes(`0f 71 23 a3 ${STATE} ${half}`))
    expect(states).toHaveLength(1)
    expect(text(rest)).toBe(half)

    const next = readStates(Uint8Array.from([...rest, ...bytes(STATE).subarray(6)]))
    expect(next.states).toHaveLength(1)
    expect(next.rest).toHaveLength(0)
  })
})

describe('parseAddress', () => {
  it('leest een IP-adres, met of zonder poort', () => {
    expect(parseAddress(' 192.168.14.133 ')).toEqual({ host: '192.168.14.133', port: 5577 })
    expect(parseAddress('127.0.0.1:40123')).toEqual({ host: '127.0.0.1', port: 40123 })
    expect(parseAddress('')).toBeNull()
    expect(parseAddress('192.168.1.1:99999')).toBeNull()
    expect(parseAddress('http://192.168.1.1')).toBeNull()
  })
})
