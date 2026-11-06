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

/**
 * Zelfde voor de rondleiding, gemaakt met `pnpm tour`: fixtures/rondleiding.pubquiz, of in het
 * Engels fixtures/tour.pubquiz.
 */
export function copyTour(locale: 'nl' | 'en' = 'nl'): string {
  return locale === 'en'
    ? copyQuiz('tour.pubquiz', 'make-tour.mjs', ['--locale', 'en'])
    : copyQuiz('rondleiding.pubquiz', 'make-tour.mjs')
}

function copyQuiz(folder: string, script: string, args: string[] = []): string {
  const target = join(tempDir('quiz'), folder)
  cpSync(join(root, 'fixtures', folder, 'media'), join(target, 'media'), { recursive: true })
  execFileSync(process.execPath, [join(root, 'scripts', script), '--quiz-only', target, ...args])
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
      // De tests kijken naar Nederlandse teksten, ook op een Mac in het Engels (zoals de CI).
      PUBQUIZ_LOCALE: 'nl',
      ...extraEnv
    } as Record<string, string>
  })
  await reportTrouble(app)
  const operator = await windowFor(app, 'operator')
  await operator.waitForLoadState('domcontentloaded')
  return { app, operator }
}

/**
 * Zet in de testuitvoer wanneer een proces van Electron wegvalt of een mediabestand niet laadt.
 * Zonder dit is een test die af en toe vastloopt achteraf niet te verklaren.
 */
async function reportTrouble(app: ElectronApplication) {
  app.process().stderr?.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (line.includes('[process-gone]')) console.log(line)
    }
  })
  await app.evaluate(({ app: electronApp }) => {
    const report = (details: { reason: string }, kind: string) => {
      if (details.reason !== 'clean-exit') {
        console.error('[process-gone]', kind, JSON.stringify(details))
      }
    }
    electronApp.on('child-process-gone', (_event, details) => report(details, 'child'))
    electronApp.on('render-process-gone', (_event, _contents, details) =>
      report(details, 'renderer')
    )
  })
  const watch = (page: Page) => {
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText
      // Een video die uit beeld gaat, breekt zijn verzoek af; dat is geen fout.
      if (request.url().startsWith('pq-media:') && reason !== 'net::ERR_ABORTED') {
        console.log(`[media] ${reason}: ${request.url()}`)
      }
    })
    page.on('response', (response) => {
      if (response.url().startsWith('pq-media:') && response.status() >= 400) {
        console.log(`[media] ${response.status()}: ${response.url()}`)
      }
    })
  }
  app.windows().forEach(watch)
  app.on('window', watch)
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

/** Opent het venster "Start show" met de knop in de werkbalk. */
export async function openStart(page: Page): Promise<Locator> {
  await page.locator('.topbar').getByRole('button', { name: 'Start show' }).click()
  const sheet = page.getByRole('dialog', { name: 'Start show' })
  await expect(sheet).toBeVisible()
  return sheet
}

/** Start de show vanuit het venster "Start show". */
export async function startShow(page: Page) {
  await page
    .getByRole('dialog', { name: 'Start show' })
    .getByRole('button', { name: 'Start show' })
    .click()
  await expect(page.locator('.live')).toBeVisible()
}

/** Zet alle scherm-slots op "venster op deze laptop", zodat tests geen externe displays overnemen. */
export async function useWindowedScreens(
  operator: Page,
  label = 'Venster op deze laptop (om te testen)'
) {
  for (const box of await operator.locator('.screen .screen-target [role="combobox"]').all()) {
    await choose(operator, box, label)
  }
}

/**
 * Sluit alle meldingen. Ze verdwijnen vanzelf na een paar seconden, dus zonder dit staan ze soms
 * wel en soms niet op een screenshot.
 */
export async function clearNotices(page: Page) {
  for (const close of await page.locator('.notice button').all()) {
    await close.click({ timeout: 1000 }).catch(() => {})
  }
  await expect(page.locator('.notice')).toHaveCount(0)
}

/**
 * Screenshot voor test-results/, dat bij elke run hetzelfde is zolang het scherm niet verandert.
 * De CI vergelijkt deze screenshots tussen master en een pull request (scripts/screenshot-diff.sh).
 *
 * - Video's staan even stil op het eerste beeld en lopen daarna verder. Zolang staat er een canvas
 *   met dat beeld op hun plek: een verborgen venster tekent een gezocht videobeeld niet altijd.
 * - Afbeeldingen staan zolang ook op een canvas: de browser schaalt een afbeelding niet elke keer
 *   even scherp, en dan verschillen de randen van bijvoorbeeld een logo.
 * - CSS-animaties staan uit (Playwright zet ze op hun eindstand).
 * - Wat vanzelf verandert (tijdelijke paden, de QR-code, aftellers) is gemarkeerd met
 *   `data-volatile` in de app en wordt afgedekt. Wat alleen in een test wisselt
 *   (het adres van een nep-apparaat, "Bewerkt zojuist"), geef je mee als `mask`. Wat verborgen
 *   is, krijgt geen vlak: `:visible`.
 */
export async function snap(
  target: Page | Locator,
  path: string,
  options: { fullPage?: boolean; mask?: Locator[] } = {}
) {
  const { mask = [], ...screenshot } = options
  const page = 'page' in target ? target.page() : target
  await page.evaluate(freezeVideos, MEDIA_EVENTS)
  try {
    await target.screenshot({
      path,
      ...screenshot,
      animations: 'disabled',
      caret: 'hide',
      mask: [page.locator('[data-volatile]:visible'), ...mask],
      maskColor: '#3a4150'
    })
  } finally {
    await page.evaluate(resumeVideos, MEDIA_EVENTS).catch(() => {})
  }
}

