import { describe, expect, it } from 'vitest'
import { placeholders, type MessageBook } from '@shared/i18n'
import {
  EDITOR_MESSAGES,
  FRAGMENT_MESSAGES,
  MEDIA_MESSAGES,
  PRINT_MESSAGES,
  ROUND_MESSAGES,
  SETUP_MESSAGES,
  SLIDE_MESSAGES
} from './editor-messages'
import { MENU_MESSAGES } from '../../../../main/messages'

const BOOKS: Record<string, MessageBook<string>> = {
  PRINT_MESSAGES,
  FRAGMENT_MESSAGES,
  SLIDE_MESSAGES,
  ROUND_MESSAGES,
  EDITOR_MESSAGES,
  MEDIA_MESSAGES,
  SETUP_MESSAGES
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

  it('telt bestanden in Media en noemt nieuwe mappen, schermen en kanalen', () => {
    expect(MEDIA_MESSAGES.in('nl')('filesMany', { count: 3 })).toBe('3 bestanden')
    expect(MEDIA_MESSAGES.in('en')('newFolderNumber', { number: 2 })).toBe('New folder 2')
    expect(EDITOR_MESSAGES.in('en')('addedMany', { count: 2 })).toBe('2 files added to Media')
    expect(SETUP_MESSAGES.in('nl')('newScreen', { number: 2 })).toBe('Scherm 2')
    expect(SETUP_MESSAGES.in('en')('newChannel', { number: 3 })).toBe('Channel 3')
  })

  it('Quiz-instellingen gebruikt de woorden van het menu, met … waar een dialoog volgt', () => {
    for (const locale of ['nl', 'en'] as const) {
      const setup = SETUP_MESSAGES.in(locale)
      const menu = MENU_MESSAGES.in(locale)
      expect(setup('exportZip').toLowerCase()).toBe(menu('exportZip').toLowerCase())
      expect(setup('reveal')).toBe(menu('reveal'))
      expect(setup('createFromCurrent').endsWith('…')).toBe(true)
    }
  })
})
