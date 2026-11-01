import { defineMessages } from '@shared/i18n'

/** Afdrukken (PrintPanel): de pdf's met formulieren en vragenkaarten. */
export const PRINT_MESSAGES = defineMessages(
  {
    title: 'Afdrukken',
    empty:
      'Deze quiz heeft nog geen vragen, afbeeldingen of fragmenten. Voeg ze toe in een ronde; dan kun je hier de formulieren maken.',
    rounds: 'Rondes',
    chosen: '{chosen} van {total}',
    pdf: 'Pdf',
    sheetTitle: 'Antwoordformulier',
    sheetHint: 'Voor de teams: tot vier rondes per A4, elk in een eigen vak om los te knippen',
    keyTitle: 'Nakijkformulier',
    keyHint: 'Precies dezelfde opmaak met de antwoorden erop: leg hem naast een ingevuld formulier',
    cardsTitle: 'Vragenkaarten',
    cardsHint:
      'Voor jou: per ronde de vragen met antwoord, vier ansichtkaarten per A4 om te knippen',
    save: 'Opslaan',
    saveDoc: '{title} opslaan',
    busy: 'Bezig…'
  },
  {
    en: {
      title: 'Print',
      empty:
        'This quiz has no questions, pictures or clips yet. Add them in a round; then you can make the forms here.',
      rounds: 'Rounds',
      chosen: '{chosen} of {total}',
      pdf: 'PDF',
      sheetTitle: 'Answer sheet',
      sheetHint: 'For the teams: up to four rounds per A4, each in its own box to cut out',
      keyTitle: 'Answer key',
      keyHint: 'The same layout with the answers filled in: lay it next to a team’s sheet',
      cardsTitle: 'Question cards',
      cardsHint: 'For you: the questions and answers per round, four postcards per A4 to cut out',
      save: 'Save',
      saveDoc: 'Save {title}',
      busy: 'Saving…'
    }
  }
)

/** De fragmenten van een ronde (FragmentList) en het paneel rechts (FragmentInspector). */
export const FRAGMENT_MESSAGES = defineMessages(
  {
    listen: 'Luister',
    listenTo: 'Luister naar {name}',
    stop: 'Stop',
    name: 'Naam',
    answer: 'Antwoord',
    answerPlaceholder: 'Antwoord, voor de antwoordenronde',
    fileMissing: 'Bestand ontbreekt',
    playing: 'Wat er speelt',
    start: 'Begin',
    end: 'Eind',
    endPlaceholder: 'tot het eind',
    file: 'Bestand',
    onAnswer: 'Bij antwoord',
    answerImage: 'Afbeelding bij het antwoord',
    sound: 'Geluid',
    channel: 'Kanaal',
    fadeIn: 'Fade-in',
    fadeInSeconds: 'Fade-in in seconden',
    fadeOut: 'Fade-out',
    fadeOutSeconds: 'Fade-out in seconden',
    seconds: 's',
    moveUp: 'Omhoog',
    moveDown: 'Omlaag',
    remove: 'Verwijder'
  },
  {
    en: {
      listen: 'Listen',
      listenTo: 'Listen to {name}',
      stop: 'Stop',
      name: 'Name',
      answer: 'Answer',
      answerPlaceholder: 'Answer, for the answers round',
      fileMissing: 'File missing',
      playing: 'What plays',
      start: 'Start',
      end: 'End',
      endPlaceholder: 'to the end',
      file: 'File',
      onAnswer: 'With the answer',
      answerImage: 'Picture with the answer',
      sound: 'Sound',
      channel: 'Channel',
      fadeIn: 'Fade in',
      fadeInSeconds: 'Fade in, in seconds',
      fadeOut: 'Fade out',
      fadeOutSeconds: 'Fade out, in seconds',
      seconds: 's',
      moveUp: 'Move up',
      moveDown: 'Move down',
      remove: 'Delete'
    }
  }
)
