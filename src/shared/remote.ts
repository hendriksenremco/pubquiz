/**
 * Plug-in Afstandsbediening: de show bedienen met een telefoon of tablet. De Mac serveert een
 * webpagina op het lokale netwerk (src/main/remote.ts); de QR-code in de app bevat het adres met
 * een geheime sleutel. De telefoon krijgt alleen wat hij toont, niet de hele quiz.
 */
import { z } from 'zod'
import type { ShowCommand } from './ipc'
import { LightSchema, quizLights, type Light, type LightStatus } from './light'
import { adjacentFragment } from './autoplay'
import { action, definePlugin, typeOnly } from './plugin'
import {
  activeRound,
  adjacentRound,
  allBlack,
  answerItems,
  loopActive,
  resolveScreen,
  restartRound,
  stepCommand,
  stepTarget,
  type StepTarget
} from './resolve'
import type { Quiz, Round, ShowState, Slide } from './types'

export const REMOTE = definePlugin({
  id: 'remote',
  name: 'Afstandsbediening',
  description:
    'De show bedienen met een telefoon of tablet op hetzelfde wifi-netwerk, via een QR-code.',
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
  /** Titel van de geopende quiz; null = er is geen quiz open. */
  quiz: string | null
  live: boolean
  round: { title: string; number: number } | null
  rounds: number
  prevRound: string | null
  nextRound: string | null
  /** De ronde die "Ronde opnieuw" start. */
  restartRound: string | null
  /** Wat vorige en volgende nu bedienen; null = er loopt geen ronde. */
  step: RemoteStep | null
  /** De slide die nu in beeld staat (ook bij beeld op zwart), voor de preview. */
  screen: { slide: Slide; number: number | null } | null
  /** Er zijn schermen om op zwart te zetten. */
  screens: boolean
  blackout: boolean
  muted: boolean
  /** null = de plug-in MagicHome-licht staat uit. */
  light: RemoteLight | null
}

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

export interface RemoteLight extends LightStatus {
  /** De lichten die de quiz zelf gebruikt. */
  quiz: Light[]
}

export const RemoteActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('round'), direction: z.enum(['next', 'prev']) }),
  z.object({ type: z.literal('restartRound') }),
  z.object({ type: z.literal('endRound') }),
  /** Vorige of volgende slide, fragment of antwoordstap; zie RemoteStep. */
  z.object({ type: z.literal('step'), direction: z.enum(['next', 'prev']) }),
  z.object({ type: z.literal('blackout'), on: z.boolean() }),
  z.object({ type: z.literal('mute'), on: z.boolean() }),
  /** null = het licht volgt de show weer. */
  z.object({ type: z.literal('light'), light: LightSchema.nullable() })
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

export function remoteView(
  quiz: Quiz | null,
  state: ShowState,
  light: LightStatus | null
): RemoteView {
  const round = quiz ? activeRound(quiz, state) : null
  return {
    quiz: quiz?.title ?? null,
    live: state.live,
    round: round && quiz ? { title: round.title, number: quiz.rounds.indexOf(round) + 1 } : null,
    rounds: quiz?.rounds.length ?? 0,
    prevRound: (quiz && adjacentRound(quiz, state, 'prev')?.title) ?? null,
    nextRound: (quiz && adjacentRound(quiz, state, 'next')?.title) ?? null,
    restartRound: (quiz && restartRound(quiz, state)?.title) ?? null,
    step: quiz && round ? remoteStep(quiz, round, state) : null,
    screen: quiz ? onScreen(quiz, state) : null,
    screens: !!quiz?.screens.length,
    blackout: !!quiz && allBlack(quiz, state),
    muted: !state.backgroundEnabled,
    light: light && quiz ? { ...light, quiz: quizLights(quiz) } : null
  }
}

/**
 * De opdracht voor de show, zoals de knoppen op de Mac hem geven; null = niets te doen (het
 * licht gaat via de plug-in). Geluid uit = fragment stopt én achtergrond uit; weer aan zet de
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
    case 'blackout':
      return { type: 'blackout', on: action.on }
    case 'mute':
      if (action.on) return { type: 'stopAll' }
      return state.backgroundEnabled ? null : { type: 'toggleBackground' }
    case 'light':
      return null
  }
}

/** Ook voor de knoppen op de Mac, zodat die hetzelfde tonen en kunnen. */
export function remoteStep(quiz: Quiz, round: Round, state: ShowState): RemoteStep {
  const target = stepTarget(quiz, round)
  const base = { target, text: null, answer: null, playing: false }
  const playing = (id: string | undefined) => !!id && state.fragment?.fragmentId === id

  if (target === 'answers') {
    const items = answerItems(quiz, round)
    const current = state.answer?.roundId === round.id ? state.answer : null
    const item = current ? items[current.index] : undefined
    if (!current || !item) {
      return { ...base, label: `${items.length} om na te lopen`, prev: false, next: true }
    }
    const noun = item.noun[0].toUpperCase() + item.noun.slice(1)
    return {
      ...base,
      label: `${noun} ${item.number}, ${item.round.title}`,
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
        ? `Fragment ${ids.indexOf(fragment.id) + 1} van ${ids.length}`
        : `${ids.length} fragmenten`,
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
      ? 'Geen slides in deze ronde'
      : slide
        ? `Slide ${state.slideIndex + 1} van ${count}`
        : `Geen slide, ${count} in deze ronde`,
    text: slide ? questionText(slide) : null,
    prev: state.slideIndex > -1,
    next: state.slideIndex < count - 1 || loopActive(round, state.slideIndex)
  }
}

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
