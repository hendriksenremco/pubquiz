import { describe, expect, it } from 'vitest'
import { placeholders } from '@shared/i18n'
import { AUDIO_MESSAGES } from './messages'

describe('teksten van de audio-engine', () => {
  it('hebben in elke taal dezelfde waarden als in het Nederlands', () => {
    const { nl, ...others } = AUDIO_MESSAGES.messages
    for (const messages of Object.values(others)) {
      for (const [key, text] of Object.entries<string>(nl)) {
        expect(placeholders(messages[key as keyof typeof nl]), key).toEqual(placeholders(text))
      }
    }
  })
})
