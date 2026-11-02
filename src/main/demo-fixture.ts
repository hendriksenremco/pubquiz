import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import type { Locale } from '@shared/i18n'

/**
 * Verse quiz.json uit het demo-script, voor tests. Niet de fixture op schijf lezen:
 * die kan in een draaiende dev-app open staan en gewijzigd zijn.
 */
export function freshDemoQuiz(): unknown {
  return freshQuiz('make-demo.mjs')
}

/** Zelfde voor de rondleiding, in het Nederlands of het Engels. */
export function freshTourQuiz(locale: Locale = 'nl'): unknown {
  return freshQuiz('make-tour.mjs', ['--locale', locale])
}

function freshQuiz(scriptName: string, args: string[] = []): unknown {
  const dir = mkdtempSync(join(tmpdir(), 'pubquiz-demo-'))
  try {
    const script = resolve(__dirname, '../../scripts', scriptName)
    execFileSync(process.execPath, [script, '--quiz-only', dir, ...args])
    return JSON.parse(readFileSync(join(dir, 'quiz.json'), 'utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
