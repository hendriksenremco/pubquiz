import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { audio, copyFixture, launch, tempDir, useWindowedScreens, windowFor } from './helpers'

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string

/** Een map "Plaatjes" met drie afbeeldingen in de Media, zoals na importeren. */
function addPictures(dir: string) {
  const file = join(dir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  quiz.folders.push({ id: 'plaatjes', name: 'Plaatjes' })
  for (const n of [1, 2, 3]) {
    copyFileSync(join(dir, 'media', 'logo.png'), join(dir, 'media', `foto-${n}.png`))
    quiz.assets.push({
      id: `foto${n}`,
      kind: 'image',
      file: `media/foto-${n}.png`,
      name: `Foto ${n}.png`,
      folderId: 'plaatjes'
    })
  }
  writeFileSync(file, JSON.stringify(quiz))
}

test.beforeAll(async () => {
  userData = tempDir('userdata')
  quizDir = copyFixture()
  addPictures(quizDir)
  ;({ app, operator } = await launch(userData, quizDir))
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
  rmSync(dirname(quizDir), { recursive: true, force: true })
})

const addRound = async (preset: string) => {
  await operator.getByRole('button', { name: 'Ronde toevoegen' }).click()
  await operator.locator('.menu-item', { hasText: preset }).click()
}

test('een vraag kan alleen zijn nummer in beeld tonen', async () => {
  await operator.locator('.sidebar .round').first().click()
  await operator.locator('.strip .thumb').nth(1).click()
  await operator.locator('.shown-chip').click()
  await operator.locator('.menu-item', { hasText: 'Alleen het nummer' }).click()
  await expect(operator.locator('.shown-chip')).toContainText('alleen het nummer')
  await expect(operator.locator('.thumb.on .slide .number')).toHaveText('1')
  await expect(operator.locator('.thumb.on .slide .body')).toHaveCount(0)
})

test('een afbeeldingenronde vul je in één keer met een map uit Media', async () => {
  await addRound('Afbeeldingenronde')
  await expect(operator.locator('#round-title')).toHaveValue('Ronde 5: afbeeldingen')

  await operator.getByRole('button', { name: 'Slide toevoegen' }).click()
  await operator.locator('.menu-item', { hasText: 'Plaatjes' }).click()
  // Titelslide plus drie afbeeldingen; de eerste afbeelding is geselecteerd.
  await expect(operator.locator('.strip .thumb:not(.add)')).toHaveCount(4)
  await expect(operator.locator('.thumb.on .image-number')).toHaveText('1')
  await operator.getByLabel('Antwoord').fill('De Eiffeltoren')
  // Bij het antwoord een andere afbeelding dan bij de vraag.
  await operator.locator('.answer-row .chip').click()
  await operator.locator('.popover-panel button[title="Foto 3.png"]').click()
  await expect(operator.locator('.answer-row .chip')).toContainText('Foto 3')

  // Eindeloos laten rondgaan, elke seconde (kort, voor de test).
  await operator.locator('.loop-chip').click()
  await operator.getByLabel('Slides vanzelf laten wisselen').check()
  await operator.getByLabel('Seconden per slide').fill('1')
  await operator.getByLabel('Seconden per slide').press('Enter')
  await operator.keyboard.press('Escape')
  await expect(operator.locator('.loop-chip')).toContainText('elke 1 s')
  await operator.waitForTimeout(400)
  await operator.screenshot({ path: 'test-results/pictures-editor.png' })
})

test('een antwoordenronde loopt vragen, afbeeldingen en fragmenten langs', async () => {
  await addRound('Antwoorden')
  const chip = operator.locator('.answers-chip')
  await expect(chip).toContainText('4 rondes')
  await chip.click()
  const menu = operator.locator('.answers-menu')
  await expect(menu.locator('.check-row', { hasText: 'Ronde 1: algemeen' })).toContainText(
    '2 vragen'
  )
  await expect(menu.locator('.check-row', { hasText: 'Ronde 5: afbeeldingen' })).toContainText(
    '3 afbeeldingen'
  )
  await operator.waitForTimeout(300)
  await operator.screenshot({ path: 'test-results/answers-editor.png' })
  await operator.keyboard.press('Escape')
})

test('live: eerst de vraag, afbeelding of het fragment, dan het antwoord', async () => {
  await operator.getByRole('button', { name: 'Show', exact: true }).click()
  await useWindowedScreens(operator)
  await operator.getByRole('button', { name: 'Start show' }).click()
  const beamer = await windowFor(app, 'screen/beamer')
  const tv = await windowFor(app, 'screen/tv')

  // Ronde 1: vraag 1 met alleen het nummer in beeld.
  await operator.locator('.rounds .round').first().click()
  await operator.keyboard.press('ArrowRight')
  await expect(beamer.locator('.slide.layout-question .number')).toHaveText('1')
  await expect(beamer.locator('.slide .body')).toHaveCount(0)
  await beamer.waitForTimeout(500)
  await beamer.screenshot({ path: 'test-results/question-number-only.png' })

  // De afbeeldingenronde zelf: → naar de eerste afbeelding, daarna gaat de loop vanzelf rond.
  await operator.locator('.rounds .round').nth(4).click()
  await operator.keyboard.press('ArrowRight')
  const number = beamer.locator('.slide.layout-image .image-number').last()
  await expect(number).toHaveText('1')
  await expect(number).toHaveText('2', { timeout: 3_000 })
  await expect(number).toHaveText('3', { timeout: 3_000 })
  await expect(number).toHaveText('1', { timeout: 3_000 })
  // Pauzeren met L: hij blijft staan.
  await operator.keyboard.press('l')
  await expect(operator.getByRole('button', { name: /Loop verder/ })).toBeVisible()
  const paused = await number.textContent()
  await operator.waitForTimeout(1_600)
  await expect(number).toHaveText(paused!)

  // Antwoorden: vraag 1 van ronde 1 staat eerst zelf in beeld, dan het antwoord eronder.
  await operator.locator('.rounds .round').last().click()
  await expect(beamer.locator('.slide .title')).toHaveText('Antwoorden')
  await operator.keyboard.press('ArrowRight')
  await expect(beamer.locator('.slide.layout-question .body')).toHaveText(
    'Wat is de hoofdstad van Australië?'
  )
  await expect(beamer.locator('.overlay')).toHaveCount(0)
  await operator.keyboard.press('ArrowRight')
  await expect(beamer.locator('.overlay.answer.bottom .ov-answer')).toHaveText('Canberra')
  await expect(beamer.locator('.overlay .ov-context')).toHaveText('Ronde 1: algemeen, vraag 1')
  await expect(tv.locator('.overlay')).toHaveCount(0)
  await beamer.waitForTimeout(700)
  await beamer.screenshot({ path: 'test-results/answers-question.png' })

  // Fragment 1 van ronde 2: speelt opnieuw met zijn nummer, dan het antwoord in het midden.
  const tiles = operator.locator('.answers .frag')
  await tiles.nth(2).click()
  await expect(beamer.locator('.overlay.fragment .ov-number')).toHaveText('1')
  await expect(beamer.locator('.overlay.fragment .ov-context')).toHaveText('Ronde 2: muziek')
  await expect.poll(async () => (await audio(app)).fragment).not.toBeNull()
  await tiles.nth(2).click()
  await expect(beamer.locator('.overlay.answer:not(.bottom) .ov-answer')).toHaveText('Antwoord 1')

  // Afbeelding 1 van de afbeeldingenronde: de afbeelding, dan het antwoord eronder.
  await tiles.nth(18).click()
  await expect(beamer.locator('.slide.layout-image .image-number')).toHaveText('1')
  await tiles.nth(18).click()
  await expect(beamer.locator('.overlay.answer.bottom .ov-answer')).toHaveText('De Eiffeltoren')
  // De eigen afbeelding bij het antwoord vervangt die van de vraag.
  await expect(beamer.locator('.slide.layout-image img').last()).toHaveAttribute(
    'src',
    /foto-3\.png/
  )
  await beamer.waitForTimeout(700)
  await beamer.screenshot({ path: 'test-results/answers-picture.png' })

  // Alleen wat echt in beeld is geweest staat op gedaan.
  await expect(tiles.nth(0)).toContainText('gedaan')
  await expect(tiles.nth(1)).not.toContainText('gedaan')
  await operator.waitForTimeout(400)
  await operator.screenshot({ path: 'test-results/answers-live.png' })

  await operator.locator('.answers').getByRole('button', { name: 'Stop', exact: true }).click()
  await expect(beamer.locator('.overlay')).toHaveCount(0)

  operator.once('dialog', (d) => d.accept())
  await operator.getByRole('button', { name: 'Stop show' }).click()
  await expect.poll(() => app.windows().some((w) => w.url().includes('#/screen/'))).toBe(false)
})
