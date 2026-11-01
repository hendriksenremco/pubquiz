import { defineMessages } from '@shared/i18n'
import type { AnswerNoun } from '@shared/resolve'

/**
 * De show op de Mac: ShowLive, de werkbalk (LiveControls) en de sneltoetsen (live-controls.ts).
 * Dezelfde knoppen als op de telefoon, met dezelfde namen (src/renderer/src/remote/messages.ts):
 * pas je hier een naam aan, doe dat daar ook.
 */
export const LIVE_MESSAGES = defineMessages(
  {
    rounds: 'Rondes',
    now: 'Nu',
    upNext: 'Hierna',
    betweenRounds: 'Tussen twee rondes',
    black: 'Zwart',
    slides: 'Slides',
    noSlide: 'Geen slide',
    imageSlide: 'Afbeelding {number}',
    imageSlideTitled: 'Afbeelding {number}: {title}',
    emptySlide: '(leeg)',
    loopPaused: 'Loop gepauzeerd',
    loopAfterTitle: 'Loop start na de titel',
    loopNext: 'Volgende over {seconds} s',
    loopResume: 'Loop verder',
    loopPause: 'Pauzeer loop',
    controls: 'Bediening',
    prevRound: 'Vorige ronde',
    nextRound: 'Volgende ronde',
    nextRoundHint: 'Start de volgende ronde (Enter)',
    restartRound: 'Ronde opnieuw',
    restartRoundHint: 'Vanaf het begin, met de fragmenten weer ongespeeld (R)',
    endRound: 'Einde ronde',
    endRoundHint: 'Schermen en muziek terug naar de standaard (E)',
    notes: 'Notities',
    blackoutOn: 'Beeld op zwart',
    blackoutOff: 'Beeld terug',
    blackoutOnHint: 'Alle schermen op zwart',
    blackoutOffHint: 'Alle schermen tonen weer hun beeld',
    muteOn: 'Geluid uit',
    muteOff: 'Geluid aan',
    muteOnHint: 'Fragment stopt en achtergrondmuziek gaat uit',
    muteOffHint: 'Achtergrondmuziek weer aan',
    shortcuts: 'Sneltoetsen',
    edit: 'Bewerken',
    stopShow: 'Stop show',
    stopTitle: 'Show stoppen?',
    stopMessage: 'De schermen gaan uit en de muziek stopt.',
    keyArrowsAnswers: 'Vorige of volgende stap in de antwoorden',
    keyArrowsFragments: 'Vorig of volgend fragment',
    keyArrowsSlides: 'Vorige of volgende slide',
    keyEnter: 'Enter',
    keyNextRound: 'Start de volgende ronde',
    keyRestart: 'Ronde opnieuw vanaf het begin',
    keyEnd: 'Einde ronde',
    keyFragment: 'Speel een fragment',
    keySpace: 'Spatie',
    keyStopFragment: 'Stop het fragment',
    keyAutoplay: 'Reeks starten of pauzeren',
    keySkip: 'Volgende in de reeks',
    keyBlackout: 'Beeld op zwart of terug',
    keyMute: 'Geluid uit of aan',
    keyLoop: 'Loop van de slides pauzeren of verder'
  },
  {
    en: {
      rounds: 'Rounds',
      now: 'Now',
      upNext: 'Up next',
      betweenRounds: 'Between rounds',
      black: 'Black',
      slides: 'Slides',
      noSlide: 'No slide',
      imageSlide: 'Picture {number}',
      imageSlideTitled: 'Picture {number}: {title}',
      emptySlide: '(empty)',
      loopPaused: 'Loop paused',
      loopAfterTitle: 'Loop starts after the title',
      loopNext: 'Next in {seconds} s',
      loopResume: 'Resume loop',
      loopPause: 'Pause loop',
      controls: 'Controls',
      prevRound: 'Previous round',
      nextRound: 'Next round',
      nextRoundHint: 'Start the next round (Enter)',
      restartRound: 'Restart round',
      restartRoundHint: 'From the start, with all clips unplayed again (R)',
      endRound: 'End round',
      endRoundHint: 'Screens and music back to the default (E)',
      notes: 'Notes',
      blackoutOn: 'Black out',
      blackoutOff: 'Screens back',
      blackoutOnHint: 'All screens to black',
      blackoutOffHint: 'All screens show their picture again',
      muteOn: 'Mute',
      muteOff: 'Unmute',
      muteOnHint: 'The clip stops and the background music turns off',
      muteOffHint: 'Background music back on',
      shortcuts: 'Shortcuts',
      edit: 'Edit',
      stopShow: 'Stop show',
      stopTitle: 'Stop the show?',
      stopMessage: 'The screens go dark and the music stops.',
      keyArrowsAnswers: 'Previous or next step in the answers',
      keyArrowsFragments: 'Previous or next clip',
      keyArrowsSlides: 'Previous or next slide',
      keyEnter: 'Return',
      keyNextRound: 'Start the next round',
      keyRestart: 'Restart the round from the beginning',
      keyEnd: 'End round',
      keyFragment: 'Play a clip',
      keySpace: 'Space',
      keyStopFragment: 'Stop the clip',
      keyAutoplay: 'Start or pause the sequence',
      keySkip: 'Next in the sequence',
      keyBlackout: 'Black out or back',
      keyMute: 'Mute or unmute',
      keyLoop: 'Pause or resume the slide loop'
    }
  }
)

