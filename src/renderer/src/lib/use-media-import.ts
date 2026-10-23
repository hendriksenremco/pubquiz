import { addImported } from '@shared/media-folders'
import type { MediaAsset } from '@shared/types'
import { useSession } from '../stores/session'
import { probeDuration } from './media'

const api = window.pubquiz

/**
 * Importeert bestanden of hele mappen in de quizmap en voegt ze (zonder dubbelingen) toe
 * aan de quiz. Losse bestanden komen in `folderId`; een Finder-map wordt een eigen quizmap.
 */
export function useMediaImport() {
  const session = useSession()

  async function importFiles(
    paths?: string[],
    folderId: string | null = null
  ): Promise<MediaAsset[]> {
    const result = await api.importMedia(paths)
    const quiz = session.quiz
    if (!quiz) return []
    const added = addImported(quiz, result, folderId)
    for (const asset of added) {
      if (asset.duration !== undefined || asset.kind === 'image') continue
      void probeDuration(asset).then((duration) => {
        if (duration !== null) asset.duration = Math.round(duration * 100) / 100
      })
    }
    return added
  }

  function pathsFromDrop(event: DragEvent): string[] {
    return [...(event.dataTransfer?.files ?? [])].map((f) => api.pathForFile(f)).filter(Boolean)
  }

  return { importFiles, pathsFromDrop }
}
