import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { rmSync } from 'fs'
import { dirname } from 'path'
import { confirmIn, copyFixture, launch, openStart, startShow, tempDir } from './helpers'

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

test('zonder schermen staat Beeld op zwart uit, net als op de telefoon', async () => {
  await operator.getByRole('button', { name: 'Quiz-instellingen' }).click()
  const remove = operator.getByRole('button', { name: 'Verwijder scherm' })
  await expect(remove).toHaveCount(2)
  for (const left of [1, 0]) {
    await remove.first().click()
    await confirmIn(operator, 'Verwijder scherm')
    await expect(remove).toHaveCount(left)
  }

  const sheet = await openStart(operator)
  await expect(sheet).toContainText('Deze quiz heeft geen schermen.')
  await startShow(operator)

  const controls = operator.locator('.live-controls')
  await expect(controls.getByRole('button', { name: /Beeld op zwart/ })).toBeDisabled()
  await expect(controls.getByRole('button', { name: /Geluid uit/ })).toBeEnabled()
})
