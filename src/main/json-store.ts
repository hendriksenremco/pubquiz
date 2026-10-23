import { promises as fs } from 'fs'
import { dirname, join } from 'path'

/** Schrijft eerst naar een tijdelijk bestand en hernoemt dan, zodat een crash nooit een half bestand achterlaat. */
export async function writeFileAtomic(path: string, data: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true })
  const tmp = join(dirname(path), `.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`)
  await fs.writeFile(tmp, data, 'utf8')
  await fs.rename(tmp, path)
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8')) as T
  } catch {
    return null
  }
}

export function writeJson(path: string, data: unknown): Promise<void> {
  return writeFileAtomic(path, JSON.stringify(data, null, 2) + '\n')
}
