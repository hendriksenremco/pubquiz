import { expect, test } from '@playwright/test'
import { readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { copyFixture, launch, tempDir, useWindowedScreens } from './helpers'

test('wijzigingen in de editor worden automatisch opgeslagen', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir)
  try {
    await operator.getByRole('button', { name: 'Ronde toevoegen' }).click()
    await operator.getByRole('button', { name: /^Muziekronde/ }).click()
    await operator.locator('#round-title').fill('Ronde 5: jaren 80')
    await expect(operator.locator('.save')).toHaveText('Opgeslagen')

    await expect
      .poll(() => JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8')).rounds.at(-1)?.title)
      .toBe('Ronde 5: jaren 80')
    const saved = JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8'))
    expect(saved.rounds).toHaveLength(5)
    expect(saved.rounds[4].background).toBe('pause')
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})

test('na een crash biedt de app aan de show te hervatten', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const first = await launch(userData, quizDir)
  await first.operator.getByRole('button', { name: 'Show', exact: true }).click()
  await useWindowedScreens(first.operator)
  await first.operator.getByRole('button', { name: 'Start show' }).click()
  await first.operator.locator('.rounds .round').nth(1).click()
  await first.operator.keyboard.press('3')
  await expect(first.operator.locator('.frag').nth(2)).toHaveClass(/on/)
  // Herstelgegevens worden binnen een seconde weggeschreven; daarna hard afschieten.
  await first.operator.waitForTimeout(1500)
  first.app.process().kill('SIGKILL')

  // Zonder quizpad starten: de app opent zelf de quiz van de afgebroken show.
  const second = await launch(userData)
  try {
    await expect(second.operator.getByText('De vorige show is onverwacht gestopt')).toBeVisible()
    await expect(second.operator.getByText('Bezig met “Ronde 2: muziek”')).toBeVisible()
    await second.operator.getByRole('button', { name: 'Hervat show' }).click()
    await expect(second.operator.locator('.now-title')).toHaveText('Ronde 2: muziek')
    await expect(second.operator.locator('.frag').nth(2)).toHaveClass(/played/)
    second.operator.once('dialog', (d) => d.accept())
    await second.operator.getByRole('button', { name: 'Stop show' }).click()
  } finally {
    await second.app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
