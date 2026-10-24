/**
 * Automatische fragmentenreeks als pure state machine.
 * Main voedt hem met events (start, fragment afgelopen, klok-tick, …) en voert de effecten uit.
 */

export type AutoplayState =
  | { status: 'idle' }
  | { status: 'playing'; roundId: string; index: number; holdAfter: boolean }
  | { status: 'gap'; roundId: string; nextIndex: number; until: number }
  | { status: 'paused'; roundId: string; nextIndex: number; remainingMs: number }

export type AutoplayEvent =
  | { type: 'start'; roundId: string; fromIndex: number; now: number }
  | { type: 'ended'; roundId: string; index: number; now: number }
  | { type: 'tick'; now: number }
  | { type: 'skip'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'stop' }

export interface AutoplayConfig {
  count: number
  gapMs: number
}

export interface AutoplayStep {
  state: AutoplayState
  /** Index van het fragment dat nu gestart moet worden. */
  play: number | null
  /** Het fragment dat nu speelt moet stoppen. */
  stopCurrent: boolean
}

export const AUTOPLAY_IDLE: AutoplayState = { status: 'idle' }

const idle = (stopCurrent = false): AutoplayStep => ({
  state: AUTOPLAY_IDLE,
  play: null,
  stopCurrent
})

const unchanged = (state: AutoplayState): AutoplayStep => ({
  state,
  play: null,
  stopCurrent: false
})

function playAt(roundId: string, index: number, config: AutoplayConfig, stopCurrent: boolean) {
  if (index >= config.count) return idle(stopCurrent)
  return {
    state: { status: 'playing', roundId, index, holdAfter: false },
    play: index,
    stopCurrent
  } satisfies AutoplayStep
}

function waitFor(roundId: string, nextIndex: number, now: number, config: AutoplayConfig) {
  if (nextIndex >= config.count) return idle()
  if (config.gapMs <= 0) return playAt(roundId, nextIndex, config, false)
  return unchanged({ status: 'gap', roundId, nextIndex, until: now + config.gapMs })
}

export function stepAutoplay(
  state: AutoplayState,
  event: AutoplayEvent,
  config: AutoplayConfig
): AutoplayStep {
  switch (event.type) {
    case 'start':
      return playAt(event.roundId, Math.max(0, event.fromIndex), config, true)

    case 'stop':
      return idle(state.status === 'playing')

    case 'ended': {
      if (
        state.status !== 'playing' ||
        state.roundId !== event.roundId ||
        state.index !== event.index
      ) {
        return unchanged(state)
      }
      const nextIndex = state.index + 1
      if (nextIndex >= config.count) return idle()
      if (state.holdAfter) {
        return unchanged({
          status: 'paused',
          roundId: state.roundId,
          nextIndex,
          remainingMs: config.gapMs
        })
      }
      return waitFor(state.roundId, nextIndex, event.now, config)
    }

    case 'tick':
      if (state.status === 'gap' && event.now >= state.until) {
        return playAt(state.roundId, state.nextIndex, config, false)
      }
      return unchanged(state)

    case 'skip':
      if (state.status === 'playing') return playAt(state.roundId, state.index + 1, config, true)
      if (state.status === 'gap' || state.status === 'paused') {
        return playAt(state.roundId, state.nextIndex, config, false)
      }
      return unchanged(state)

    case 'pause':
      if (state.status === 'gap') {
        return unchanged({
          status: 'paused',
          roundId: state.roundId,
          nextIndex: state.nextIndex,
          remainingMs: Math.max(0, state.until - event.now)
        })
      }
      if (state.status === 'playing') return unchanged({ ...state, holdAfter: true })
      return unchanged(state)

    case 'resume':
      if (state.status === 'paused') {
        if (state.remainingMs <= 0) return playAt(state.roundId, state.nextIndex, config, false)
        return unchanged({
          status: 'gap',
          roundId: state.roundId,
          nextIndex: state.nextIndex,
          until: event.now + state.remainingMs
        })
      }
      if (state.status === 'playing') return unchanged({ ...state, holdAfter: false })
      return unchanged(state)
  }
}

/**
 * Bladeren met ← →: de index van het fragment na of voor het laatst gestarte. Nog niets gestart,
 * dan begint → bij het eerste. Voorbij het begin of het eind: null.
 */
export function adjacentFragment(
  ids: string[],
  lastId: string | null,
  direction: 'next' | 'prev'
): number | null {
  const index = lastId ? ids.indexOf(lastId) : -1
  const target = index + (direction === 'next' ? 1 : -1)
  return target >= 0 && target < ids.length ? target : null
}

/** Resterende hele seconden in de pauze tussen twee fragmenten, of null. */
export function autoplayCountdown(state: AutoplayState, now: number): number | null {
  if (state.status === 'gap') return Math.max(0, Math.ceil((state.until - now) / 1000))
  if (state.status === 'paused') return Math.ceil(state.remainingMs / 1000)
  return null
}
