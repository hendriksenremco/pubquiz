/**
 * Plug-in Afstandsbediening: de show bedienen met een telefoon of tablet. De Mac serveert een
 * webpagina op het lokale netwerk (src/main/remote.ts); de QR-code in de app bevat het adres met
 * een geheime sleutel. De telefoon krijgt alleen wat hij toont, niet de hele quiz.
 */
import { z } from 'zod'
import type { Locale } from './i18n'
import type { ShowCommand } from './ipc'
import { adjacentFragment } from './autoplay'
import { action, definePlugin, typeOnly } from './plugin'
import { roundTitle } from './quiz-messages'
import type { PluginId, PluginStatus } from './plugins'
import {
  activeRound,
  adjacentRound,
  allBlack,
  answerItems,
  channelVolume,
  findAsset,
  type AnswerItem,
  type AnswerNoun,
  loopActive,
  musicStatus,
  type MusicStatus,
  resolveAudio,
  resolveScreen,
  restartRound,
  screenHasSound,
  screenVolume,
  slideLabel,
  stepCommand,
  stepTarget,
  type StepTarget
} from './resolve'
import { STEP_MESSAGES } from './show-messages'
import type { Quiz, Round, ShowState, Slide } from './types'

export const REMOTE = definePlugin({
  id: 'remote',
  text: {
    nl: {
      name: 'Afstandsbediening',
      description:
        'De show bedienen met een telefoon of tablet op hetzelfde wifi-netwerk, via een QR-code.'
    },
    en: {
      name: 'Remote control',
      description: 'Run the show from a phone or tablet on the same Wi-Fi network, with a QR code.'
    }
  },
  /** De geheime sleutel uit de QR-code; te kort of ontbreekt = main maakt een nieuwe. */
  config: z.object({ key: z.string().min(20).optional().catch(undefined) }).catch({}),
  status: typeOnly<RemoteLink>(),
  actions: {
    /** Een nieuwe sleutel: telefoons met de oude code kunnen dan niets meer. */
    renew: action<RemoteResult>()(z.undefined())
  }
})

/** Wat de telefoon toont. */
export interface RemoteView {
  /** De taal van de app op de Mac; de telefoon gebruikt dezelfde, met dezelfde namen. */
  locale: Locale
  /** Titel van de geopende quiz; null = er is geen quiz open. */
  quiz: string | null
  live: boolean
  round: { title: string; number: number } | null
  rounds: number
  prevRound: string | null
  nextRound: string | null
  /** De ronde die "Ronde opnieuw" start. */
  restartRound: string | null
  /** De notities voor de presentator bij de ronde die loopt, zoals onder de rondes op de Mac. */
  notes: string | null
  /** Wat vorige en volgende nu bedienen; null = er loopt geen ronde. */
  step: RemoteStep | null
  /** De slide die nu in beeld staat (ook bij beeld op zwart), voor de preview. */
  screen: { slide: Slide; number: number | null } | null
  /** Er zijn schermen om op zwart te zetten. */
  screens: boolean
  blackout: boolean
  /**
   * De rondes van de quiz, om er één te starten zoals in de lijst links in de show op de Mac; leeg
   * = er is geen quiz open.
   */
  roundList: RemoteRound[]
  /**
   * De schermen, om er één op zwart te zetten zoals onder elk scherm in de show op de Mac. Alleen
   * bij twee of meer schermen: bij één doet Beeld op zwart hetzelfde.
   */
  screenList: RemoteScreen[]
  muted: boolean
  /** Het aftellen (T) loopt. */
  timer: boolean
  /**
   * De slides van de ronde, om er één te kiezen zoals bij Slides in de show op de Mac; leeg = deze
   * ronde heeft geen slides. De telefoon zet er Geen slide voor (index -1): aan als er geen `on` is.
   */
  slides: RemoteSlide[]
  /**
   * De slides van de ronde wisselen vanzelf (L op de Mac); null = deze ronde heeft dat niet.
   * `until`: wanneer de volgende slide komt (klok van de Mac, ms), voor "Volgende over 5 s" zoals bij
   * Slides op de Mac; null = er wordt nu niet geteld (gepauzeerd, of nog op de titel). `seconds`:
   * hoe lang een slide blijft staan; de telefoon telt nooit verder terug dan dat, ook als zijn klok
   * wat afwijkt van die van de Mac.
   */
  loop: { paused: boolean; seconds: number; until: number | null } | null
  /**
   * De fragmentenreeks (Speel reeks op de Mac, A); null = deze ronde heeft geen fragmenten.
   * `paused` is ook het laatste fragment van een reeks die daarna stopt: dan staat er Hervat.
   */
  sequence: { status: RemoteSequence } | null
  /**
   * De fragmenten van de ronde, om er één te kiezen zoals bij Fragmenten op de Mac; leeg = deze
   * ronde heeft geen fragmenten.
   */
  fragments: RemoteFragment[]
  /**
   * Er staat een vraag, fragment of antwoord van deze antwoordenronde in beeld: dan kan Stop
   * antwoorden, zoals bij Antwoorden op de Mac.
   */
  answering: boolean
  /**
   * De vragen, afbeeldingen en fragmenten van een antwoordenronde, om er één te kiezen zoals bij
   * Antwoorden op de Mac; leeg = dit is geen antwoordenronde.
   */
  answers: RemoteAnswer[]
  /** Geluid, zoals rechts in de show op de Mac; null = er is geen quiz open. */
  sound: RemoteSound | null
  /** Plug-ins die aan staan en knoppen op de telefoon hebben (`remoteActions`), met hun status. */
  plugins: RemotePlugin[]
}

