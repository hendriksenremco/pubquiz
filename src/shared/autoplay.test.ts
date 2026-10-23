import { describe, expect, it } from 'vitest'
import { AUTOPLAY_IDLE, autoplayCountdown, stepAutoplay, type AutoplayState } from './autoplay'

const config = { count: 3, gapMs: 5000 }

function start(fromIndex = 0) {
  return stepAutoplay(AUTOPLAY_IDLE, { type: 'start', roundId: 'r', fromIndex, now: 0 }, config)
}

describe('stepAutoplay', () => {
  it('start direct met het eerste fragment en stopt wat er speelde', () => {
    expect(start()).toEqual({
      state: { status: 'playing', roundId: 'r', index: 0, holdAfter: false },
      play: 0,
      stopCurrent: true
    })
  })

  it('wacht de gap af en speelt dan het volgende fragment', () => {
    const ended = stepAutoplay(
      start().state,
      { type: 'ended', roundId: 'r', index: 0, now: 1000 },
      config
    )
    expect(ended.state).toEqual({ status: 'gap', roundId: 'r', nextIndex: 1, until: 6000 })
    expect(ended.play).toBeNull()

    expect(stepAutoplay(ended.state, { type: 'tick', now: 5999 }, config).play).toBeNull()
    const next = stepAutoplay(ended.state, { type: 'tick', now: 6000 }, config)
    expect(next.play).toBe(1)
    expect(next.state).toMatchObject({ status: 'playing', index: 1 })
  })

  it('speelt zonder gap direct door', () => {
    const noGap = { count: 3, gapMs: 0 }
    const ended = stepAutoplay(
      start().state,
      { type: 'ended', roundId: 'r', index: 0, now: 0 },
      noGap
    )
    expect(ended.play).toBe(1)
  })

  it('is klaar na het laatste fragment', () => {
    const last: AutoplayState = { status: 'playing', roundId: 'r', index: 2, holdAfter: false }
    const done = stepAutoplay(last, { type: 'ended', roundId: 'r', index: 2, now: 0 }, config)
    expect(done.state).toEqual(AUTOPLAY_IDLE)
    expect(done.stopCurrent).toBe(false)
  })

  it('negeert einde-meldingen van een ander fragment', () => {
    const playing = start().state
    const other = stepAutoplay(playing, { type: 'ended', roundId: 'r', index: 2, now: 0 }, config)
    expect(other.state).toBe(playing)
  })

  it('skip springt naar het volgende fragment, ook vanuit de gap', () => {
    const skipped = stepAutoplay(start().state, { type: 'skip', now: 0 }, config)
    expect(skipped).toMatchObject({ play: 1, stopCurrent: true })

    const gap: AutoplayState = { status: 'gap', roundId: 'r', nextIndex: 2, until: 9999 }
    expect(stepAutoplay(gap, { type: 'skip', now: 0 }, config)).toMatchObject({
      play: 2,
      stopCurrent: false
    })
  })

  it('pauzeert de countdown en hervat met de resterende tijd', () => {
    const gap: AutoplayState = { status: 'gap', roundId: 'r', nextIndex: 1, until: 5000 }
    const paused = stepAutoplay(gap, { type: 'pause', now: 3000 }, config).state
    expect(paused).toEqual({ status: 'paused', roundId: 'r', nextIndex: 1, remainingMs: 2000 })
    expect(stepAutoplay(paused, { type: 'tick', now: 99_999 }, config).play).toBeNull()

    const resumed = stepAutoplay(paused, { type: 'resume', now: 10_000 }, config).state
    expect(resumed).toEqual({ status: 'gap', roundId: 'r', nextIndex: 1, until: 12_000 })
  })

  it('pauze tijdens een fragment houdt de reeks aan na dat fragment', () => {
    const held = stepAutoplay(start().state, { type: 'pause', now: 0 }, config).state
    expect(held).toMatchObject({ status: 'playing', holdAfter: true })
    const after = stepAutoplay(held, { type: 'ended', roundId: 'r', index: 0, now: 0 }, config)
    expect(after.state).toEqual({ status: 'paused', roundId: 'r', nextIndex: 1, remainingMs: 5000 })
  })

  it('stop maakt alles idle en stopt een spelend fragment', () => {
    expect(stepAutoplay(start().state, { type: 'stop' }, config)).toEqual({
      state: AUTOPLAY_IDLE,
      play: null,
      stopCurrent: true
    })
    const gap: AutoplayState = { status: 'gap', roundId: 'r', nextIndex: 1, until: 1 }
    expect(stepAutoplay(gap, { type: 'stop' }, config).stopCurrent).toBe(false)
  })

  it('start voorbij het einde is direct klaar', () => {
    expect(start(3).state).toEqual(AUTOPLAY_IDLE)
  })
})

describe('autoplayCountdown', () => {
  it('rondt resterende seconden naar boven af', () => {
    const gap: AutoplayState = { status: 'gap', roundId: 'r', nextIndex: 1, until: 5000 }
    expect(autoplayCountdown(gap, 0)).toBe(5)
    expect(autoplayCountdown(gap, 4001)).toBe(1)
    expect(autoplayCountdown(gap, 6000)).toBe(0)
    expect(autoplayCountdown(AUTOPLAY_IDLE, 0)).toBeNull()
  })
})
