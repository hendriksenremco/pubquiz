import { defineMessages } from './i18n'

/**
 * Teksten over de show die main en shared maken, voor de Mac en de telefoon: hoe vorige en
 * volgende heten (`stepNames`) en waar je staat (`remoteStep`).
 */
export const STEP_MESSAGES = defineMessages(
  {
    prevSlide: 'Vorige slide',
    nextSlide: 'Volgende slide',
    prevFragment: 'Vorig fragment',
    nextFragment: 'Volgend fragment',
    prevStep: 'Vorige stap',
    nextStep: 'Volgende stap',
    answersToGo: '{count} om na te lopen',
    answerQuestion: 'Vraag {number}, {round}',
    answerImage: 'Afbeelding {number}, {round}',
    answerFragment: 'Fragment {number}, {round}',
    fragmentOf: 'Fragment {number} van {total}',
    fragments: '{count} fragmenten',
    noSlides: 'Geen slides in deze ronde',
    slideOf: 'Slide {number} van {total}',
    noSlideOf: 'Geen slide, {count} in deze ronde'
  },
  {
    en: {
      prevSlide: 'Previous slide',
      nextSlide: 'Next slide',
      prevFragment: 'Previous clip',
      nextFragment: 'Next clip',
      prevStep: 'Previous step',
      nextStep: 'Next step',
      answersToGo: '{count} to go through',
      answerQuestion: 'Question {number}, {round}',
      answerImage: 'Picture {number}, {round}',
      answerFragment: 'Clip {number}, {round}',
      fragmentOf: 'Clip {number} of {total}',
      fragments: '{count} clips',
      noSlides: 'No slides in this round',
      slideOf: 'Slide {number} of {total}',
      noSlideOf: 'No slide, {count} in this round'
    }
  }
)

/** Wat de server van de afstandsbediening (src/main/remote.ts) aan de telefoon terugmeldt. */
export const REMOTE_ERRORS = defineMessages(
  {
    failed: 'Er ging iets mis op de Mac',
    scanAgain: 'Scan de QR-code opnieuw',
    tooMany: 'Te veel apparaten verbonden',
    onlyMethod: 'Alleen {method}',
    unknownCommand: 'Onbekende opdracht',
    notFromPhone: 'Dat kan niet vanaf de telefoon',
    startShow: 'Start eerst de show op de Mac',
    pluginOff: '{name} staat uit op de Mac',
    unknownPlugin: 'Deze plug-in',
    didNotWork: 'Dat lukte niet'
  },
  {
    en: {
      failed: 'Something went wrong on the Mac',
      scanAgain: 'Scan the QR code again',
      tooMany: 'Too many devices connected',
      onlyMethod: '{method} only',
      unknownCommand: 'Unknown command',
      notFromPhone: "That can't be done from the phone",
      startShow: 'Start the show on the Mac first',
      pluginOff: '{name} is off on the Mac',
      unknownPlugin: 'This plug-in',
      didNotWork: "That didn't work"
    }
  }
)
