/**
 * De live-toestand is altijd: standaard van de quiz ⊕ overrides van de actieve ronde.
 * Na "Einde ronde" (activeRoundId = null) valt alles vanzelf terug naar de standaard.
 */
import type { Fragment, MediaAsset, Quiz, Round, ScreenContent, ShowState, Slide } from './types'
import { autoplayCountdown } from './autoplay'

export type ScreenOverlay =
  | { kind: 'fragment'; number: number; label: string }
  /** Pauze tussen twee fragmenten. `remaining`: deel van de pauze dat nog over is (1 → 0). */
  | { kind: 'countdown'; seconds: number; nextNumber: number; remaining: number }

export interface ResolvedScreen {
  content: ScreenContent
  /** Content zonder blackout, voor previews in de operator-UI. */
  programContent: ScreenContent
  blackout: boolean
  slide: Slide | null
  overlay: ScreenOverlay | null
  /** Geluid van de video op de speakers van het scherm; null = stil. */
  sound: ResolvedSound | null
}

export interface ResolvedSound {
  /** Effectief volume 0..1 (video × scherm × ducking). */
  gain: number
  ducked: boolean
}

export interface ResolvedBackground {
  assetId: string
  channelId: string
  /** Effectieve gain 0..1 (volume × ducking). */
  gain: number
  playing: boolean
  ducked: boolean
}

export interface ResolvedFragment {
  key: string
  fragment: Fragment
  asset: MediaAsset
  startedAt: number
}

export interface ResolvedAudio {
  background: ResolvedBackground | null
  fragment: ResolvedFragment | null
  channelVolumes: Record<string, number>
}

export const BLACK: ScreenContent = { type: 'black' }

/** Ducking van videogeluid als de quiz geen achtergrondmuziek (en dus geen eigen niveau) heeft. */
export const DEFAULT_DUCK = 0.25

export function findRound(quiz: Quiz, roundId: string | null): Round | null {
  if (!roundId) return null
  return quiz.rounds.find((r) => r.id === roundId) ?? null
}

export function findAsset(quiz: Quiz, assetId: string | undefined): MediaAsset | null {
  if (!assetId) return null
  return quiz.assets.find((a) => a.id === assetId) ?? null
}

export function activeRound(quiz: Quiz, state: ShowState): Round | null {
  return findRound(quiz, state.activeRoundId)
}

export function slideTargets(slide: Slide, screenId: string): boolean {
  return slide.targetScreens === 'all' || slide.targetScreens.includes(screenId)
}

export function resolveScreen(
  quiz: Quiz,
  state: ShowState,
  screenId: string,
  now = Date.now()
): ResolvedScreen {
  const slot = quiz.screens.find((s) => s.id === screenId)
  const round = activeRound(quiz, state)
  const override = round?.screens[screenId]
  const programContent = override ?? slot?.default ?? BLACK
  const blackout = state.blackout.includes(screenId)
  // Een ronde kan de standaard laten zien maar het geluid ervan uitzetten.
  const muted = !!round && !override && round.mutedScreens.includes(screenId)

  const candidate = round && state.slideIndex >= 0 ? round.slides[state.slideIndex] : undefined
  const slide = candidate && slideTargets(candidate, screenId) ? candidate : null

  const content = blackout ? BLACK : programContent
  return {
    content,
    programContent,
    blackout,
    slide: blackout ? null : slide,
    overlay: blackout || !round ? null : resolveOverlay(round, state, screenId, now),
    sound: muted ? null : resolveSound(quiz, state, screenId, content)
  }
}

/** Live volume van een scherm (fader in de mixer); los van het volume per video. */
export function screenVolume(state: ShowState, screenId: string): number {
  return state.volumes[screenId] ?? 1
}

/** Videogeluid zakt mee met de achtergrondmuziek zolang er een fragment speelt. */
function resolveSound(
  quiz: Quiz,
  state: ShowState,
  screenId: string,
  content: ScreenContent
): ResolvedSound | null {
  if (!state.live || content.type !== 'video' || content.volume === undefined) return null
  const ducked = state.fragment !== null
  const duckTo = quiz.background?.duckTo ?? DEFAULT_DUCK
  return {
    gain: content.volume * screenVolume(state, screenId) * (ducked ? duckTo : 1),
    ducked
  }
}

/** Speelt dit scherm ergens in de quiz een video met geluid (standaard of in een ronde)? */
export function screenHasSound(quiz: Quiz, screenId: string): boolean {
  const withSound = (c: ScreenContent | undefined) => c?.type === 'video' && c.volume !== undefined
  return (
    withSound(quiz.screens.find((s) => s.id === screenId)?.default) ||
    quiz.rounds.some((r) => withSound(r.screens[screenId]))
  )
}

function resolveOverlay(
  round: Round,
  state: ShowState,
  screenId: string,
  now: number
): ScreenOverlay | null {
  if (!round.fragmentScreens.includes(screenId)) return null
  const ap = state.autoplay
  if (ap.status === 'idle' || ap.roundId !== round.id) return manualOverlay(round, state)

  if (ap.status === 'playing') {
    const fragment = round.fragments[ap.index]
    return fragment ? { kind: 'fragment', number: ap.index + 1, label: fragment.label } : null
  }

  if (!round.autoplay.countdownOnScreen) return null
  const seconds = autoplayCountdown(ap, now)
  if (seconds === null) return null
  const gapMs = round.autoplay.gapSeconds * 1000
  const leftMs = ap.status === 'gap' ? ap.until - now : ap.remainingMs
  const remaining = gapMs > 0 ? Math.min(1, Math.max(0, leftMs / gapMs)) : 0
  return { kind: 'countdown', seconds, nextNumber: ap.nextIndex + 1, remaining }
}

