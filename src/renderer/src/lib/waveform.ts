import { ref, watch, type Ref } from 'vue'
import type { MediaAsset } from '@shared/types'
import { urlFor } from './media'
import { barsFor, type Peaks } from './peaks'

/** Zoveel piekwaardes per bestand; elke weergave haalt daar zijn eigen aantal balkjes uit. */
const RESOLUTION = 2000
/** Genoeg voor de vorm, en vlug te decoderen. */
const SAMPLE_RATE = 8000

const cache = new Map<string, Promise<Peaks | null>>()

/** Piekwaardes van een geluidsbestand; per venster één keer berekend. */
export function peaksOf(asset: MediaAsset): Promise<Peaks | null> {
  const url = urlFor(asset)
  let pending = cache.get(url)
  if (!pending) {
    pending = compute(url).catch(() => null)
    cache.set(url, pending)
  }
  return pending
}

async function compute(url: string): Promise<Peaks> {
  const data = await (await fetch(url)).arrayBuffer()
  const audio = await new OfflineAudioContext(1, 1, SAMPLE_RATE).decodeAudioData(data)
  const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c))
  const peaks = new Float32Array(RESOLUTION)
  const size = audio.length / RESOLUTION
  for (let i = 0; i < RESOLUTION; i++) {
    const to = Math.min(audio.length, Math.floor((i + 1) * size))
    let max = 0
    for (const samples of channels) {
      for (let j = Math.floor(i * size); j < to; j++) {
        const v = Math.abs(samples[j])
        if (v > max) max = v
      }
    }
    peaks[i] = max
  }
  return { peaks, duration: audio.duration }
}

export interface WaveSource {
  asset: MediaAsset | null | undefined
  start?: number
  end?: number
}

/** Balkjes voor een fragment (of zonder start/eind het hele bestand); null tot ze klaar zijn. */
export function useWaveform(
  source: () => WaveSource,
  count: number
): { bars: Ref<number[] | null>; duration: Ref<number | null> } {
  const bars = ref<number[] | null>(null)
  const duration = ref<number | null>(null)
  watch(
    () => {
      const s = source()
      return [s.asset?.file, s.start, s.end] as const
    },
    async () => {
      const s = source()
      if (!s.asset) {
        bars.value = null
        duration.value = null
        return
      }
      const peaks = await peaksOf(s.asset)
      const now = source()
      // Intussen een ander fragment of stuk gekozen: dat antwoord komt nog.
      if (now.asset?.file !== s.asset.file || now.start !== s.start || now.end !== s.end) return
      bars.value = peaks ? barsFor(peaks, count, s.start, s.end) : null
      duration.value = peaks?.duration ?? null
    },
    { immediate: true }
  )
  return { bars, duration }
}