type FrozenWindow = Window & {
  __pubquizFrozen?: {
    playing: HTMLVideoElement[]
    block: (e: Event) => void
    painted: { element: HTMLElement; canvas: HTMLCanvasElement; display: string }[]
  }
}

/** Media-events die de app niet mag zien terwijl een video voor de screenshot stilstaat. */
const MEDIA_EVENTS = ['pause', 'play', 'playing', 'seeking', 'seeked', 'timeupdate', 'waiting']

/**
 * Draait in de pagina: zet elke video op het eerste beeld, onthoudt welke speelden en zet video's
 * en afbeeldingen op een canvas. De app merkt er niets van: de media-events worden op `window`
 * afgevangen (capture), anders stopt bijvoorbeeld een voorbeeld dat op `pause` reageert.
 */
async function freezeVideos(events: string[]) {
  const until = async (ready: () => boolean) => {
    for (let i = 0; i < 100 && !ready(); i++) await new Promise((r) => setTimeout(r, 20))
  }
  // Laadt de media niet, dan kan dit altijd blijven wachten, en page.evaluate heeft geen time-out.
  const atMost = (work: Promise<unknown>) =>
    Promise.race([work, new Promise((done) => setTimeout(done, 2000))])
  // Een video die net play() kreeg, eerst echt laten starten: pauzeren breekt de belofte van
  // play() af, en dan stopt bijvoorbeeld een voorbeeld in de mediabibliotheek.
  const started = Array.from(document.querySelectorAll('video')).filter((v) => !v.paused)
  await Promise.all(started.map((v) => until(() => v.readyState >= 3)))
  await new Promise((r) => setTimeout(r, 50))

  const block = (e: Event) => {
    if (e.target instanceof HTMLVideoElement) e.stopImmediatePropagation()
  }
  for (const name of events) window.addEventListener(name, block, true)
  const videos = Array.from(document.querySelectorAll('video'))
  const frozen = {
    playing: videos.filter((v) => !v.paused),
    block,
    painted: [] as NonNullable<FrozenWindow['__pubquizFrozen']>['painted']
  }
  ;(window as FrozenWindow).__pubquizFrozen = frozen
  await Promise.all(
    videos.map(async (video) => {
      video.pause()
      if (!video.currentSrc) return
      // Niet wachten op beeld vóór het zoeken: een tegeltje met preload="metadata" laadt dat pas
      // als het zoekt, en begint op #t=1.
      await until(() => video.readyState >= 1)
      if (video.currentTime !== 0) {
        // Klaar met zoeken wil nog niet zeggen dat het beeld op het scherm staat; dat meldt
        // alleen de frame-callback. Die komt niet altijd in een verborgen venster, dus met een
        // grens.
        const shown = new Promise<void>((done) => {
          video.requestVideoFrameCallback(() => done())
          setTimeout(done, 1000)
        })
        video.currentTime = 0
        await shown
      }
      await until(() => !video.seeking && video.readyState >= 2)
    })
  )
  // Het beeld op een canvas, op dezelfde plek in de pagina: drawImage pakt het gezochte beeld,
  // ook als het venster het nog niet op het scherm heeft gezet.
  const copied =
    'display position top right bottom left width height margin object-fit object-position ' +
    'opacity filter border-radius z-index transform'
  const paint = (element: HTMLVideoElement | HTMLImageElement, width: number, height: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')?.drawImage(element, 0, 0)
    const computed = getComputedStyle(element)
    for (const name of copied.split(' ')) {
      canvas.style.setProperty(name, computed.getPropertyValue(name))
    }
    element.before(canvas)
    frozen.painted.push({ element, canvas, display: element.style.display })
    element.style.display = 'none'
  }
  for (const video of videos) {
    if (video.readyState >= 2 && video.videoWidth) {
      paint(video, video.videoWidth, video.videoHeight)
    }
  }
  // Wat toch wordt afgedekt (de QR-code) blijft staan, anders verdwijnt het masker.
  const images = Array.from(document.querySelectorAll('img')).filter(
    (img) => !img.closest('[data-volatile]')
  )
  await atMost(Promise.all(images.map((img) => img.decode().catch(() => {}))))
  for (const img of images) {
    if (img.naturalWidth) paint(img, img.naturalWidth, img.naturalHeight)
  }
  // Twee frames, zodat het stilgezette beeld echt getekend is.
  await atMost(new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
}

/** Draait in de pagina: laat de video's die speelden weer lopen en geeft de events weer door. */
async function resumeVideos(events: string[]) {
  const w = window as FrozenWindow
  const frozen = w.__pubquizFrozen
  if (!frozen) return
  delete w.__pubquizFrozen
  for (const { element, canvas, display } of frozen.painted) {
    element.style.display = display
    canvas.remove()
  }
  // play() blijft wachten zolang er geen beeld binnenkomt, en page.evaluate heeft geen time-out.
  await Promise.race([
    Promise.all(frozen.playing.map((video) => video.play().catch(() => {}))),
    new Promise((done) => setTimeout(done, 2000))
  ])
  for (const name of events) window.removeEventListener(name, frozen.block, true)
}
