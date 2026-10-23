import { ref, watch, type Ref } from 'vue'
import type { MediaAsset } from '@shared/types'
import { urlFor } from './media'

const cache = new Map<string, Promise<string | null>>()

/**
 * Haalt een piepklein (8×4) plaatje uit een video of afbeelding, als data-URL.
 * Opgeblazen en vervaagd geeft dat een gloed in de kleuren van het beeld, zoals bij
 * albumhoezen in muziek-apps. Mislukt het (bv. CORS), dan gewoon geen gloed.
 */
export function ambientFor(asset: MediaAsset | null): Promise<string | null> {
  if (!asset || asset.kind === 'audio') return Promise.resolve(null)
  return ambientFromUrl(asset.kind, urlFor(asset))
}

/** Zelfde, voor een willekeurige media-URL (bv. de cover van een recente quiz). */
export function ambientFromUrl(kind: 'video' | 'image', url: string): Promise<string | null> {
  let pending = cache.get(url)
  if (!pending) {
    pending = sample(kind, url).catch(() => null)
    cache.set(url, pending)
  }
  return pending
}

async function sample(kind: 'video' | 'image', url: string): Promise<string | null> {
  const source = kind === 'video' ? await loadVideoFrame(url) : await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 4
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

function loadVideoFrame(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2)
    }
    video.onseeked = () => resolve(video)
    video.onerror = reject
    video.src = url
  })
}

/** Reactieve variant: data-URL voor de gloed achter een header, of null. */
export function useAmbient(asset: () => MediaAsset | null): Ref<string | null> {
  const url = ref<string | null>(null)
  watch(
    () => asset()?.id,
    async () => {
      const current = asset()
      const result = await ambientFor(current)
      if (asset()?.id === current?.id) url.value = result
    },
    { immediate: true }
  )
  return url
}
