import { newId } from './factory'
import type { Quiz, ScreenContent } from './types'

export interface TemplateOptions {
  /** Rondes overnemen: titels, slides, beeld en achtergrond per ronde. */
  rounds: boolean
  /** Ook de geluidsfragmenten in die rondes (en hun bestanden). */
  fragments: boolean
}

/** Ids van alle assets waar de quiz ergens naar verwijst. */
export function usedAssetIds(quiz: Quiz): Set<string> {
  const used = new Set<string>()
  const add = (c: ScreenContent) => c.type !== 'black' && used.add(c.assetId)
  for (const slot of quiz.screens) add(slot.default)
  if (quiz.background) used.add(quiz.background.assetId)
  for (const round of quiz.rounds) {
    Object.values(round.screens).forEach(add)
    if (typeof round.background === 'object') used.add(round.background.replaceAssetId)
    for (const f of round.fragments) used.add(f.assetId)
    for (const s of round.slides) if (s.imageAssetId) used.add(s.imageAssetId)
  }
  return used
}

/**
 * Nieuwe quiz op basis van een bestaande. Schermen, kanalen, achtergrondmuziek en alle beeld
 * (video's en afbeeldingen, met hun mappen) gaan altijd mee: dat is de "look" van de quiz.
 * Geluid alleen als het nog gebruikt wordt, zodat de liedjes van vorige keer niet meeliften.
 * Ids blijven gelijk (ze zijn per quiz uniek); de quiz zelf krijgt een nieuw id.
 */
export function quizFromTemplate(source: Quiz, title: string, options: TemplateOptions): Quiz {
  const copy: Quiz = structuredClone(source)
  copy.id = newId()
  copy.title = title
  copy.rounds = options.rounds
    ? copy.rounds.map((r) => (options.fragments ? r : { ...r, fragments: [] }))
    : []

  const used = usedAssetIds(copy)
  copy.assets = copy.assets.filter((a) => a.kind !== 'audio' || used.has(a.id))
  copy.folders = copy.folders.filter((f) => copy.assets.some((a) => a.folderId === f.id))
  return copy
}
