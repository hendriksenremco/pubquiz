import { defineMessages } from './i18n'

/**
 * Namen die de app zelf aan een nieuwe quiz geeft: schermen, kanalen, rondes, vragen en
 * fragmenten (`src/shared/factory.ts` en `src/shared/draft.ts`). Ze komen in het quizbestand, dus
 * in de taal van de Mac waarop de quiz gemaakt is.
 */
export const NAME_MESSAGES = defineMessages(
  {
    screen: 'Beamer',
    roomChannel: 'Zaal',
    fragmentChannel: 'Fragmenten',
    round: 'Ronde {number}',
    musicRound: 'Ronde {number}: muziek',
    picturesRound: 'Ronde {number}: afbeeldingen',
    answers: 'Antwoorden',
    break: 'Pauze',
    question: 'Vraag {number}',
    fragment: 'Fragment {number}'
  },
  {
    en: {
      screen: 'Projector',
      roomChannel: 'Room',
      fragmentChannel: 'Clips',
      round: 'Round {number}',
      musicRound: 'Round {number}: music',
      picturesRound: 'Round {number}: pictures',
      answers: 'Answers',
      break: 'Break',
      question: 'Question {number}',
      fragment: 'Clip {number}'
    }
  }
)

/** Waar een bestand gebruikt wordt (`findAssetUsages` in `src/shared/resolve.ts`). */
export const USAGE_MESSAGES = defineMessages(
  {
    screenDefault: 'Standaard van scherm "{name}"',
    background: 'Achtergrondmuziek',
    roundScreen: 'Ronde "{title}": scherm',
    roundBackground: 'Ronde "{title}": achtergrond',
    roundFragment: 'Ronde "{title}": fragment',
    roundSlide: 'Ronde "{title}": slide',
    roundAnswer: 'Ronde "{title}": bij een antwoord'
  },
  {
    en: {
      screenDefault: 'Default for screen "{name}"',
      background: 'Background music',
      roundScreen: 'Round "{title}": screen',
      roundBackground: 'Round "{title}": background',
      roundFragment: 'Round "{title}": clip',
      roundSlide: 'Round "{title}": slide',
      roundAnswer: 'Round "{title}": with an answer'
    }
  }
)
