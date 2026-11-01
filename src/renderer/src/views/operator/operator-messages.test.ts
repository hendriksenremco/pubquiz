import { describe, expect, it } from 'vitest'
import { placeholders, type MessageBook } from '@shared/i18n'
import { COMPONENT_MESSAGES } from '../../components/messages'
import {
  AI_MESSAGES,
  NEW_QUIZ_MESSAGES,
  OPERATOR_MESSAGES,
  SETTINGS_MESSAGES
} from './operator-messages'

const BOOKS: Record<string, MessageBook<string>> = {
  OPERATOR_MESSAGES,
  NEW_QUIZ_MESSAGES,
  AI_MESSAGES,
  SETTINGS_MESSAGES,
  COMPONENT_MESSAGES
}

describe('teksten van de werkbalk en de dialogen', () => {
  for (const [name, book] of Object.entries(BOOKS)) {
    it(`${name} heeft in elke taal dezelfde waarden als in het Nederlands`, () => {
      const { nl, ...others } = book.messages
      for (const messages of Object.values(others)) {
        for (const [key, text] of Object.entries(nl)) {
          expect(placeholders(messages[key]), key).toEqual(placeholders(text))
        }
      }
    })
  }

  it('geeft de naam van een kopie en de titel van de dialoog in beide talen', () => {
    expect(NEW_QUIZ_MESSAGES.in('nl')('copyName', { title: 'Mei' })).toBe('Mei (nieuw)')
    expect(NEW_QUIZ_MESSAGES.in('en')('titleFrom', { title: 'May' })).toBe(
      'New quiz based on “May”'
    )
  })
})
