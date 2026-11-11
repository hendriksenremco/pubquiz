import { describe, expect, it, vi } from 'vitest'
import { Updater } from './updater'

function setup(live = false) {
  const state = { live }
  const deps = {
    check: vi.fn(async () => {}),
    isLive: () => state.live,
    notify: vi.fn(),
    log: vi.fn()
  }
  return { state, deps, updater: new Updater(deps) }
}

describe('Updater', () => {
  it('zoekt buiten een show', async () => {
    const { deps, updater } = setup()
    await updater.tick()
    expect(deps.check).toHaveBeenCalledOnce()
  })

  it('zoekt niet tijdens een show', async () => {
    const { deps, updater } = setup(true)
    await updater.tick()
    expect(deps.check).not.toHaveBeenCalled()
  })

  it('zoekt niet twee keer tegelijk', async () => {
    const { deps, updater } = setup()
    let done = () => {}
    deps.check.mockImplementationOnce(() => new Promise<void>((r) => (done = r)))
    const first = updater.tick()
    await updater.tick()
    done()
    await first
    expect(deps.check).toHaveBeenCalledOnce()
  })

  it('een mislukte zoektocht geeft geen melding en blokkeert de volgende niet', async () => {
    const { deps, updater } = setup()
    deps.check.mockRejectedValueOnce(new Error('offline'))
    await updater.tick()
    await updater.tick()
    expect(deps.check).toHaveBeenCalledTimes(2)
    expect(deps.notify).not.toHaveBeenCalled()
    expect(deps.log).toHaveBeenCalledOnce()
  })

  it('meldt een binnengehaalde versie meteen buiten een show, één keer', () => {
    const { deps, updater } = setup()
    updater.downloaded('0.3.0')
    updater.downloaded('0.3.0')
    expect(deps.notify).toHaveBeenCalledOnce()
    expect(deps.notify).toHaveBeenCalledWith('0.3.0')
  })

  it('meldt een versie die tijdens de show binnenkwam pas na Stop show', () => {
    const { state, deps, updater } = setup(true)
    updater.downloaded('0.3.0')
    expect(deps.notify).not.toHaveBeenCalled()
    state.live = false
    updater.showStopped()
    expect(deps.notify).toHaveBeenCalledWith('0.3.0')
    updater.showStopped()
    expect(deps.notify).toHaveBeenCalledOnce()
  })
})
