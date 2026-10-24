import type { z } from 'zod'
import type {
  AudioChannelSchema,
  AutoplaySettingsSchema,
  BackgroundSchema,
  FragmentSchema,
  MediaAssetSchema,
  MediaFolderSchema,
  MediaKindSchema,
  QuizSchema,
  RoundBackgroundSchema,
  RoundSchema,
  ScreenContentSchema,
  ScreenSlotSchema,
  SlideBackdropSchema,
  SlideSchema
} from './quiz-schema'
import type { AnswerState } from './answers'
import type { AutoplayState } from './autoplay'

export type MediaKind = z.infer<typeof MediaKindSchema>
export type MediaAsset = z.infer<typeof MediaAssetSchema>
export type MediaFolder = z.infer<typeof MediaFolderSchema>
export type ScreenContent = z.infer<typeof ScreenContentSchema>
export type ScreenSlot = z.infer<typeof ScreenSlotSchema>
export type AudioChannel = z.infer<typeof AudioChannelSchema>
export type Background = z.infer<typeof BackgroundSchema>
export type Fragment = z.infer<typeof FragmentSchema>
export type SlideBackdrop = z.infer<typeof SlideBackdropSchema>
export type Slide = z.infer<typeof SlideSchema>
export type RoundBackground = z.infer<typeof RoundBackgroundSchema>
export type AutoplaySettings = z.infer<typeof AutoplaySettingsSchema>
export type Round = z.infer<typeof RoundSchema>
export type Quiz = z.infer<typeof QuizSchema>

/** Fragment dat nu speelt. `key` is uniek per afspeelactie, zodat dubbel starten herkenbaar is. */
export interface PlayingFragment {
  key: string
  roundId: string
  fragmentId: string
  startedAt: number
  /** Door de audio-engine gemeld zodra de buffer bekend is. */
  duration: number | null
}

/** Live-toestand van de show; main is de bron van waarheid, renderers spiegelen hem. */
export interface ShowState {
  live: boolean
  activeRoundId: string | null
  /** Laatst gestarte ronde, om "volgende ronde" te bepalen tussen rondes in. */
  lastRoundId: string | null
  /** Index in `round.slides`, of -1 voor geen slide. */
  slideIndex: number
  fragment: PlayingFragment | null
  /** Laatst gestarte fragment, ook als het al is afgelopen: ← → bladeren vanaf hier. */
  lastFragmentId: string | null
  played: string[]
  autoplay: AutoplayState
  /** Antwoordenronde die loopt: welk fragment en of het antwoord in beeld is. */
  answer: AnswerState | null
  /** Fragment-ids waarvan het antwoord al in beeld is geweest. */
  answered: string[]
  /** Wanneer de slide-loop de volgende slide toont; null = de loop loopt niet. */
  loopUntil: number | null
  /** Door de host gepauzeerd; geldt tot de volgende ronde. */
  loopPaused: boolean
  /** Screen-slot ids die op zwart staan. */
  blackout: string[]
  backgroundEnabled: boolean
  /** Runtime-volumes per kanaal (ontbreekt = volume uit de quiz) en per scherm (ontbreekt = 1). */
  volumes: Record<string, number>
}

export interface DisplayInfo {
  id: number
  label: string
  width: number
  height: number
  internal: boolean
  primary: boolean
}

/** Waar een scherm-slot heen gaat: een display, een gewoon venster op de laptop, of uit. */
export type ScreenTarget =
  { kind: 'display'; displayId: number; label: string } | { kind: 'window' } | { kind: 'off' }

export interface AudioTarget {
  deviceId: string
  label: string
}

/** Fysieke koppeling voor de geopende quiz, per slot-/kanaal-id. */
export interface HardwareMapping {
  screens: Record<string, ScreenTarget>
  audio: Record<string, AudioTarget>
  /** Uitgang voor het videogeluid per scherm-slot; ontbreekt = de speakers van dat scherm zelf. */
  screenSound: Record<string, AudioTarget>
}

export interface Notice {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
}
