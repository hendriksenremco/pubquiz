import { describe, expect, it } from 'vitest'
import { placeholders, type MessageBook } from '@shared/i18n'
import {
  CONTROLLER_MESSAGES,
  LIGHT_PANEL_MESSAGES,
  LIGHT_PICKER_MESSAGES,
  LIGHT_PLACE_MESSAGES
} from './magichome/messages'
import { REMOTE_QR_MESSAGES } from './remote/messages'
import { SCORE_TABLE_MESSAGES } from './scores/messages'

const BOOKS: Record<string, MessageBook<string>> = {
  CONTROLLER_MESSAGES,
  LIGHT_PANEL_MESSAGES,
  LIGHT_PICKER_MESSAGES,
  LIGHT_PLACE_MESSAGES,
  REMOTE_QR_MESSAGES,
  SCORE_TABLE_MESSAGES
}

describe('teksten van de plug-ins in de app', () => {
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
})
