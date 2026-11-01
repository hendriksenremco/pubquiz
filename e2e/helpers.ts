import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Locator,
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
  return copyQuiz('demo.pubquiz', 'make-demo.mjs')
}

/** De rondleiding zoals `pnpm tour` hem maakt; de app zet hem bij de eerste start klaar. */
export const tourFixture = join(root, 'fixtures', 'rondleiding.pubquiz')

/** Zelfde voor de rondleiding (fixtures/rondleiding.pubquiz, gemaakt met `pnpm tour`). */
export function copyTour(): string {
  return copyQuiz('rondleiding.pubquiz', 'make-tour.mjs')
}

function copyQuiz(folder: string, script: string): string {
  const target = join(tempDir('quiz'), folder)
  cpSync(join(root, 'fixtures', folder, 'media'), join(target, 'media'), { recursive: true })
  execFileSync(process.execPath, [join(root, 'scripts', script), '--quiz-only', target])
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
      // Geen rondleiding op het dashboard, behalve in de test die erom gaat.
      PUBQUIZ_TOUR: '',
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

/** Beantwoordt de vraag in het bevestigingsvenster van de app (ConfirmHost). */
export async function confirmIn(page: Page, button: string) {
  await page.getByRole('dialog').getByRole('button', { name: button, exact: true }).click()
}

/** Kiest een optie in een keuzelijst van de app (Select.vue). */
export async function choose(page: Page, combobox: Locator, option: string | RegExp) {
  await combobox.click()
  await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click()
}

/** Opent het venster "Show starten" met de knop in de werkbalk. */
export async function openStart(page: Page): Promise<Locator> {
  await page.locator('.topbar').getByRole('button', { name: 'Start show' }).click()
  const sheet = page.getByRole('dialog', { name: 'Show starten' })
  await expect(sheet).toBeVisible()
  return sheet
}

/** Start de show vanuit het venster "Show starten". */
export async function startShow(page: Page) {
  await page
    .getByRole('dialog', { name: 'Show starten' })
    .getByRole('button', { name: 'Start show' })
    .click()
  await expect(page.locator('.live')).toBeVisible()
}

/** Zet alle scherm-slots op "venster op deze laptop", zodat tests geen externe displays overnemen. */
export async function useWindowedScreens(operator: Page) {
  for (const box of await operator.locator('.screen .screen-target [role="combobox"]').all()) {
    await choose(operator, box, 'Venster op deze laptop (om te testen)')
  }
}

/**
 * Screenshot voor test-results/, dat bij elke run hetzelfde is zolang het scherm niet verandert.
 * De CI vergelijkt deze screenshots tussen master en een pull request (scripts/screenshot-diff.sh).
 *
 * - Video's staan even stil op het eerste beeld en lopen daarna verder.
 * - CSS-animaties staan uit (Playwright zet ze op hun eindstand).
 * - Wat vanzelf verandert (tijdelijke paden, de QR-code, aftellers) is gemarkeerd met
 *   `data-volatile` in de app en wordt afgedekt.
 */
export async function snap(
  target: Page | Locator,
  path: string,
  options: { fullPage?: boolean } = {}
) {
  const page = 'page' in target ? target.page() : target
  await page.evaluate(freezeVideos)
  try {
    await target.screenshot({
      path,
      ...options,
      animations: 'disabled',
      caret: 'hide',
      mask: [page.locator('[data-volatile]')],
      maskColor: '#3a4150'
    })
  } finally {
    await page.evaluate(resumeVideos).catch(() => {})
  }
}

type FrozenWindow = Window & { __pubquizFrozen?: HTMLVideoElement[] }

/** Draait in de pagina: zet elke video op het eerste beeld en onthoudt welke speelden. */
async function freezeVideos() {
  const wait = (video: HTMLVideoElement, event: string) =>
    new Promise<void>((done) => {
      const timer = setTimeout(done, 2000)
      video.addEventListener(event, () => (clearTimeout(timer), done()), { once: true })
    })
  const videos = Array.from(document.querySelectorAll('video'))
  ;(window as FrozenWindow).__pubquizFrozen = videos.filter((v) => !v.paused)
  await Promise.all(
    videos.map(async (video) => {
      video.pause()
      if (!video.currentSrc) return
      if (video.readyState < 2) await wait(video, 'loadeddata')
      if (video.currentTime === 0) return
      const seeked = wait(video, 'seeked')
      video.currentTime = 0
      await seeked
    })
  )
  // Twee frames, zodat het stilgezette beeld echt getekend is.
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
}

/** Draait in de pagina: laat de video's die speelden weer lopen. */
function resumeVideos() {
  const w = window as FrozenWindow
  for (const video of w.__pubquizFrozen ?? []) void video.play().catch(() => {})
  delete w.__pubquizFrozen
}
