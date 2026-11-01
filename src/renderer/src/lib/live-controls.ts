import { computed } from 'vue'
import type { ShowCommand } from '@shared/ipc'
import { remoteStep } from '@shared/remote'
import {
  activeRound,
  adjacentRound,
  allBlack as isAllBlack,
  restartRound,
  stepCommand,
  stepNames as namesOf,
  stepTarget
} from '@shared/resolve'
import { useSession } from '../stores/session'
import { ask } from './confirm'

/**
 * Bediening van de live show, gedeeld door de werkbalk en de sneltoetsen van ShowLive. Dezelfde
 * knoppen als op de afstandsbediening (src/renderer/src/remote).
 */
export function useLiveControls() {
  const api = window.pubquiz
  const session = useSession()
  const quiz = computed(() => session.quiz!)
  const state = computed(() => session.state)
  const round = computed(() => activeRound(quiz.value, state.value))
  const send = (command: ShowCommand) => api.command(command)

  /** Wat ← → (en een presenter-clicker) bedienen; zie stepTarget. */
  const arrows = computed(() => stepTarget(quiz.value, round.value))
  const hasAnswers = computed(() => arrows.value === 'answers')
  const step = (direction: 'next' | 'prev') => send(stepCommand(arrows.value, direction))
  /** Waar ← → staan en of ze verder kunnen; null = er loopt geen ronde. */
  const stepView = computed(() =>
    round.value ? remoteStep(quiz.value, round.value, state.value) : null
  )
  const stepNames = computed(() => namesOf(arrows.value))

  const prevRound = computed(() => adjacentRound(quiz.value, state.value, 'prev'))
  const nextRound = computed(() => adjacentRound(quiz.value, state.value, 'next'))
  const restartable = computed(() => restartRound(quiz.value, state.value))

  const allBlack = computed(() => isAllBlack(quiz.value, state.value))
  function toggleBlackout(screenId?: string) {
    const on = screenId ? !state.value.blackout.includes(screenId) : !allBlack.value
    send({ type: 'blackout', screenId, on })
  }

  /** Geluid uit = fragment stopt én achtergrond uit; weer aan zet de achtergrond terug. */
  const muted = computed(() => !state.value.backgroundEnabled)
  function toggleSound() {
    send(muted.value ? { type: 'toggleBackground' } : { type: 'stopAll' })
  }

  function toggleAutoplay() {
    const ap = state.value.autoplay
    if (ap.status === 'idle') send({ type: 'autoplay', action: 'start' })
    else if (ap.status === 'paused' || (ap.status === 'playing' && ap.holdAfter))
      send({ type: 'autoplay', action: 'resume' })
    else send({ type: 'autoplay', action: 'pause' })
  }

  function toggleLoop() {
    if (round.value?.slideLoopSeconds) send({ type: 'slideLoop', paused: !state.value.loopPaused })
  }

  async function stopShow() {
    const ok = await ask({
      title: 'Show stoppen?',
      message: 'De schermen gaan uit en de muziek stopt.',
      confirm: 'Stop show',
      danger: true
    })
    if (ok) await api.stopShow()
  }

  const ARROWS = {
    answers: 'Vorige of volgende stap in de antwoorden',
    fragments: 'Vorig of volgend fragment',
    slides: 'Vorige of volgende slide'
  } as const

  const shortcuts = computed((): [string, string][] => [
    ['← →', ARROWS[arrows.value]],
    ['Enter', 'Start de volgende ronde'],
    ['R', 'Ronde opnieuw vanaf het begin'],
    ['E', 'Einde ronde'],
    ['1–9', 'Speel een fragment'],
    ['Spatie', 'Stop het fragment'],
    ['A', 'Reeks starten of pauzeren'],
    ['S', 'Volgende in de reeks'],
    ['B', 'Beeld op zwart of terug'],
    ['M', 'Geluid uit of aan'],
    ['L', 'Loop van de slides pauzeren of verder']
  ])

  return {
    send,
    round,
    prevRound,
    nextRound,
    restartable,
    hasAnswers,
    arrows,
    step,
    stepView,
    stepNames,
    allBlack,
    toggleBlackout,
    muted,
    toggleSound,
    toggleAutoplay,
    toggleLoop,
    stopShow,
    shortcuts
  }
}
