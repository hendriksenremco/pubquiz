import { ref } from 'vue'
import type { MediaAsset } from '@shared/types'
import { urlFor } from './media'

// Eén voorluister-speler voor het hele operator-venster (systeemstandaard-uitgang).
// Video-tegels spelen zelf af, maar melden zich via claim() aan, zodat er altijd maar één
// voorbeeld tegelijk speelt.
const audio = new Audio()
const playingId = ref<string | null>(null)
let stopAt: number | null = null

audio.addEventListener('timeupdate', () => {
  if (stopAt !== null && audio.currentTime >= stopAt) stop()
})
audio.addEventListener('ended', () => stop())

function stop() {
  audio.pause()
  playingId.value = null
  stopAt = null
}

/** Een ander element (bv. een video) gaat een voorbeeld spelen: audio stopt. */
function claim(id: string) {
  audio.pause()
  stopAt = null
  playingId.value = id
}

function toggle(id: string, asset: MediaAsset | null, start = 0, end?: number) {
  if (playingId.value === id) return stop()
  if (!asset) return
  audio.src = urlFor(asset)
  audio.currentTime = start
  stopAt = end ?? null
  playingId.value = id
  void audio.play().catch(stop)
}

export function usePreviewPlayer() {
  return { playingId, toggle, stop, claim }
}
