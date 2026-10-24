import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { copyFixture, launch, tempDir } from './helpers'

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

const savedQuiz = () => JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8'))

/** Ligt het paneel helemaal binnen het venster, en zit het bovenop (niet onder iets anders)? */
async function expectPanelOnTop(page: Page) {
  const panel = page.locator('.popover-panel')
  await expect(panel).toBeVisible()
  const result = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect()
    // 16px naar binnen: in de afgeronde hoeken valt een klik terecht op wat erachter ligt.
    const points = [
      [r.left + 16, r.top + 16],
      [r.right - 16, r.top + 16],
      [r.left + 16, r.bottom - 16],
      [r.right - 16, r.bottom - 16],
      [r.left + r.width / 2, r.top + r.height / 2]
    ]
    return {
      inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      onTop: points.every(([x, y]) => el.contains(document.elementFromPoint(x, y)))
    }
  })
  expect(result).toEqual({ inside: true, onTop: true })
}

test('menu’s vallen niet buiten het venster en liggen bovenop', async () => {
  await operator.getByRole('button', { name: 'Ronde toevoegen' }).click()
  await expectPanelOnTop(operator)
  await operator.keyboard.press('Escape')

  await operator.locator('.sidebar .round').first().click()
  await operator.locator('.chips .chip').last().click()
  await expectPanelOnTop(operator)
  await operator.waitForTimeout(200) // infaden afwachten voor de screenshot
  await operator.screenshot({ path: 'test-results/popover-background.png' })

  // Sluiten en meteen van pagina wisselen mag geen menu achterlaten.
  await operator.keyboard.press('Escape')
  await operator.getByRole('button', { name: /^Media/ }).click()
  await expect(operator.locator('.popover-panel')).toHaveCount(0)
  await operator.locator('.sidebar .round').first().click()
})

test('toont mappen en maakt een nieuwe map', async () => {
  await operator.getByRole('button', { name: /^Media/ }).click()
  await expect(operator.locator('.folder-name')).toHaveText(['Fragmenten', 'Loops'])
  await expect(
    operator.locator('.folder', { hasText: 'Loops' }).locator('.mosaic-cell')
  ).toHaveCount(3)
  await operator.waitForTimeout(500) // thumbnails laten laden voor de screenshot
  await operator.screenshot({ path: 'test-results/media-folders.png' })

  await operator.getByRole('button', { name: 'Nieuwe map' }).click()
  const title = operator.getByLabel('Naam van de map')
  await expect(title).toBeFocused()
  await title.fill('Pauzemuziek')
  await operator.locator('.crumb').click()
  await expect(operator.locator('.folder-name')).toHaveText(['Fragmenten', 'Loops', 'Pauzemuziek'])
})

test('verplaatst een bestand naar een map', async () => {
  const row = operator.locator('.sound', { hasText: 'background-break.m4a' })
  await row.getByLabel('Map').selectOption({ label: 'Pauzemuziek' })
  await expect(row).toHaveCount(0)

  await operator.locator('.folder', { hasText: 'Pauzemuziek' }).click()
  await expect(operator.locator('.sound .name')).toHaveText(['background-break.m4a'])
  await expect
    .poll(() => {
      const quiz = savedQuiz()
      const folder = quiz.folders.find((f: { name: string }) => f.name === 'Pauzemuziek')
      return quiz.assets.find((a: { id: string }) => a.id === 'bg-break')?.folderId === folder?.id
    })
    .toBe(true)
  await operator.locator('.crumb').click()
})

test('speelt een video af als voorbeeld', async () => {
  await operator.locator('.folder', { hasText: 'Loops' }).click()
  const tile = operator.locator('.tile-item').first()
  await tile.hover()
  await tile.getByRole('button', { name: 'Speel voorbeeld' }).click()
  await expect(tile.locator('.frame')).toHaveClass(/playing/)
  await expect
    .poll(() => tile.locator('video').evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false)
  await operator.screenshot({ path: 'test-results/media-folder-loops.png' })

  await tile.getByRole('button', { name: 'Stop voorbeeld' }).click()
  await expect(tile.locator('.frame')).not.toHaveClass(/playing/)
  await operator.locator('.crumb').click()
})

