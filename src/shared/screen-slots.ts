import type { Quiz } from './types'

/** Of een ronde of slide iets voor dit scherm instelt; dat verdwijnt als het scherm weggaat. */
export function screenUsedByRounds(quiz: Quiz, screenId: string): boolean {
  return quiz.rounds.some(
    (round) =>
      screenId in round.screens ||
      round.mutedScreens.includes(screenId) ||
      round.fragmentScreens.includes(screenId) ||
      round.slides.some(
        (slide) => slide.targetScreens !== 'all' && slide.targetScreens.includes(screenId)
      )
  )
}

/** Verwijdert het scherm en wat rondes en slides ervoor instellen. */
export function deleteScreen(quiz: Quiz, screenId: string): void {
  quiz.screens = quiz.screens.filter((s) => s.id !== screenId)
  for (const round of quiz.rounds) {
    delete round.screens[screenId]
    round.mutedScreens = round.mutedScreens.filter((id) => id !== screenId)
    round.fragmentScreens = round.fragmentScreens.filter((id) => id !== screenId)
    for (const slide of round.slides) {
      if (slide.targetScreens === 'all') continue
      slide.targetScreens = slide.targetScreens.filter((id) => id !== screenId)
      // Een slide zonder scherm zou nergens meer staan: dan weer op alle schermen.
      if (slide.targetScreens.length === 0) slide.targetScreens = 'all'
    }
  }
}
