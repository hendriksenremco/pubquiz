import { describe, expect, it } from 'vitest'
import { LOCALES, placeholders, type MessageBook } from '@shared/i18n'
import { REMOTE_MESSAGES } from '../../remote/messages'
import {
  ANSWER_NOUNS,
  ANSWERS_MESSAGES,
  FRAGMENT_PAD_MESSAGES,
  LIVE_MESSAGES,
  MIXER_MESSAGES,
  MUSIC_STATUS,
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
      'loopPause',
      'loopResume',
      'betweenRounds',
      'notes'
    ] as const
    for (const locale of LOCALES) {
      const mac = LIVE_MESSAGES.in(locale)
      const phone = REMOTE_MESSAGES.in(locale)
      for (const key of same) expect(mac(key), `${locale}: ${key}`).toBe(phone(key))
      // Slides: "Geen slide in beeld" (noSlide) is op de telefoon de lege preview.
      expect(mac('slides'), `${locale}: slides`).toBe(phone('slides'))
      expect(mac('noSlide'), `${locale}: noSlide`).toBe(phone('noSlideButton'))
      // De knoppen van de reeks (FragmentPad); "Volgende" heet op de telefoon `skip`, naast vorige en volgende.
      const pad = FRAGMENT_PAD_MESSAGES.in(locale)
      const pairs = [
        ['title', 'fragments'],
        ['playSequence', 'playSequence'],
        ['pause', 'pause'],
        ['resume', 'resume'],
        ['next', 'skip'],
        ['stopSequence', 'stopSequence'],
        ['reset', 'reset'],
        ['upNext', 'upNextFragment'],
        ['played', 'played']
      ] as const
      for (const [mac, tel] of pairs) expect(pad(mac), `${locale}: ${mac}`).toBe(phone(tel))
      // Antwoorden (AnswersPad).
      const answers = ANSWERS_MESSAGES.in(locale)
      expect(answers('title'), `${locale}: answers`).toBe(phone('answers'))
      expect(answers('stop'), `${locale}: stopAnswers`).toBe(phone('stopAnswers'))
      const answerKeys = [
        'nounQuestion',
        'nounImage',
        'nounFragment',
        'answerShown',
        'numberShown',
        'finished',
        'noAnswer'
      ] as const
      for (const key of answerKeys) expect(answers(key), `${locale}: ${key}`).toBe(phone(key))
      expect(answers('nounShown', { noun: 'x' })).toBe(phone('nounShown', { noun: 'x' }))
      // Geluid (Mixer): de muziek, haar stand en de schuifjes.
      const mixer = MIXER_MESSAGES.in(locale)
      const soundKeys = [
        'sound',
        'background',
        ...Object.values(MUSIC_STATUS),
        'silent',
        'turnOff',
        'turnOn'
      ] as const
      for (const key of soundKeys) expect(mixer(key), `${locale}: ${key}`).toBe(phone(key))
      for (const key of ['videoSound', 'channelVolume'] as const) {
        expect(mixer(key, { name: 'x' }), `${locale}: ${key}`).toBe(phone(key, { name: 'x' }))
      }
    }
  })

  it('noemt elk soort antwoord in beide talen', () => {
    const t = ANSWERS_MESSAGES.in('en')
    expect(t(ANSWER_NOUNS.afbeelding.item, { number: 3 })).toBe('Picture 3')
    expect(ANSWERS_MESSAGES.in('nl')(ANSWER_NOUNS.fragment.next)).toBe('Volgend fragment')
    expect(t('hintShow', { noun: t(ANSWER_NOUNS.vraag.noun) })).toBe('Put this question on screen')
  })

  it('noemt stoppen zoals beginnen: Start antwoorden en Stop antwoorden', () => {
    for (const locale of ['nl', 'en'] as const) {
      const t = ANSWERS_MESSAGES.in(locale)
      expect(t('stop').split(' ')[1]).toBe(t('start').split(' ')[1])
    }
  })
})
