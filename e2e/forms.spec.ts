import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { confirmIn, copyFixture, launch, tempDir } from './helpers'

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string
let saveDir: string

test.beforeAll(async () => {
  userData = tempDir('userdata')
  saveDir = tempDir('pdf')
  quizDir = copyFixture()
  // Een lang antwoord: moet op het nakijkformulier over meerdere regels doorlopen.
  const file = join(quizDir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  quiz.rounds[1].fragments[2].answer =
    'Queen – Bohemian Rhapsody (live at Wembley Stadium, 13 juli 1985, Live Aid)'
  writeFileSync(file, JSON.stringify(quiz))
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

/** Paginaformaat in millimeters (MediaBox staat in punten, 72 per inch). */
function pageSizeMm(file: string): [number, number] {
  const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(
    readFileSync(file).toString('latin1')
  )!
  return [Math.round((Number(box[1]) / 72) * 25.4), Math.round((Number(box[2]) / 72) * 25.4)]
}

test('maakt het antwoordformulier, de antwoorden en de vragenkaarten als pdf', async () => {
  await operator.locator('.topbar').getByRole('button', { name: 'Afdrukken' }).click()
  const dialog = operator.locator('.print')
  // Alleen rondes met iets om in te vullen; de pauze niet.
  await expect(dialog.locator('label.option .option-title')).toHaveText([
    'Ronde 1: algemeen',
    'Ronde 2: muziek',
    'Ronde 4: intro’s'
  ])
  await operator.waitForTimeout(200)
  await operator.screenshot({ path: 'test-results/print-page.png' })

  await dialog.getByRole('button', { name: 'Antwoordformulier opslaan' }).click()
  const sheet = await saved('Demo-pubquiz – antwoordformulier.pdf')
  // A4, tot vier rondes per blad: de drie rondes van de demo passen op één.
  expect(pageSizeMm(sheet)).toEqual([210, 297])
  expect(pageCount(sheet)).toBe(1)
  await expect(operator.locator('.notice')).toContainText('Opgeslagen')

  // Nakijkformulier: dezelfde indeling, dus ook één A4.
  await dialog.getByRole('button', { name: 'Nakijkformulier opslaan' }).click()
  const key = await saved('Demo-pubquiz – nakijkformulier.pdf')
  expect(pageSizeMm(key)).toEqual([210, 297])
  expect(pageCount(key)).toBe(1)

  // Vragenkaarten: ansichtkaartformaat, een kaart per ronde.
  await dialog.getByRole('button', { name: 'Vragenkaarten opslaan' }).click()
  const cards = await saved('Demo-pubquiz – vragenkaarten.pdf')
  expect(pageSizeMm(cards)).toEqual([148, 105])
  expect(pageCount(cards)).toBe(3)
})

test('acties staan zichtbaar in beeld, niet achter drie stippen', async () => {
  await operator.getByRole('button', { name: 'Quiz-instellingen' }).click()
  for (const name of ['Nieuwe quiz op basis van deze', 'Exporteer als zip', 'Toon in Finder']) {
    await expect(operator.getByRole('button', { name })).toBeVisible()
  }
  await expect(operator.getByRole('button', { name: 'Verwijder scherm' })).toHaveCount(2)
  await operator.waitForTimeout(300)
  await operator.screenshot({ path: 'test-results/quiz-actions.png' })

  // Ronde dupliceren en verwijderen, onderaan de instellingen van de ronde.
  const rounds = operator.locator('.sidebar .round')
  await rounds.first().click()
  await operator.getByRole('tab', { name: 'Ronde' }).click()
  await operator.getByRole('button', { name: 'Dupliceer ronde' }).click()
  await expect(rounds).toHaveCount(5)
  await expect(operator.locator('#round-title')).toHaveValue('Ronde 1: algemeen (kopie)')
  await operator.getByRole('tab', { name: 'Ronde' }).click()
  await operator.screenshot({ path: 'test-results/round-actions.png' })
  await operator.getByRole('button', { name: 'Verwijder ronde' }).click()
  await confirmIn(operator, 'Verwijder')
  await expect(rounds).toHaveCount(4)

  await operator.getByRole('button', { name: /^Media/ }).click()
  await expect(operator.getByRole('button', { name: 'Verwijder uit quiz' }).first()).toBeVisible()
  await operator.screenshot({ path: 'test-results/media-actions.png' })
  await expect(operator.getByRole('button', { name: 'Meer' })).toHaveCount(0)
})
