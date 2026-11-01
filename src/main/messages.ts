import { defineMessages, type Locale, type Params } from '@shared/i18n'

/**
 * Teksten die main zelf maakt (issue #53): het menu, de dialogen om te openen en op te slaan, en
 * de meldingen in de app. Zonder Electron, zodat de tests ze kunnen lezen.
 */

/** De menubalk. Wat macOS zelf vertaalt (knippen, plakken, venster …) staat er niet in. */
export const MENU_MESSAGES = defineMessages(
  {
    about: 'Over {app}',
    settings: 'Instellingen…',
    file: 'Archief',
    newQuiz: 'Nieuwe quiz…',
    openQuiz: 'Open quiz…',
    importZip: 'Importeer uit zip…',
    exportZip: 'Exporteer als zip…',
    reveal: 'Toon in Finder',
    edit: 'Wijzig',
    undo: 'Herstel',
    redo: 'Opnieuw',
    view: 'Weergave'
  },
  {
    en: {
      about: 'About {app}',
      settings: 'Settings…',
      file: 'File',
      newQuiz: 'New Quiz…',
      openQuiz: 'Open Quiz…',
      importZip: 'Import from Zip…',
      exportZip: 'Export as Zip…',
      reveal: 'Show in Finder',
      edit: 'Edit',
      undo: 'Undo',
      redo: 'Redo',
      view: 'View'
    }
  }
)

/** De dialogen van macOS om te openen en op te slaan. */
export const DIALOG_MESSAGES = defineMessages(
  {
    openTitle: 'Quiz openen',
    openButton: 'Open',
    openMessage: 'Kies een {ext}-map (of het quiz.json-bestand erin)',
    importZipTitle: 'Quiz importeren uit zip',
    exportZipTitle: 'Exporteer als zip',
    savePdfTitle: 'Pdf opslaan',
    importMediaTitle: 'Media importeren',
    importMediaMessage: 'Kies bestanden of een hele map',
    importMediaButton: 'Importeer',
    mediaFilter: 'Video, audio en afbeeldingen',
    importRoundsTitle: 'Ronde importeren',
    roundFileFilter: 'Rondebestand van QuizNote',
    chooseQuizForRound: 'In welke quiz wil je “{file}” importeren?'
  },
  {
    en: {
      openTitle: 'Open Quiz',
      openButton: 'Open',
      openMessage: 'Choose a {ext} folder (or the quiz.json file inside it)',
      importZipTitle: 'Import Quiz from Zip',
      exportZipTitle: 'Export as Zip',
      savePdfTitle: 'Save PDF',
      importMediaTitle: 'Import Media',
      importMediaMessage: 'Choose files or a whole folder',
      importMediaButton: 'Import',
      mediaFilter: 'Video, audio and pictures',
      importRoundsTitle: 'Import Round',
      roundFileFilter: 'QuizNote round file',
      chooseQuizForRound: 'Which quiz do you want to import “{file}” into?'
    }
  }
)

/** Meldingen in de app, en de fouten van quizbestanden. */
export const NOTICE_MESSAGES = defineMessages(
  {
    nameQuiz: 'Geef de quiz een naam',
    quizExists: 'Er bestaat al een quiz met de naam "{name}"',
    unreadableQuiz: 'Geen leesbare {file} gevonden in {dir}',
    noQuizInZip: 'Geen quiz gevonden in dit zip-bestand',
    noQuizIn: 'Geen quiz gevonden in {dir}',
    openFailed: 'Quiz openen mislukt: {error}',
    missingMedia: 'Ontbrekende media: {files}',
    importFailed: 'Importeren mislukt: {error}',
    exported: 'Geëxporteerd naar {file}',
    exportFailed: 'Exporteren mislukt: {error}',
    saved: 'Opgeslagen: {file}',
    pdfFailed: 'Pdf maken mislukt: {error}',
    stopShowFirst: 'Stop eerst de show voordat je naar het overzicht gaat',
    notImported: 'Niet geïmporteerd (onbekend type): {files}',
    invalidChange: 'Ongeldige wijziging bij {path}: {error}',
    saveFailed: 'Opslaan mislukt: {error}',
    audioError: 'Audio: {error}',
    audioCrashed: 'De audio-engine is gecrasht en wordt herstart',
    screenMissing: 'Scherm "{name}": gekoppeld display is niet aangesloten',
    displayName: 'Scherm {id}',
    displayRemoved: 'Display losgekoppeld: {name}',
    displayAdded: 'Display aangesloten: {name}',
    quizReady: 'Nieuwe quiz “{title}” staat klaar op het dashboard',
    remoteFailed: 'De afstandsbediening kon niet starten: {error}',
    windowed: '{name} (venster)',
    notRoundFile: 'Dit is geen rondebestand van QuizNote',
    newerRoundFile: 'Dit rondebestand komt uit een nieuwere QuizNote. Werk de app bij.',
    invalidRoundFile: 'Fout in het rondebestand: {error}',
    unsafeRoundPath: 'Ongeldig pad in het rondebestand: {file}',
    missingRoundMedia: 'Dit bestand ontbreekt in het rondebestand: {file}',
    notAPicture: '{file} is geen afbeelding',
    notAudio: '{file} is geen geluidsbestand',
    noAudioChannel:
      'Deze quiz heeft geen audiokanaal voor de liedjes. Voeg er een toe bij Quiz-instellingen.',
    roundFileTooBig: 'Dit rondebestand is groter dan 1 GB',
    badRoundLink: 'QuizNote opent alleen rondes van quiznote.app',
    roundDownloadFailed: 'Het rondebestand ophalen is mislukt: {error}'
  },
  {
    en: {
      nameQuiz: 'Give the quiz a name',
      quizExists: 'There is already a quiz called "{name}"',
      unreadableQuiz: 'No readable {file} found in {dir}',
      noQuizInZip: 'No quiz found in this zip file',
      noQuizIn: 'No quiz found in {dir}',
      openFailed: 'Could not open the quiz: {error}',
      missingMedia: 'Missing media: {files}',
      importFailed: 'Could not import: {error}',
      exported: 'Exported to {file}',
      exportFailed: 'Could not export: {error}',
      saved: 'Saved: {file}',
      pdfFailed: 'Could not make the PDF: {error}',
      stopShowFirst: 'Stop the show before you go back to the overview',
      notImported: 'Not imported (unknown type): {files}',
      invalidChange: 'Invalid change at {path}: {error}',
      saveFailed: 'Could not save: {error}',
      audioError: 'Audio: {error}',
      audioCrashed: 'The audio engine crashed and is restarting',
      screenMissing: 'Screen "{name}": its display is not connected',
      displayName: 'Screen {id}',
      displayRemoved: 'Display disconnected: {name}',
      displayAdded: 'Display connected: {name}',
      quizReady: 'New quiz “{title}” is ready on the dashboard',
      remoteFailed: 'The remote control could not start: {error}',
      windowed: '{name} (window)',
      notRoundFile: 'This is not a QuizNote round file',
      newerRoundFile: 'This round file comes from a newer QuizNote. Update the app.',
      invalidRoundFile: 'Error in the round file: {error}',
      unsafeRoundPath: 'Invalid path in the round file: {file}',
      missingRoundMedia: 'This file is missing from the round file: {file}',
      notAPicture: '{file} is not a picture',
      notAudio: '{file} is not an audio file',
      noAudioChannel: 'This quiz has no audio channel for the songs. Add one in Quiz settings.',
      roundFileTooBig: 'This round file is larger than 1 GB',
      badRoundLink: 'QuizNote only opens rounds from quiznote.app',
      roundDownloadFailed: 'Could not download the round file: {error}'
    }
  }
)