/** Geluid op de telefoon: de achtergrondmuziek aan of uit, en het volume per kanaal en scherm. */
export interface RemoteSound {
  /** De achtergrondmuziek van de quiz; null = de quiz heeft er geen. */
  music: { name: string | null; status: MusicStatus } | null
  levels: RemoteLevel[]
}

/**
 * Eén schuifje bij Geluid: een geluidskanaal, of het videogeluid van een scherm dat ergens in de
 * quiz een video met geluid speelt.
 */
export interface RemoteLevel {
  id: string
  name: string
  kind: 'channel' | 'screen'
  /** 0 tot 1. */
  volume: number
  /** Alleen bij videogeluid: stil (nu geen geluid) of zachter (er speelt een fragment). */
  status: 'silent' | 'ducked' | null
}

/** Eén ronde in de lijst Rondes op de telefoon: tikken start hem. */
export interface RemoteRound {
  id: string
  number: number
  title: string
  /** Deze ronde loopt (Nu). */
  on: boolean
  /** Deze ronde start bij Volgende ronde (Hierna). */
  next: boolean
}

/** Eén scherm op de telefoon: tikken zet alleen dit scherm op zwart, of weer terug. */
export interface RemoteScreen {
  id: string
  name: string
  black: boolean
}

/** Eén slide in de lijst Slides op de telefoon, met dezelfde korte naam als op de Mac. */
export interface RemoteSlide {
  id: string
  label: string
  /** Deze slide staat nu in beeld. */
  on: boolean
}

/** Eén fragment op de telefoon: tikken speelt het, nog eens tikken stopt het. */
export interface RemoteFragment {
  id: string
  number: number
  label: string
  /** Het antwoord bij dit fragment, zoals op de Mac; null als het niet is ingevuld. */
  answer: string | null
  playing: boolean
  played: boolean
  /** Speelt bij Volgende (→), als vorige en volgende door de fragmenten gaan. */
  upcoming: boolean
}

/**
 * Eén vraag, afbeelding of fragment in een antwoordenronde op de telefoon: tikken zet hem in beeld,
 * nog eens tikken toont of verbergt het antwoord.
 */
