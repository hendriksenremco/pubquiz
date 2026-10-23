import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

/**
 * Verse quiz.json uit het demo-script, voor tests. Niet de fixture op schijf lezen:
 * die kan in een draaiende dev-app open staan en gewijzigd zijn.
 */
export function freshDemoQuiz(): unknown {
  const dir = mkdtempSync(join(tmpdir(), 'pubquiz-demo-'))
  try {
    const script = resolve(__dirname, '../../scripts/make-demo.mjs')
    execFileSync(process.execPath, [script, '--quiz-only', dir])
    return JSON.parse(readFileSync(join(dir, 'quiz.json'), 'utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
