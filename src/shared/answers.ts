/**
 * Antwoordenronde: de fragmenten van eerdere rondes nog eens langs. Per fragment eerst het nummer
 * (het fragment speelt opnieuw), dan het antwoord. Pure stappenlogica; main voert de effecten uit.
 */

export interface AnswerState {
  /** De antwoordenronde die nu loopt. */
  roundId: string
  /** Index in de fragmenten die de ronde langsloopt (zie `answerItems`). */
  index: number
  revealed: boolean
}

export type AnswerAction = 'next' | 'prev' | 'stop' | { goto: number }

export interface AnswerStep {
  answer: AnswerState | null
  /** Fragment dat (opnieuw) moet spelen. */
  play: number | null
  /** Het fragment dat nu speelt moet stoppen. */
  stopCurrent: boolean
}

export function stepAnswers(
  current: AnswerState | null,
  action: AnswerAction,
  roundId: string,
  count: number
): AnswerStep {
  const unchanged: AnswerStep = { answer: current, play: null, stopCurrent: false }
  const show = (index: number, revealed: boolean, stopCurrent = false): AnswerStep => ({
    answer: { roundId, index, revealed },
    play: null,
    stopCurrent
  })
  const play = (index: number): AnswerStep => ({
    answer: { roundId, index, revealed: false },
    play: index,
    stopCurrent: true
  })

  if (action === 'stop') return { answer: null, play: null, stopCurrent: true }
  if (count === 0) return { answer: null, play: null, stopCurrent: false }

  if (typeof action === 'object') {
    if (action.goto < 0 || action.goto >= count) return unchanged
    if (current?.index === action.goto) return show(current.index, !current.revealed)
    return play(action.goto)
  }

  if (action === 'next') {
    if (!current) return play(0)
    if (!current.revealed) return show(current.index, true)
    return current.index < count - 1 ? play(current.index + 1) : unchanged
  }

  // prev: antwoord weer verbergen, dan naar het antwoord van het vorige fragment, dan naar het begin.
  if (!current) return unchanged
  if (current.revealed) return show(current.index, false)
  if (current.index > 0) return show(current.index - 1, true, true)
  return { answer: null, play: null, stopCurrent: true }
}
