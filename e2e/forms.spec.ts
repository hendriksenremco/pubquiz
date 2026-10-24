import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { copyFileSync, existsSync, readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { copyFixture, launch, tempDir } from './helpers'

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string
let saveDir: string

test.beforeAll(async () => {
  userData = tempDir('userdata')
  saveDir = tempDir('pdf')
  quizDir = copyFixture()
  ;({ app, operator } = await launch(userData, quizDir, { PUBQUIZ_SAVE_DIR: saveDir }))
})

test.afterAll(async () => {
  await app?.close()
  for (const dir of [userData, saveDir, dirname(quizDir)]) {
    rmSync(dir, { recursive: true, force: true })
  }
})

/** Aantal pagina's in een pdf van Chromium (elk paginaobject heeft `/Type /Page`). */
function pageCount(file: string): number {
  return (
    readFileSync(file)
      .toString('latin1')
      .match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0
  )
}

async function saved(name: string): Promise<string> {
  const file = join(saveDir, name)
  await expect.poll(() => existsSync(file), { timeout: 20_000 }).toBe(true)
  expect(readFileSync(file).subarray(0, 5).toString()).toBe('%PDF-')
  // Kopie om te bekijken, net als de screenshots.
  copyFileSync(file, join('test-results', name))
  return file
}

test('maakt het antwoordformulier en de antwoorden als pdf', async () => {
  await operator.getByRole('button', { name: 'Quizmenu' }).click()
  await operator.locator('.menu-item', { hasText: 'Antwoordformulieren' }).click()
  const dialog = operator.getByRole('dialog', { name: 'Antwoordformulieren' })
  // Alleen rondes met iets om in te vullen; de pauze niet.
  await expect(dialog.locator('.option-title')).toHaveText([
    'Ronde 1: algemeen',
    'Ronde 2: muziek',
    'Ronde 4: intro’s',
    'Elke ronde op een eigen blad'
  ])
  await operator.waitForTimeout(200)
  await operator.screenshot({ path: 'test-results/forms-dialog.png' })

  await dialog.getByRole('button', { name: 'Antwoordformulier' }).click()
  const sheet = await saved('Demo-pubquiz – antwoordformulier.pdf')
  // Elke ronde op een eigen blad.
  expect(pageCount(sheet)).toBe(3)
  await expect(operator.locator('.notice')).toContainText('Opgeslagen')

  await dialog.getByRole('button', { name: 'Antwoorden' }).click()
  const key = await saved('Demo-pubquiz – antwoorden.pdf')
  expect(pageCount(key)).toBeGreaterThanOrEqual(1)
})
