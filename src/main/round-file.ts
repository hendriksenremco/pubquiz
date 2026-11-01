import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { DraftError } from '@shared/draft'
import { mediaKindForFile, newId } from '@shared/factory'
import type { Locale } from '@shared/i18n'
import {
  addRounds,
  isSafeZipPath,
  parseRoundFile,
  ROUND_FILE_JSON,
  ROUND_FILE_MAX_BYTES,
  roundFileMedia,
  RoundFileError,
  type RoundImport
} from '@shared/round-file'
import type { MediaAsset, Quiz } from '@shared/types'
import { NoticeError } from './messages'
import { importMediaFiles } from './quiz-files'
import { readZip, ZipError, type ZipEntry } from './zip'

/**
 * Leest een rondebestand (issue #99) en kopieert zijn media naar de quiz in `quizDir`. Alles wordt
 * eerst nagekeken, ook of de rondes in deze quiz passen (`at` is de plek), zodat een fout bestand
 * niets achterlaat. Fouten zijn een `NoticeError`.
 */
export async function readRoundFile(
  path: string,
  quizDir: string,
  quiz: Quiz,
  at: number,
  locale: Locale
): Promise<RoundImport> {
  try {
    const stat = await fs.stat(path)
    if (stat.size > ROUND_FILE_MAX_BYTES) throw new RoundFileError('roundFileTooBig')

    const entries = readZip(await fs.readFile(path))
    const unsafe = entries.find((e) => !isSafeZipPath(e.name))
    if (unsafe) throw new RoundFileError('unsafeRoundPath', { file: unsafe.name })
    const byName = new Map(entries.map((e) => [e.name, e]))

    const json = byName.get(ROUND_FILE_JSON)
    if (!json) throw new RoundFileError('notRoundFile')
    const drafts = parseRoundFile(json.read().toString('utf8'))

    const files = roundFileMedia(drafts).map((f) => {
      const entry = byName.get(f.path)
      if (!entry) throw new RoundFileError('missingRoundMedia', { file: f.path })
      if (mediaKindForFile(f.path) !== f.kind) {
        throw new RoundFileError(f.kind === 'audio' ? 'notAudio' : 'notAPicture', {
          file: basename(f.path)
        })
      }
      return { ...f, entry }
    })

    // Proef: passen de rondes in deze quiz? Op een kopie, met nep-bestanden.
    const fake: Record<string, MediaAsset> = {}
    for (const f of files) {
      fake[f.path] = { id: newId(), kind: f.kind, file: f.path, name: basename(f.path) }
    }
    addRounds(structuredClone(quiz), drafts, fake, at, locale)

    return { file: basename(path), drafts, assets: await importEntries(quizDir, files) }
  } catch (err) {
    throw asNotice(err)
  }
}

/** Pakt de bestanden uit in een tijdelijke map en importeert ze; de naam blijft die in de zip. */
async function importEntries(
  quizDir: string,
  files: { path: string; entry: ZipEntry }[]
): Promise<Record<string, MediaAsset>> {
  const temp = await fs.mkdtemp(join(tmpdir(), 'quiznote-ronde-'))
  try {
    const assets: Record<string, MediaAsset> = {}
    for (const [i, f] of files.entries()) {
      const dir = join(temp, String(i))
      await fs.mkdir(dir)
      const source = join(dir, basename(f.path))
      await fs.writeFile(source, f.entry.read())
      const [asset] = (await importMediaFiles(quizDir, [source])).assets
      if (!asset) throw new RoundFileError('missingRoundMedia', { file: f.path })
      assets[f.path] = asset
    }
    return assets
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
}

function asNotice(err: unknown): Error {
  if (err instanceof NoticeError) return err
  if (err instanceof RoundFileError) return new NoticeError(err.key, err.params)
  if (err instanceof ZipError) return new NoticeError('notRoundFile')
  if (err instanceof DraftError) return new NoticeError('invalidRoundFile', { error: err.message })
  if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
    return new NoticeError('notRoundFile')
  }
  return err instanceof Error ? err : new Error(String(err))
}
