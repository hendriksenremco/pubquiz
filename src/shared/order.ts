import { slideNumber } from './resolve'
import type { Round } from './types'

/**
 * Zet het item `id` vlak vóór of na `targetId`, zoals bij slepen in een lijst. Is het hetzelfde
 * item, of bestaat een van beide niet, dan blijft de lijst zoals hij was.
 */
export function moveById<T extends { id: string }>(
  list: T[],
  id: string,
  targetId: string,
  after: boolean
): void {
  if (id === targetId || !list.some((item) => item.id === targetId)) return
  const from = list.findIndex((item) => item.id === id)
  if (from < 0) return
  const [moved] = list.splice(from, 1)
  const to = list.findIndex((item) => item.id === targetId)
  list.splice(after ? to + 1 : to, 0, moved)
}

/**
 * Na het verschuiven: vragen en nummers met een standaardtitel ("Vraag 3", "3") krijgen het
 * nummer van hun nieuwe plek, zoals de antwoordenronde ze telt. Eigen titels blijven staan.
 */
export function renumberSlides(round: Round): void {
  for (const slide of round.slides) {
    const n = slideNumber(round, slide)
    const title = slide.title ?? ''
    if (n === null) continue
    if (slide.layout === 'question' && /^Vraag \d+$/.test(title)) slide.title = `Vraag ${n}`
    if (slide.layout === 'number' && /^\d+$/.test(title)) slide.title = String(n)
  }
}
