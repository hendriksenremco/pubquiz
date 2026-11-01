import { describe, expect, it } from 'vitest'
import { placeholders, type MessageBook } from './i18n'
import {
  ANSWER_CONTEXT,
  CHECK_MESSAGES,
  REMOTE_ERRORS,
  SCREEN_MESSAGES,
  STEP_MESSAGES
} from './show-messages'
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
    samePlaceholders(SCREEN_MESSAGES)
    samePlaceholders(CHECK_MESSAGES)
  })
})

describe('ANSWER_CONTEXT', () => {
  it('zegt bij een antwoord op het scherm waar het bij hoort', () => {
    const say = (locale: 'nl' | 'en', noun: keyof typeof ANSWER_CONTEXT) =>
      SCREEN_MESSAGES.in(locale)(ANSWER_CONTEXT[noun], { round: 'Muziek', number: 2 })
    expect(say('nl', 'fragment')).toBe('Muziek, fragment 2')
    expect(say('nl', 'vraag')).toBe('Muziek, vraag 2')
    expect(say('en', 'fragment')).toBe('Muziek, clip 2')
    expect(say('en', 'afbeelding')).toBe('Muziek, picture 2')
  })
})

describe('stepNames', () => {
  it('noemt vorige en volgende naar wat ze bedienen, in de taal van de app', () => {
    expect(stepNames('slides')).toEqual(['Vorige slide', 'Volgende slide'])
    expect(stepNames('fragments', 'en')).toEqual(['Previous clip', 'Next clip'])
    expect(stepNames('answers', 'en')).toEqual(['Previous step', 'Next step'])
  })
})
