import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { constants, createReadStream, promises as fs } from 'fs'
import { basename, extname, join, relative, sep } from 'path'
import { promisify } from 'util'
import { createQuiz, mediaKindForFile, newId } from '@shared/factory'
import type { ImportResult, RecentQuiz } from '@shared/ipc'
import { naturalCompare } from '@shared/media-folders'
import { migrateQuiz } from '@shared/migrate'
import { quizFromTemplate, type TemplateOptions } from '@shared/template'
import type { MediaAsset, Quiz } from '@shared/types'
import { readJson, writeJson } from './json-store'

const run = promisify(execFile)

export const QUIZ_EXT = '.pubquiz'
const QUIZ_FILE = 'quiz.json'
const MEDIA_DIR = 'media'

export function withQuizExtension(path: string): string {
  return path.endsWith(QUIZ_EXT) ? path : path + QUIZ_EXT
}

export async function isQuizDir(path: string): Promise<boolean> {
  return fs
    .stat(join(path, QUIZ_FILE))
    .then((s) => s.isFile())
    .catch(() => false)
}

export async function readQuiz(dir: string): Promise<Quiz> {
  const raw = await readJson<unknown>(join(dir, QUIZ_FILE))
  if (raw === null) throw new Error(`Geen leesbare ${QUIZ_FILE} gevonden in ${dir}`)
  return migrateQuiz(raw)
}

export function writeQuiz(dir: string, quiz: Quiz): Promise<void> {
  return writeJson(join(dir, QUIZ_FILE), quiz)
}

/** Mapnaam voor een quiz: tekens die macOS of USB-sticks niet lusten worden vervangen. */
export function folderNameFor(title: string): string {
  return title
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim()
}

/** Maakt een lege quizmap; weigert als er op die plek al iets staat. */
async function makeQuizDir(path: string): Promise<string> {
  const dir = withQuizExtension(path)
  const exists = await fs.stat(dir).then(
    () => true,
    () => false
  )
  if (exists) throw new Error(`Er bestaat al een quiz met de naam "${basename(dir, QUIZ_EXT)}"`)
  await fs.mkdir(join(dir, MEDIA_DIR), { recursive: true })
  return dir
}

export async function createQuizDir(
  path: string,
  title?: string
): Promise<{ dir: string; quiz: Quiz }> {
  const dir = await makeQuizDir(path)
  const quiz = createQuiz(title ?? basename(dir, QUIZ_EXT))
  await writeQuiz(dir, quiz)
  return { dir, quiz }
}

/**
 * Nieuwe quiz op basis van een bestaande (zie quizFromTemplate). Alleen de media die de nieuwe
 * quiz gebruikt wordt gekopieerd, als APFS-clone: direct klaar en zonder extra schijfruimte.
 */
export async function createQuizFromTemplate(
  source: string,
  path: string,
  options: TemplateOptions,
  title?: string
): Promise<{ dir: string; quiz: Quiz }> {
  const original = await readQuiz(source)
  const dir = await makeQuizDir(path)
  const quiz = quizFromTemplate(original, title ?? basename(dir, QUIZ_EXT), options)
  await Promise.all(
    quiz.assets.map((asset) =>
      fs
        .copyFile(join(source, asset.file), join(dir, asset.file), constants.COPYFILE_FICLONE)
        // Ontbrekend bronbestand: de controle bij Show meldt het, de rest gaat gewoon door.
        .catch(() => undefined)
    )
  )
  await writeQuiz(dir, quiz)
  return { dir, quiz }
}

/** Samenvatting voor het home-dashboard; ook voor quizzen die verplaatst of kapot zijn. */
export async function summarizeQuiz(dir: string): Promise<Omit<RecentQuiz, 'tour'>> {
  const missing: Omit<RecentQuiz, 'tour'> = {
    path: dir,
    exists: false,
    title: basename(dir, QUIZ_EXT),
    rounds: 0,
    screens: 0,
    modifiedAt: null,
    cover: null
  }
  try {
    const [quiz, stat] = await Promise.all([readQuiz(dir), fs.stat(join(dir, QUIZ_FILE))])
    const content = quiz.screens[0]?.default
    const asset =
      content && content.type !== 'black'
        ? quiz.assets.find((a) => a.id === content.assetId)
        : undefined
    return {
      path: dir,
      exists: true,
      title: quiz.title || missing.title,
      rounds: quiz.rounds.length,
      screens: quiz.screens.length,
      modifiedAt: stat.mtimeMs,
      cover:
        asset && (asset.kind === 'video' || asset.kind === 'image')
          ? { kind: asset.kind, file: asset.file }
          : null
    }
  } catch {
    return missing
  }
}