/** Handmatig gestart fragment: het nummer staat in beeld zolang het speelt. */
function manualOverlay(round: Round, state: ShowState): ScreenOverlay | null {
  const playing = state.fragment
  if (!playing || playing.roundId !== round.id) return null
  const index = round.fragments.findIndex((f) => f.id === playing.fragmentId)
  if (index === -1) return null
  return { kind: 'fragment', number: index + 1, label: round.fragments[index].label }
}

export function channelVolume(quiz: Quiz, state: ShowState, channelId: string): number {
  return state.volumes[channelId] ?? quiz.channels.find((c) => c.id === channelId)?.volume ?? 1
}

export function resolveAudio(quiz: Quiz, state: ShowState): ResolvedAudio {
  const channelVolumes = Object.fromEntries(
    quiz.channels.map((c) => [c.id, channelVolume(quiz, state, c.id)])
  )
  return {
    background: state.live ? resolveBackground(quiz, state) : null,
    fragment: state.live ? resolveFragment(quiz, state) : null,
    channelVolumes
  }
}

function resolveBackground(quiz: Quiz, state: ShowState): ResolvedBackground | null {
  const bg = quiz.background
  if (!bg) return null
  const round = activeRound(quiz, state)
  const mode = round?.background ?? 'continue'
  const assetId = typeof mode === 'object' ? mode.replaceAssetId : bg.assetId
  const playing = state.backgroundEnabled && mode !== 'pause'
  const ducked = mode === 'duck' || state.fragment !== null
  return {
    assetId,
    channelId: bg.channelId,
    gain: bg.volume * (ducked ? bg.duckTo : 1),
    playing,
    ducked
  }
}

function resolveFragment(quiz: Quiz, state: ShowState): ResolvedFragment | null {
  const playing = state.fragment
  if (!playing) return null
  const fragment = findRound(quiz, playing.roundId)?.fragments.find(
    (f) => f.id === playing.fragmentId
  )
  const asset = findAsset(quiz, fragment?.assetId)
  if (!fragment || !asset) return null
  return { key: playing.key, fragment, asset, startedAt: playing.startedAt }
}

/** Alle plekken waar een asset gebruikt wordt, leesbaar voor de host. */
export function findAssetUsages(quiz: Quiz, assetId: string): string[] {
  const usages: string[] = []
  const uses = (c: ScreenContent) => c.type !== 'black' && c.assetId === assetId

  for (const slot of quiz.screens) {
    if (uses(slot.default)) usages.push(`Standaard van scherm "${slot.name}"`)
  }
  if (quiz.background?.assetId === assetId) usages.push('Achtergrondmuziek')
  for (const round of quiz.rounds) {
    if (Object.values(round.screens).some(uses)) usages.push(`Ronde "${round.title}": scherm`)
    if (typeof round.background === 'object' && round.background.replaceAssetId === assetId) {
      usages.push(`Ronde "${round.title}": achtergrond`)
    }
    if (round.fragments.some((f) => f.assetId === assetId)) {
      usages.push(`Ronde "${round.title}": fragment`)
    }
    if (round.slides.some((s) => s.imageAssetId === assetId)) {
      usages.push(`Ronde "${round.title}": slide`)
    }
  }
  return usages
}

/** Problemen die een show in de weg zitten (ontbrekende assets/kanalen). */
export function findBrokenReferences(quiz: Quiz): string[] {
  const assetIds = new Set(quiz.assets.map((a) => a.id))
  const channelIds = new Set(quiz.channels.map((c) => c.id))
  const problems: string[] = []
  const checkAsset = (id: string | undefined, where: string) => {
    if (id && !assetIds.has(id)) problems.push(`${where}: media ontbreekt`)
  }
  const checkContent = (c: ScreenContent, where: string) => {
    if (c.type !== 'black') checkAsset(c.assetId, where)
  }

  for (const slot of quiz.screens) checkContent(slot.default, `Scherm "${slot.name}"`)
  if (quiz.background) {
    checkAsset(quiz.background.assetId, 'Achtergrondmuziek')
    if (!channelIds.has(quiz.background.channelId)) {
      problems.push('Achtergrondmuziek: audiokanaal ontbreekt')
    }
  }
  for (const round of quiz.rounds) {
    const where = `Ronde "${round.title}"`
    for (const content of Object.values(round.screens)) checkContent(content, where)
    if (typeof round.background === 'object') checkAsset(round.background.replaceAssetId, where)
    for (const f of round.fragments) {
      checkAsset(f.assetId, `${where}, ${f.label}`)
      if (!channelIds.has(f.channelId)) problems.push(`${where}, ${f.label}: kanaal ontbreekt`)
    }
    for (const s of round.slides) checkAsset(s.imageAssetId, `${where}, slide`)
  }
  return problems
}
