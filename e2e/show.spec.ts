import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import {
  activeVideo,
  audio as audioOf,
  confirmIn,
  copyFixture,
  launch,
  openStart,
  snap,
  startShow,
  tempDir,
  useWindowedScreens,
  windowFor as windowOf
} from './helpers'

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string

const windowFor = (route: string) => windowOf(app, route)
const audio = () => audioOf(app)

test.beforeAll(async () => {
  userData = tempDir('userdata')
  quizDir = copyFixture()
  ;({ app, operator } = await launch(userData, quizDir))
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
  rmSync(dirname(quizDir), { recursive: true, force: true })
})

test('opent de demo-quiz in de editor', async () => {
  await expect(operator.locator('.topbar .name')).toHaveText('Demo-pubquiz')
  await expect(operator.locator('.sidebar .round')).toHaveCount(4)
  await operator.locator('.sidebar .round').nth(1).click()
  await expect(operator.locator('#round-title')).toHaveValue('Ronde 2: muziek')
  await expect(operator.locator('.track')).toHaveCount(8)
  // De ronde zelf: het fragmentnummer alleen op de gekozen schermen.
  await operator.getByRole('tab', { name: 'Ronde' }).click()
  const numberOn = operator.getByRole('group', { name: 'Fragmentnummer in beeld op' })
  await expect(numberOn.getByLabel('Beamer')).toBeChecked()
  await expect(numberOn.getByLabel('TV bar')).not.toBeChecked()
  await operator.waitForTimeout(800) // previews laten laden voor de screenshot
  await snap(operator, 'test-results/editor-round.png')

  await operator.locator('.track').nth(2).click()
  await expect(operator.getByRole('tab', { name: 'Fragment' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  // De waveform van het hele bestand, met het stuk dat speelt tussen twee grepen.
  const wave = operator.locator('.edit-wave')
  await expect(wave.locator('rect')).toHaveCount(160)
  const begin = wave.getByRole('slider', { name: 'Begin' })
  await expect(begin).toHaveAttribute('aria-valuenow', '0')
  await expect(wave.getByRole('slider', { name: 'Eind' })).toHaveAttribute('aria-valuenow', '83')
  await begin.focus()
  await operator.keyboard.press('ArrowRight')
  await expect
    .poll(
      () =>
        JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8')).rounds[1].fragments[2].start
    )
    .toBe(0.5)
  await expect(operator.locator('.times input').first()).toHaveValue('0:00.5')
  await snap(operator, 'test-results/editor-fragment-open.png')

  await operator.locator('.sidebar .round').first().click()
  await operator.waitForTimeout(600)
  await snap(operator, 'test-results/editor-round-slides.png')

  await operator.getByRole('button', { name: 'Quiz-instellingen' }).click()
  await operator.waitForTimeout(800)
  await snap(operator, 'test-results/editor-setup.png')

  await operator.getByRole('button', { name: /^Media/ }).click()
  await operator.waitForTimeout(500)
  await snap(operator, 'test-results/editor-media.png')
})

test('bereidt de show voor met schermen als venster', async () => {
  await openStart(operator)
  await useWindowedScreens(operator)
  await snap(operator, 'test-results/show-prepare.png')

  // De keuzelijst werkt ook met het toetsenbord: openen, bladeren, Escape laat alles staan.
  const target = operator.locator('.screen .screen-target [role="combobox"]').first()
  await target.focus()
  await operator.keyboard.press('Enter')
  const list = operator.getByRole('listbox')
  await expect(list.getByRole('option', { name: /Venster op deze laptop/ })).toBeFocused()
  await operator.keyboard.press('ArrowUp')
  await expect(list.getByRole('option', { name: 'Uit' })).toBeFocused()
  await operator.waitForTimeout(200)
  await snap(operator, 'test-results/select-open.png')
  await operator.keyboard.press('Escape')
  await expect(list).toHaveCount(0)
  await expect(target).toBeFocused()
  await expect(target).toHaveAttribute('data-value', 'window')
})

test('wisselt scherm tijdens een ronde en valt daarna terug', async () => {
  await startShow(operator)
  await expect(operator.locator('.live')).toBeVisible()

  const beamer = await windowFor('screen/beamer')
  await expect.poll(() => activeVideo(beamer)).toContain('default-loop.mp4')
  // Tijdens de show kun je niet per ongeluk naar het overzicht.
  await expect(operator.getByRole('button', { name: 'Quizzen' })).toBeDisabled()

  await operator.locator('.rounds .round').nth(1).click()
  await expect(operator.locator('.now-title')).toHaveText('Ronde 2: muziek')
  await expect.poll(() => activeVideo(beamer)).toContain('music-loop.mp4')
  await expect(beamer.locator('.slide .title')).toHaveText('Ronde 2')
  // De preview op de laptop volgt mee.
  await expect.poll(() => activeVideo(operator)).toContain('music-loop.mp4')

  await operator.keyboard.press('e')
  await expect.poll(() => activeVideo(beamer)).toContain('default-loop.mp4')
  await expect(beamer.locator('.slide')).toHaveCount(0)
})

test('vult het scherm met de achtergrond en houdt de inhoud 16:9', async () => {
  const beamer = await windowFor('screen/beamer')
  const resize = (width: number, height: number) =>
    app.evaluate(
      ({ BrowserWindow }, size) => {
        const win = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes('#/screen/beamer')
        )!
        win.setAspectRatio(0)
        win.setContentSize(size.width, size.height)
      },
      { width, height }
    )
  const box = async (selector: string) => (await beamer.locator(selector).first().boundingBox())!

  await operator.locator('.rounds .round').nth(1).click()
  await expect(beamer.locator('.slide .title')).toHaveText('Ronde 2')

  // Ultrabreed, zoals een 21:9-monitor: video en dimmen tot in de hoeken, de tekst in het midden.
  await resize(1260, 540)
  await expect.poll(async () => Math.round((await box('.safe')).width)).toBe(960)
  expect((await box('.safe')).x).toBeCloseTo(150, 0)
  expect((await box('.slide')).x).toBeCloseTo(150, 0)
  expect((await box('.layer.on video')).width).toBeCloseTo(1260, 0)
  expect((await box('.slide-backdrop')).width).toBeCloseTo(1260, 0)
  // Na de overvloeier (600 ms), zodat het screenshot het eindbeeld laat zien.
  await beamer.waitForTimeout(800)
  await snap(beamer, 'test-results/screen-ultrawide.png')

  // Hoger, zoals een 4:3-beamer: de inhoud houdt boven en onder ruimte, de video vult alles.
  await resize(720, 540)
  await expect.poll(async () => Math.round((await box('.safe')).height)).toBe(405)
  expect((await box('.safe')).y).toBeCloseTo(67.5, 0)
  expect((await box('.layer.on video')).height).toBeCloseTo(540, 0)

  await resize(960, 540)
  await expect.poll(async () => Math.round((await box('.safe')).height)).toBe(540)
  await operator.keyboard.press('e')
  await expect(beamer.locator('.slide')).toHaveCount(0)
})

test('achtergrondmuziek speelt, pauzeert in een pauze-ronde en duckt in een duck-ronde', async () => {
  await expect.poll(async () => (await audio()).background?.key).toBe('bg@zaal')
  await expect.poll(async () => (await audio()).background?.gain ?? 0).toBeGreaterThan(0.55)
  expect((await audio()).outputs.map((o) => o.state)).toEqual(['running', 'running'])

  await operator.locator('.rounds .round').nth(1).click()
  await expect.poll(async () => (await audio()).background?.playing).toBe(false)

  await operator.locator('.rounds .round').nth(3).click()
  await expect.poll(async () => (await audio()).background?.playing).toBe(true)
  await expect.poll(async () => (await audio()).background?.gain ?? 1).toBeLessThan(0.15)

  await operator.locator('.rounds .round').nth(2).click()
  await expect.poll(async () => (await audio()).background?.key).toBe('bg-break@zaal')

  await operator.keyboard.press('e')
  await expect.poll(async () => (await audio()).background?.key).toBe('bg@zaal')
})

test('serveert media met Range-requests (nodig voor loopen en seeken)', async () => {
  const beamer = await windowFor('screen/beamer')
  const result = await beamer.evaluate(async () => {
    const res = await fetch('pq-media://quiz/media/default-loop.mp4', {
      headers: { Range: 'bytes=100-199' }
    })
    return {
      status: res.status,
      range: res.headers.get('content-range'),
      size: (await res.arrayBuffer()).byteLength
    }
  })
  expect(result.status).toBe(206)
  expect(result.range).toMatch(/^bytes 100-199\/\d+$/)
  expect(result.size).toBe(100)

  const traversal = await beamer.evaluate(
    async () => (await fetch('pq-media://quiz/..%2F..%2Fpackage.json')).status
  )
  expect(traversal).toBe(403)
})

test('beeld- en geluidknoppen zijn terug te draaien', async () => {
  const beamer = await windowFor('screen/beamer')
  await operator.getByRole('button', { name: /Beeld op zwart/ }).click()
  await expect.poll(() => beamer.locator('.layer.on video').count()).toBe(0)
  await operator.getByRole('button', { name: /Geluid uit/ }).click()
  await expect.poll(async () => (await audio()).background?.playing).toBe(false)
  await operator.waitForTimeout(300)
  await snap(operator.locator('.topbar'), 'test-results/show-bar-alert.png')

  await operator.getByRole('button', { name: /Beeld terug/ }).click()
  await expect.poll(() => activeVideo(beamer)).toContain('default-loop.mp4')
  await operator.getByRole('button', { name: /Geluid aan/ }).click()
  await expect.poll(async () => (await audio()).background?.playing).toBe(true)
  await snap(operator.locator('.topbar'), 'test-results/show-bar.png')
})

test('speelt een fragment af tot het einde en markeert het als gespeeld', async () => {
  await operator.locator('.rounds .round').nth(1).click()
  await operator.keyboard.press('1')
  const first = operator.locator('.frag').first()
  await expect(first).toHaveClass(/on/)
  // Ook handmatig staat het nummer in beeld, maar alleen op de gekozen beamer.
  const beamer = await windowFor('screen/beamer')
  const tv = await windowFor('screen/tv')
  await expect(beamer.locator('.overlay .ov-number')).toHaveText('1')
  await expect(tv.locator('.overlay')).toHaveCount(0)
  // De waveform van het fragment loopt mee op de beamer en op de knop.
  await expect(beamer.locator('.ov-wave .base rect')).toHaveCount(48)
  await expect(beamer.locator('.ov-wave .played.running')).toHaveCount(1)
  await expect(first.locator('.frag-wave .played.running')).toHaveCount(1)
  await expect(operator.locator('.frag').nth(1).locator('.frag-wave .base rect')).toHaveCount(40)
  await expect(first.locator('.frag-time')).toContainText('-0:0')
  // Echt aan het spelen in de engine (een decodeerfout zou ook als "afgelopen" tellen).
  await expect.poll(async () => (await audio()).fragment).not.toBeNull()
  await expect(operator.locator('.notice.error')).toHaveCount(0)
  await expect.poll(() => activeVideo(operator)).toContain('music-loop.mp4')
  await operator.waitForTimeout(700) // crossfade en slide-fade afwachten voor de screenshot
  await snap(operator, 'test-results/show-live.png')
  await expect(first).toHaveClass(/played/, { timeout: 10_000 })
  await expect(beamer.locator('.overlay')).toHaveCount(0)
})

test('autoplay toont fragmentnummer en countdown op het scherm', async () => {
  const beamer = await windowFor('screen/beamer')
  await operator.getByRole('button', { name: /Speel reeks/ }).click()
  await expect(beamer.locator('.overlay .ov-number')).toHaveText('2')
  // In de pauze blijft het grote getal het (volgende) fragmentnummer; de seconden staan eronder.
  await expect(beamer.locator('.overlay.countdown')).toBeVisible({ timeout: 10_000 })
  await expect(beamer.locator('.overlay .ov-label')).toHaveText('Volgende')
  await expect(beamer.locator('.overlay .ov-number')).toHaveText('3')
  await expect(beamer.locator('.overlay .ov-count')).toContainText(/over \d s/)
  await beamer.waitForTimeout(1200)
  await snap(beamer, 'test-results/screen-countdown.png')
  await expect(beamer.locator('.overlay .ov-number')).toHaveText('3')
  await operator.getByRole('button', { name: 'Stop reeks' }).click()
  await expect(beamer.locator('.overlay')).toHaveCount(0)
})

test('bladert met de pijltjes door de fragmenten', async () => {
  // Fragment 1 en 2 zijn al gestart (de cijfertoets en de reeks): → gaat verder met 3.
  const frag = (n: number) => operator.locator('.frag').nth(n - 1)
  const help = operator.getByRole('button', { name: 'Sneltoetsen' })
  await help.click()
  await expect(operator.locator('.shortcuts')).toContainText('Vorig of volgend fragment')
  await help.click()
  await expect(operator.locator('.shortcuts')).toHaveCount(0)
  await expect(frag(3)).toHaveClass(/upcoming/)
  await expect(frag(3).locator('.frag-next')).toContainText('Volgende')

  await operator.keyboard.press('ArrowRight')
  await expect(frag(3)).toHaveClass(/on/)
  await expect(frag(4)).toHaveClass(/upcoming/)
  await operator.keyboard.press('ArrowRight')
  await expect(frag(4)).toHaveClass(/on/)
  await expect(frag(3)).not.toHaveClass(/on/)
  await operator.waitForTimeout(300)
  await snap(operator, 'test-results/show-fragment-arrows.png')

  await operator.keyboard.press('ArrowLeft')
  await expect(frag(3)).toHaveClass(/on/)
  await expect(frag(4)).toHaveClass(/upcoming/)
  await operator.keyboard.press(' ')
  await expect(operator.locator('.frag.on')).toHaveCount(0)
})

test('telt af met T op de schermen met het fragmentnummer, en stopt met nog een keer T', async () => {
  // Ronde 2 (muziek) loopt nog; het fragmentnummer staat alleen op de beamer.
  const beamer = await windowFor('screen/beamer')
  const tv = await windowFor('screen/tv')
  await operator.keyboard.press('t')
  await expect(beamer.locator('.overlay.timer')).toBeVisible()
  await expect(beamer.locator('.overlay .ov-label')).toHaveText('Nog')
  await expect(beamer.locator('.overlay .ov-number')).toHaveText(/^(30|29|28)$/)
  await expect(tv.locator('.overlay')).toHaveCount(0)
  const button = operator.getByRole('button', { name: /Stop aftellen/ })
  await expect(button).toBeVisible()
  await beamer.waitForTimeout(700) // infaden afwachten voor de screenshot
  await beamer.screenshot({ path: 'test-results/screen-timer.png' })
  await operator.locator('.topbar').screenshot({ path: 'test-results/show-bar-timer.png' })

  await operator.keyboard.press('t')
  await expect(beamer.locator('.overlay')).toHaveCount(0)
  await expect(operator.getByRole('button', { name: /^Aftellen/ })).toBeVisible()
})

test('stoppen en afsluiten vragen het eerst, in een venster van de app', async () => {
  const round = await operator.locator('.now-title').textContent()
  await operator.getByRole('button', { name: 'Stop show' }).click()
  const stop = operator.getByRole('dialog', { name: 'Show stoppen?' })
  // Niet terug te draaien: de focus staat op Annuleer.
  await expect(stop.getByRole('button', { name: 'Annuleer' })).toBeFocused()
  await operator.waitForTimeout(200) // infaden afwachten voor de screenshot
  await snap(operator, 'test-results/confirm-stop.png')
  // Enter is dan voor het venster, niet "volgende ronde".
  await operator.keyboard.press('Enter')
  await expect(stop).toHaveCount(0)
  await expect(operator.locator('.now-title')).toHaveText(round!)
  await expect(operator.locator('.live')).toBeVisible()

  // Afsluiten tijdens de show: main vraagt het via de app.
  await app.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('pq:confirm-quit')
  })
  const quit = operator.getByRole('dialog', { name: 'De show loopt nog' })
  await expect(quit.getByRole('button', { name: 'Afsluiten' })).toBeVisible()
  await operator.keyboard.press('Escape')
  await expect(quit).toHaveCount(0)
  await expect(operator.locator('.live')).toBeVisible()
})

test('stop show sluit de schermen', async () => {
  await operator.getByRole('button', { name: 'Stop show' }).click()
  await confirmIn(operator, 'Stop show')
  await expect.poll(() => app.windows().some((w) => w.url().includes('#/screen/'))).toBe(false)
})
