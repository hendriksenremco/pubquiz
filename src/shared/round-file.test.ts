import { describe, expect, it } from 'vitest'
import { DraftError } from './draft'
import { createQuiz, createRound } from './factory'
import { QuizSchema } from './quiz-schema'
import {
  addRounds,
  isRoundFile,
  isSafeZipPath,
  parseRoundFile,
  roundFileMedia,
  RoundFileError,
  type RoundFileProblem
} from './round-file'
import type { MediaAsset } from './types'

const questions = {
  type: 'questions',
  title: 'Aardrijkskunde',
  questions: [
    { question: 'Hoofdstad van Italië?', answer: 'Rome', image: 'media/rome.jpg' },
    { question: 'Langste rivier?', answer: 'Nijl' }
  ]
}
const music = {
  type: 'music',
  title: 'Jaren 80',
  songs: [{ audio: 'media/liedje.mp3', answer: 'A-ha – Take on Me' }]
}

function problem(fn: () => unknown): RoundFileProblem | undefined {
  try {
    fn()
  } catch (err) {
    if (err instanceof RoundFileError) return err.key
    throw err
  }
  return undefined
}

const asset = (path: string, kind: MediaAsset['kind']): MediaAsset => ({
  id: `id-${path}`,
  kind,
  file: `media/hash-${path.slice(6)}`,
  name: path.slice(6)
})

describe('parseRoundFile', () => {
  it('leest één ronde', () => {
    const drafts = parseRoundFile(JSON.stringify({ formatVersion: 1, ...questions }))
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ type: 'questions', title: 'Aardrijkskunde' })
  })

  it('leest meer rondes, en een antwoordenronde met zijn eigen `rounds`', () => {
    const answers = { type: 'answers', rounds: ['Aardrijkskunde'] }
    const drafts = parseRoundFile(
      JSON.stringify({ formatVersion: 1, rounds: [questions, music, answers] })
    )
    expect(drafts.map((d) => d.type)).toEqual(['questions', 'music', 'answers'])
    // Eén antwoordenronde los: `type` wint van `rounds`.
    expect(parseRoundFile(JSON.stringify({ formatVersion: 1, ...answers }))[0].type).toBe('answers')
  })

  it('weigert iets wat geen rondebestand is', () => {
    expect(problem(() => parseRoundFile('geen json'))).toBe('notRoundFile')
    expect(problem(() => parseRoundFile('[]'))).toBe('notRoundFile')
    expect(problem(() => parseRoundFile(JSON.stringify(questions)))).toBe('notRoundFile')
    expect(problem(() => parseRoundFile(JSON.stringify({ formatVersion: '1' })))).toBe(
      'notRoundFile'
    )
  })

  it('vraagt om bij te werken bij een nieuwer formaat', () => {
    const json = JSON.stringify({ formatVersion: 2, ...questions })
    expect(problem(() => parseRoundFile(json))).toBe('newerRoundFile')
  })

  it('noemt wat er mis is in de rondes', () => {
    const bad = { ...questions, questions: [{ question: 'Zonder antwoord' }] }
    let error: RoundFileError | undefined
    try {
      parseRoundFile(JSON.stringify({ formatVersion: 1, rounds: [bad] }))
    } catch (err) {
      error = err as RoundFileError
    }
    expect(error?.key).toBe('invalidRoundFile')
    expect(error?.params?.error).toContain('answer')
    expect(problem(() => parseRoundFile(JSON.stringify({ formatVersion: 1, rounds: [] })))).toBe(
      'invalidRoundFile'
    )
  })

  it('weigert paden buiten media/ in de zip', () => {
    for (const image of [
      '/Users/remco/rome.jpg',
      'media/../../rome.jpg',
      'rome.jpg',
      'media\\a.jpg'
    ]) {
      const round = { ...questions, questions: [{ question: 'V', answer: 'A', image }] }
      const json = JSON.stringify({ formatVersion: 1, ...round })
      expect(
        problem(() => parseRoundFile(json)),
        image
      ).toBe('unsafeRoundPath')
    }
  })
})

describe('isRoundFile', () => {
  it('herkent de extensie, ook met hoofdletters', () => {
    expect(isRoundFile('/Users/x/Downloads/Sport.quiznoteronde')).toBe(true)
    expect(isRoundFile('Sport.QuizNoteRonde')).toBe(true)
    expect(isRoundFile('Sport.zip')).toBe(false)
    expect(isRoundFile('/Pubquizzen/Sport.pubquiz')).toBe(false)
  })
})

