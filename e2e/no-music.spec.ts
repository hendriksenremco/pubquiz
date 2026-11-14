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
  // Een quiz zonder achtergrondmuziek, zoals een nieuwe quiz.
  const file = join(quizDir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  quiz.background = null
  for (const round of quiz.rounds) round.background = 'continue'
  writeFileSync(file, JSON.stringify(quiz, null, 2))
  ;({ app, operator } = await launch(userData, quizDir))
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
  rmSync(dirname(quizDir), { recursive: true, force: true })
})

test('zonder achtergrondmuziek staat bij Geluid alleen het volume, net als op de telefoon', async () => {
  await openStart(operator)
  await startShow(operator)

  const mixer = operator.locator('.mixer')
  await expect(mixer).toBeVisible()
  await expect(mixer).not.toContainText('Achtergrondmuziek')
  await expect(mixer.getByRole('button', { name: /Muziek/ })).toHaveCount(0)
  await expect(mixer.getByRole('slider').first()).toBeVisible()
  await snap(operator, 'test-results/show-no-music.png')
})
