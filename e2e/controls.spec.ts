import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { copyFixture, launch, snap, tempDir } from './helpers'

// Bediening in de stijl van de app in plaats van die van macOS: kleuren, vinkjes, schuifjes.

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

test('een slide krijgt een kleur uit het rijtje of een eigen kleurcode', async () => {
  await operator.locator('.sidebar .round').first().click()
  await operator.locator('.slide-list .item').nth(1).locator('.thumb').click()
  await operator.getByRole('button', { name: 'Achtergrond' }).click()
  await operator.locator('.menu-item', { hasText: 'Effen kleur' }).click()

  const panel = operator.locator('.popover-panel')
  await panel.getByRole('button', { name: 'Kleur #16304f' }).click()
  await expect(panel.getByRole('button', { name: 'Kleur #16304f' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await operator.waitForTimeout(200)
  await snap(operator, 'test-results/controls-colors.png')

  const hex = panel.getByLabel('Eigen kleurcode')
  // Het paneel is gegroeid maar blijft helemaal in het venster.
  await expect(hex).toBeInViewport({ ratio: 1 })
  await hex.fill('3A2410')
  await hex.press('Enter')
  await expect(hex).toHaveValue('#3a2410')
  // Geen geldige kleur: de vorige blijft.
  await hex.fill('rood')
  await hex.press('Enter')
  await expect(hex).toHaveValue('#3a2410')
  await expect.poll(() => savedQuiz().rounds[0].slides[1].backdrop).toEqual({ color: '#3a2410' })
  await operator.keyboard.press('Escape')
})

test('vinkjes en schuifjes zijn echte invoervelden met de stijl van de app', async () => {
  await operator.locator('.topbar').getByRole('button', { name: 'Afdrukken' }).click()
  const box = operator.locator('.print label.option input[type="checkbox"]').first()
  await expect(box).toBeChecked()
  // Geen standaardvinkje van macOS meer.
  expect(await box.evaluate((el) => getComputedStyle(el).appearance)).toBe('none')
  await box.uncheck()
  await expect(operator.locator('.print .count')).toHaveText('2 van 3')
  await box.focus()
  await operator.keyboard.press('Space')
  await expect(box).toBeChecked()

  // Het schuifje van de achtergrondmuziek: de baan is gevuld tot de waarde.
  await operator.locator('.nav-item', { hasText: 'Quiz' }).click()
  const slider = operator.locator('.slider input[type="range"]').first()
  const value = Number(await slider.inputValue())
  await expect(slider).toHaveCSS('--fill', `${value * 100}%`)
  await slider.focus()
  await operator.keyboard.press('ArrowLeft')
  await expect(slider).not.toHaveCSS('--fill', `${value * 100}%`)
})
