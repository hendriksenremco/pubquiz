import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { freshDemoQuiz } from './demo-fixture'
import {
  createQuizDir,
  createQuizFromTemplate,
  exportZip,
  findMissingMedia,
  folderNameFor,
  importMediaFiles,
  importZip,
  readQuiz,
  writeQuiz
} from './quiz-files'

const dirs: string[] = []
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pubquiz-test-'))
  dirs.push(dir)
  return dir
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('quiz-bestanden', () => {
  it('maakt een .pubquiz-map met geldige quiz.json', async () => {
    const { dir, quiz } = await createQuizDir(join(temp(), 'Vrijdag'))
    expect(basename(dir)).toBe('Vrijdag.pubquiz')
    expect(quiz.title).toBe('Vrijdag')
    expect(await readQuiz(dir)).toEqual(quiz)
  })

  it('maakt een veilige mapnaam van de naam van de quiz', () => {
    expect(folderNameFor('  Pubquiz  november ')).toBe('Pubquiz november')
    expect(folderNameFor('Ronde 1/2: muziek?')).toBe('Ronde 1-2- muziek-')
    expect(folderNameFor('.verborgen')).toBe('verborgen')
    expect(folderNameFor('   ')).toBe('')
  })

  it('weigert een nieuwe quiz over een bestaande heen', async () => {
    const parent = temp()
    await createQuizDir(join(parent, 'Vrijdag'))
    await expect(createQuizDir(join(parent, 'Vrijdag'))).rejects.toThrow(/bestaat al/)
  })

  it('maakt een quiz op basis van een andere en kopieert alleen de nodige media', async () => {
    const parent = temp()
    const source = join(parent, 'Oktober.pubquiz')
    mkdirSync(join(source, 'media'), { recursive: true })
    const demo = freshDemoQuiz() as { assets: { file: string }[] }
    for (const a of demo.assets) writeFileSync(join(source, a.file), a.file)
    writeFileSync(join(source, 'quiz.json'), JSON.stringify(demo))

    const { dir, quiz } = await createQuizFromTemplate(source, join(parent, 'November'), {
      rounds: true,
      fragments: false
    })
    expect(basename(dir)).toBe('November.pubquiz')
    expect(quiz.title).toBe('November')
    expect(await readQuiz(dir)).toEqual(quiz)
    expect(readdirSync(join(dir, 'media')).sort()).toEqual(
      quiz.assets.map((a) => basename(a.file)).sort()
    )
    expect(readdirSync(join(dir, 'media'))).not.toContain('fragment-1.m4a')
  })

  it('importeert media onder een hash-naam, dedupliceert en slaat onbekende types over', async () => {
    const { dir } = await createQuizDir(join(temp(), 'Q'))
    const src = temp()
    writeFileSync(join(src, 'Één liedje.MP3'), 'abc')
    writeFileSync(join(src, 'kopie.mp3'), 'abc')
    writeFileSync(join(src, 'notities.txt'), 'x')

    const result = await importMediaFiles(dir, [
      join(src, 'Één liedje.MP3'),
      join(src, 'kopie.mp3'),
      join(src, 'notities.txt')
    ])
    expect(result.skipped).toEqual(['notities.txt'])
    expect(result.assets.map((a) => a.kind)).toEqual(['audio', 'audio'])
    expect(result.assets[0].name).toBe('Één liedje.MP3')
    expect(result.assets[0].file).toMatch(/^media\/[0-9a-f]{20}\.mp3$/)
    expect(result.assets[1].file).toBe(result.assets[0].file)
    expect(readdirSync(join(dir, 'media'))).toHaveLength(1)
  })

  it('importeert een hele map, op natuurlijke volgorde en inclusief submappen', async () => {
    const { dir } = await createQuizDir(join(temp(), 'Q'))
    const src = join(temp(), 'Ronde 2')
    mkdirSync(join(src, 'extra'), { recursive: true })
    mkdirSync(join(src, '.verborgen'))
    writeFileSync(join(src, 'Track 10.mp3'), 'tien')
    writeFileSync(join(src, 'Track 2.mp3'), 'twee')
    writeFileSync(join(src, 'cover.jpg'), 'hoes')
    writeFileSync(join(src, 'tracklist.txt'), 'x')
    writeFileSync(join(src, '.DS_Store'), 'x')
    writeFileSync(join(src, 'extra', 'Bonus.m4a'), 'bonus')
    writeFileSync(join(src, '.verborgen', 'geheim.mp3'), 'x')

    const result = await importMediaFiles(dir, [src])
    expect(result.assets.map((a) => a.name)).toEqual([
      'cover.jpg',
      'Bonus.m4a',
      'Track 2.mp3',
      'Track 10.mp3'
    ])
    expect(result.folders).toEqual([{ name: 'Ronde 2', assetIds: result.assets.map((a) => a.id) }])
    expect(result.skipped).toEqual([])
  })

  it('meldt een map zonder media', async () => {
    const { dir } = await createQuizDir(join(temp(), 'Q'))
    const src = join(temp(), 'Leeg')
    mkdirSync(src)
    writeFileSync(join(src, 'notities.txt'), 'x')
    const result = await importMediaFiles(dir, [src])
    expect(result.folders).toEqual([])
    expect(result.skipped).toEqual(['Leeg (geen media)'])
  })

  it('meldt ontbrekende mediabestanden', async () => {
    const { dir, quiz } = await createQuizDir(join(temp(), 'Q'))
    quiz.assets.push({ id: 'x', kind: 'video', file: 'media/weg.mp4', name: 'weg.mp4' })
    await writeQuiz(dir, quiz)
    expect(await findMissingMedia(dir, quiz)).toEqual(['weg.mp4'])
  })

  it.runIf(process.platform === 'darwin')('exporteert en importeert via zip', async () => {
    const { dir, quiz } = await createQuizDir(join(temp(), 'Zip test'))
    const zip = join(temp(), 'export.zip')
    await exportZip(dir, zip)

    const dest = temp()
    const imported = await importZip(zip, dest)
    expect(basename(imported)).toBe('Zip test.pubquiz')
    expect(await readQuiz(imported)).toEqual(quiz)

    const again = await importZip(zip, dest)
    expect(basename(again)).toBe('Zip test 2.pubquiz')
  })
})
