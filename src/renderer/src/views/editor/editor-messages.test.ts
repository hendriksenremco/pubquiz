import { describe, expect, it } from 'vitest'
import { placeholders, type MessageBook } from '@shared/i18n'
import {
  FRAGMENT_MESSAGES,
  PRINT_MESSAGES,
  ROUND_MESSAGES,
  SLIDE_MESSAGES
} from './editor-messages'

const BOOKS: Record<string, MessageBook<string>> = {
  PRINT_MESSAGES,
  FRAGMENT_MESSAGES,
  SLIDE_MESSAGES,
  ROUND_MESSAGES
}

describe('teksten van de editor', () => {
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

  it('maakt de knop om een pdf op te slaan', () => {
    expect(PRINT_MESSAGES.in('nl')('saveDoc', { title: 'Nakijkformulier' })).toBe(
      'Nakijkformulier opslaan'
    )
    expect(PRINT_MESSAGES.in('nl')('chosen', { chosen: 2, total: 5 })).toBe('2 van 5')
  })

  it('noemt een afbeeldingsslide met zijn nummer', () => {
    expect(SLIDE_MESSAGES.in('nl')('kindImage', { number: 3 })).toBe('Afbeelding 3')
    expect(SLIDE_MESSAGES.in('en')('kindImage', { number: 3 })).toBe('Picture 3')
  })

  it('noemt nieuwe vragen en fragmenten met hun nummer', () => {
    expect(ROUND_MESSAGES.in('nl')('newQuestion', { number: 4 })).toBe('Vraag 4')
    expect(ROUND_MESSAGES.in('nl')('fragmentName', { number: 2 })).toBe('Fragment 2')
    expect(ROUND_MESSAGES.in('en')('fragmentName', { number: 2 })).toBe('Clip 2')
  })
})
