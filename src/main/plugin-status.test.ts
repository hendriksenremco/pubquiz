import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STATUS_INTERVAL_MS, StatusBoard } from './plugin-status'

describe('StatusBoard', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stuurt een nieuwe status meteen, en dezelfde niet nog eens', () => {
    const send = vi.fn()
    const board = new StatusBoard(send)
    board.publish('magichome', { light: null, manual: false, quiz: [] })
    board.publish('magichome', { light: null, manual: false, quiz: [] })
    expect(send.mock.calls).toEqual([['magichome', { light: null, manual: false, quiz: [] }]])
    expect(board.get('magichome')).toEqual({ light: null, manual: false, quiz: [] })
    expect(board.get('remote')).toBeNull()
  })

  it('stuurt hooguit eens per interval, en dan de nieuwste', () => {
    const send = vi.fn()
    const board = new StatusBoard(send)
    board.publish('remote', { devices: 0 })
    board.publish('remote', { devices: 1 })
    board.publish('remote', { devices: 2 })
    expect(send).toHaveBeenCalledTimes(1)
    // Wie erom vraagt, krijgt al de nieuwste.
    expect(board.get('remote')).toEqual({ devices: 2 })
    expect(board.all()).toEqual({ remote: { devices: 2 } })

    vi.advanceTimersByTime(STATUS_INTERVAL_MS)
    expect(send.mock.calls).toEqual([
      ['remote', { devices: 0 }],
      ['remote', { devices: 2 }]
    ])
  })

  it('remt elke plug-in apart', () => {
    const send = vi.fn()
    const board = new StatusBoard(send)
    board.publish('remote', { devices: 0 })
    board.publish('magichome', { manual: false })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('stuurt niets meer na clear, en null om te melden dat hij uit staat', () => {
    const send = vi.fn()
    const board = new StatusBoard(send)
    board.publish('remote', { devices: 0 })
    board.publish('remote', { devices: 1 })
    board.clear('remote')
    vi.advanceTimersByTime(STATUS_INTERVAL_MS)
    expect(send.mock.calls).toEqual([
      ['remote', { devices: 0 }],
      ['remote', null]
    ])
    expect(board.all()).toEqual({})
    board.clear('remote')
    expect(send).toHaveBeenCalledTimes(2)
  })
})
