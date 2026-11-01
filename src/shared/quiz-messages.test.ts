import { describe, expect, it } from 'vitest'
import { createFragment, createQuiz, createRound, fragmentChannel } from './factory'
import { placeholders, type MessageBook } from './i18n'
import { NAME_MESSAGES, USAGE_MESSAGES } from './quiz-messages'

function samePlaceholders<Key extends string>(book: MessageBook<Key>) {
  const { nl, ...others } = book.messages
  for (const messages of Object.values(others)) {
    for (const [key, text] of Object.entries<string>(nl)) {
      expect(placeholders(messages[key as Key]), key).toEqual(placeholders(text))
    }
  }
}

describe('namen in een nieuwe quiz', () => {
  it('hebben in elke taal dezelfde waarden als in het Nederlands', () => {
    samePlaceholders(NAME_MESSAGES)
    samePlaceholders(USAGE_MESSAGES)
  })

  it('zijn standaard Nederlands', () => {
    const quiz = createQuiz('Kroegquiz')
    expect(quiz.screens.map((s) => s.name)).toEqual(['Beamer'])
    expect(quiz.channels.map((c) => c.name)).toEqual(['Zaal', 'Fragmenten'])
    expect(createRound('music', 2).title).toBe('Ronde 2: muziek')
    expect(createFragment('a', 'c', 3).label).toBe('Fragment 3')
  })

  it('volgen de taal van de app', () => {
    const quiz = createQuiz('Pub quiz', 'en')
    expect(quiz.screens.map((s) => s.name)).toEqual(['Projector'])
    expect(quiz.channels.map((c) => c.name)).toEqual(['Room', 'Clips'])
    const titles = (['normal', 'music', 'pictures', 'break', 'answers'] as const).map((preset) => {
      const round = createRound(preset, 1, quiz, 'en')
      return [round.title, round.slides[0].title]
    })
    expect(titles).toEqual([
      ['Round 1', 'Round 1'],
      ['Round 1: music', 'Round 1'],
      ['Round 1: pictures', 'Round 1'],
      ['Break', 'Break'],
      ['Answers', 'Answers']
    ])
  })

  it('vinden het kanaal voor fragmenten in beide talen', () => {
    for (const locale of ['nl', 'en'] as const) {
      const quiz = createQuiz('Q', locale)
      quiz.channels.reverse()
      expect(fragmentChannel(quiz)?.name).toBe(NAME_MESSAGES.in(locale)('fragmentChannel'))
    }
  })
})
