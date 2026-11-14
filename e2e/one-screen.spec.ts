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
  useWindowedScreens
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

test('met één scherm staat Beeld op zwart alleen in de werkbalk, net als op de telefoon', async () => {
  await operator.getByRole('button', { name: 'Quiz-instellingen' }).click()
  const remove = operator.getByRole('button', { name: 'Verwijder scherm' })
  await expect(remove).toHaveCount(2)
  await remove.last().click()
  await confirmIn(operator, 'Verwijder scherm')
  await expect(remove).toHaveCount(1)

  await openStart(operator)
  await useWindowedScreens(operator)
  await startShow(operator)
  const screen = operator.locator('.screens .screen')
  await expect(screen).toHaveCount(1)
  await expect(screen).toContainText('Beamer')
  await expect(screen.getByRole('button')).toHaveCount(0)

  const toolbar = operator.locator('.live-controls').getByRole('button', { name: /Beeld op zwart/ })
  await toolbar.click()
  await expect(screen.locator('.frame')).toHaveClass(/black/)
  await expect(
    operator.locator('.live-controls').getByRole('button', { name: /Beeld terug/ })
  ).toBeVisible()
})
