import { describe, expect, it } from 'vitest'
import { createQuiz } from './factory'
import type { ImportResult } from './ipc'
import { addImported, assetsIn, createFolder, deleteFolder, naturalCompare } from './media-folders'
import type { MediaAsset } from './types'

const asset = (id: string, file = `media/${id}.mp3`): MediaAsset => ({
  id,
  kind: 'audio',
  file,
  name: `${id}.mp3`
})

function result(patch: Partial<ImportResult>): ImportResult {
  return { assets: [], skipped: [], folders: [], ...patch }
}

describe('mediamappen', () => {
  it('sorteert op natuurlijke volgorde', () => {
    expect(['Track 10', 'track 2', 'Track 1'].sort(naturalCompare)).toEqual([
      'Track 1',
      'track 2',
      'Track 10'
    ])
  })

  it('maakt van een Finder-map een quizmap en hergebruikt een bestaande met dezelfde naam', () => {
    const quiz = createQuiz('Q')
    const existing = createFolder(quiz, 'Ronde 2')
    addImported(
      quiz,
      result({
        assets: [asset('a'), asset('b'), asset('c')],
        folders: [
          { name: 'ronde 2', assetIds: ['a', 'b'] },
          { name: 'Loops', assetIds: ['c'] }
        ]
      })
    )
    expect(quiz.folders.map((f) => f.name)).toEqual(['Ronde 2', 'Loops'])
    expect(assetsIn(quiz, existing.id).map((a) => a.id)).toEqual(['a', 'b'])
    expect(assetsIn(quiz, quiz.folders[1].id).map((a) => a.id)).toEqual(['c'])
  })

  it('zet losse bestanden in de doelmap en voegt bestanden niet dubbel toe', () => {
    const quiz = createQuiz('Q')
    const folder = createFolder(quiz, 'Loops')
    quiz.assets.push(asset('bestaand', 'media/x.mp4'))

    const added = addImported(
      quiz,
      result({ assets: [asset('nieuw'), asset('kopie', 'media/x.mp4')] }),
      folder.id
    )
    expect(added.map((a) => a.id)).toEqual(['nieuw', 'bestaand'])
    expect(quiz.assets).toHaveLength(2)
    expect(assetsIn(quiz, folder.id).map((a) => a.id)).toEqual(['bestaand', 'nieuw'])
  })

  it('laat bij het verwijderen van een map de bestanden staan', () => {
    const quiz = createQuiz('Q')
    const folder = createFolder(quiz, 'Weg')
    addImported(quiz, result({ assets: [asset('a')] }), folder.id)
    deleteFolder(quiz, folder.id)
    expect(quiz.folders).toEqual([])
    expect(assetsIn(quiz, null).map((a) => a.id)).toEqual(['a'])
  })
})