/** Ontbrekende mediabestanden, als relatieve paden. */
export async function findMissingMedia(dir: string, quiz: Quiz): Promise<string[]> {
  const missing: string[] = []
  await Promise.all(
    quiz.assets.map(async (asset) => {
      const ok = await fs
        .access(join(dir, asset.file), constants.R_OK)
        .then(() => true)
        .catch(() => false)
      if (!ok) missing.push(asset.name)
    })
  )
  return missing
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex').slice(0, 20)))
  })
}

/** Kopieert één bestand naar `media/` onder een content-hash-naam; null als het geen media is. */
async function importOne(dir: string, source: string): Promise<MediaAsset | null> {
  const name = basename(source)
  const kind = mediaKindForFile(name)
  if (!kind) return null
  const file = `${MEDIA_DIR}/${await hashFile(source)}${extname(name).toLowerCase()}`
  const target = join(dir, file)
  const exists = await fs
    .access(target)
    .then(() => true)
    .catch(() => false)
  if (!exists) await fs.copyFile(source, target, constants.COPYFILE_FICLONE)
  return { id: newId(), kind, file, name }
}

/** Alle mediabestanden in een map (ook submappen), op natuurlijke volgorde van hun pad. */
async function listMediaFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && !e.name.startsWith('.') && mediaKindForFile(e.name))
    .map((e) => join(e.parentPath, e.name))
    .filter(
      (path) =>
        !relative(root, path)
          .split(sep)
          .some((part) => part.startsWith('.'))
    )
    .sort((a, b) => naturalCompare(relative(root, a), relative(root, b)))
}

/**
 * Kopieert bestanden naar `media/` onder een content-hash-naam (ASCII, dedupliceert,
 * geen NFC/NFD- of hoofdletterproblemen op USB-sticks). De oorspronkelijke naam blijft in `name`.
 * Een map wordt in z'n geheel geïmporteerd (niet-media erin wordt stil overgeslagen) en komt
 * in `folders` terug, zodat de renderer er een quizmap van kan maken.
 */
export async function importMediaFiles(dir: string, paths: string[]): Promise<ImportResult> {
  const result: ImportResult = { assets: [], skipped: [], folders: [] }
  await fs.mkdir(join(dir, MEDIA_DIR), { recursive: true })

  for (const source of paths) {
    const stat = await fs.stat(source).catch(() => null)
    if (stat?.isDirectory()) {
      const assetIds: string[] = []
      for (const file of await listMediaFiles(source)) {
        const asset = await importOne(dir, file)
        if (!asset) continue
        result.assets.push(asset)
        assetIds.push(asset.id)
      }
      if (assetIds.length) result.folders.push({ name: basename(source), assetIds })
      else result.skipped.push(`${basename(source)} (geen media)`)
      continue
    }
    const asset = stat?.isFile() ? await importOne(dir, source) : null
    if (asset) result.assets.push(asset)
    else result.skipped.push(basename(source))
  }
  return result
}

/** Zip-export via macOS `ditto`, zodat cloud-drives en mail het package niet platslaan. */
export async function exportZip(dir: string, target: string): Promise<void> {
  await run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', dir, target])
}

/** Pakt een zip uit naast `destParent` en geeft het pad van de quizmap terug. */
export async function importZip(zip: string, destParent: string): Promise<string> {
  const staging = join(destParent, `.pubquiz-import-${Date.now()}`)
  await fs.mkdir(staging, { recursive: true })
  try {
    await run('ditto', ['-x', '-k', zip, staging])
    const found = await findQuizDir(staging)
    if (!found) throw new Error('Geen quiz gevonden in dit zip-bestand')

    let target = join(destParent, withQuizExtension(basename(found, QUIZ_EXT)))
    for (
      let n = 2;
      await fs.access(target).then(
        () => true,
        () => false
      );
      n++
    ) {
      target = join(destParent, `${basename(found, QUIZ_EXT)} ${n}${QUIZ_EXT}`)
    }
    await fs.rename(found, target)
    return target
  } finally {
    await fs.rm(staging, { recursive: true, force: true })
  }
}

async function findQuizDir(root: string, depth = 0): Promise<string | null> {
  if (await isQuizDir(root)) return root
  if (depth > 2) return null
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '__MACOSX') continue
    const found = await findQuizDir(join(root, entry.name), depth + 1)
    if (found) return found
  }
  return null
}
