/**
 * Het LEDENET-protocol van MagicHome-controllers (TCP-poort 5577), voor model A1 ("Addressable
 * v1"). Overgenomen uit `flux_led` (MIT), `ProtocolLEDENETAddressableA1`. Alleen het bouwen en
 * lezen van berichten; de verbinding zit in src/main/magichome.ts.
 */

import type { Light } from './light'

export const MAGICHOME_PORT = 5577

export interface MagicHomeAddress {
  host: string
  port: number
}

/** De toestand die de controller meldt, op vraag of uit zichzelf (app of afstandsbediening). */
export interface MagicHomeState {
  model: number
  on: boolean
  /** Ingebouwd effect 1–300; null = een vaste kleur (of een modus die we niet kennen). */
  effect: number | null
  speed: number
  color: string
  firmware: number
}

/** Uitslag van "test de verbinding". */
export type MagicHomeProbe = { ok: true; state: MagicHomeState } | { ok: false; error: string }

export const EFFECT_MIN = 1
export const EFFECT_MAX = 300
/** Effectnummers staan 99 verder in de berichten. */
const EFFECT_OFFSET = 99
const STATE_LENGTH = 14

/** Elk bericht eindigt op de som van zijn bytes. */
export function checksum(bytes: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < bytes.length; i++) sum += bytes[i]
  return sum & 0xff
}

function message(bytes: number[]): Uint8Array {
  return Uint8Array.from([...bytes, checksum(bytes)])
}

export const queryState = (): Uint8Array => message([0x81, 0x8a, 0x8b])

export const power = (on: boolean): Uint8Array => message([0x71, on ? 0x23 : 0x24, 0x0f])

/**
 * Vaste kleur. `31` bewaart hem in de controller, zodat hij na stroom eraf terugkomt; zo doet
 * `flux_led` het standaard. `F0`: alleen de RGB-kleuren schrijven.
 */
export function color(hex: string): Uint8Array {
  const [r, g, b] = rgb(hex)
  return message([0x31, r, g, b, 0x00, 0x00, 0xf0, 0x0f])
}

/** Ingebouwd effect 1–300 met een snelheid van 0 tot 100. */
export function effect(id: number, speed: number): Uint8Array {
  const code = clamp(Math.round(id), EFFECT_MIN, EFFECT_MAX) + EFFECT_OFFSET
  return message([0x61, code >> 8, code & 0xff, clamp(Math.round(speed), 0, 100), 0x0f])
}

/** Wat de controller krijgt voor een licht. Eerst aan: een kleur of effect zet hem niet vanzelf aan. */
export function lightMessages(light: Light): Uint8Array[] {
  if (light.type === 'off') return [power(false)]
  if (light.type === 'color') return [power(true), color(light.color)]
  return [power(true), effect(light.effect, light.speed)]
}

/** Toestandsbericht van 14 bytes, of null als het dat niet is. */
export function parseState(bytes: Uint8Array): MagicHomeState | null {
  if (bytes.length !== STATE_LENGTH || bytes[0] !== 0x81) return null
  if (checksum(bytes.subarray(0, STATE_LENGTH - 1)) !== bytes[STATE_LENGTH - 1]) return null
  const id = ((bytes[3] << 8) | bytes[4]) - EFFECT_OFFSET
  return {
    model: bytes[1],
    on: bytes[2] === 0x23,
    effect: id >= EFFECT_MIN && id <= EFFECT_MAX ? id : null,
    speed: bytes[5],
    color: hex(bytes[6], bytes[7], bytes[8]),
    firmware: bytes[10]
  }
}

/**
 * Haalt de toestandsberichten uit wat er binnenkwam. Antwoorden komen niet één op één per vraag
 * (de controller meldt zich ook uit zichzelf), dus: zoeken naar een kop met een kloppende
 * checksum en de rest overslaan. `rest`: een begonnen bericht, om met de volgende bytes aan te vullen.
 */
export function readStates(buffer: Uint8Array): { states: MagicHomeState[]; rest: Uint8Array } {
  const states: MagicHomeState[] = []
  let at = 0
  while (at < buffer.length) {
    if (buffer[at] !== 0x81) {
      at++
      continue
    }
    if (buffer.length - at < STATE_LENGTH) break
    const state = parseState(buffer.subarray(at, at + STATE_LENGTH))
    if (state) {
      states.push(state)
      at += STATE_LENGTH
    } else at++
  }
  return { states, rest: buffer.slice(at) }
}

/** "192.168.1.20" of "192.168.1.20:5577"; null als het geen adres is. */
export function parseAddress(text: string): MagicHomeAddress | null {
  const match = /^([a-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(text.trim())
  if (!match) return null
  const port = match[2] ? Number(match[2]) : MAGICHOME_PORT
  return port >= 1 && port <= 65535 ? { host: match[1], port } : null
}

/** "#ff8000" → [255, 128, 0]; een ongeldige code wordt zwart. */
export function rgb(code: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(code.trim())
  const n = match ? parseInt(match[1], 16) : 0
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