export interface RemoteAnswer {
  id: string
  /** De ronde waar hij bij hoort; de telefoon zet ze per ronde onder elkaar, zoals de Mac. */
  round: string
  number: number
  noun: AnswerNoun
  /** Leeg = geen antwoord ingevuld. */
  answer: string
  /** De vraag zelf, zoals AnswersPad hem toont: alleen bij een vraagslide, anders null. */
  question: string | null
  /**
   * Zoals AnswersPad hem toont: het fragment speelt, het antwoord of alleen de vraag (of het
   * nummer) staat in beeld, of hij is al gedaan.
   */
  state: 'playing' | 'answer' | 'shown' | 'done' | null
  /** Deze staat in beeld (ook als zijn fragment speelt); tikken toont of verbergt dan het antwoord. */
  on: boolean
  /** Het antwoord staat in beeld; voor de gewenste stand bij nog eens tikken. */
  revealed: boolean
}

/** Hoe de reeks erbij staat, zoals de knoppen op de Mac hem tonen. */
export type RemoteSequence = 'idle' | 'running' | 'paused'

/** Eén plug-in op de telefoon; het onderdeel ervoor staat in src/renderer/src/plugins/phone.ts. */
export type RemotePlugin = { [Id in PluginId]: { id: Id; status: PluginStatus<Id> } }[PluginId]

/** Vorige en volgende werken zoals ← → op de Mac: slides, fragmenten of antwoorden. */
export interface RemoteStep {
  target: StepTarget
  /** Waar je staat, bv. "Slide 2 van 5", "Fragment 3 van 8" of "Vraag 2, Ronde 1". */
  label: string
  /** Om voor te lezen of te herkennen: de vraag van de slide, de naam van het fragment. */
  text: string | null
  /** Het antwoord, zodra het in beeld staat (antwoordenronde). */
  answer: string | null
  /** Het fragment hiervan speelt nu. */
  playing: boolean
  prev: boolean
  next: boolean
}

export const RemoteActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('round'), direction: z.enum(['next', 'prev']) }),
  z.object({ type: z.literal('restartRound') }),
  z.object({ type: z.literal('endRound') }),
  /** Vorige of volgende slide, fragment of antwoordstap; zie RemoteStep. */
  z.object({ type: z.literal('step'), direction: z.enum(['next', 'prev']) }),
  /** Beeld op zwart of terug: alle schermen, of met `screenId` alleen dat scherm. */
  z.object({
    type: z.literal('blackout'),
    on: z.boolean(),
    screenId: z.string().max(64).optional()
  }),
  /** Eén ronde starten, zoals een tik in de lijst Rondes op de Mac. */
  z.object({ type: z.literal('startRound'), id: z.string().max(64) }),
  z.object({ type: z.literal('mute'), on: z.boolean() }),
  /** Aftellen (T) starten of stoppen; alleen in een ronde. */
  z.object({ type: z.literal('timer'), on: z.boolean() }),
  /** Het vanzelf wisselen van de slides (L) pauzeren of hervatten; alleen in zo'n ronde. */
  z.object({ type: z.literal('slideLoop'), paused: z.boolean() }),
  /** De fragmentenreeks (A en S op de Mac); alleen als dat kan in de stand van de reeks. */
  z.object({
    type: z.literal('sequence'),
    action: z.enum(['start', 'pause', 'resume', 'skip', 'stop'])
  }),
  /** Eén slide van de ronde in beeld zetten, zoals een tik bij Slides op de Mac; -1 = Geen slide. */
  z.object({ type: z.literal('slide'), index: z.number().int().min(-1).max(999) }),
  /** Muziek aan of uit, zoals bij Geluid op de Mac; het fragment speelt door. */
  z.object({ type: z.literal('music'), on: z.boolean() }),
  /** Het volume van een kanaal of van het videogeluid van een scherm, zoals bij Geluid op de Mac. */
  z.object({
    type: z.literal('volume'),
    id: z.string().max(64),
    volume: z.number().min(0).max(1)
  }),
  /** Fragmenten opnieuw: alle fragmenten van de ronde weer ongespeeld. */
  z.object({ type: z.literal('resetPlayed') }),
  /** Eén fragment van de ronde spelen of stoppen, zoals een tik op dat fragment op de Mac. */
  z.object({ type: z.literal('fragment'), id: z.string().max(64), play: z.boolean() }),
  /** Stop antwoorden: nummer en antwoord uit beeld, zoals de knop bij Antwoorden op de Mac. */
  z.object({ type: z.literal('stopAnswers') }),
  /**
   * Eén vraag, afbeelding of fragment van de antwoordenronde, zoals een tik erop bij Antwoorden op de
   * Mac. `revealed`: de gewenste stand van het antwoord; een andere vraag komt altijd eerst zonder.
   */
  z.object({ type: z.literal('answer'), id: z.string().max(64), revealed: z.boolean() }),
  /**
   * Een actie van een plug-in, bv. het licht kiezen. Main controleert hem met de definitie van die
   * plug-in, en alleen wat in zijn `remoteActions` staat, mag.
   */
  z.object({
    type: z.literal('plugin'),
    id: z.string().max(64),
    action: z.string().max(64),
    /** Ontbreekt als de actie geen invoer heeft (JSON kent geen undefined). */
    input: z.unknown().optional()
  })
])