/** Een antwoordenronde tijdens de show (AnswersPad). */
export const ANSWERS_MESSAGES = defineMessages(
  {
    title: 'Antwoorden',
    notShown: 'Niet in beeld',
    notShownHint: 'Kies in de editor bij Antwoorden op welk scherm ze komen',
    prev: 'Vorige',
    start: 'Start antwoorden',
    reveal: 'Toon antwoord',
    done: 'Klaar',
    nextQuestion: 'Volgende vraag',
    nextImage: 'Volgende afbeelding',
    nextFragment: 'Volgend fragment',
    stop: 'Stop',
    stopHint: 'Nummer en antwoord uit beeld',
    nounQuestion: 'vraag',
    nounImage: 'afbeelding',
    nounFragment: 'fragment',
    itemQuestion: 'Vraag {number}',
    itemImage: 'Afbeelding {number}',
    itemFragment: 'Fragment {number}',
    statusAnswer: '{item}: antwoord in beeld',
    statusNumber: '{item}: nummer in beeld',
    statusShown: '{item} in beeld',
    playing: 'speelt…',
    answerShown: 'antwoord in beeld',
    numberShown: 'nummer in beeld',
    nounShown: '{noun} in beeld',
    finished: '✓ gedaan',
    hintToggle: 'Klik om het antwoord te tonen of te verbergen',
    hintFragment: 'Speel dit fragment en zet het nummer in beeld',
    hintShow: 'Zet deze {noun} in beeld',
    noAnswer: 'Geen antwoord ingevuld'
  },
  {
    en: {
      title: 'Answers',
      notShown: 'Not on screen',
      notShownHint: 'Choose in the editor, under Answers, which screen they go to',
      prev: 'Previous',
      start: 'Start answers',
      reveal: 'Show answer',
      done: 'Done',
      nextQuestion: 'Next question',
      nextImage: 'Next picture',
      nextFragment: 'Next clip',
      stop: 'Stop',
      stopHint: 'Number and answer off the screen',
      nounQuestion: 'question',
      nounImage: 'picture',
      nounFragment: 'clip',
      itemQuestion: 'Question {number}',
      itemImage: 'Picture {number}',
      itemFragment: 'Clip {number}',
      statusAnswer: '{item}: answer on screen',
      statusNumber: '{item}: number on screen',
      statusShown: '{item} on screen',
      playing: 'playing…',
      answerShown: 'answer on screen',
      numberShown: 'number on screen',
      nounShown: '{noun} on screen',
      finished: '✓ done',
      hintToggle: 'Click to show or hide the answer',
      hintFragment: 'Play this clip and put its number on screen',
      hintShow: 'Put this {noun} on screen',
      noAnswer: 'No answer filled in'
    }
  }
)

/** Per soort antwoord: hoe hij heet, met en zonder nummer, en wat → dan doet. */
export const ANSWER_NOUNS = {
  vraag: { noun: 'nounQuestion', item: 'itemQuestion', next: 'nextQuestion' },
  afbeelding: { noun: 'nounImage', item: 'itemImage', next: 'nextImage' },
  fragment: { noun: 'nounFragment', item: 'itemFragment', next: 'nextFragment' }
} as const satisfies Record<AnswerNoun, Record<string, string>>

/** De fragmenten van een ronde tijdens de show (FragmentPad). */
export const FRAGMENT_PAD_MESSAGES = defineMessages(
  {
    title: 'Fragmenten',
    playSequence: 'Speel reeks',
    resume: 'Hervat',
    pause: 'Pauze',
    next: 'Volgende',
    stopSequence: 'Stop reeks',
    reset: 'Reset',
    resetHint: 'Gespeeld-markeringen wissen',
    sequencePlaying: 'Reeks: fragment {number}',
    sequenceLast: 'Reeks: fragment {number} (stopt hierna)',
    sequenceGap: 'Reeks: fragment {number} over {seconds} s',
    sequencePaused: 'Reeks gepauzeerd, volgende: fragment {number}',
    playing: 'speelt…',
    played: '✓ gespeeld'
  },
  {
    en: {
      title: 'Clips',
      playSequence: 'Play sequence',
      resume: 'Resume',
      pause: 'Pause',
      next: 'Next',
      stopSequence: 'Stop sequence',
      reset: 'Reset',
      resetHint: 'Clear the played marks',
      sequencePlaying: 'Sequence: clip {number}',
      sequenceLast: 'Sequence: clip {number} (stops after this)',
      sequenceGap: 'Sequence: clip {number} in {seconds} s',
      sequencePaused: 'Sequence paused, next: clip {number}',
      playing: 'playing…',
      played: '✓ played'
    }
  }
)

/** Het geluid tijdens de show (Mixer). */
export const MIXER_MESSAGES = defineMessages(
  {
    sound: 'Geluid',
    background: 'Achtergrond',
    none: 'Geen',
    off: 'Uit',
    pausedByRound: 'Gepauzeerd (ronde)',
    ducked: 'Zachter',
    playing: 'Speelt',
    silent: 'Stil',
    turnOff: 'Zet uit',
    turnOn: 'Zet aan',
    systemDefault: 'Systeemstandaard',
    speakersOf: 'Speakers van {name}',
    videoSound: 'Videogeluid {name}'
  },
  {
    en: {
      sound: 'Sound',
      background: 'Background',
      none: 'None',
      off: 'Off',
      pausedByRound: 'Paused (round)',
      ducked: 'Quieter',
      playing: 'Playing',
      silent: 'Silent',
      turnOff: 'Turn off',
      turnOn: 'Turn on',
      systemDefault: 'System default',
      speakersOf: '{name} speakers',
      videoSound: 'Video sound {name}'
    }
  }
)
