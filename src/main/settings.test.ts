import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { createQuiz } from '@shared/factory'
import { adoptSettings, findDisplay, Settings } from './settings'

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
      await settings.whenSaved()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('Settings.setTour', () => {
  it('zet de rondleiding achteraan, of op de plek waar hij eerder geopend was', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pubquiz-settings-'))
    try {
      const settings = await Settings.load(dir)
      expect(settings.tourDir).toBeNull()
      settings.addRecent('/q/b')
      settings.addRecent('/q/a')
      settings.setTour('/lib/Rondleiding.pubquiz', '/app/Rondleiding.pubquiz')
      expect(settings.recent).toEqual(['/q/a', '/q/b', '/lib/Rondleiding.pubquiz'])
      expect(settings.tourDir).toBe('/lib/Rondleiding.pubquiz')

      // Al eens vanaf de bron geopend: die kaart wordt de rondleiding, op dezelfde plek.
      const again = await Settings.load(mkdtempSync(join(dir, 'x-')))
      again.addRecent('/q/a')
      again.addRecent('/dev/rondleiding.pubquiz')
      again.setTour('/lib/Rondleiding.pubquiz', '/dev/rondleiding.pubquiz')
      expect(again.recent).toEqual(['/lib/Rondleiding.pubquiz', '/q/a'])

      // Een volle lijst: de oudste valt eraf, de rondleiding staat er wel in.
      const full = await Settings.load(mkdtempSync(join(dir, 'y-')))
      for (let i = 0; i < 8; i++) full.addRecent(`/q/${i}`)
      full.setTour('/lib/Rondleiding.pubquiz', '/app/Rondleiding.pubquiz')
      expect(full.recent).toHaveLength(8)
      expect(full.recent.at(-1)).toBe('/lib/Rondleiding.pubquiz')
      expect(full.recent).not.toContain('/q/0')
      await Promise.all([settings, again, full].map((s) => s.whenSaved()))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('adoptSettings', () => {
  it('neemt instellingen één keer over uit de map van de jongste oude naam', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pubquiz-adopt-'))
    const pubquiz = join(dir, 'Pubquiz')
    const quizmeister = join(dir, 'Quizmeister')
    const to = join(dir, 'QuizNote')
    try {
      mkdirSync(pubquiz)
      mkdirSync(quizmeister)
      writeFileSync(join(pubquiz, 'settings.json'), JSON.stringify({ recent: ['/q/oud'] }))
      writeFileSync(join(quizmeister, 'settings.json'), JSON.stringify({ recent: ['/q/a'] }))
      await adoptSettings([quizmeister, pubquiz], to)
      expect((await Settings.load(to)).recent).toEqual(['/q/a'])

      // Daarna niet meer: wat in de nieuwe map staat, blijft staan.
      writeFileSync(join(quizmeister, 'settings.json'), JSON.stringify({ recent: ['/q/b'] }))
      await adoptSettings([quizmeister, pubquiz], to)
      expect((await Settings.load(to)).recent).toEqual(['/q/a'])

      // Alleen de werknaam heeft instellingen: dan komen ze daarvandaan.
      await adoptSettings([join(dir, 'bestaat-niet'), pubquiz], join(dir, 'Tweede'))
      expect((await Settings.load(join(dir, 'Tweede'))).recent).toEqual(['/q/oud'])

      // Geen oude map: niets aan de hand.
      await adoptSettings([join(dir, 'bestaat-niet')], join(dir, 'Nieuw'))
      expect((await Settings.load(join(dir, 'Nieuw'))).recent).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('Settings.analytics', () => {
  it('is eerst niet gevraagd, en krijgt pas met toestemming een id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pubquiz-settings-'))
    try {
      const settings = await Settings.load(dir)
      expect(settings.analyticsConsent).toBeNull()
      expect(settings.analyticsId).toBeNull()

      settings.setAnalytics(true)
      const id = settings.analyticsId
      expect(id).toMatch(/^[0-9a-f-]{36}$/)
      await settings.whenSaved()
      expect((await Settings.load(dir)).analyticsId).toBe(id)

      settings.setAnalytics(false)
      expect(settings.analyticsConsent).toBe(false)
      expect(settings.analyticsId).toBeNull()
      settings.setAnalytics(true)
      expect(settings.analyticsId).not.toBe(id)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
