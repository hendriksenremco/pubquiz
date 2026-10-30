/**
 * Plug-in Afstandsbediening: de show bedienen met een telefoon of tablet. De Mac serveert een
 * webpagina op het lokale netwerk (src/main/remote.ts); de QR-code in de app bevat het adres met
 * een geheime sleutel. De telefoon krijgt alleen wat hij toont, niet de hele quiz.
 */
import { z } from 'zod'
import type { ShowCommand } from './ipc'
import { LightSchema, quizLights, type Light, type LightStatus } from './light'
import { activeRound, adjacentRound, allBlack, loopActive, slideText } from './resolve'
import type { Quiz, ShowState } from './types'

/** Wat de telefoon toont. */
export interface RemoteView {
  /** Titel van de geopende quiz; null = er is geen quiz open. */
  quiz: string | null
  live: boolean
  round: { title: string; number: number } | null
  rounds: number
  prevRound: string | null
  nextRound: string | null
  /** De slides van de ronde; null = de ronde heeft er geen. `index` -1 = geen slide. */
  slide: { index: number; count: number; text: string | null; prev: boolean; next: boolean } | null
  /** Er zijn schermen om op zwart te zetten. */
  screens: boolean
  blackout: boolean
  muted: boolean
  /** null = de plug-in MagicHome-licht staat uit. */
  light: RemoteLight | null
}

export interface RemoteLight extends LightStatus {
  /** De lichten die de quiz zelf gebruikt. */
  quiz: Light[]
}

export const RemoteActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('round'), direction: z.enum(['next', 'prev']) }),
  z.object({ type: z.literal('slide'), direction: z.enum(['next', 'prev']) }),
  z.object({ type: z.literal('blackout'), on: z.boolean() }),
  z.object({ type: z.literal('mute'), on: z.boolean() }),
  /** null = het licht volgt de show weer. */
  z.object({ type: z.literal('light'), light: LightSchema.nullable() })
])

/** Wat de telefoon vraagt. Aan/uit is de gewenste stand, geen wissel: twee keer tikken mag. */
export type RemoteAction = z.infer<typeof RemoteActionSchema>

/** Antwoord van de Mac op een actie. */
export type RemoteResult = { ok: true } | { ok: false; error: string }

export function remoteView(
  quiz: Quiz | null,
  state: ShowState,
  light: LightStatus | null
): RemoteView {
  const round = quiz ? activeRound(quiz, state) : null
  const slides = round?.slides ?? []
  const slide = slides[state.slideIndex]
  return {
    quiz: quiz?.title ?? null,
    live: state.live,
    round: round && quiz ? { title: round.title, number: quiz.rounds.indexOf(round) + 1 } : null,
    rounds: quiz?.rounds.length ?? 0,
    prevRound: (quiz && adjacentRound(quiz, state, 'prev')?.title) ?? null,
    nextRound: (quiz && adjacentRound(quiz, state, 'next')?.title) ?? null,
    slide: round?.slides.length
      ? {
          index: state.slideIndex,
          count: slides.length,
          text: slide ? slideText(round, slide) : null,
          prev: state.slideIndex > -1,
          next: state.slideIndex < slides.length - 1 || loopActive(round, state.slideIndex)
        }
      : null,
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
export function remoteCommand(state: ShowState, action: RemoteAction): ShowCommand | null {
  switch (action.type) {
    case 'round':
      return { type: action.direction === 'next' ? 'nextRound' : 'prevRound' }
    case 'slide':
      return { type: action.direction === 'next' ? 'nextSlide' : 'prevSlide' }
    case 'blackout':
      return { type: 'blackout', on: action.on }
    case 'mute':
      if (action.on) return { type: 'stopAll' }
      return state.backgroundEnabled ? null : { type: 'toggleBackground' }
    case 'light':
      return null
  }
}
