import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { createQuiz } from '@shared/factory'
import { findDisplay, Settings } from './settings'

const displays = [
  { id: 1, label: 'Built-in Retina Display' },
  { id: 7, label: 'BEAMER-KANTINE (AirPlay)' }
]

describe('findDisplay', () => {
  it('vindt een display op id, op naam, en ruim op naam (AirPlay)', () => {
    expect(findDisplay({ kind: 'display', displayId: 1, label: 'x' }, displays)?.id).toBe(1)
    expect(
      findDisplay({ kind: 'display', displayId: 99, label: 'Built-in Retina Display' }, displays)
        ?.id
    ).toBe(1)
    expect(
      findDisplay({ kind: 'display', displayId: -1, label: 'BEAMER-KANTINE' }, displays)?.id
    ).toBe(7)
    expect(
      findDisplay({ kind: 'display', displayId: -1, label: 'BRUIN-CAFE' }, displays)
    ).toBeNull()
    expect(findDisplay({ kind: 'window' }, displays)).toBeNull()
  })
})

describe('Settings.mappingFor', () => {
  it('onthoudt een eigen uitgang voor videogeluid per schermnaam, en vergeet hem bij automatisch', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pubquiz-settings-'))
    try {
      const settings = await Settings.load(dir)
      const quiz = createQuiz('Test')
      const slot = quiz.screens[0]
      const usb = { deviceId: 'usb', label: 'USB Audio CODEC (USB)' }

      expect(settings.mappingFor(quiz, []).screenSound).toEqual({})
      const mapping = settings.mappingFor(quiz, [])
      settings.saveMapping(quiz, { ...mapping, screenSound: { [slot.id]: usb } })

      // Een andere quiz met een scherm met dezelfde naam krijgt dezelfde uitgang.
      const other = createQuiz('Andere')
      expect(settings.mappingFor(other, []).screenSound).toEqual({ [other.screens[0].id]: usb })

      settings.saveMapping(quiz, { ...mapping, screenSound: {} })
      expect(settings.mappingFor(other, []).screenSound).toEqual({})
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
