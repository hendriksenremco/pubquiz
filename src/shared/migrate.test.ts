import { describe, expect, it } from 'vitest'
import { freshDemoQuiz } from '../main/demo-fixture'
import { createQuiz, createRound } from './factory'
import { migrateQuiz, QuizFormatError } from './migrate'
import { SCHEMA_VERSION } from './version'

describe('migrateQuiz', () => {
  it('accepteert een nieuwe quiz met rondes', () => {
    const quiz = createQuiz('Test')
    quiz.rounds.push(createRound('music', 1))
    expect(migrateQuiz(JSON.parse(JSON.stringify(quiz)))).toEqual(quiz)
  })

  it('accepteert de demo-quiz', () => {
    const quiz = migrateQuiz(freshDemoQuiz())
    expect(quiz.rounds.length).toBeGreaterThan(0)
  })

  it('vult mappen aan bij een quiz van vóór de mappen', () => {
    const { folders: _, ...old } = createQuiz('Oud')
    expect(migrateQuiz(old).folders).toEqual([])
  })

  it('zet videogeluid via een kanaal (schema 1) om naar geluid via het scherm', () => {
    const quiz = createQuiz('Oud')
    const old = {
      ...quiz,
      schemaVersion: 1,
      screens: [
        { id: 'a', name: 'A', default: { type: 'video', assetId: 'v', audioChannelId: 'zaal' } },
        { id: 'b', name: 'B', default: { type: 'video', assetId: 'v' } }
      ],
      rounds: [
        {
          ...createRound('normal', 1),
          screens: { a: { type: 'video', assetId: 'w', audioChannelId: 'zaal' } }
        }
      ]
    }
    const migrated = migrateQuiz(old)
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.screens[0].default).toEqual({ type: 'video', assetId: 'v', volume: 1 })
    expect(migrated.screens[1].default).toEqual({ type: 'video', assetId: 'v' })
    expect(migrated.rounds[0].screens['a']).toEqual({ type: 'video', assetId: 'w', volume: 1 })
  })

  it('zet het fragmentnummer (schema 2) om naar schermen per ronde', () => {
    const quiz = createQuiz('Oud')
    const [aan, uit] = [createRound('music', 1), createRound('normal', 2)]
    const old = {
      ...quiz,
      schemaVersion: 2,
      rounds: [aan, uit].map(({ fragmentScreens: _, autoplay, ...round }, i) => ({
        ...round,
        autoplay: { ...autoplay, showFragmentNumber: i === 0 }
      }))
    }
    const migrated = migrateQuiz(old)
    // Aan was: op alle schermen, zoals het altijd werkte.
    expect(migrated.rounds[0].fragmentScreens).toEqual(quiz.screens.map((s) => s.id))
    expect(migrated.rounds[1].fragmentScreens).toEqual([])
    expect(migrated.rounds[0].autoplay).toEqual({ gapSeconds: 5, countdownOnScreen: true })
  })

  it('weigert ontbrekende of te nieuwe schemaversies', () => {
    expect(() => migrateQuiz({})).toThrow(QuizFormatError)
    expect(() => migrateQuiz({ schemaVersion: 99 })).toThrow(/nieuwere versie/)
    expect(() => migrateQuiz(null)).toThrow(QuizFormatError)
  })

  it('noemt het pad van een ongeldig veld', () => {
    const quiz = createQuiz('Test')
    const broken = { ...quiz, screens: [{ id: 's', name: 'X', default: { type: 'video' } }] }
    expect(() => migrateQuiz(broken)).toThrow(/screens\.0\.default\.assetId/)
  })
})