export type NoticeKey = keyof (typeof NOTICE_MESSAGES)['messages']['nl']

/**
 * Een fout met een tekst uit `NOTICE_MESSAGES`. `message` is Nederlands (voor logs en voor wie
 * de fout niet vertaalt); `errorText` geeft hem in de taal van de app.
 */
export class NoticeError extends Error {
  constructor(
    readonly key: NoticeKey,
    readonly params?: Params
  ) {
    super(NOTICE_MESSAGES.in('nl')(key, params))
  }
}

/** De tekst van een fout, vertaald als het een `NoticeError` is. */
export function errorText(err: unknown, locale: Locale): string {
  if (err instanceof NoticeError) return NOTICE_MESSAGES.in(locale)(err.key, err.params)
  return err instanceof Error ? err.message : String(err)
}

/** Fouten van de MagicHome-controller, voor de instellingen, de werkbalk en de telefoon. */
export const MAGICHOME_ERRORS = defineMessages(
  {
    fillAddress: 'Vul het IP-adres van de controller in',
    fillAddressFirst: 'Vul eerst het adres van de controller in',
    onlyLive: 'Alleen tijdens de show',
    followsShow: 'Tijdens de show volgt het licht de show',
    refused: '{host} weigert de verbinding. Is dit de MagicHome-controller?',
    unreachable:
      'MagicHome-controller op {host} niet bereikbaar. Zit hij op hetzelfde wifi-netwerk als deze Mac?',
    other: 'MagicHome-controller op {host}: {error}'
  },
  {
    en: {
      fillAddress: 'Enter the IP address of the controller',
      fillAddressFirst: 'Enter the address of the controller first',
      onlyLive: 'Only during the show',
      followsShow: 'During the show, the light follows the show',
      refused: '{host} refuses the connection. Is this the MagicHome controller?',
      unreachable:
        'Cannot reach the MagicHome controller at {host}. Is it on the same Wi-Fi network as this Mac?',
      other: 'MagicHome controller at {host}: {error}'
    }
  }
)

/** Fouten bij het koppelen van Claude Desktop (`connectClaude`), voor het venster Met je AI. */
export const AI_ERRORS = defineMessages(
  {
    claudeMissing: 'Claude Desktop is niet gevonden op deze Mac.',
    configUnreadable:
      'De instellingen van Claude Desktop zijn niet te lezen. Voeg QuizNote daar zelf toe met de instellingen hieronder.'
  },
  {
    en: {
      claudeMissing: 'Claude Desktop was not found on this Mac.',
      configUnreadable:
        "Claude Desktop's settings cannot be read. Add QuizNote there yourself with the settings below."
    }
  }
)

/**
 * De map van de meegeleverde rondleiding: in de app (`pnpm tour:build`), tijdens het ontwikkelen
 * in `fixtures/` (in kleine letters), en in de bibliotheek na de eerste start.
 */
export const TOUR_MESSAGES = defineMessages({ folder: 'Rondleiding' }, { en: { folder: 'Tour' } })
