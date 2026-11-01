import { SCHEMA_VERSION } from './version'
import type { AudioChannel, Fragment, Quiz, Round, ScreenSlot, ShowState, Slide } from './types'
import { AUTOPLAY_IDLE } from './autoplay'
import type { Locale } from './i18n'
import { NAME_MESSAGES } from './quiz-messages'

export function newId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

/** Een lege quiz, met één scherm en twee kanalen die heten in de taal van de app. */
export function createQuiz(title: string, locale: Locale = 'nl'): Quiz {
  const t = NAME_MESSAGES.in(locale)
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    title,
    folders: [],
    assets: [],
    screens: [createScreenSlot(t('screen'))],
    channels: [createChannel(t('roomChannel')), createChannel(t('fragmentChannel'))],
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

export type RoundPreset = 'normal' | 'music' | 'pictures' | 'break' | 'answers'

/** `quiz` is nodig voor een antwoordenronde: die neemt de muziekrondes van de quiz over. */
export function createRound(
  preset: RoundPreset,
  number: number,
  quiz?: Quiz,
  locale: Locale = 'nl'
): Round {
  const t = NAME_MESSAGES.in(locale)
  const base: Round = {
    id: newId(),
    title: t('round', { number }),
    screens: {},
    mutedScreens: [],
    fragmentScreens: [],
    answersFor: [],
    slideLoopSeconds: null,
    slides: [createSlide('title', t('round', { number }))],
    background: 'continue',
    fragments: [],
    autoplay: { gapSeconds: 5, countdownOnScreen: true }
  }
  if (preset === 'music') {
    return { ...base, title: t('musicRound', { number }), background: 'pause' }
  }
  if (preset === 'pictures') {
    return { ...base, title: t('picturesRound', { number }) }
  }
  if (preset === 'answers') {
    const sources = quiz?.rounds.filter((r) => hasAnswers(r)) ?? []
    return {
      ...base,
      title: t('answers'),
      slides: [createSlide('title', t('answers'))],
      answersFor: sources.map((r) => r.id),
      fragmentScreens: answerScreens(quiz, sources)
    }
  }
  if (preset === 'break') {
    return { ...base, title: t('break'), slides: [createSlide('title', t('break'))] }
  }
  return base
}

/** Waar antwoorden in beeld komen: waar de nummers van die rondes stonden, anders het eerste scherm. */
export function answerScreens(quiz: Quiz | undefined, sources: Round[]): string[] {
  const used = new Set(sources.flatMap((r) => r.fragmentScreens))
  const screens = quiz?.screens.filter((s) => used.has(s.id)).map((s) => s.id) ?? []
  return screens.length || !quiz?.screens[0] ? screens : [quiz.screens[0].id]
}

export function createSlide(layout: Slide['layout'], title = ''): Slide {
  return { id: newId(), layout, title, body: '', targetScreens: 'all', backdrop: 'dim' }
}

/** Afbeelding over het hele scherm, op zwart zodat de video niet afleidt. */
export function createImageSlide(imageAssetId?: string): Slide {
  return {
    ...createSlide('image'),
    ...(imageAssetId ? { imageAssetId } : {}),
    backdrop: { color: '#000000' }
  }
}

/** Slides waar een antwoord bij hoort: vragen, nummers en afbeeldingen (geen titelslides). */
export function answerSlides(round: Round): Slide[] {
  return round.slides.filter((s) => s.layout !== 'title')
}

/** Heeft deze ronde iets om in een antwoordenronde langs te lopen? */
export function hasAnswers(round: Round): boolean {
  return round.fragments.length > 0 || answerSlides(round).length > 0
}

export function createFragment(
  assetId: string,
  channelId: string,
  number: number,
  label = NAME_MESSAGES.in('nl')('fragment', { number })
): Fragment {
  return { id: newId(), label, assetId, channelId, fadeIn: 0, fadeOut: 0.5 }
}

/** Het kanaal voor fragmenten: dat met "Fragmenten" of "Clips" in de naam, anders het laatste. */
export function fragmentChannel(quiz: Quiz): AudioChannel | undefined {
  return quiz.channels.find((c) => /fragment|clip/i.test(c.name)) ?? quiz.channels.at(-1)
}

export function createShowState(): ShowState {
  return {
    live: false,
    activeRoundId: null,
    lastRoundId: null,
    slideIndex: -1,
    fragment: null,
    lastFragmentId: null,
    played: [],
    autoplay: AUTOPLAY_IDLE,
    answer: null,
    answered: [],
    loopUntil: null,
    loopPaused: false,
    timer: null,
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
