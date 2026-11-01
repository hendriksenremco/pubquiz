import { isStandingsSlide, standings, type Standing } from '@shared/scores'
import type { Quiz, Slide } from '@shared/types'
import { useSession } from '../../stores/session'

/**
 * De stand voor een slide die hem toont, zolang de plug-in Tussenstand aan staat; anders null en
 * is het een gewone titelslide. Voor de schermen, de previews en de lijst met slides.
 */
export function useStandings() {
  const session = useSession()
  return (quiz: Quiz, slide: Slide): Standing[] | null =>
    session.pluginOn('scores') && isStandingsSlide(slide) ? standings(quiz) : null
}
