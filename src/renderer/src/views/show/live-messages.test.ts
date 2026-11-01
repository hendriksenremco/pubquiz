import { describe, expect, it } from 'vitest'
import { LOCALES, placeholders, type MessageBook } from '@shared/i18n'
import { REMOTE_MESSAGES } from '../../remote/messages'
import {
  ANSWER_NOUNS,
  ANSWERS_MESSAGES,
  FRAGMENT_PAD_MESSAGES,
  LIVE_MESSAGES,
  MIXER_MESSAGES,
  START_MESSAGES
} from './live-messages'
import { AUDIO_DEVICE_MESSAGES } from '../../lib/audio-devices'

const BOOKS: Record<string, MessageBook<string>> = {
  LIVE_MESSAGES,
  ANSWERS_MESSAGES,
  FRAGMENT_PAD_MESSAGES,
  MIXER_MESSAGES,
  START_MESSAGES,
  AUDIO_DEVICE_MESSAGES
}

describe('teksten van de show', () => {
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

  it('geeft de knoppen dezelfde namen als op de telefoon', () => {
    const same = [
      'prevRound',
      'nextRound',
      'restartRound',
      'endRound',
      'blackoutOn',
      'blackoutOff',
      'muteOn',
      'muteOff',
      'timerOn',
      'timerOff',
      'betweenRounds'
    ] as const
    for (const locale of LOCALES) {
      const mac = LIVE_MESSAGES.in(locale)
      const phone = REMOTE_MESSAGES.in(locale)
      for (const key of same) expect(mac(key), `${locale}: ${key}`).toBe(phone(key))
    }
  })

  it('noemt elk soort antwoord in beide talen', () => {
    const t = ANSWERS_MESSAGES.in('en')
    expect(t(ANSWER_NOUNS.afbeelding.item, { number: 3 })).toBe('Picture 3')
    expect(ANSWERS_MESSAGES.in('nl')(ANSWER_NOUNS.fragment.next)).toBe('Volgend fragment')
    expect(t('hintShow', { noun: t(ANSWER_NOUNS.vraag.noun) })).toBe('Put this question on screen')
  })
})
