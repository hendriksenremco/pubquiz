import { SCHEMA_VERSION } from './version'
import type { AudioChannel, Fragment, Quiz, Round, ScreenSlot, ShowState, Slide } from './types'
import { AUTOPLAY_IDLE } from './autoplay'

export function newId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

export function createQuiz(title: string): Quiz {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    title,
    folders: [],
    assets: [],
    screens: [createScreenSlot('Beamer')],
    channels: [createChannel('Zaal'), createChannel('Fragmenten')],
    background: null,
    rounds: []
  }
}

export function createScreenSlot(name: string): ScreenSlot {
  return { id: newId(), name, default: { type: 'black' } }
}

export function createChannel(name: string): AudioChannel {
  return { id: newId(), name, volume: 1 }
}

export type RoundPreset = 'normal' | 'music' | 'break'

export const ROUND_PRESETS: Record<RoundPreset, string> = {
  normal: 'Gewone ronde',
  music: 'Muziekronde',
  break: 'Pauze'
}

export function createRound(preset: RoundPreset, number: number): Round {
  const base: Round = {
    id: newId(),
    title: `Ronde ${number}`,
    screens: {},
    mutedScreens: [],
    fragmentScreens: [],
    slides: [createSlide('title', `Ronde ${number}`)],
    background: 'continue',
    fragments: [],
    autoplay: { gapSeconds: 5, countdownOnScreen: true }
  }
  if (preset === 'music') {
    return { ...base, title: `Ronde ${number}: muziek`, background: 'pause' }
  }
  if (preset === 'break') {
    return { ...base, title: 'Pauze', slides: [createSlide('title', 'Pauze')] }
  }
  return base
}

export function createSlide(layout: Slide['layout'], title = ''): Slide {
  return { id: newId(), layout, title, body: '', targetScreens: 'all', backdrop: 'dim' }
}

export function createFragment(
  assetId: string,
  channelId: string,
  number: number,
  label = `Fragment ${number}`
): Fragment {
  return { id: newId(), label, assetId, channelId, fadeIn: 0, fadeOut: 0.5 }
}

export function createShowState(): ShowState {
  return {
    live: false,
    activeRoundId: null,
    lastRoundId: null,
    slideIndex: -1,
    fragment: null,
    played: [],
    autoplay: AUTOPLAY_IDLE,
    blackout: [],
    backgroundEnabled: true,
    volumes: {}
  }
}

const EXTENSIONS: Record<string, 'video' | 'audio' | 'image'> = {
  mp4: 'video',
  m4v: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  mp3: 'audio',
  m4a: 'audio',
  aac: 'audio',
  wav: 'audio',
  aif: 'audio',
  aiff: 'audio',
  flac: 'audio',
  ogg: 'audio',
  opus: 'audio',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  avif: 'image',
  svg: 'image'
}

export function mediaKindForFile(name: string): 'video' | 'audio' | 'image' | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSIONS[ext] ?? null
}

export const MEDIA_EXTENSIONS = Object.keys(EXTENSIONS)