/** Wat de telefoon vraagt. Aan/uit is de gewenste stand, geen wissel: twee keer tikken mag. */
export type RemoteAction = z.infer<typeof RemoteActionSchema>

/** Wat de app bij de QR-code toont. */
export interface RemoteLink {
  /** null = geen netwerk, of de server kon niet starten. */
  url: string | null
  /** Telefoons en tablets die nu verbonden zijn. */
  devices: number
}

/** Antwoord van de Mac op een actie. */
export type RemoteResult = { ok: true } | { ok: false; error: string }

const titleOf = (round: Round | null | undefined, locale: Locale): string | null =>
  round ? roundTitle(round, locale) : null

/** `plugins`: de plug-ins voor de telefoon; zonder quiz toont hij ze niet. */
export function remoteView(
  quiz: Quiz | null,
  state: ShowState,
  plugins: RemotePlugin[] = [],
  locale: Locale = 'nl'
): RemoteView {
  const round = quiz ? activeRound(quiz, state) : null
  return {
    locale,
    quiz: quiz?.title ?? null,
    live: state.live,
    round:
      round && quiz
        ? { title: roundTitle(round, locale), number: quiz.rounds.indexOf(round) + 1 }
        : null,
    rounds: quiz?.rounds.length ?? 0,
    prevRound: titleOf(quiz && adjacentRound(quiz, state, 'prev'), locale),
    nextRound: titleOf(quiz && adjacentRound(quiz, state, 'next'), locale),
    restartRound: titleOf(quiz && restartRound(quiz, state), locale),
    notes: round?.hostNotes?.trim() || null,
    step: quiz && round ? remoteStep(quiz, round, state, locale) : null,
    screen: quiz ? onScreen(quiz, state) : null,
    screens: !!quiz?.screens.length,
    blackout: !!quiz && allBlack(quiz, state),
    roundList: quiz ? remoteRounds(quiz, state, locale) : [],
    screenList:
      quiz && quiz.screens.length > 1
        ? quiz.screens.map((s) => ({
            id: s.id,
            name: s.name,
            black: state.blackout.includes(s.id)
          }))
        : [],
    muted: !state.backgroundEnabled,
    timer: state.timer !== null,
    slides:
      round?.slides.map((slide, i) => ({
        id: slide.id,
        label: slideLabel(round, slide, locale),
        on: state.slideIndex === i
      })) ?? [],
    loop: round?.slideLoopSeconds
      ? { paused: state.loopPaused, seconds: round.slideLoopSeconds, until: state.loopUntil }
      : null,
    sequence: round?.fragments.length ? { status: sequenceOf(round, state) } : null,
    fragments: quiz && round ? remoteFragments(quiz, round, state) : [],
    answering: !!round && answering(round, state),
    answers: quiz && round ? remoteAnswers(quiz, round, state, locale) : [],
    sound: quiz ? remoteSound(quiz, state) : null,
    plugins: quiz ? plugins : []
  }
}

