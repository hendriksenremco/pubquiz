import { describe, expect, it } from 'vitest'
import { SaveQueue } from './save-queue'

/** Een schrijfactie die pas klaar is als de test dat zegt. */
function slowWrite(disk: string[], value: () => string) {
  let finish!: () => void
  const write = () => {
    const snapshot = value()
    return new Promise<void>((resolve) => {
      finish = () => {
        disk.push(snapshot)
        resolve()
      }
    })
  }
  return { write, finish: () => finish() }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('SaveQueue', () => {
  it('schrijft alleen als er iets veranderd is', async () => {
    const saves = new SaveQueue()
    const writes: string[] = []
    expect(await saves.flush(async () => void writes.push('a'))).toBe(false)
    saves.changed()
    expect(saves.dirty).toBe(true)
    expect(await saves.flush(async () => void writes.push('b'))).toBe(true)
    expect(saves.dirty).toBe(false)
    expect(writes).toEqual(['b'])
  })

  it('een wijziging tijdens het schrijven blijft staan voor de volgende opslag', async () => {
    const saves = new SaveQueue()
    const disk: string[] = []
    let quiz = 'zonder loop'
    const slow = slowWrite(disk, () => quiz)

    saves.changed()
    const first = saves.flush(slow.write)
    await tick()
    quiz = 'met loop'
    saves.changed()
    slow.finish()

    expect(await first).toBe(false)
    expect(saves.dirty).toBe(true)
    expect(await saves.flush(async () => void disk.push(quiz))).toBe(true)
    expect(disk).toEqual(['zonder loop', 'met loop'])
  })

  it('schrijft nooit twee keer tegelijk, en de nieuwste versie komt als laatste', async () => {
    const saves = new SaveQueue()
    const disk: string[] = []
    let quiz = 'oud'
    const slow = slowWrite(disk, () => quiz)

    saves.changed()
    const first = saves.flush(slow.write)
    await tick()
    quiz = 'nieuw'
    saves.changed()
    let started = false
    const second = saves.flush(async () => {
      started = true
      disk.push(quiz)
    })
    await tick()
    expect(started).toBe(false)

    slow.finish()
    await Promise.all([first, second])
    expect(disk).toEqual(['oud', 'nieuw'])
    expect(saves.dirty).toBe(false)
  })

  it('na een mislukte opslag blijft de quiz dirty en werkt de volgende gewoon', async () => {
    const saves = new SaveQueue()
    saves.changed()
    await expect(saves.flush(() => Promise.reject(new Error('schijf vol')))).rejects.toThrow(
      'schijf vol'
    )
    expect(saves.dirty).toBe(true)
    expect(await saves.flush(async () => undefined)).toBe(true)
  })

  it('clean vergeet wat er nog openstond', () => {
    const saves = new SaveQueue()
    saves.changed()
    saves.clean()
    expect(saves.dirty).toBe(false)
  })
})
