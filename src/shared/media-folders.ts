import { newId } from './factory'
import type { ImportResult } from './ipc'
import type { MediaAsset, MediaFolder, Quiz } from './types'

/** Natuurlijke volgorde: "Track 2" vóór "Track 10". */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, 'nl', { numeric: true, sensitivity: 'base' })
}

export function createFolder(quiz: Quiz, name: string): MediaFolder {
  const folder = { id: newId(), name }
  quiz.folders.push(folder)
  return folder
}

/** Assets in een map, of (folderId null) de assets zonder map. */
export function assetsIn(quiz: Quiz, folderId: string | null): MediaAsset[] {
  return quiz.assets.filter((a) => (a.folderId ?? null) === folderId)
}

/** Verwijdert de map; de bestanden blijven, zonder map. */
export function deleteFolder(quiz: Quiz, folderId: string): void {
  for (const asset of quiz.assets) {
    if (asset.folderId === folderId) delete asset.folderId
  }
  quiz.folders = quiz.folders.filter((f) => f.id !== folderId)
}

export function moveToFolder(asset: MediaAsset, folderId: string | null): void {
  if (folderId) asset.folderId = folderId
  else delete asset.folderId
}

/**
 * Voegt een importresultaat toe aan de quiz. Bestanden die er al zijn worden niet dubbel
 * toegevoegd; een geïmporteerde Finder-map wordt een quizmap (een bestaande met dezelfde naam
 * wordt hergebruikt); losse bestanden komen in `targetFolderId`.
 * Geeft de assets terug zoals ze in de quiz staan, in importvolgorde.
 */
export function addImported(
  quiz: Quiz,
  result: ImportResult,
  targetFolderId: string | null = null
): MediaAsset[] {
  const folderOf = new Map<string, string>()
  for (const group of result.folders) {
    const folder =
      quiz.folders.find((f) => f.name.toLowerCase() === group.name.toLowerCase()) ??
      createFolder(quiz, group.name)
    for (const id of group.assetIds) folderOf.set(id, folder.id)
  }

  const added: MediaAsset[] = []
  for (const asset of result.assets) {
    const folderId = folderOf.get(asset.id) ?? targetFolderId
    const existing = quiz.assets.find((a) => a.file === asset.file)
    if (existing) {
      if (folderId && !existing.folderId) existing.folderId = folderId
      added.push(existing)
      continue
    }
    quiz.assets.push(folderId ? { ...asset, folderId } : asset)
    added.push(quiz.assets[quiz.assets.length - 1])
  }
  return added
}

export interface AssetGroup {
  folder: MediaFolder | null
  assets: MediaAsset[]
}

/** Assets van de gevraagde soorten: eerst die zonder map, dan per map op naam. Lege groepen vallen weg. */
export function groupByFolder(quiz: Quiz, kinds: MediaAsset['kind'][]): AssetGroup[] {
  const ofKind = (folderId: string | null) =>
    assetsIn(quiz, folderId).filter((a) => kinds.includes(a.kind))
  const folders = [...quiz.folders].sort((a, b) => naturalCompare(a.name, b.name))
  return [
    { folder: null, assets: ofKind(null) },
    ...folders.map((folder) => ({ folder, assets: ofKind(folder.id) }))
  ].filter((g) => g.assets.length > 0)
}
