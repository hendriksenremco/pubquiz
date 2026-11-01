import { defineMessages } from './i18n'
import type { AnswerNoun } from './resolve'

/**
 * Teksten op de pdf's (antwoordformulier, nakijkformulier en vragenkaarten), hun bestandsnamen en
 * de samenvatting per ronde ("2 vragen, 8 fragmenten") in src/shared/forms.ts.
 */
export const FORM_MESSAGES = defineMessages(
  {
    team: 'Team',
    answerKey: 'Nakijkformulier',
    untitled: 'Pubquiz',
    fileSheet: 'antwoordformulier',
    fileKey: 'nakijkformulier',
    fileCards: 'vragenkaarten',
    nounQuestion: 'Vraag',
    nounImage: 'Afbeelding',
    nounFragment: 'Fragment',
    questionsOne: '{count} vraag',
    questionsMany: '{count} vragen',
    imagesOne: '{count} afbeelding',
    imagesMany: '{count} afbeeldingen',
    fragmentsOne: '{count} fragment',
    fragmentsMany: '{count} fragmenten'
  },
  {
    en: {
      team: 'Team',
      answerKey: 'Answer key',
      untitled: 'Pub quiz',
      fileSheet: 'answer sheet',
      fileKey: 'answer key',
      fileCards: 'question cards',
      nounQuestion: 'Question',
      nounImage: 'Picture',
      nounFragment: 'Clip',
      questionsOne: '{count} question',
      questionsMany: '{count} questions',
      imagesOne: '{count} picture',
      imagesMany: '{count} pictures',
      fragmentsOne: '{count} clip',
      fragmentsMany: '{count} clips'
    }
  }
)

/** Wat een nummer op een pdf is, als een ronde vragen en fragmenten door elkaar heeft. */
export const FORM_NOUNS = {
  vraag: 'nounQuestion',
  afbeelding: 'nounImage',
  fragment: 'nounFragment'
} as const satisfies Record<AnswerNoun, string>
