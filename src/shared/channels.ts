import type { Quiz } from './types'

/** Hoe vaak de achtergrondmuziek en de fragmenten dit geluidskanaal gebruiken. */
export function channelUses(quiz: Quiz, channelId: string): number {
  let uses = quiz.background?.channelId === channelId ? 1 : 0
  for (const round of quiz.rounds) {
    uses += round.fragments.filter((f) => f.channelId === channelId).length
  }
  return uses
}
