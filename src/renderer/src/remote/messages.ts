import { defineMessages } from '@shared/i18n'

/**
 * De teksten op de telefoon. Dezelfde knoppen als in de show op de Mac, met dezelfde namen: pas
 * je hier een naam aan, doe dat daar ook.
 */
export const REMOTE_MESSAGES = defineMessages(
  {
    unreachable: 'De Mac is niet bereikbaar',
    deniedTitle: 'Scan de QR-code opnieuw',
    deniedText:
      'Deze link werkt niet meer. De QR-code staat op de Mac, onder Telefoon in de werkbalk van de show.',
    statusLost: 'Geen verbinding',
    statusConnecting: 'Verbinden…',
    statusLive: 'Live',
    statusIdle: 'Niet live',
    lostBanner: 'Verbinding met de Mac kwijt. Opnieuw verbinden…',
    roundOf: 'Ronde {number} van {total}',
    betweenRounds: 'Tussen twee rondes',
    connecting: 'Verbinden met de Mac…',
    noQuiz: 'Geen quiz open op de Mac',
    startShow: 'Start de show op de Mac',
    upNext: 'Hierna: {title}',
    lastRound: 'Dit was de laatste ronde',
    onScreen: 'In beeld',
    playing: 'Speelt',
    preview: 'Preview van de slide',
    noSlide: 'Geen slide in beeld',
    prev: 'Vorige',
    next: 'Volgende',
    answer: 'Antwoord',
    rounds: 'Rondes',
    prevRound: 'Vorige ronde',
    nextRound: 'Volgende ronde',
    restartRound: 'Ronde opnieuw',
    endRound: 'Einde ronde',
    blackoutOn: 'Beeld op zwart',
    blackoutOff: 'Beeld terug',
    muteOn: 'Geluid uit',
    muteOff: 'Geluid aan',
    timerOn: 'Aftellen',
    timerOff: 'Stop aftellen'
  },
  {
    en: {
      unreachable: "Can't reach the Mac",
      deniedTitle: 'Scan the QR code again',
      deniedText:
        'This link no longer works. The QR code is on the Mac, under Phone in the show toolbar.',
      statusLost: 'No connection',
      statusConnecting: 'Connecting…',
      statusLive: 'Live',
      statusIdle: 'Not live',
      lostBanner: 'Lost the connection to the Mac. Reconnecting…',
      roundOf: 'Round {number} of {total}',
      betweenRounds: 'Between rounds',
      connecting: 'Connecting to the Mac…',
      noQuiz: 'No quiz open on the Mac',
      startShow: 'Start the show on the Mac',
      upNext: 'Up next: {title}',
      lastRound: 'That was the last round',
      onScreen: 'On screen',
      playing: 'Playing',
      preview: 'Slide preview',
      noSlide: 'No slide on screen',
      prev: 'Previous',
      next: 'Next',
      answer: 'Answer',
      rounds: 'Rounds',
      prevRound: 'Previous round',
      nextRound: 'Next round',
      restartRound: 'Restart round',
      endRound: 'End round',
      blackoutOn: 'Black out',
      blackoutOff: 'Screens back',
      muteOn: 'Mute',
      muteOff: 'Unmute',
      timerOn: 'Countdown',
      timerOff: 'Stop countdown'
    }
  }
)
