import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { rmSync } from 'fs'
import { dirname } from 'path'
import {
  confirmIn,
  copyFixture,
  launch,
  openStart,
  startShow,
  tempDir,
  useWindowedScreens,
  windowFor
} from './helpers'

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string

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

/** Geluid van de zichtbare video in een screen-venster. */
function sound(page: Page) {
  return page
    .locator('.layer.on video')
    .first()
    .evaluate((v: HTMLVideoElement) => ({
      muted: v.muted,
      volume: Math.round(v.volume * 100) / 100,
      sinkId: v.sinkId
    }))
}

test('zet geluid aan voor de standaardvideo en een ronde-video', async () => {
  await operator.getByRole('button', { name: 'Quiz-instellingen' }).click()
  const beamerTile = operator.locator('.screen.tile').first()
  await beamerTile.locator('.chip').click()
  await operator.getByLabel('Geluid van de video').check()
  await expect(operator.getByLabel('Volume van de video')).toHaveValue('0.8')
  await operator.waitForTimeout(300) // popover laten infaden voor de screenshot
  await operator.screenshot({ path: 'test-results/screen-sound-popover.png' })
  await operator.keyboard.press('Escape')
  await expect(beamerTile.locator('.chip-sound')).toBeVisible()

  // Ronde 1 toont de standaard, maar zonder geluid.
  await operator.locator('.sidebar .round').nth(0).click()
  await operator.getByRole('tab', { name: 'Ronde' }).click()
  const roundBeamer = operator.locator('.round-settings .picker').first()
  await roundBeamer.click()
  await expect(operator.getByLabel('Geluid van de video')).toBeChecked()
  await operator.getByLabel('Geluid van de video').uncheck()
  await operator.waitForTimeout(300)
  await operator.screenshot({ path: 'test-results/screen-sound-round-muted.png' })
  await operator.keyboard.press('Escape')
  await expect(roundBeamer).toHaveAttribute('title', /Standaard, zonder geluid/)

  // Ronde 2 toont een andere video op de beamer; ook die met geluid.
  await operator.locator('.sidebar .round').nth(1).click()
  await operator.getByRole('tab', { name: 'Ronde' }).click()
  await operator.locator('.round-settings .picker').first().click()
  await operator.getByLabel('Geluid van de video').check()
  await operator.keyboard.press('Escape')
})

test('kiest bij Show waar het videogeluid heen gaat', async () => {
  const sheet = await openStart(operator)
  await useWindowedScreens(operator)
  // Alleen de beamer speelt video met geluid; de TV toont een afbeelding: geen geluidskeuze.
  const sound = sheet.locator('.sound-target [role="combobox"]')
  await expect(sound).toHaveCount(1)
  await expect(sound).toHaveAttribute('aria-label', 'Videogeluid van Beamer via')
  await expect(sound).toHaveAttribute('data-value', 'auto')
  await operator.screenshot({ path: 'test-results/screen-sound-prepare.png' })
})

test('speelt het videogeluid alleen op het scherm, duckt bij een fragment en zwijgt bij zwart', async () => {
  await startShow(operator)
  const beamer = await windowFor(app, 'screen/beamer')

  await expect.poll(() => sound(beamer)).toEqual({ muted: false, volume: 0.8, sinkId: '' })
  // Previews op de laptop blijven stil.
  await expect
    .poll(() =>
      operator.evaluate(() => [...document.querySelectorAll('video')].every((v) => v.muted))
    )
    .toBe(true)

  // Fader van het scherm in de mixer.
  await operator.getByLabel('Videogeluid Beamer', { exact: true }).fill('0.5')
  await expect.poll(async () => (await sound(beamer)).volume).toBe(0.4)
  await operator.screenshot({ path: 'test-results/screen-sound-mixer.png' })

  // Ronde 1: standaardvideo blijft lopen, maar zonder geluid.
  await operator.locator('.rounds .round').nth(0).click()
  await expect.poll(async () => (await sound(beamer)).muted).toBe(true)
  await expect
    .poll(() => beamer.locator('.layer.on video').first().getAttribute('src'))
    .toContain('default-loop.mp4')

  // Ronde 2: andere video met geluid; tijdens een fragment zakt hij naar 20% (duckTo).
  await operator.locator('.rounds .round').nth(1).click()
  await expect
    .poll(() => beamer.locator('.layer.on video').first().getAttribute('src'))
    .toContain('music-loop.mp4')
  await expect.poll(async () => (await sound(beamer)).volume).toBe(0.4)
  await operator.keyboard.press('1')
  await expect.poll(async () => (await sound(beamer)).volume).toBe(0.08)
  await operator.keyboard.press(' ')
  await expect.poll(async () => (await sound(beamer)).volume).toBe(0.4)

  // Pauze-ronde: video zonder geluid.
  await operator.locator('.rounds .round').nth(2).click()
  await expect
    .poll(() => beamer.locator('.layer.on video').first().getAttribute('src'))
    .toContain('pause-loop.mp4')
  await expect.poll(async () => (await sound(beamer)).muted).toBe(true)

  // Terug naar de standaard, dan beeld op zwart: alles stil.
  await operator.keyboard.press('e')
  await expect.poll(async () => (await sound(beamer)).volume).toBe(0.4)
  await operator
    .locator('.live-controls')
    .getByRole('button', { name: /Beeld op zwart/ })
    .click()
  await expect
    .poll(() =>
      beamer.evaluate(() => [...document.querySelectorAll('video')].every((v) => v.muted))
    )
    .toBe(true)

  await operator.getByRole('button', { name: 'Stop show' }).click()
  await confirmIn(operator, 'Stop show')
  await expect.poll(() => app.windows().some((w) => w.url().includes('#/screen/'))).toBe(false)
})
