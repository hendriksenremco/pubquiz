import { stepAnswers, type AnswerAction } from '@shared/answers'
import { AUTOPLAY_IDLE, adjacentFragment, stepAutoplay, type AutoplayEvent } from '@shared/autoplay'
import { createShowState, newId } from '@shared/factory'
import type { AudioEngineEvent, AutoplayAction, ShowCommand } from '@shared/ipc'
import {
  adjacentRound,
  answerItems,
  findAsset,
  findRound,
  loopActive,
  nextLoopSlide
} from '@shared/resolve'
import type { Fragment, Quiz, Round, ShowState } from '@shared/types'

export interface ShowHost {
  quiz(): Quiz | null
  publish(state: ShowState): void
}

/** Velden die na een crash hersteld worden; spelende audio en autoplay niet. */
const RESTORABLE = [
  'activeRoundId',
  'lastRoundId',
  'slideIndex',
  'lastFragmentId',
  'played',
  'answered',
  'blackout',
  'backgroundEnabled',
  'volumes'
] as const satisfies readonly (keyof ShowState)[]

const TICK_MS = 100

/**
 * Bron van waarheid voor de live-show. Bevat geen Electron-code, zodat hij los te testen is;
 * de host publiceert de state naar alle vensters.
 */
export class ShowController {
  private state: ShowState = createShowState()
  private ticker: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly host: ShowHost,
    private readonly clock: () => number = Date.now
  ) {}

  get current(): ShowState {
    return this.state
  }

  start(restore?: Partial<ShowState>): void {
    const restored: Partial<ShowState> = {}
    for (const key of RESTORABLE) {
      if (restore?.[key] !== undefined) Object.assign(restored, { [key]: restore[key] })
    }
    this.state = { ...createShowState(), ...restored, live: true }
    this.reconcile()
  }

  stop(): void {
    this.state = createShowState()
    this.publish()
  }

  handle(command: ShowCommand): void {
    const quiz = this.host.quiz()
    if (!quiz || !this.state.live) return
    const s = this.state
    const round = findRound(quiz, s.activeRoundId)

    switch (command.type) {
      case 'startRound':
        this.startRound(quiz, command.roundId)
        break
      case 'endRound':
        this.stopPlayback()
        s.answer = null
        s.loopPaused = false
        s.activeRoundId = null
        s.slideIndex = -1
        break
      case 'nextRound':
      case 'prevRound': {
        const target = adjacentRound(quiz, s, command.type === 'nextRound' ? 'next' : 'prev')
        if (target) this.startRound(quiz, target.id)
        break
      }
      // Met de hand bladeren zet de loop-timer opnieuw; in een loop gaat → na de laatste naar de eerste.
      case 'setSlide':
        if (round) s.slideIndex = clamp(command.index, -1, round.slides.length - 1)
        s.loopUntil = null
        break
      case 'nextSlide':
        if (round && loopActive(round, s.slideIndex))
          s.slideIndex = nextLoopSlide(round, s.slideIndex)
        else if (round && s.slideIndex < round.slides.length - 1) s.slideIndex++
        s.loopUntil = null
        break
      case 'prevSlide':
        if (round && s.slideIndex > -1) s.slideIndex--
        s.loopUntil = null
        break
      case 'slideLoop':
        s.loopPaused = command.paused
        s.loopUntil = null
        break
      case 'playFragment': {
        const fragment = round?.fragments.find((f) => f.id === command.fragmentId)
        if (!round || !fragment) break
        s.autoplay = AUTOPLAY_IDLE
        this.startFragment(quiz, round, fragment)
        break
      }
      case 'stopFragment':
        this.stopPlayback()
        break
      case 'stepFragment':
        if (round) this.stepFragment(quiz, round, command.direction)
        break
      case 'autoplay':
        if (round) this.autoplay(quiz, round, command.action)
        break
      case 'answers':
        if (round) this.answers(quiz, round, command.action)
        break
      case 'answerAt':
        if (round) this.answers(quiz, round, { goto: command.index })
        break
      case 'setVolume':
        s.volumes = { ...s.volumes, [command.id]: clamp(command.volume, 0, 1) }
        break
      case 'toggleBackground':
        s.backgroundEnabled = !s.backgroundEnabled
        break
      case 'blackout': {
        const ids = command.screenId ? [command.screenId] : quiz.screens.map((x) => x.id)
        const rest = s.blackout.filter((id) => !ids.includes(id))
        s.blackout = command.on ? [...rest, ...ids] : rest
        break
      }
      case 'stopAll':
        this.stopPlayback()
        s.backgroundEnabled = false
        break
      case 'resetPlayed': {
        const ids = new Set(round?.fragments.map((f) => f.id))
        s.played = s.played.filter((id) => !ids.has(id))
        if (s.lastFragmentId && ids.has(s.lastFragmentId)) s.lastFragmentId = null
        break
      }
    }
    this.publish()
  }

  audioEvent(event: AudioEngineEvent): void {
    const s = this.state
    if (event.type === 'fragmentStarted') {
      if (s.fragment?.key !== event.key) return
      s.fragment = { ...s.fragment, duration: event.duration }
      this.publish()
      return
    }
    const ended = s.fragment
    if (!event.key || ended?.key !== event.key) return
    s.fragment = null
    const quiz = this.host.quiz()
    const round = quiz && findRound(quiz, ended.roundId)
    const ap = s.autoplay
    if (quiz && round && ap.status === 'playing' && ap.roundId === round.id) {
      if (round.fragments[ap.index]?.id === ended.fragmentId) {
        this.stepAutoplay(quiz, round, {
          type: 'ended',
          roundId: round.id,
          index: ap.index,
          now: this.clock()
        })
      }
    }
    this.publish()
  }

  /** Na een quizwijziging: niet blijven verwijzen naar rondes, slides of fragmenten die weg zijn. */
  reconcile(): void {
    const quiz = this.host.quiz()
    const s = this.state
    if (quiz) {
      const round = findRound(quiz, s.activeRoundId)
      if (!round) {
        s.activeRoundId = null
        s.slideIndex = -1
      } else {
        s.slideIndex = clamp(s.slideIndex, -1, round.slides.length - 1)
      }
      if (s.lastRoundId && !findRound(quiz, s.lastRoundId)) s.lastRoundId = null
      if (s.fragment) {
        const exists = findRound(quiz, s.fragment.roundId)?.fragments.some(
          (f) => f.id === s.fragment?.fragmentId
        )
        if (!exists) s.fragment = null
      }
      if (s.autoplay.status !== 'idle' && s.autoplay.roundId !== s.activeRoundId) {
        s.autoplay = AUTOPLAY_IDLE
      }
      if (
        s.answer &&
        (s.answer.roundId !== s.activeRoundId ||
          !round ||
          s.answer.index >= answerItems(quiz, round).length)
      ) {
        s.answer = null
      }
      const screenIds = new Set(quiz.screens.map((x) => x.id))
      s.blackout = s.blackout.filter((id) => screenIds.has(id))
    }
    this.publish()
  }

  dispose(): void {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
  }

  private startRound(quiz: Quiz, roundId: string): void {
    const round = findRound(quiz, roundId)
    if (!round || this.state.activeRoundId === roundId) return
    this.stopPlayback()
    this.state.answer = null
    this.state.loopPaused = false
    this.state.activeRoundId = round.id
    this.state.lastRoundId = round.id
    this.state.slideIndex = round.slides.length > 0 ? 0 : -1
  }

  private stopPlayback(): void {
    this.state.fragment = null
    this.state.autoplay = AUTOPLAY_IDLE
  }

  private startFragment(quiz: Quiz, round: Round, fragment: Fragment): void {
    const asset = findAsset(quiz, fragment.assetId)
    const start = fragment.start ?? 0
    const end = fragment.end ?? asset?.duration
    this.state.fragment = {
      key: newId(),
      roundId: round.id,
      fragmentId: fragment.id,
      startedAt: this.clock(),
      duration: end !== undefined ? Math.max(0, end - start) : null
    }
    this.state.lastFragmentId = fragment.id
    if (!this.state.played.includes(fragment.id)) {
      this.state.played = [...this.state.played, fragment.id]
    }
  }

  private stepFragment(quiz: Quiz, round: Round, direction: 'next' | 'prev'): void {
    const ids = round.fragments.map((f) => f.id)
    const target = adjacentFragment(ids, this.state.lastFragmentId, direction)
    if (target === null) return
    // Loopt de reeks, dan gaat die vanaf dit fragment verder; anders speelt alleen dit fragment.
    const ap = this.state.autoplay
    if (ap.status !== 'idle' && ap.roundId === round.id) {
      const now = this.clock()
      this.stepAutoplay(quiz, round, { type: 'start', roundId: round.id, fromIndex: target, now })
    } else {
      this.state.autoplay = AUTOPLAY_IDLE
      this.startFragment(quiz, round, round.fragments[target])
    }
  }

  private autoplay(quiz: Quiz, round: Round, action: AutoplayAction): void {
    const now = this.clock()
    if (action === 'start') {
      this.state.answer = null
      const firstUnplayed = round.fragments.findIndex((f) => !this.state.played.includes(f.id))
      this.stepAutoplay(quiz, round, {
        type: 'start',
        roundId: round.id,
        fromIndex: firstUnplayed === -1 ? 0 : firstUnplayed,
        now
      })
      return
    }
    this.stepAutoplay(quiz, round, action === 'stop' ? { type: 'stop' } : { type: action, now })
  }

  private answers(quiz: Quiz, round: Round, action: AnswerAction): void {
    const items = answerItems(quiz, round)
    const current = this.state.answer?.roundId === round.id ? this.state.answer : null
    const step = stepAnswers(current, action, round.id, items.length)
    this.state.answer = step.answer
    this.state.autoplay = AUTOPLAY_IDLE
    if (step.stopCurrent) this.state.fragment = null
    const shown = step.answer?.revealed ? items[step.answer.index]?.id : undefined
    if (shown && !this.state.answered.includes(shown)) {
      this.state.answered = [...this.state.answered, shown]
    }
    // Een fragment speelt opnieuw; een vraag of afbeelding staat alleen in beeld.
    const item = step.play !== null ? items[step.play] : undefined
    if (item?.fragment) this.startFragment(quiz, item.round, item.fragment)
  }

  private stepAutoplay(quiz: Quiz, round: Round, event: AutoplayEvent): void {
    const step = stepAutoplay(this.state.autoplay, event, {
      count: round.fragments.length,
      gapMs: round.autoplay.gapSeconds * 1000
    })
    this.state.autoplay = step.state
    if (step.stopCurrent) this.state.fragment = null
    const fragment = step.play !== null ? round.fragments[step.play] : undefined
    if (fragment) this.startFragment(quiz, round, fragment)
  }

  private tick(): void {
    const quiz = this.host.quiz()
    if (!quiz) return
    const s = this.state
    const now = this.clock()
    let changed = false

    const ap = s.autoplay
    const apRound = ap.status === 'gap' ? findRound(quiz, ap.roundId) : null
    if (ap.status === 'gap' && apRound && now >= ap.until) {
      this.stepAutoplay(quiz, apRound, { type: 'tick', now })
      changed = true
    }

    const round = findRound(quiz, s.activeRoundId)
    if (round && s.loopUntil !== null && now >= s.loopUntil) {
      s.slideIndex = nextLoopSlide(round, s.slideIndex)
      s.loopUntil = null
      changed = true
    }
    if (changed) this.publish()
  }

  /** Zet de loop-timer als de ronde op een loop-slide staat, en haalt hem weg als dat niet zo is. */
  private syncLoop(): void {
    const s = this.state
    const quiz = this.host.quiz()
    const round = quiz ? findRound(quiz, s.activeRoundId) : null
    if (!s.live || s.loopPaused || s.answer || !round || !loopActive(round, s.slideIndex)) {
      s.loopUntil = null
      return
    }
    s.loopUntil ??= this.clock() + round.slideLoopSeconds! * 1000
  }

  private publish(): void {
    this.syncLoop()
    const needsTicker = this.state.autoplay.status === 'gap' || this.state.loopUntil !== null
    if (needsTicker && !this.ticker) this.ticker = setInterval(() => this.tick(), TICK_MS)
    if (!needsTicker && this.ticker) this.dispose()
    this.host.publish(this.state)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