/**
 * De opdracht voor de show, zoals de knoppen op de Mac hem geven; null = niets te doen (een
 * actie van een plug-in gaat via die plug-in). Geluid uit = fragment stopt én achtergrond uit; weer aan zet de
 * achtergrond terug.
 */
export function remoteCommand(
  quiz: Quiz,
  state: ShowState,
  action: RemoteAction
): ShowCommand | null {
  switch (action.type) {
    case 'round':
      return { type: action.direction === 'next' ? 'nextRound' : 'prevRound' }
    case 'restartRound':
    case 'endRound':
      return { type: action.type }
    case 'step':
      return stepCommand(stepTarget(quiz, activeRound(quiz, state)), action.direction)
    case 'blackout': {
      if (!action.screenId) return { type: 'blackout', on: action.on }
      if (!quiz.screens.some((s) => s.id === action.screenId)) return null
      if (state.blackout.includes(action.screenId) === action.on) return null
      return { type: 'blackout', screenId: action.screenId, on: action.on }
    }
    case 'startRound':
      if (!quiz.rounds.some((r) => r.id === action.id) || state.activeRoundId === action.id)
        return null
      return { type: 'startRound', roundId: action.id }
    case 'mute':
      if (action.on) return { type: 'stopAll' }
      return state.backgroundEnabled ? null : { type: 'toggleBackground' }
    case 'timer':
      if (action.on === (state.timer !== null)) return null
      return action.on && !activeRound(quiz, state) ? null : { type: 'timer' }
    case 'slideLoop':
      if (!activeRound(quiz, state)?.slideLoopSeconds || action.paused === state.loopPaused)
        return null
      return { type: 'slideLoop', paused: action.paused }
    case 'sequence': {
      const round = activeRound(quiz, state)
      if (!round?.fragments.length) return null
      const allowed: Record<RemoteSequence, string[]> = {
        idle: ['start'],
        running: ['pause', 'skip', 'stop'],
        paused: ['resume', 'skip', 'stop']
      }
      if (!allowed[sequenceOf(round, state)].includes(action.action)) return null
      return { type: 'autoplay', action: action.action }
    }
    case 'slide': {
      const round = activeRound(quiz, state)
      if (!round || action.index >= round.slides.length) return null
      if (action.index === -1 && !round.slides.length) return null
      return action.index === state.slideIndex ? null : { type: 'setSlide', index: action.index }
    }
    case 'music':
      if (!quiz.background || action.on === state.backgroundEnabled) return null
      return { type: 'toggleBackground' }
    case 'volume': {
      const level = remoteLevels(quiz, state).find((l) => l.id === action.id)
      if (!level || level.volume === action.volume) return null
      return { type: 'setVolume', id: action.id, volume: action.volume }
    }
    case 'resetPlayed':
      return activeRound(quiz, state)?.fragments.length ? { type: 'resetPlayed' } : null
    case 'fragment': {
      if (!activeRound(quiz, state)?.fragments.some((f) => f.id === action.id)) return null
      const playing = state.fragment?.fragmentId === action.id
      if (action.play === playing) return null
      return action.play
        ? { type: 'playFragment', fragmentId: action.id }
        : { type: 'stopFragment' }
    }
    case 'stopAnswers': {
      const round = activeRound(quiz, state)
      return round && answering(round, state) ? { type: 'answers', action: 'stop' } : null
    }
    case 'answer': {
      const round = activeRound(quiz, state)
      if (!round) return null
      const index = answerItems(quiz, round).findIndex((item) => item.id === action.id)
      if (index < 0) return null
      const current = answering(round, state) ? state.answer : null
      // answerAt wisselt het antwoord bij de vraag in beeld, en zet een andere vraag in beeld zonder.
      const command: ShowCommand = { type: 'answerAt', index }
      if (current?.index === index) return action.revealed === current.revealed ? null : command
      return action.revealed ? null : command
    }
    case 'plugin':
      return null
  }
}

