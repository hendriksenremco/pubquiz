import type { InjectionKey } from 'vue'
import { mediaUrl } from '@shared/ipc'
import type { MediaAsset, Quiz } from '@shared/types'

/**
 * Waar een slide zijn afbeelding vandaan haalt, op asset-id. Zonder: uit de quiz via pq-media; de
 * afstandsbediening op de telefoon haalt hem bij de Mac (zie remote/RemoteApp.vue).
 */
export const ASSET_URL: InjectionKey<(assetId: string | undefined) => string | null> =
  Symbol('asset-url')

export function assetUrl(quiz: Quiz | null, assetId: string | undefined): string | null {
  const asset = quiz?.assets.find((a) => a.id === assetId)
  return asset ? mediaUrl(asset.file) : null
}

export function urlFor(asset: MediaAsset): string {
  return mediaUrl(asset.file)
}

/** Leest de duur van een audio- of videobestand via een los media-element. */
export function probeDuration(asset: MediaAsset): Promise<number | null> {
  if (asset.kind === 'image') return Promise.resolve(null)
  return new Promise((resolve) => {
    const el = document.createElement(asset.kind === 'video' ? 'video' : 'audio')
    const done = (value: number | null) => {
      el.removeAttribute('src')
      el.load()
      resolve(value)
    }
    el.preload = 'metadata'
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null)
    el.onerror = () => done(null)
    el.src = urlFor(asset)
  })
}
