import { afterEach, describe, expect, it } from 'vitest'
import { migrateQuiz } from '@shared/migrate'
import { resolveScreen } from '@shared/resolve'
import type { Quiz, ShowState } from '@shared/types'
import { freshDemoQuiz } from './demo-fixture'
import { ShowController } from './show'

const demo = migrateQuiz(freshDemoQuiz())

function setup(quiz: Quiz = demo) {
  let now = 1_000
  const published: ShowState[] = []
  const show = new ShowController(
    { quiz: () => quiz, publish: (s) => published.push(structuredClone(s)) },
    () => now
  )
  show.start()
  return {
    show,
    published,
    get state() {
      return show.current
    },
    advance(ms: number) {
      now += ms
    }
  }
}

let active: ShowController | null = null
afterEach(() => active?.dispose())

describe('ShowController', () => {
  it('negeert commando’s als de show niet live is', () => {
    const t = setup()
    t.show.stop()
    t.show.handle({ type: 'startRound', roundId: 'r1' })
    expect(t.state.activeRoundId).toBeNull()
  })

  it('wisselt het scherm tijdens een ronde en valt daarna terug', () => {
    const t = setup()
    const beamer = () => resolveScreen(demo, t.state, 'beamer').content
    expect(beamer()).toMatchObject({ assetId: 'loop' })

    t.show.handle({ type: 'startRound', roundId: 'r2' })
    expect(beamer()).toMatchObject({ assetId: 'music-loop' })
    expect(t.state.slideIndex).toBe(0)

    t.show.handle({ type: 'endRound' })
    expect(beamer()).toMatchObject({ assetId: 'loop' })
    expect(t.state.slideIndex).toBe(-1)
  })

  it('bepaalt de volgende ronde, ook tussen rondes in', () => {
    const t = setup()
    t.show.handle({ type: 'nextRound' })
    expect(t.state.activeRoundId).toBe('r1')
    t.show.handle({ type: 'endRound' })
    t.show.handle({ type: 'nextRound' })
    expect(t.state.activeRoundId).toBe('r2')
    t.show.handle({ type: 'nextRound' })
    expect(t.state.activeRoundId).toBe('r3')
  })

  it('bladert door slides binnen de grenzen', () => {
    const t = setup()
    t.show.handle({ type: 'startRound', roundId: 'r1' })
    t.show.handle({ type: 'nextSlide' })
    t.show.handle({ type: 'nextSlide' })
    t.show.handle({ type: 'nextSlide' })
    expect(t.state.slideIndex).toBe(2)
    t.show.handle({ type: 'setSlide', index: -5 })
    expect(t.state.slideIndex).toBe(-1)
    t.show.handle({ type: 'prevSlide' })
    expect(t.state.slideIndex).toBe(-1)
  })

  it('speelt een fragment, markeert het als gespeeld en ruimt op bij einde', () => {
    const t = setup()
    t.show.handle({ type: 'startRound', roundId: 'r2' })
    t.show.handle({ type: 'playFragment', fragmentId: 'r2-f3' })
    const key = t.state.fragment!.key
    expect(t.state.fragment).toMatchObject({ fragmentId: 'r2-f3', duration: 5 })
    expect(t.state.played).toEqual(['r2-f3'])

    t.show.audioEvent({ type: 'fragmentEnded', key: 'oud' })
    expect(t.state.fragment).not.toBeNull()
    t.show.audioEvent({ type: 'fragmentEnded', key })
    expect(t.state.fragment).toBeNull()
  })

  it('speelt de autoplay-reeks af met gap en begint bij het eerste ongespeelde fragment', () => {
    const t = setup()
    active = t.show
    t.show.handle({ type: 'startRound', roundId: 'r2' })
    t.show.handle({ type: 'playFragment', fragmentId: 'r2-f1' })
    t.show.handle({ type: 'autoplay', action: 'start' })
    expect(t.state.fragment?.fragmentId).toBe('r2-f2')

    t.show.audioEvent({ type: 'fragmentEnded', key: t.state.fragment!.key })
    expect(t.state.autoplay).toMatchObject({ status: 'gap', nextIndex: 2 })
    expect(resolveScreen(demo, t.state, 'beamer', 1_000).overlay).toMatchObject({
      kind: 'countdown',
      seconds: 4
    })

    t.show.handle({ type: 'autoplay', action: 'skip' })
    expect(t.state.fragment?.fragmentId).toBe('r2-f3')
  })

  it('een handmatig fragment stopt de autoplay', () => {
    const t = setup()
    t.show.handle({ type: 'startRound', roundId: 'r2' })
    t.show.handle({ type: 'autoplay', action: 'start' })
    t.show.handle({ type: 'playFragment', fragmentId: 'r2-f5' })
    expect(t.state.autoplay.status).toBe('idle')
    expect(t.state.fragment?.fragmentId).toBe('r2-f5')
  })

  it('stopt fragment en autoplay bij een rondewissel', () => {
    const t = setup()
    t.show.handle({ type: 'startRound', roundId: 'r2' })
    t.show.handle({ type: 'autoplay', action: 'start' })
    t.show.handle({ type: 'startRound', roundId: 'r3' })
    expect(t.state.fragment).toBeNull()
    expect(t.state.autoplay.status).toBe('idle')
  })

  it('zet blackout per scherm of voor alle schermen', () => {
    const t = setup()
    t.show.handle({ type: 'blackout', screenId: 'tv', on: true })
    expect(t.state.blackout).toEqual(['tv'])
    t.show.handle({ type: 'blackout', on: true })
    expect(t.state.blackout.sort()).toEqual(['beamer', 'tv'])
    t.show.handle({ type: 'blackout', on: false })
    expect(t.state.blackout).toEqual([])
  })

  it('herstelt na een crash alleen de herstelbare velden', () => {
    const t = setup()
    t.show.start({
      activeRoundId: 'r2',
      played: ['r2-f1'],
      fragment: { key: 'x', roundId: 'r2', fragmentId: 'r2-f2', startedAt: 0, duration: 5 }
    })
    expect(t.state).toMatchObject({ live: true, activeRoundId: 'r2', played: ['r2-f1'] })
    expect(t.state.fragment).toBeNull()
  })

  it('ruimt verwijzingen op als de quiz verandert', () => {
    const quiz = structuredClone(demo)
    const t = setup(quiz)
    t.show.handle({ type: 'startRound', roundId: 'r2' })
    t.show.handle({ type: 'playFragment', fragmentId: 'r2-f1' })
    quiz.rounds = quiz.rounds.filter((r) => r.id !== 'r2')
    t.show.reconcile()
    expect(t.state.activeRoundId).toBeNull()
    expect(t.state.fragment).toBeNull()
  })
})
