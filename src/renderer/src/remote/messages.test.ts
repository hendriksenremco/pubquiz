import { describe, expect, it } from 'vitest'
import { placeholders } from '@shared/i18n'
import { REMOTE_MESSAGES } from './messages'

describe('teksten op de telefoon', () => {
  it('hebben in elke taal dezelfde waarden als in het Nederlands', () => {
    const { nl, ...others } = REMOTE_MESSAGES.messages
    for (const messages of Object.values(others)) {
      for (const [key, text] of Object.entries(nl)) {
        expect(placeholders(messages[key as keyof typeof nl]), key).toEqual(placeholders(text))
      }
    }
  })
})
