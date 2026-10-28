import type { Slide } from '@shared/types'

/** Wat een slide over het beeld eronder legt: dimmen, niets (tekst over de video) of een effen kleur. */
export function slideBackdrop(slide: Slide): Record<string, string> {
  const b = slide.backdrop
  if (b === 'dim') return { background: 'rgba(0, 0, 0, 0.55)' }
  if (b === 'over-video') return {}
  return { background: b.color }
}
