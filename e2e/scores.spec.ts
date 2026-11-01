import { expect, test } from '@playwright/test'
import { readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { confirmIn, copyFixture, launch, tempDir } from './helpers'

test('teams en punten per ronde bij Quiz-instellingen, via de plug-in Tussenstand', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir)
  const saved = () =>
    JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8')).plugins?.scores ?? null
  const table = operator.getByTestId('score-table')
  try {
    // Uit (standaard): geen tussenstand bij Quiz-instellingen.
    await operator.getByRole('button', { name: 'Quiz-instellingen' }).click()
    await expect(operator.getByRole('button', { name: 'Exporteer als zip' })).toBeVisible()
    await expect(table).toHaveCount(0)

    await operator.locator('.topbar').getByRole('button', { name: 'Quizzen' }).click()
    await operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
    const dialog = operator.getByRole('dialog', { name: 'Instellingen' })
    await dialog.getByRole('checkbox', { name: /Tussenstand/ }).check()
    await dialog.getByRole('button', { name: 'Klaar' }).click()
    await operator.getByRole('button', { name: 'Bewerken' }).click()
    await operator.getByRole('button', { name: 'Quiz-instellingen' }).click()

    await expect(table).toContainText('Nog geen teams')
    await table.getByRole('button', { name: 'Team toevoegen' }).click()
    await table.getByRole('button', { name: 'Team toevoegen' }).click()
    await table.getByRole('button', { name: 'Team toevoegen' }).click()
    const names = table.getByLabel('Naam van het team')
    await expect(names).toHaveCount(3)
    await names.nth(0).fill('De Slimmeriken')
    await names.nth(0).press('Tab')
    await names.nth(1).fill('Quizzly Bears')
    await names.nth(1).press('Tab')

    // Antwoordenrondes hebben geen kolom; de demo heeft er geen, dus vier rondes.
    await expect(table.locator('th.round')).toHaveCount(4)
    const points = (team: string, round: string) =>
      table.getByLabel(`Punten van ${team} in ${round}`)
    await points('De Slimmeriken', 'Ronde 1: algemeen').fill('7,5')
    await points('De Slimmeriken', 'Ronde 1: algemeen').press('Tab')
    await points('De Slimmeriken', 'Ronde 2: muziek').fill('6')
    await points('De Slimmeriken', 'Ronde 2: muziek').press('Tab')
    await points('Quizzly Bears', 'Ronde 1: algemeen').fill('9')
    await points('Quizzly Bears', 'Ronde 1: algemeen').press('Tab')
    // Ongeldig: het veld blijft leeg.
    await points('Team 3', 'Ronde 1: algemeen').fill('abc')
    await points('Team 3', 'Ronde 1: algemeen').press('Tab')
    await expect(points('Team 3', 'Ronde 1: algemeen')).toHaveValue('')

    await expect(table.locator('td.total')).toHaveText(['13.5', '9', '0'])
    await expect
      .poll(() => saved()?.teams.map((t: { name: string }) => t.name))
      .toEqual(['De Slimmeriken', 'Quizzly Bears', 'Team 3'])
    await operator.waitForTimeout(300)
    await table.screenshot({ path: 'test-results/scores-table.png' })

    // Een team weghalen, met zijn punten.
    await table.getByRole('button', { name: 'Team weghalen' }).nth(1).click()
    await confirmIn(operator, 'Weghalen')
    await expect(names).toHaveCount(2)
    await expect.poll(() => JSON.stringify(saved())).not.toContain('Quizzly')

    // Punten wissen: de teams blijven.
    await table.getByRole('button', { name: 'Punten wissen' }).click()
    await confirmIn(operator, 'Wissen')
    await expect(table.locator('td.total')).toHaveText(['0', '0'])
    await expect(table.getByRole('button', { name: 'Punten wissen' })).toHaveCount(0)
    await expect.poll(() => saved()?.points).toEqual({})
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