describe('isSafeZipPath', () => {
  it('laat alleen paden binnen de zip door', () => {
    expect(isSafeZipPath('ronde.json')).toBe(true)
    expect(isSafeZipPath('media/Venetië 1.jpg')).toBe(true)
    for (const path of [
      '',
      '/etc/passwd',
      '../x',
      'media/../../x',
      'a//b',
      './a',
      'C:/x',
      'a\\b'
    ]) {
      expect(isSafeZipPath(path), path).toBe(false)
    }
  })
})

describe('roundFileMedia', () => {
  it('noemt elk bestand één keer, met zijn soort', () => {
    const drafts = parseRoundFile(
      JSON.stringify({ formatVersion: 1, rounds: [questions, music, questions] })
    )
    expect(roundFileMedia(drafts)).toEqual([
      { path: 'media/rome.jpg', kind: 'image' },
      { path: 'media/liedje.mp3', kind: 'audio' }
    ])
  })
})

describe('addRounds', () => {
  const assets = {
    'media/rome.jpg': asset('media/rome.jpg', 'image'),
    'media/liedje.mp3': asset('media/liedje.mp3', 'audio')
  }

  it('voegt de rondes in op de plek, met hun bestanden in een map per ronde', () => {
    const quiz = createQuiz('Vrijdag')
    quiz.rounds = [
      { ...createRound('normal', 1), title: 'Eerste' },
      { ...createRound('normal', 2), title: 'Laatste' }
    ]
    const drafts = parseRoundFile(JSON.stringify({ formatVersion: 1, rounds: [questions, music] }))
    const added = addRounds(quiz, drafts, assets, 1, 'nl')

    expect(added.map((r) => r.title)).toEqual(['Aardrijkskunde', 'Jaren 80'])
    expect(quiz.rounds.map((r) => r.title)).toEqual([
      'Eerste',
      'Aardrijkskunde',
      'Jaren 80',
      'Laatste'
    ])
    expect(quiz.folders.map((f) => f.name)).toEqual(['Aardrijkskunde', 'Jaren 80'])
    const rome = quiz.assets.find((a) => a.name === 'rome.jpg')!
    expect(rome.folderId).toBe(quiz.folders[0].id)
    expect(added[0].slides[1].imageAssetId).toBe(rome.id)
    expect(added[1].fragments[0].assetId).toBe(quiz.assets.find((a) => a.name === 'liedje.mp3')!.id)
    expect(() => QuizSchema.parse(quiz)).not.toThrow()
  })

  it('voegt een bestand dat er al is niet dubbel toe', () => {
    const quiz = createQuiz('Vrijdag')
    const drafts = parseRoundFile(JSON.stringify({ formatVersion: 1, ...questions }))
    addRounds(quiz, drafts, assets, 0, 'nl')
    addRounds(
      quiz,
      drafts,
      { 'media/rome.jpg': { ...assets['media/rome.jpg'], id: 'nieuw' } },
      0,
      'nl'
    )
    expect(quiz.assets).toHaveLength(1)
    expect(quiz.rounds[0].slides[1].imageAssetId).toBe(quiz.assets[0].id)
  })

  it('weigert een muziekronde zonder audiokanaal en een ontbrekend bestand', () => {
    const quiz = createQuiz('Vrijdag')
    quiz.channels = []
    const drafts = parseRoundFile(JSON.stringify({ formatVersion: 1, ...music }))
    expect(problem(() => addRounds(quiz, drafts, assets, 0, 'nl'))).toBe('noAudioChannel')
    const withChannel = createQuiz('Vrijdag')
    expect(problem(() => addRounds(withChannel, drafts, {}, 0, 'nl'))).toBe('missingRoundMedia')
  })

  it('geeft een DraftError bij een antwoordenronde voor een onbekende ronde', () => {
    const drafts = parseRoundFile(
      JSON.stringify({ formatVersion: 1, type: 'answers', rounds: ['Bestaat niet'] })
    )
    expect(() => addRounds(createQuiz('Vrijdag'), drafts, {}, 0, 'nl')).toThrow(DraftError)
  })
})
