import { describe, expect, it } from 'vitest'
import { placeholders, type MessageBook } from '@shared/i18n'
import {
  AI_ERRORS,
  DIALOG_MESSAGES,
  errorText,
  MAGICHOME_ERRORS,
  MENU_MESSAGES,
  NOTICE_MESSAGES,
  NoticeError
} from './messages'

function samePlaceholders<Key extends string>(book: MessageBook<Key>) {
  const { nl, ...others } = book.messages
  for (const messages of Object.values(others)) {
    for (const [key, text] of Object.entries<string>(nl)) {
      expect(placeholders(messages[key as Key]), key).toEqual(placeholders(text))
    }
  }
}

describe('teksten van main', () => {
  it('hebben in elke taal dezelfde waarden als in het Nederlands', () => {
    samePlaceholders(MENU_MESSAGES)
    samePlaceholders(DIALOG_MESSAGES)
    samePlaceholders(NOTICE_MESSAGES)
    samePlaceholders(MAGICHOME_ERRORS)
    samePlaceholders(AI_ERRORS)
  })
})

describe('errorText', () => {
  it('vertaalt een NoticeError; zijn message blijft Nederlands', () => {
    const err = new NoticeError('quizExists', { name: 'Kroegquiz' })
    expect(err.message).toBe('Er bestaat al een quiz met de naam "Kroegquiz"')
    expect(errorText(err, 'nl')).toBe(err.message)
    expect(errorText(err, 'en')).toBe('There is already a quiz called "Kroegquiz"')
  })

  it('laat andere fouten zoals ze zijn', () => {
    expect(errorText(new Error('ENOSPC'), 'en')).toBe('ENOSPC')
    expect(errorText('kapot', 'en')).toBe('kapot')
  })
})
