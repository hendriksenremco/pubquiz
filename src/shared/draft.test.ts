import { describe, expect, it } from 'vitest'
import {
  AGENT_PARAMS,
  buildRound,
  describeQuiz,
  DraftError,
  draftFiles,
  type RoundDraft
} from './draft'
import { createQuiz } from './factory'
import type { Locale } from './i18n'
import { QuizSchema } from './quiz-schema'
import type { Quiz } from './types'

/** Bouwt rondes na elkaar, zoals de app doet; bestanden krijgen een asset-id op hun naam. */
function build(drafts: RoundDraft[], locale: Locale = 'nl'): Quiz {
  const quiz = createQuiz('Italië', locale)
  for (const draft of drafts) {
    for (const f of draftFiles(draft)) {
      if (!quiz.assets.some((a) => a.id === f.path)) {
        quiz.assets.push({ id: f.path, kind: f.kind, file: `media/${f.path}`, name: f.path })
      }
    }
    quiz.rounds.push(buildRound(quiz, draft, (path) => path, locale))
  }
  return QuizSchema.parse(quiz)
}

const questions: RoundDraft = {
  type: 'questions',
  title: 'Ronde 1: Italië',
  intro: 'Tien vragen over Italië',
  notes: 'Vraag 2 lees je voor',
  questions: [
    { question: 'Wat is de hoofdstad van Italië?', answer: 'Rome' },
    { question: 'Hoeveel inwoners heeft Italië ongeveer?', answer: '59 miljoen', readAloud: true },
    {
      question: 'Welke stad zie je hier?',
      answer: 'Venetië',
      image: 'venetie.jpg',
      answerImage: 'venetie-heel.jpg'
    }
  ]
}

describe('buildRound', () => {
  it('maakt van vragen een titelslide met uitleg en een slide per vraag', () => {
    const [round] = build([questions]).rounds
    expect(round.title).toBe('Ronde 1: Italië')
    expect(round.hostNotes).toBe('Vraag 2 lees je voor')
    expect(round.slides.map((s) => [s.layout, s.title])).toEqual([
      ['title', 'Ronde 1: Italië'],
      ['question', 'Vraag 1'],
      ['question', 'Vraag 2'],
      ['question', 'Vraag 3']
    ])
    expect(round.slides[0].body).toBe('Tien vragen over Italië')
    expect(round.slides[2]).toMatchObject({ numberOnly: true, answer: '59 miljoen' })
    expect(round.slides[3]).toMatchObject({
      imageAssetId: 'venetie.jpg',
      answerImageAssetId: 'venetie-heel.jpg'
    })
  })

  it('maakt van liedjes fragmenten, met het nummer op het eerste scherm', () => {
    const quiz = build([
      {
        type: 'music',
        title: 'Ronde 2: Italiaanse hits',
        songs: [
          { audio: 'volare.mp3', answer: 'Domenico Modugno – Volare', start: 12, end: 32 },
          { audio: 'azzurro.mp3', answer: 'Adriano Celentano – Azzurro' }
        ]
      }
    ])
    const [round] = quiz.rounds
    expect(round.background).toBe('pause')
    expect(round.fragmentScreens).toEqual([quiz.screens[0].id])
    expect(round.fragments).toMatchObject([
      {
        label: 'Fragment 1',
        assetId: 'volare.mp3',
        start: 12,
        end: 32,
        answer: 'Domenico Modugno – Volare'
      },
      { label: 'Fragment 2', assetId: 'azzurro.mp3', answer: 'Adriano Celentano – Azzurro' }
    ])
    const channel = quiz.channels.find((c) => c.id === round.fragments[0].channelId)
    expect(channel?.name).toBe('Fragmenten')
  })

  it('maakt van plaatjes een afbeeldingenronde die eventueel rondloopt', () => {
    const [round] = build([
      {
        type: 'pictures',
        title: 'Ronde 3: wie is dit?',
        loopSeconds: 6,
        pictures: [
          { image: 'a.jpg', answer: 'Sophia Loren', caption: 'Actrice', answerImage: 'b.jpg' }
        ]
      }
    ]).rounds
    expect(round.slideLoopSeconds).toBe(6)
    expect(round.slides[1]).toMatchObject({
      layout: 'image',
      imageAssetId: 'a.jpg',
      title: 'Actrice',
      answer: 'Sophia Loren',
      answerImageAssetId: 'b.jpg'
    })
  })

  it('loopt in een antwoordenronde standaard alle eerdere rondes met antwoorden langs', () => {
    const quiz = build([questions, { type: 'break' }, { type: 'answers' }])
    const [first, pause, answers] = quiz.rounds
    expect(pause.title).toBe('Pauze')
    expect(answers.title).toBe('Antwoorden')
    expect(answers.answersFor).toEqual([first.id])
  })

  it('kiest in een antwoordenronde rondes op hun titel, en meldt een titel die niet bestaat', () => {
    const quiz = build([questions, { type: 'answers', rounds: ['ronde 1: italië'] }])
    expect(quiz.rounds[1].answersFor).toEqual([quiz.rounds[0].id])
    expect(() => build([questions, { type: 'answers', rounds: ['Ronde 9'] }])).toThrow(DraftError)
  })

  it('geeft wat de AI niet noemt een naam in de taal van de app', () => {
    const music: RoundDraft = {
      type: 'music',
      title: 'Hits',
      songs: [{ audio: 'a.mp3', answer: 'A' }]
    }
    const quiz = build([questions, music, { type: 'break' }, { type: 'answers' }], 'en')
    const [first, songs, pause, answers] = quiz.rounds
    expect(first.slides[1].title).toBe('Question 1')
    expect(songs.fragments[0].label).toBe('Clip 1')
    expect(quiz.channels.find((c) => c.id === songs.fragments[0].channelId)?.name).toBe('Clips')
    expect([pause.title, answers.title]).toEqual(['Break', 'Answers'])
  })
})

describe('AGENT_PARAMS', () => {
  it('weigert een ronde zonder vragen of een onbekend soort ronde', () => {
    const create = AGENT_PARAMS.create_quiz
    expect(create.safeParse({ title: 'X', rounds: [questions] }).success).toBe(true)
    expect(
      create.safeParse({
        title: 'X',
        rounds: [{ type: 'questions', title: 'Leeg', questions: [] }]
      }).success
    ).toBe(false)
    expect(create.safeParse({ title: 'X', rounds: [{ type: 'quiz', title: 'Y' }] }).success).toBe(
      false
    )
    expect(create.safeParse({ title: ' ', rounds: [] }).success).toBe(false)
  })
})

describe('describeQuiz', () => {
  it('vat rondes samen met hun vragen en antwoorden', () => {
    const quiz = build([questions, { type: 'break' }, { type: 'answers' }])
    const summary = describeQuiz(quiz, '/q/Italië.pubquiz')
    expect(summary.rounds.map((r) => r.kind)).toEqual(['questions', 'slides', 'answers'])
    expect(summary.rounds[0].questions?.[0]).toEqual({
      question: 'Wat is de hoofdstad van Italië?',
      answer: 'Rome'
    })
    expect(summary.rounds[2].answersFor).toEqual(['Ronde 1: Italië'])
  })
})