/** Geluid zoals Mixer het toont op de Mac. */
function remoteSound(quiz: Quiz, state: ShowState): RemoteSound {
  const bg = quiz.background
  // In de show de muziek van nu: een ronde kan een ander nummer spelen.
  const assetId = resolveAudio(quiz, state).background?.assetId ?? bg?.assetId
  return {
    music: bg
      ? { name: findAsset(quiz, assetId)?.name ?? null, status: musicStatus(quiz, state) }
      : null,
    levels: remoteLevels(quiz, state)
  }
}

/** De kanalen, en de schermen die ergens in de quiz een video met geluid spelen. */
function remoteLevels(quiz: Quiz, state: ShowState): RemoteLevel[] {
  const channels = quiz.channels.map((c): RemoteLevel => ({
    id: c.id,
    name: c.name,
    kind: 'channel',
    volume: channelVolume(quiz, state, c.id),
    status: null
  }))
  const screens = quiz.screens
    .filter((slot) => screenHasSound(quiz, slot.id))
    .map((slot): RemoteLevel => {
      const sound = resolveScreen(quiz, state, slot.id).sound
      return {
        id: slot.id,
        name: slot.name,
        kind: 'screen',
        volume: screenVolume(state, slot.id),
        status: !sound ? 'silent' : sound.ducked ? 'ducked' : null
      }
    })
  return [...channels, ...screens]
}

/** De rondes zoals de lijst links in de show op de Mac ze toont, met Nu en Hierna. */
function remoteRounds(quiz: Quiz, state: ShowState, locale: Locale): RemoteRound[] {
  const next = adjacentRound(quiz, state, 'next')
  return quiz.rounds.map((round, i) => ({
    id: round.id,
    number: i + 1,
    title: roundTitle(round, locale),
    on: round.id === state.activeRoundId,
    next: round.id === next?.id
  }))
}

/** De vragen, afbeeldingen en fragmenten zoals AnswersPad ze toont. */
function remoteAnswers(quiz: Quiz, round: Round, state: ShowState, locale: Locale): RemoteAnswer[] {
  const current = answering(round, state) ? state.answer : null
  return answerItems(quiz, round).map((item, index) => {
    const on = current?.index === index
    const playing = !!item.fragment && state.fragment?.fragmentId === item.fragment.id
    return {
      id: item.id,
      round: roundTitle(item.round, locale),
      number: item.number,
      noun: item.noun,
      answer: item.answer,
      question:
        item.slide?.layout === 'question' ? item.slide.body || item.slide.title || null : null,
      state: playing
        ? 'playing'
        : on
          ? current.revealed
            ? 'answer'
            : 'shown'
          : state.answered.includes(item.id)
            ? 'done'
            : null,
      on,
      revealed: on && current.revealed
    }
  })
}

/** Er staat een stap van deze antwoordenronde in beeld (AnswersPad toont dan Stop antwoorden). */
function answering(round: Round, state: ShowState): boolean {
  return state.answer?.roundId === round.id
}

/** De stand van de reeks in deze ronde, zoals FragmentPad hem toont: Speel reeks, Pauzeer of Hervat. */
export function sequenceOf(round: Round, state: ShowState): RemoteSequence {
  const a = state.autoplay
  if (a.status === 'idle' || a.roundId !== round.id) return 'idle'
  if (a.status === 'paused' || (a.status === 'playing' && a.holdAfter)) return 'paused'
  return 'running'
}

