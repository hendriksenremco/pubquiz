import { expect, test } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  confirmIn,
  copyFixture,
  launch,
  openStart,
  startShow,
  tempDir,
  useWindowedScreens,
  windowFor
} from './helpers'

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

test('een slide Tussenstand toont de stand op het scherm', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  // Teams en punten staan al in de quiz; de tabel zelf test de test hierboven.
  const file = join(quizDir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  const [one, two] = quiz.rounds
  const teams = ['De Slimmeriken', 'Quizzly Bears', 'Team Kroket', 'Het Bruine Brein']
  quiz.plugins = {
    ...quiz.plugins,
    scores: {
      teams: teams.map((name, i) => ({ id: `t${i}`, name })),
      points: {
        [one.id]: { t0: 7.5, t1: 9, t2: 6, t3: 9 },
        [two.id]: { t0: 6, t1: 3, t2: 8, t3: 3 }
      }
    }
  }
  writeFileSync(file, JSON.stringify(quiz, null, 2))
  const savedSlides = () =>
    JSON.parse(readFileSync(file, 'utf8')).rounds[0].slides.map(
      (s: { layout: string; title: string; plugins?: unknown }) => [s.layout, s.title, s.plugins]
    )

  const { app, operator } = await launch(userData, quizDir)
  try {
    await operator.locator('.sidebar .round').first().click()
    const addSlide = operator.getByRole('button', { name: 'Slide', exact: true })
    // Uit (standaard): geen slide Tussenstand om toe te voegen.
    await addSlide.click()
    await expect(operator.locator('.menu-item', { hasText: 'Nummer' })).toBeVisible()
    await expect(operator.locator('.menu-item', { hasText: 'Tussenstand' })).toHaveCount(0)
    await addSlide.click()

    await operator.locator('.topbar').getByRole('button', { name: 'Quizzen' }).click()
    await operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
    const dialog = operator.getByRole('dialog', { name: 'Instellingen' })
    await dialog.getByRole('checkbox', { name: /Tussenstand/ }).check()
    await dialog.getByRole('button', { name: 'Klaar' }).click()
    await operator.getByRole('button', { name: 'Bewerken' }).click()
    await operator.locator('.sidebar .round').first().click()

    // Achteraan toegevoegd, als titelslide met de markering van de plug-in.
    await addSlide.click()
    await operator.locator('.menu-item', { hasText: 'Tussenstand' }).click()
    await expect
      .poll(() => savedSlides().at(-1))
      .toEqual(['title', 'Tussenstand', { scores: { standings: true } }])
    const thumb = operator.locator('.slide-list .item').last()
    await expect(thumb).toContainText('Tussenstand')
    await expect(thumb.locator('.standing')).toHaveCount(4)
    await operator.waitForTimeout(300)
    await operator.screenshot({ path: 'test-results/scores-slide-editor.png' })

    await openStart(operator)
    await useWindowedScreens(operator)
    await startShow(operator)
    const beamer = await windowFor(app, 'screen/beamer')
    await operator.locator('.rounds .round').first().click()
    const rows = beamer.locator('.slide .standing')
    for (let i = 0; i < 6 && !(await rows.count()); i++) {
      await operator.keyboard.press('ArrowRight')
      await operator.waitForTimeout(400)
    }
    // Meeste punten bovenaan; gelijk = dezelfde plaats, in de volgorde van de teams.
    await expect(rows.locator('.team')).toHaveText([
      'Team Kroket',
      'De Slimmeriken',
      'Quizzly Bears',
      'Het Bruine Brein'
    ])
    await expect(rows.locator('.place')).toHaveText(['1', '2', '3', '3'])
    await expect(rows.locator('.total')).toHaveText(['14', '13,5', '12', '12'])
    await expect(beamer.locator('.slide .eyebrow-big')).toHaveText('Tussenstand')
    await beamer.waitForTimeout(700)
    await beamer.screenshot({ path: 'test-results/scores-slide.png' })
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
