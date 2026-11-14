import { defineMessages } from './i18n'
import type { AnswerNoun } from './resolve'

/**
 * Teksten over de show die main en shared maken, voor de Mac en de telefoon: hoe vorige en
 * volgende heten (`stepNames`, en in een antwoordenronde `remoteStep`), waar je staat (`remoteStep`) en de korte naam van een slide in de
 * lijst Slides (`slideLabel`).
 */
export const STEP_MESSAGES = defineMessages(
  {
    prevSlide: 'Vorige slide',
    nextSlide: 'Volgende slide',
    prevFragment: 'Vorig fragment',
    nextFragment: 'Volgend fragment',
    prevStep: 'Vorige stap',
    nextStep: 'Volgende stap',
    startAnswers: 'Start antwoorden',
    revealAnswer: 'Toon antwoord',
    nextQuestion: 'Volgende vraag',
    nextImage: 'Volgende afbeelding',
    answersToGo: '{count} om na te lopen',
    answerQuestion: 'Vraag {number}, {round}',
    answerImage: 'Afbeelding {number}, {round}',
    answerFragment: 'Fragment {number}, {round}',
    fragmentOf: 'Fragment {number} van {total}',
    fragments: '{count} fragmenten',
    noSlides: 'Geen slides in deze ronde',
    slideOf: 'Slide {number} van {total}',
    noSlideOf: 'Geen slide, {count} in deze ronde',
    numberSlide: 'Nummer {number}',
    imageSlide: 'Afbeelding {number}',
    imageSlideTitled: 'Afbeelding {number}: {title}',
    emptySlide: '(leeg)'
  },
  {
    en: {
      prevSlide: 'Previous slide',
      nextSlide: 'Next slide',
      prevFragment: 'Previous clip',
      nextFragment: 'Next clip',
      prevStep: 'Previous step',
      nextStep: 'Next step',
      startAnswers: 'Start answers',
      revealAnswer: 'Show answer',
      nextQuestion: 'Next question',
      nextImage: 'Next picture',
      answersToGo: '{count} to go through',
      answerQuestion: 'Question {number}, {round}',
      answerImage: 'Picture {number}, {round}',
      answerFragment: 'Clip {number}, {round}',
      fragmentOf: 'Clip {number} of {total}',
      fragments: '{count} clips',
      noSlides: 'No slides in this round',
      slideOf: 'Slide {number} of {total}',
      noSlideOf: 'No slide, {count} in this round',
      numberSlide: 'Number {number}',
      imageSlide: 'Picture {number}',
      imageSlideTitled: 'Picture {number}: {title}',
      emptySlide: '(empty)'
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

/**
 * Wat er over de slide heen op een scherm staat (ScreenStage.vue): voor het publiek, op het
 * voorbeeld in de show ook "Zwart". En wat een display laat zien als je hem aanwijst (IdentifyApp.vue).
 */
export const SCREEN_MESSAGES = defineMessages(
  {
    question: 'Vraag',
    fragment: 'Fragment',
    next: 'Volgende',
    inSeconds: 'over {seconds} s',
    timeLeft: 'Nog',
    contextQuestion: '{round}, vraag {number}',
    contextImage: '{round}, afbeelding {number}',
    contextFragment: '{round}, fragment {number}',
    thisDisplay: 'Dit display is',
    blackout: 'Zwart'
  },
  {
    en: {
      question: 'Question',
      fragment: 'Clip',
      next: 'Next',
      inSeconds: 'in {seconds} s',
      timeLeft: 'Time left',
      contextQuestion: '{round}, question {number}',
      contextImage: '{round}, picture {number}',
      contextFragment: '{round}, clip {number}',
      thisDisplay: 'This display is',
      blackout: 'Black'
    }
  }
)

/** Bij een antwoord op het scherm: waar het bij hoort, bv. "Muziek, fragment 2". */
export const ANSWER_CONTEXT = {
  vraag: 'contextQuestion',
  afbeelding: 'contextImage',
  fragment: 'contextFragment'
} as const satisfies Record<AnswerNoun, string>

/** Wat `findBrokenReferences` meldt bij Start show: verwijzingen naar media of kanalen die weg zijn. */
export const CHECK_MESSAGES = defineMessages(
  {
    mediaMissing: '{where}: bestand ontbreekt',
    channelMissing: '{where}: kanaal ontbreekt',
    screen: 'Scherm “{name}”',
    background: 'Achtergrondmuziek',
    round: 'Ronde “{title}”',
    slide: '{round}, slide',
    answerImage: '{where}, afbeelding bij het antwoord'
  },
  {
    en: {
      mediaMissing: '{where}: file missing',
      channelMissing: '{where}: channel missing',
      screen: 'Screen “{name}”',
      background: 'Background music',
      round: 'Round “{title}”',
      slide: '{round}, slide',
      answerImage: '{where}, picture with the answer'
    }
  }
)