/** De fragmenten zoals FragmentPad ze toont: wat speelt, wat gespeeld is en wat → gaat spelen. */
function remoteFragments(quiz: Quiz, round: Round, state: ShowState): RemoteFragment[] {
  const ids = round.fragments.map((f) => f.id)
  const next =
    stepTarget(quiz, round) === 'fragments'
      ? adjacentFragment(ids, state.lastFragmentId, 'next')
      : null
  return round.fragments.map((f, i) => {
    const playing = state.fragment?.fragmentId === f.id
    return {
      id: f.id,
      number: i + 1,
      label: f.label,
      answer: f.answer || null,
      playing,
      played: !playing && state.played.includes(f.id),
      upcoming: next === i
    }
  })
}

/** Ook voor de knoppen op de Mac, zodat die hetzelfde tonen en kunnen. */
export function remoteStep(
  quiz: Quiz,
  round: Round,
  state: ShowState,
  locale: Locale = 'nl'
): RemoteStep {
  const t = STEP_MESSAGES.in(locale)
  const target = stepTarget(quiz, round)
  const base = { target, text: null, answer: null, playing: false }
  const playing = (id: string | undefined) => !!id && state.fragment?.fragmentId === id

  if (target === 'answers') {
    const items = answerItems(quiz, round)
    const current = state.answer?.roundId === round.id ? state.answer : null
    const item = current ? items[current.index] : undefined
    if (!current || !item) {
      return { ...base, label: t('answersToGo', { count: items.length }), prev: false, next: true }
    }
    return {
      ...base,
      label: t(ANSWER_LABELS[item.noun], {
        number: item.number,
        round: roundTitle(item.round, locale)
      }),
      text: item.slide ? questionText(item.slide) : (item.fragment?.label ?? null),
      answer: current.revealed ? item.answer || item.fragment?.label || '—' : null,
      playing: playing(item.fragment?.id),
      prev: true,
      next: !current.revealed || current.index < items.length - 1
    }
  }

  if (target === 'fragments') {
    const ids = round.fragments.map((f) => f.id)
    const fragment = round.fragments.find((f) => f.id === state.lastFragmentId)
    return {
      ...base,
      label: fragment
        ? t('fragmentOf', { number: ids.indexOf(fragment.id) + 1, total: ids.length })
        : t('fragments', { count: ids.length }),
      text: fragment?.label ?? null,
      playing: playing(fragment?.id),
      prev: adjacentFragment(ids, state.lastFragmentId, 'prev') !== null,
      next: adjacentFragment(ids, state.lastFragmentId, 'next') !== null
    }
  }

  const count = round.slides.length
  const slide = round.slides[state.slideIndex]
  return {
    ...base,
    label: !count
      ? t('noSlides')
      : slide
        ? t('slideOf', { number: state.slideIndex + 1, total: count })
        : t('noSlideOf', { count }),
    text: slide ? questionText(slide) : null,
    prev: state.slideIndex > -1,
    next: state.slideIndex < count - 1 || loopActive(round, state.slideIndex)
  }
}

const ANSWER_LABELS = {
  vraag: 'answerQuestion',
  afbeelding: 'answerImage',
  fragment: 'answerFragment'
} as const satisfies Record<AnswerItem['noun'], string>

/** De vraag om voor te lezen, ook als er alleen het nummer in beeld staat. */
function questionText(slide: Slide): string | null {
  return slide.layout === 'question' ? slide.body?.trim() || null : null
}

/** De eerste slide die op een scherm staat; zwart telt niet, de preview toont hem dan gedimd. */
function onScreen(quiz: Quiz, state: ShowState): RemoteView['screen'] {
  const visible = { ...state, blackout: [] }
  for (const slot of quiz.screens) {
    const resolved = resolveScreen(quiz, visible, slot.id)
    if (resolved.slide) return { slide: resolved.slide, number: resolved.slideNumber }
  }
  return null
}
