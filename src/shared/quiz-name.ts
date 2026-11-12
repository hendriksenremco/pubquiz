/** Extensie van nieuwe quizzen (issue #43). */
export const QUIZ_EXT = '.quiznote'
/** De oude werknaam: zulke quizzen blijven gewoon open te maken. */
export const LEGACY_QUIZ_EXT = '.pubquiz'
const QUIZ_EXTS = [QUIZ_EXT, LEGACY_QUIZ_EXT]

/** Heeft het pad de extensie van een quiz, nieuw of oud (ook met een `/` erachter)? */
export function hasQuizExtension(path: string): boolean {
  const trimmed = path.replace(/\/+$/, '')
  return QUIZ_EXTS.some((ext) => trimmed.endsWith(ext))
}

/** Naam van een quizmap zonder extensie: `Vrijdag.quiznote` en `Vrijdag.pubquiz` worden `Vrijdag`. */
export function quizBaseName(path: string): string {
  const name = path.replace(/\/+$/, '').split('/').pop() ?? ''
  const ext = QUIZ_EXTS.find((e) => name.endsWith(e))
  return ext ? name.slice(0, -ext.length) : name
}

/**
 * De titel van een quiz zoals de bediening hem toont (werkbalk, venster, telefoon): een lege titel
 * wordt de naam van de map, zoals op het startscherm.
 */
export function quizTitle(title: string, dir: string | null): string {
  return title.trim() || (dir ? quizBaseName(dir) : '')
}
