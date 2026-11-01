import { describe, expect, it } from 'vitest'
import { placeholders } from '@shared/i18n'
import { HOME_MESSAGES } from './home-messages'

describe('teksten op het startscherm', () => {
  it('hebben in elke taal dezelfde waarden als in het Nederlands', () => {
    const { nl, ...others } = HOME_MESSAGES.messages
    for (const messages of Object.values(others)) {
      for (const [key, text] of Object.entries(nl)) {
        expect(placeholders(messages[key as keyof typeof nl]), key).toEqual(placeholders(text))
      }
    }
  })
})
