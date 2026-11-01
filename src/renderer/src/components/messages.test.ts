import { describe, expect, it } from 'vitest'
import { placeholders } from '@shared/i18n'
import { COMPONENT_MESSAGES } from './messages'

describe('teksten van de algemene onderdelen', () => {
  it('hebben in elke taal dezelfde waarden als in het Nederlands', () => {
    const { nl, ...others } = COMPONENT_MESSAGES.messages
    for (const messages of Object.values(others)) {
      for (const [key, text] of Object.entries(nl)) {
        expect(placeholders(messages[key]), key).toEqual(placeholders(text))
      }
    }
  })

  it('telt in het voorbeeld en noemt de soorten media', () => {
    expect(COMPONENT_MESSAGES.in('nl')('countOf', { index: 2, total: 7 })).toBe('2 van 7')
    expect(COMPONENT_MESSAGES.in('en')('countOf', { index: 2, total: 7 })).toBe('2 of 7')
    expect(
      COMPONENT_MESSAGES.in('nl')('kindsJoin', { first: "Video's", second: 'Afbeeldingen' })
    ).toBe("Video's en Afbeeldingen")
  })
})
