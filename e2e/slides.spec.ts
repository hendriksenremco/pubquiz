import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import { copyFixture, launch, tempDir } from './helpers'

// Slides van een ronde op volgorde zetten door ze te slepen, zoals in Keynote.

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

const savedSlides = () =>
  JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8')).rounds[0].slides.map(
    (s: { layout: string; title: string }) => `${s.layout}: ${s.title}`
  )

test('zet slides op volgorde door de miniatuur te slepen', async () => {
  await operator.locator('.sidebar .round').first().click()
  const items = operator.locator('.slide-list .item')
  await expect(items).toHaveCount(3)

  // Het nummer omhoog, in de bovenste helft van de vraag: dan komt het ervoor.
  await items
    .nth(2)
    .locator('.thumb')
    .dragTo(items.nth(1), { targetPosition: { x: 40, y: 8 } })
  // De nummers schuiven mee: het nummer is nu 1, de vraag 2.
  await expect.poll(savedSlides).toEqual(['title: Ronde 1', 'number: 1', 'question: Vraag 2'])
  // Slides slepen is geen bestand neerzetten: de ronde licht niet op.
  await expect(operator.locator('.canvas.dropping')).toHaveCount(0)

  // De titel omlaag, in de onderste helft van de laatste slide: dan komt hij erna. Stap voor
  // stap, om tijdens het slepen de lijn te zien waar hij terechtkomt.
  await items.nth(0).locator('.thumb').hover()
  await operator.mouse.down()
  const last = (await items.nth(2).boundingBox())!
  await operator.mouse.move(last.x + 40, last.y + last.height - 8, { steps: 8 })
  await expect(items.nth(2)).toHaveClass(/drop-after/)
  await expect(items.nth(0)).toHaveClass(/lifted/)
  await operator.screenshot({ path: 'test-results/slides-drag.png' })
  await operator.mouse.up()
  await expect.poll(savedSlides).toEqual(['number: 1', 'question: Vraag 2', 'title: Ronde 1'])
  await expect(operator.locator('.slide-list .lifted, .slide-list [class*="drop-"]')).toHaveCount(0)
})
