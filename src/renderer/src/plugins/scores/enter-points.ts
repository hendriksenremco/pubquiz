import { pointsOf, scoresOf, setPoints } from '@shared/scores'
import type { Quiz } from '@shared/types'

/**
 * Wat er in een puntenveld is getypt, bewaren: leeg = niet ingevuld, een komma mag. Ongeldig: het
 * veld laat weer zien wat er bewaard is.
 */
export function enterPoints(quiz: Quiz, roundId: string, teamId: string, event: Event): void {
  const input = event.target as HTMLInputElement
  const raw = input.value.trim().replace(',', '.')
  setPoints(quiz, roundId, teamId, raw === '' ? null : Number(raw))
  input.value = String(pointsOf(scoresOf(quiz), roundId, teamId) ?? '')
}