test('toont een bestand groot als voorbeeld en bladert verder', async () => {
  await operator.locator('.folder', { hasText: 'Loops' }).click()
  const names = await operator.locator('.tile-item .name').allTextContents()
  expect(names).toHaveLength(3)
  const tile = operator.locator('.tile-item').first()
  await tile.getByRole('button', { name: 'Speel voorbeeld' }).click()

  // Het grote voorbeeld neemt het over: de tegel stopt, het voorbeeld speelt met geluid.
  await tile.getByRole('button', { name: 'Voorbeeld', exact: true }).click()
  const dialog = operator.getByRole('dialog')
  await expect(dialog).toHaveAccessibleName(`Voorbeeld: ${names[0]}`)
  await expect(tile.locator('.frame')).not.toHaveClass(/playing/)
  await expect
    .poll(() => dialog.locator('video').evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(false)
  await expect(dialog.locator('.meta')).toContainText(/\d+ × \d+/)
  await expect(dialog.locator('.usages')).toContainText('Standaard van scherm "Beamer"')
  await expect(dialog.locator('.count')).toHaveText('1 van 3')
  await operator.waitForTimeout(700) // gloed laten infaden voor de screenshot
  await operator.screenshot({ path: 'test-results/media-preview.png' })

  await operator.keyboard.press('ArrowRight')
  await expect(dialog).toHaveAccessibleName(`Voorbeeld: ${names[1]}`)
  await operator.keyboard.press('ArrowLeft')
  await operator.keyboard.press('ArrowLeft')
  await expect(dialog).toHaveAccessibleName(`Voorbeeld: ${names[2]}`)
  await operator.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // In de hoofdmap: eerst de afbeelding (klik op de tegel), dan het geluid.
  await operator.locator('.crumb').click()
  await operator.locator('.tile-item .frame').first().click()
  await expect(dialog).toHaveAccessibleName('Voorbeeld: logo.png')
  await expect(dialog.locator('.meta')).toContainText(/Afbeelding.*\d+ × \d+/)
  await dialog.getByRole('button', { name: 'Volgende' }).click()
  await expect(dialog).toHaveAccessibleName('Voorbeeld: background.m4a')
  await expect
    .poll(() => dialog.locator('audio').evaluate((a: HTMLAudioElement) => a.paused))
    .toBe(false)
  await operator.screenshot({ path: 'test-results/media-preview-sound.png' })
  await dialog.getByRole('button', { name: 'Sluiten' }).click()
  await expect(dialog).toHaveCount(0)

  // De knop staat ook bij elk geluid in de lijst.
  await operator
    .locator('.sound', { hasText: 'background.m4a' })
    .getByRole('button', { name: 'Voorbeeld', exact: true })
    .click()
  await expect(dialog).toHaveAccessibleName('Voorbeeld: background.m4a')
  await operator.keyboard.press('Escape')
})

test('voegt een hele Media-map als fragmenten toe aan een ronde', async () => {
  await operator.getByRole('button', { name: 'Ronde toevoegen' }).click()
  await operator.getByRole('button', { name: /^Muziekronde/ }).click()
  await operator.getByRole('button', { name: 'Toevoegen', exact: true }).click()
  await operator
    .locator('.popover-panel')
    .getByRole('button', { name: /Fragmenten/ })
    .click()
  await expect(operator.locator('.track-title')).toHaveText(
    Array.from({ length: 8 }, (_, i) => `Fragment ${i + 1}`)
  )
  await expect(operator.locator('.track-sub').first()).toHaveText('fragment-1.m4a')
})
