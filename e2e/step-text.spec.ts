import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { copyFixture, launch, openStart, snap, startShow, tempDir } from './helpers'

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string

test.beforeAll(async () => {
  userData = tempDir('userdata')
  quizDir = copyFixture()
  // Vraag 1 van ronde 1 toont op de schermen alleen het nummer.
  const file = join(quizDir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  quiz.rounds[0].slides[1].numberOnly = true
  writeFileSync(file, JSON.stringify(quiz, null, 2))
  ;({ app, operator } = await launch(userData, quizDir))
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
  rmSync(dirname(quizDir), { recursive: true, force: true })
})

test('onder de pijlen staat de vraag om voor te lezen, zoals op de telefoon', async () => {
  await openStart(operator)
  await startShow(operator)

  await operator.locator('.rounds .round').first().click()
  await operator.locator('.slides .slide', { hasText: 'Vraag 1' }).click()
  const control = operator.locator('.side .control')
  await expect(control.locator('.step-text')).toHaveText('Wat is de hoofdstad van Australië?')
  await expect(control.locator('.step-answer')).toHaveCount(0)
  await operator.waitForTimeout(400)
  await snap(operator, 'test-results/show-step-text.png')

  // Een slide zonder vraag: geen tekst onder de pijlen.
  await operator.locator('.slides .slide', { hasText: 'Geen slide' }).click()
  await expect(control.locator('.step-text')).toHaveCount(0)
})
