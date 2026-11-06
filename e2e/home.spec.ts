import { expect, test } from '@playwright/test'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import {
  choose,
  confirmIn,
  copyFixture,
  launch,
  openStart,
  snap,
  startShow,
  tempDir,
  tourFixture
} from './helpers'

test('dashboard: leeg starten, recente quiz openen en terugkomen', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  try {
    // Eerste keer: niets recents, dus de lege staat.
    let { app, operator } = await launch(userData)
    await expect(operator.getByRole('heading', { name: 'Maak je eerste pubquiz' })).toBeVisible()
    await snap(operator, 'test-results/home-empty.png')
    await app.close()

    // Quiz openen, dan via de home-knop naar het overzicht.
    ;({ app, operator } = await launch(userData, quizDir))
    await expect(operator.locator('.topbar .name')).toHaveText('Demo-pubquiz')
    await operator.getByRole('button', { name: 'Quizzen' }).click()
    await expect(operator.locator('.hero .kicker')).toHaveText('Laatst geopend')
    await expect(operator.locator('.hero-title')).toHaveText('Demo-pubquiz')
    await expect(operator.locator('.hero-meta')).toContainText('4 rondes en 2 schermen')

    // De cover komt via pq-media://recent, en alleen recente quizzen mogen dat.
    const cover = operator.locator('.hero-cover video')
    await expect(cover).toHaveAttribute('src', /^pq-media:\/\/recent\//)
    await expect
      .poll(() => cover.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThan(0)
    const forbidden = await operator.evaluate(
      async () => (await fetch(`pq-media://recent/${encodeURIComponent('/etc')}/hosts`)).status
    )
    expect(forbidden).toBe(403)
    await operator.waitForTimeout(800) // cover en gloed laten laden voor de screenshot
    await snap(operator, 'test-results/home.png')

    await operator.getByRole('button', { name: 'Start show' }).click()
    await expect(operator.getByRole('dialog', { name: 'Start show' })).toBeVisible()
    await app.close()

    // Opnieuw starten zonder bestand: terug op het dashboard, met dezelfde quiz bovenaan.
    ;({ app, operator } = await launch(userData))
    await expect(operator.locator('.hero-title')).toHaveText('Demo-pubquiz')
    await app.close()
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})

test('in het Engels: het dashboard en de werkbalk', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const env = { PUBQUIZ_LOCALE: 'en' }
  try {
    let { app, operator } = await launch(userData, undefined, env)
    await expect(operator.getByRole('heading', { name: 'Make your first pub quiz' })).toBeVisible()
    await expect(operator.getByRole('button', { name: 'New quiz…' })).toBeVisible()
    await expect(operator.getByRole('button', { name: 'Settings' })).toBeVisible()
    await snap(operator, 'test-results/home-empty-en.png')
    await app.close()
    ;({ app, operator } = await launch(userData, quizDir, env))
    await expect(operator.locator('.topbar .name')).toHaveText('Demo-pubquiz')
    await expect(operator.getByRole('button', { name: 'Print' })).toBeVisible()
    await snap(operator, 'test-results/editor-en.png')
    await operator.getByRole('button', { name: 'Quizzes' }).click()
    await expect(operator.locator('.hero .kicker')).toHaveText('Last opened')
    await expect(operator.locator('.hero-meta')).toContainText('4 rounds and 2 screens')
    await expect(operator.locator('.hero-text').getByRole('button', { name: 'Edit' })).toBeVisible()
    await app.close()
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})

test('in het Engels: het voorbeeld van een scherm op zwart', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir, { PUBQUIZ_LOCALE: 'en' })
  try {
    const sheet = await openStart(operator)
    for (const box of await sheet.locator('.screen .screen-target [role="combobox"]').all()) {
      await choose(operator, box, 'Window on this laptop (for testing)')
    }
    await startShow(operator)
    const controls = operator.locator('.live-controls')
    await controls.getByRole('button', { name: /Black out/ }).click()
    await expect(operator.locator('.blackout-badge').first()).toHaveText('Black')
    await operator.getByRole('button', { name: 'Stop show' }).click()
    await confirmIn(operator, 'Stop show')
    await expect(operator.locator('.live')).toHaveCount(0)
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})

test('dashboard: de rondleiding staat de eerste keer klaar, en komt niet terug als je hem weghaalt', async () => {
  const userData = tempDir('userdata')
  const library = join(userData, 'Pubquiz')
  const quizDir = copyFixture()
  const env = { PUBQUIZ_TOUR: tourFixture }
  try {
    // Eerste start: een kopie in de bibliotheek, bovenaan het dashboard.
    let { app, operator } = await launch(userData, undefined, env)
    await expect(operator.locator('.hero .kicker')).toHaveText('Begin hier')
    await expect(operator.locator('.hero-title')).toHaveText('Rondleiding')
    expect(existsSync(join(library, 'Rondleiding.quiznote', 'quiz.json'))).toBe(true)
    await operator.waitForTimeout(800) // cover en gloed laten laden voor de screenshot
    // "Bewerkt zojuist" of "1 minuut geleden": dat hangt af van hoe lang de test al loopt.
    await snap(operator, 'test-results/home-tour.png', {
      mask: [operator.locator('.hero-meta')]
    })
    await operator
      .locator('.hero-text')
      .getByRole('button', { name: 'Bewerk', exact: true })
      .click()
    await expect(operator.locator('.topbar .name')).toHaveText('Rondleiding')
    await app.close()

    // Een eigen quiz gaat voor; de rondleiding blijft in de lijst.
    ;({ app, operator } = await launch(userData, quizDir, env))
    await operator.getByRole('button', { name: 'Quizzen' }).click()
    await expect(operator.locator('.hero .kicker')).toHaveText('Laatst geopend')
    await expect(operator.locator('.hero-title')).toHaveText('Demo-pubquiz')
    const tour = operator.locator('.card', { hasText: 'Rondleiding' })
    await expect(tour).toHaveCount(1)
    await tour.getByRole('button', { name: 'Verwijder uit lijst' }).click()
    await expect(tour).toHaveCount(0)
    await app.close()

    // Weggehaald is weggehaald, ook na opnieuw starten.
    ;({ app, operator } = await launch(userData, undefined, env))
    await expect(operator.locator('.hero-title')).toHaveText('Demo-pubquiz')
    await expect(operator.locator('.card', { hasText: 'Rondleiding' })).toHaveCount(0)
    await app.close()
  } finally {
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})

test('dashboard: een verplaatste quiz is te herkennen en uit de lijst te halen', async () => {
  const userData = tempDir('userdata')
  const first = copyFixture()
  const second = join(dirname(first), 'Tweede.pubquiz')
  cpSync(first, second, { recursive: true })
  const { app, operator } = await launch(userData, first)
  try {
    // Tweede quiz openen zonder het native open-dialoog.
    await operator.evaluate(
      (path) =>
        (window as unknown as { pubquiz: { openQuiz(p: string): Promise<void> } }).pubquiz.openQuiz(
          path
        ),
      second
    )
    rmSync(first, { recursive: true, force: true })
    await operator.getByRole('button', { name: 'Quizzen' }).click()

    const card = operator.locator('.card')
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('Niet gevonden')
    // Het tijdelijke pad van de test wisselt per run.
    await snap(operator, 'test-results/home-missing.png', {
      mask: [card.locator('.card-meta')]
    })

    await card.getByRole('button', { name: 'Verwijder uit lijst' }).click()
    await expect(card).toHaveCount(0)
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(first), { recursive: true, force: true })
  }
})

test('nieuwe quiz: alleen een naam, de app maakt zelf de map aan', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const library = join(userData, 'Pubquiz')
  const { app, operator } = await launch(userData, quizDir)
  const dialog = operator.getByRole('dialog')
  const newQuizMenu = async () => {
    await operator.getByRole('button', { name: 'Quizzen' }).click()
    await operator.locator('.new-tile').click()
  }
  try {
    // Lege quiz.
    await newQuizMenu()
    await operator.getByRole('button', { name: 'Lege quiz' }).click()
    await expect(dialog.getByLabel('Naam')).toBeFocused()
    await dialog.getByLabel('Naam').fill('Pubquiz november')
    await operator.waitForTimeout(300) // infaden afwachten voor de screenshot
    await snap(operator, 'test-results/new-quiz-dialog.png')
    await dialog.getByLabel('Naam').press('Enter')
    await expect(operator.locator('.topbar .name')).toHaveText('Pubquiz november')
    expect(existsSync(join(library, 'Pubquiz november.quiznote', 'quiz.json'))).toBe(true)

    // Dezelfde naam nog eens: een duidelijke melding in het venster.
    await newQuizMenu()
    await operator.getByRole('button', { name: 'Lege quiz' }).click()
    await dialog.getByLabel('Naam').fill('Pubquiz november')
    await dialog.getByLabel('Naam').press('Enter')
    await expect(dialog.getByRole('alert')).toContainText('bestaat al')
    await dialog.getByRole('button', { name: 'Annuleer' }).click()

    // Op basis van de demo: rondes mee, fragmenten en hun liedjes niet.
    await operator.locator('.new-tile').click()
    await operator.locator('.popover-panel').getByRole('button', { name: 'Demo-pubquiz' }).click()
    await expect(dialog.getByLabel('Naam')).toHaveValue('Demo-pubquiz (nieuw)')
    await operator.waitForTimeout(300)
    await snap(operator, 'test-results/new-quiz-template.png')
    await dialog.getByLabel('Naam').fill('Pubquiz december')
    await dialog.getByRole('button', { name: 'Maak quiz' }).click()
    await expect(operator.locator('.topbar .name')).toHaveText('Pubquiz december')
    await expect(operator.locator('.sidebar .round')).toHaveCount(4)

    const dir = join(library, 'Pubquiz december.quiznote')
    const saved = JSON.parse(readFileSync(join(dir, 'quiz.json'), 'utf8'))
    expect(saved.rounds[1].fragments).toEqual([])
    expect(readdirSync(join(dir, 'media'))).toHaveLength(saved.assets.length)
    expect(readdirSync(join(dir, 'media'))).not.toContain('fragment-1.m4a')
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
