import { describe, expect, it } from 'vitest'
import { placeholders, type MessageBook } from './i18n'
import { REMOTE_ERRORS, STEP_MESSAGES } from './show-messages'
import { stepNames } from './resolve'

function samePlaceholders<Key extends string>(book: MessageBook<Key>) {
  const { nl, ...others } = book.messages
  for (const messages of Object.values(others)) {
    for (const [key, text] of Object.entries<string>(nl)) {
      expect(placeholders(messages[key as Key]), key).toEqual(placeholders(text))
    }
  }
}

describe('teksten over de show', () => {
  it('hebben in elke taal dezelfde waarden als in het Nederlands', () => {
    samePlaceholders(STEP_MESSAGES)
    samePlaceholders(REMOTE_ERRORS)
  })
})

describe('stepNames', () => {
  it('noemt vorige en volgende naar wat ze bedienen, in de taal van de app', () => {
    expect(stepNames('slides')).toEqual(['Vorige slide', 'Volgende slide'])
    expect(stepNames('fragments', 'en')).toEqual(['Previous clip', 'Next clip'])
    expect(stepNames('answers', 'en')).toEqual(['Previous step', 'Next step'])
  })
})
