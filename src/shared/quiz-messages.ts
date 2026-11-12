import { defineMessages, type Locale } from './i18n'

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

/** Een ronde zonder titel, in de bediening op de Mac en de telefoon (niet op de schermen). */
export const TITLE_MESSAGES = defineMessages(
  { untitledRound: 'Naamloze ronde' },
  { en: { untitledRound: 'Untitled round' } }
)

/** De titel van een ronde zoals de bediening hem toont: een lege titel wordt "Naamloze ronde". */
export function roundTitle(round: { title: string }, locale: Locale = 'nl'): string {
  return round.title.trim() || TITLE_MESSAGES.in(locale)('untitledRound')
}

/** Waar een bestand gebruikt wordt (`findAssetUsages` in `src/shared/resolve.ts`). */
export const USAGE_MESSAGES = defineMessages(
  {
    screenDefault: 'Standaard van scherm “{name}”',
    background: 'Achtergrondmuziek',
    roundScreen: 'Ronde “{title}”: scherm',
    roundBackground: 'Ronde “{title}”: achtergrondmuziek',
    roundFragment: 'Ronde “{title}”: fragment',
    roundSlide: 'Ronde “{title}”: slide',
    roundAnswer: 'Ronde “{title}”: afbeelding bij het antwoord'
  },
  {
    en: {
      screenDefault: 'Default for screen “{name}”',
      background: 'Background music',
      roundScreen: 'Round “{title}”: screen',
      roundBackground: 'Round “{title}”: background music',
      roundFragment: 'Round “{title}”: clip',
      roundSlide: 'Round “{title}”: slide',
      roundAnswer: 'Round “{title}”: picture with the answer'
    }
  }
)

/** Waarom een quiz.json niet te openen is (`QuizFormatError` in `src/shared/migrate.ts`). */
export const FORMAT_MESSAGES = defineMessages(
  {
    notAnObject: 'quiz.json bevat geen geldig object',
    noSchemaVersion: 'quiz.json mist een geldige schemaVersion',
    newerVersion: 'Deze quiz is gemaakt met een nieuwere versie van de app (schema {version}).',
    noMigration: 'Geen migratie van schema {version}',
    invalid: 'quiz.json is ongeldig bij “{path}”: {error}'
  },
  {
    en: {
      notAnObject: 'quiz.json does not contain a valid object',
      noSchemaVersion: 'quiz.json has no valid schemaVersion',
      newerVersion: 'This quiz was made with a newer version of the app (schema {version}).',
      noMigration: 'No migration from schema {version}',
      invalid: 'quiz.json is invalid at “{path}”: {error}'
    }
  }
)

export type FormatProblem = keyof (typeof FORMAT_MESSAGES)['messages']['nl']
