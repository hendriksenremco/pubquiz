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
  stepTarget,
  timerSeconds
} from '@shared/resolve'
import { FRAGMENT_PAD_MESSAGES, LIVE_MESSAGES } from '../views/show/live-messages'
import { useSession } from '../stores/session'
import { ask } from './confirm'
import { locale } from './locale'

const t = LIVE_MESSAGES.in(locale)
const tPad = FRAGMENT_PAD_MESSAGES.in(locale)

/** Twee namen van één knop, zoals hij heet als hij aan of uit staat: "Beeld op zwart / Beeld terug". */
const both = (...names: string[]) => names.join(' / ')

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
    round.value ? remoteStep(quiz.value, round.value, state.value, locale) : null
  )
  const stepNames = computed(() => stepView.value?.names ?? namesOf(arrows.value, locale))

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

  /** Aftellen (T) loopt; kan alleen in een ronde. */
  const timing = computed(() => state.value.timer !== null)
  const timerLength = computed(() => timerSeconds(quiz.value, round.value))
  function toggleTimer() {
    if (round.value || timing.value) send({ type: 'timer' })
  }

  function toggleLoop() {
    if (round.value?.slideLoopSeconds) send({ type: 'slideLoop', paused: !state.value.loopPaused })
  }

  async function stopShow() {
    const ok = await ask({
      title: t('stopTitle'),
      message: t('stopMessage'),
      confirm: t('stopShow'),
      icon: 'power',
      danger: true,
      live: true
    })
    if (ok) await api.stopShow()
  }

  const ARROWS = {
    answers: 'keyArrowsAnswers',
    fragments: 'keyArrowsFragments',
    slides: 'keyArrowsSlides'
  } as const

  /**
   * Sneltoetsen: bij een toets met een knop staat de naam van die knop, zodat je hem in de werkbalk
   * of de zijbalk terugvindt.
   */
  const shortcuts = computed((): [string, string][] => [
    ['← →', t(ARROWS[arrows.value])],
    [t('keyEnter'), t('nextRound')],
    ['R', t('restartRound')],
    ['E', t('endRound')],
    ['1–9', t('keyFragment')],
    [t('keySpace'), t('keyStopFragment')],
    ['A', both(tPad('playSequence'), tPad('pause'), tPad('resume'))],
    ['S', tPad('skip')],
    ['B', both(t('blackoutOn'), t('blackoutOff'))],
    ['M', both(t('muteOn'), t('muteOff'))],
    ['L', both(t('loopPause'), t('loopResume'))],
    ['T', both(t('timerOn'), t('timerOff'))]
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
    timing,
    timerLength,
    toggleTimer,
    stopShow,
    shortcuts
  }
}
