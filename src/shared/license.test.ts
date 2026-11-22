import { describe, expect, it } from 'vitest'
import { createQuiz, createScreenSlot } from './factory'
import {
  DAY_MS,
  keyHint,
  limitMapping,
  needsPro,
  OFFLINE_DAYS,
  proState,
  type StoredLicense
} from './license'
import type { HardwareMapping } from './types'

const now = Date.UTC(2026, 11, 1)
const license = (over: Partial<StoredLicense> = {}): StoredLicense => ({
  key: '38b1460a-5104-4067-a91d-77b872934d51',
  instanceId: 'i1',
  status: 'active',
  checkedAt: now - DAY_MS,
  expiresAt: null,
  ...over
})

describe('proState', () => {
  it('staat open zolang de winkel er niet is', () => {
    expect(proState({ license: null, earlyUntil: null, now, ready: false })).toMatchObject({
      pro: true,
      source: 'open'
    })
  })

  it('geeft Pro met een actieve, recent gecontroleerde code', () => {
    expect(proState({ license: license(), earlyUntil: null, now, ready: true })).toEqual({
      pro: true,
      source: 'license',
      keyHint: '4D51',
      until: null,
      problem: null
    })
  })

  it('werkt 30 dagen zonder controle, daarna niet meer', () => {
    const almost = license({ checkedAt: now - OFFLINE_DAYS * DAY_MS + 1 })
    const late = license({ checkedAt: now - OFFLINE_DAYS * DAY_MS - 1 })
    expect(proState({ license: almost, earlyUntil: null, now, ready: true }).pro).toBe(true)
    expect(proState({ license: late, earlyUntil: null, now, ready: true })).toMatchObject({
      pro: false,
      problem: 'offline'
    })
  })

  it('stopt bij een verlopen of uitgeschakelde code', () => {
    const expired = license({ expiresAt: now - 1 })
    expect(proState({ license: expired, earlyUntil: null, now, ready: true })).toMatchObject({
      pro: false,
      problem: 'expired'
    })
    const disabled = license({ status: 'disabled' })
    expect(proState({ license: disabled, earlyUntil: null, now, ready: true }).problem).toBe(
      'disabled'
    )
  })

  it('geeft wie de app al gebruikte gratis Pro tot de datum, ook naast een verlopen code', () => {
    expect(proState({ license: null, earlyUntil: now + DAY_MS, now, ready: true })).toMatchObject({
      pro: true,
      source: 'early',
      until: now + DAY_MS
    })
    const expired = license({ status: 'expired' })
    expect(
      proState({ license: expired, earlyUntil: now + DAY_MS, now, ready: true })
    ).toMatchObject({ pro: true, source: 'early', problem: 'expired' })
    expect(proState({ license: null, earlyUntil: now - 1, now, ready: true }).pro).toBe(false)
  })

  it('toont alleen de laatste vier tekens van een code', () => {
    expect(keyHint('abcd-ef12')).toBe('EF12')
  })
})

describe('limitMapping', () => {
  const quiz = createQuiz('Test')
  quiz.screens.push(createScreenSlot('Zaal'))
  const [beamer, zaal] = quiz.screens
  const [room, clips] = quiz.channels
  const usb = { deviceId: 'usb', label: 'USB' }
  const hdmi = { deviceId: 'hdmi', label: 'HDMI' }
  const mapping: HardwareMapping = {
    screens: {
      [beamer!.id]: { kind: 'display', displayId: 2, label: 'Beamer' },
      [zaal!.id]: { kind: 'display', displayId: 3, label: 'Tv' }
    },
    audio: { [room!.id]: usb, [clips!.id]: hdmi },
    screenSound: { [beamer!.id]: usb, [zaal!.id]: hdmi }
  }

  it('laat met Pro alles zoals het is', () => {
    expect(limitMapping(quiz, mapping, true)).toBe(mapping)
  })

  it('gebruikt zonder Pro alleen het eerste scherm en de uitgang van het eerste kanaal', () => {
    const limited = limitMapping(quiz, mapping, false)
    expect(limited.screens[beamer!.id]).toEqual(mapping.screens[beamer!.id])
    expect(limited.screens[zaal!.id]).toEqual({ kind: 'off' })
    expect(limited.audio).toEqual({ [room!.id]: usb, [clips!.id]: usb })
    expect(limited.screenSound).toEqual({ [beamer!.id]: usb })
    expect(needsPro(quiz, mapping)).toBe(true)
  })

  it('vindt dat een gewone quiz geen Pro nodig heeft', () => {
    const simple = createQuiz('Simpel')
    const out = { deviceId: 'default', label: 'Systeemstandaard' }
    const plain: HardwareMapping = {
      screens: { [simple.screens[0]!.id]: { kind: 'window' } },
      audio: Object.fromEntries(simple.channels.map((c) => [c.id, out])),
      screenSound: {}
    }
    expect(needsPro(simple, plain)).toBe(false)
    expect(limitMapping(simple, plain, false)).toEqual(plain)
  })
})
