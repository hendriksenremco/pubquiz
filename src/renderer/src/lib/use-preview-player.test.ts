import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { MediaAsset } from '@shared/types'

/** Nep-Audio: play() blijft hangen tot pause() hem afbreekt, zoals in Chromium tijdens het laden. */
class FakeAudio {
  paused = true
  currentTime = 0
  src = ''
  private reject: ((err: Error) => void) | null = null
  addEventListener(): void {}
  play(): Promise<void> {
    this.paused = false
    return new Promise((_resolve, reject) => (this.reject = reject))
  }
  pause(): void {
    this.paused = true
    this.reject?.(new DOMException('The play() request was interrupted by a call to pause()'))
    this.reject = null
  }
}

let player: typeof import('./use-preview-player').usePreviewPlayer extends () => infer R ? R : never

beforeAll(async () => {
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  const { usePreviewPlayer } = await import('./use-preview-player')
  player = usePreviewPlayer()
})

const song = { id: 'a', kind: 'audio', file: 'media/a.mp3', name: 'a.mp3' } as MediaAsset

describe('usePreviewPlayer', () => {
  it('laat een nieuw voorbeeld spelen als dat een nog ladend geluid afbreekt', async () => {
    player.toggle('fragment', song)
    player.claim('preview:video')
    await Promise.resolve()
    await Promise.resolve()
    expect(player.playingId.value).toBe('preview:video')
  })
})
