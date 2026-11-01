import { defineMessages } from '@shared/i18n'

/** De werkbalk van de app en de vraag bij afsluiten tijdens de show (OperatorApp). */
export const OPERATOR_MESSAGES = defineMessages(
  {
    untitled: 'Naamloze quiz',
    stopShowFirst: 'Stop eerst de show',
    quizzes: 'Quizzen',
    live: 'Live',
    toShow: 'Naar de show',
    print: 'Afdrukken',
    startShow: 'Start show',
    settings: 'Instellingen',
    quitTitle: 'De show loopt nog',
    quitMessage: 'Wil je echt afsluiten? De schermen gaan uit en de muziek stopt.',
    quit: 'Afsluiten'
  },
  {
    en: {
      untitled: 'Untitled quiz',
      stopShowFirst: 'Stop the show first',
      quizzes: 'Quizzes',
      live: 'Live',
      toShow: 'Back to show',
      print: 'Print',
      startShow: 'Start show',
      settings: 'Settings',
      quitTitle: 'The show is still running',
      quitMessage: 'Do you really want to quit? The screens go dark and the music stops.',
      quit: 'Quit'
    }
  }
)

/** Nieuwe quiz, leeg of op basis van een eerdere quiz (NewQuizDialog). */
export const NEW_QUIZ_MESSAGES = defineMessages(
  {
    copyName: '{title} (nieuw)',
    title: 'Nieuwe quiz',
    titleFrom: 'Nieuwe quiz op basis van “{title}”',
    name: 'Naam',
    namePlaceholder: 'Bijvoorbeeld: Pubquiz november',
    savedIn: 'Wordt bewaard in {folder}',
    alwaysCopied:
      "Schermen, audiokanalen, achtergrondmuziek en alle video's en afbeeldingen gaan altijd mee.",
    rounds: 'Rondes',
    roundsHint: 'Titels, slides, en per ronde het beeld en de muziek',
    fragments: 'Geluidsfragmenten',
    fragmentsHint: 'De liedjes in die rondes; meestal kies je die opnieuw',
    cancel: 'Annuleer',
    create: 'Maak quiz'
  },
  {
    en: {
      copyName: '{title} (new)',
      title: 'New quiz',
      titleFrom: 'New quiz based on “{title}”',
      name: 'Name',
      namePlaceholder: 'For example: Pub quiz November',
      savedIn: 'Saved in {folder}',
      alwaysCopied:
        'Screens, audio channels, background music and all videos and images are always copied.',
      rounds: 'Rounds',
      roundsHint: 'Titles, slides, and the picture and music for each round',
      fragments: 'Sound clips',
      fragmentsHint: 'The songs in those rounds; usually you pick new ones',
      cancel: 'Cancel',
      create: 'Create quiz'
    }
  }
)

/** Een quiz maken met je eigen AI-assistent (AiDialog). */
export const AI_MESSAGES = defineMessages(
  {
    title: 'Een quiz maken met je AI',
    askFor: 'Vraag je AI-assistent bijvoorbeeld:',
    example: 'Maak een pubquiz in QuizNote met zes rondes over Italië.',
    explain:
      "De quiz verschijnt dan hier, met vragen, antwoorden en een antwoordenronde. Muziek en foto's maakt een AI niet zelf: noem een map met je liedjes of foto's, of voeg ze daarna toe.",
    connected: 'Gekoppeld. Start Claude Desktop opnieuw als hij open stond.',
    connectOnce: 'Eén keer koppelen, daarna kun je het Claude gewoon vragen.',
    connect: 'Koppel aan Claude Desktop',
    notInstalled: 'Claude Desktop staat niet op deze Mac.',
    otherApps: 'Andere AI-apps',
    otherAppsHint: 'Voeg QuizNote toe als MCP-server met deze instellingen:',
    copied: 'Gekopieerd',
    copy: 'Kopieer',
    done: 'Klaar'
  },
  {
    en: {
      title: 'Create a quiz with your AI',
      askFor: 'Ask your AI assistant, for example:',
      example: 'Make a pub quiz in QuizNote with six rounds about Italy.',
      explain:
        "The quiz then appears here, with questions, answers and an answer round. An AI doesn't make music or photos itself: name a folder with your songs or photos, or add them afterwards.",
      connected: 'Connected. Restart Claude Desktop if it was open.',
      connectOnce: 'Connect once, then just ask Claude.',
      connect: 'Connect to Claude Desktop',
      notInstalled: 'Claude Desktop is not on this Mac.',
      otherApps: 'Other AI apps',
      otherAppsHint: 'Add QuizNote as an MCP server with these settings:',
      copied: 'Copied',
      copy: 'Copy',
      done: 'Done'
    }
  }
)

/** De instellingen van de app op deze Mac (SettingsDialog). */
export const SETTINGS_MESSAGES = defineMessages(
  {
    title: 'Instellingen',
    plugins: 'Plug-ins',
    done: 'Klaar'
  },
  {
    en: {
      title: 'Settings',
      plugins: 'Plug-ins',
      done: 'Done'
    }
  }
)
