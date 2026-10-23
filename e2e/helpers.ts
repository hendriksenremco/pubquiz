import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { execFileSync } from 'child_process'
import { cpSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const root = resolve(__dirname, '..')

export function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `pubquiz-${prefix}-`))
}

/**
 * Kopie van de demo-quiz met een verse quiz.json uit het demo-script, zodat tests niet
 * afhangen van wat er (bv. in een draaiende dev-app) aan de fixture is gewijzigd.
 */
export function copyFixture(): string {
  const target = join(tempDir('quiz'), 'demo.pubquiz')
  cpSync(join(root, 'fixtures', 'demo.pubquiz', 'media'), join(target, 'media'), {
    recursive: true
  })
  execFileSync(process.execPath, [join(root, 'scripts', 'make-demo.mjs'), '--quiz-only', target])
  return target
}

export async function launch(
  userData: string,
  quizDir?: string,
  extraEnv: Record<string, string> = {}
) {
  // Editors als VS Code zetten ELECTRON_RUN_AS_NODE; dan start Electron als kale Node.
  const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env
  const app = await electron.launch({
    args: [join(root, 'out/main/index.js'), ...(quizDir ? [quizDir] : [])],
    env: {
      ...env,
      PUBQUIZ_USER_DATA: userData,
      PUBQUIZ_LIBRARY: join(userData, 'Pubquiz'),
      PUBQUIZ_MUTE: '1',
      // Onzichtbaar testen; PUBQUIZ_HEADED=1 pnpm test:e2e laat de vensters wel zien.
      ...(process.env['PUBQUIZ_HEADED'] ? {} : { PUBQUIZ_HEADLESS: '1' }),
      ...extraEnv
    } as Record<string, string>
  })
  const operator = await windowFor(app, 'operator')
  await operator.waitForLoadState('domcontentloaded')
  return { app, operator }
}

export async function windowFor(app: ElectronApplication, route: string): Promise<Page> {
  const find = () => app.windows().find((w) => w.url().includes(`#/${route}`))
  await expect.poll(() => find() !== undefined).toBe(true)
  return find()!
}

/** Bestandsnaam van de zichtbare video in een venster. */
export function activeVideo(page: Page) {
  return page.locator('.layer.on video').first().getAttribute('src')
}

export interface AudioSnapshot {
  background: { key: string; playing: boolean; gain: number } | null
  fragment: string | null
  outputs: { id: string; sinkId: string; state: string }[]
}

/** Toestand van de audio-engine in het verborgen audiovenster. */
export async function audio(app: ElectronApplication): Promise<AudioSnapshot> {
  const page = await windowFor(app, 'audio')
  return page.evaluate(() =>
    (
      window as unknown as { __pubquizAudio: { debugSnapshot(): AudioSnapshot } }
    ).__pubquizAudio.debugSnapshot()
  )
}

/** Zet alle scherm-slots op "venster op deze laptop", zodat tests geen externe displays overnemen. */
export async function useWindowedScreens(operator: Page) {
  for (const select of await operator.locator('.screen select.screen-target').all()) {
    await select.selectOption('window')
  }
}
