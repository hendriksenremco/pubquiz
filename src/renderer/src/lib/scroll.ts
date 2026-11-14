/**
 * Hoe ver een strook die horizontaal schuift moet staan om één item helemaal te tonen, met wat
 * ruimte erom. Staat het item al helemaal in beeld, dan blijft de strook staan (null), zodat hij
 * niet verspringt als je zelf hebt geschoven.
 */
export function scrollToShow(
  view: { left: number; width: number },
  item: { left: number; width: number },
  margin = 0
): number | null {
  const start = item.left - margin
  const end = item.left + item.width + margin
  if (start < view.left) return Math.max(0, start)
  if (end > view.left + view.width) return Math.max(0, end - view.width)
  return null
}
