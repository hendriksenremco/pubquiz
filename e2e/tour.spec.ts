import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { rmSync } from 'fs'
import { dirname } from 'path'
import {
  activeVideo,
  audio as audioOf,
  confirmIn,
  copyTour,
  launch,
  openStart,
  startShow,
  tempDir,
  useWindowedScreens,
  windowFor as windowOf
} from './helpers'

// De rondleiding van begin tot eind, zoals een quizmaster hem speelt. De screenshots
// (test-results/tour-*.png) zijn ook bruikbaar voor de promotiesite.

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string

const windowFor = (route: string) => windowOf(app, route)
const audio = () => audioOf(app)

test.beforeAll(async () => {
  userData = tempDir('userdata')
  quizDir = copyTour()
  ;({ app, operator } = await launch(userData, quizDir))
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
  rmSync(dirname(quizDir), { recursive: true, force: true })
})

/** Laptop en beamer vastleggen, na het overvloeien. */
async function shoot(name: string) {
  const beamer = await windowFor('screen/beamer')
  await operator.waitForTimeout(800)
  await operator.screenshot({ path: `test-results/tour-${name}.png` })
  await beamer.screenshot({ path: `test-results/tour-${name}-beamer.png` })
}

/** Staat deze tekst in beeld? Tijdens het overvloeien staan oude en nieuwe slide er allebei. */
const showsText = (page: Page, selector: string, text: string) =>
  expect(page.locator(selector, { hasText: text }).first()).toBeVisible()

async function startNextRound(title: string) {
  await operator.keyboard.press('Enter')
  await expect(operator.locator('.now-title')).toHaveText(title)
}

test('opent de rondleiding en start de show zonder ontbrekende bestanden', async () => {
  await expect(operator.locator('.topbar .name')).toHaveText('Rondleiding')
  await expect(operator.locator('.sidebar .round')).toHaveCount(8)
  await operator.locator('.sidebar .round').nth(2).click()
  await expect(operator.locator('#round-title')).toHaveValue('Ronde 2: muziek')
  await operator.waitForTimeout(800)
  await operator.screenshot({ path: 'test-results/tour-editor.png' })

  await openStart(operator)
  await useWindowedScreens(operator)
  await expect(operator.getByText(/Bestand ontbreekt/)).toHaveCount(0)
  await startShow(operator)
  await expect(operator.locator('.live')).toBeVisible()
  const beamer = await windowFor('screen/beamer')
  await expect.poll(() => activeVideo(beamer)).toContain('welkom-loop.mp4')
  await expect.poll(async () => (await audio()).background?.key).toBe('achtergrond@zaal')
})

test('welkom: uitleg op de beamer, de tv houdt zijn logo', async () => {
  await startNextRound('Welkom')
  const beamer = await windowFor('screen/beamer')
  const tv = await windowFor('screen/tv')
  await showsText(beamer, '.slide .title', 'Welkom bij QuizNote')
  await expect(tv.locator('.slide')).toHaveCount(0)
  await shoot('welkom')
  await operator.keyboard.press('ArrowRight')
  await showsText(beamer, '.slide .title', 'Elk scherm z’n eigen beeld')
})

test('ronde 1: een vraag met afbeelding en een vraag met alleen het nummer', async () => {
  await startNextRound('Ronde 1: algemene kennis')
  const beamer = await windowFor('screen/beamer')
  await operator.keyboard.press('ArrowRight')
  await operator.keyboard.press('ArrowRight')
  await showsText(beamer, '.slide .body', 'Welke kleur krijg je als je deze twee mengt?')
  await expect(beamer.locator('.slide img.image[src*="blauw-en-geel.png"]')).toBeVisible()
  await shoot('vragen')
  await operator.keyboard.press('ArrowRight')
  await expect(beamer.locator('.slide .number')).toHaveText('3')
  await expect(beamer.locator('.slide .body')).toHaveCount(0)
})

test('ronde 2: liedjes met de pijltjes, het nummer alleen op de beamer', async () => {
  await startNextRound('Ronde 2: muziek')
  const beamer = await windowFor('screen/beamer')
  const tv = await windowFor('screen/tv')
  await expect.poll(() => activeVideo(beamer)).toContain('muziek-loop.mp4')
  await expect.poll(async () => (await audio()).background?.playing).toBe(false)

  await operator.keyboard.press('ArrowRight')
  await expect(operator.locator('.frag').first()).toHaveClass(/on/)
  await expect(beamer.locator('.overlay .ov-number')).toHaveText('1')
  await expect(tv.locator('.overlay')).toHaveCount(0)
  await expect.poll(async () => (await audio()).fragment).not.toBeNull()
  await shoot('muziek')
  await operator.keyboard.press(' ')
})

test('pauze: andere muziek en de pauze-loop op alle schermen', async () => {
  await startNextRound('Pauze')
  const beamer = await windowFor('screen/beamer')
  const tv = await windowFor('screen/tv')
  await expect.poll(() => activeVideo(beamer)).toContain('pauze-loop.mp4')
  await expect.poll(() => activeVideo(tv)).toContain('pauze-loop.mp4')
  await expect.poll(async () => (await audio()).background?.key).toBe('pauzemuziek@zaal')
  await shoot('pauze')
})

test('ronde 3: de vlaggen lopen vanzelf rond', async () => {
  await startNextRound('Ronde 3: vlaggen')
  const beamer = await windowFor('screen/beamer')
  await operator.keyboard.press('ArrowRight')
  await showsText(beamer, '.slide .image-number', '1')
  // Na 5 seconden vanzelf de volgende.
  await expect(beamer.locator('.slide .image-number', { hasText: '2' })).toBeVisible({
    timeout: 7_000
  })
  await shoot('vlaggen')
})

test('ronde 4: de video speelt zijn geluid via de beamer, de vraag staat erover', async () => {
  await startNextRound('Ronde 4: kijken en luisteren')
  const beamer = await windowFor('screen/beamer')
  await expect.poll(() => activeVideo(beamer)).toContain('klokslagen.mp4')
  await expect
    .poll(() =>
      beamer
        .locator('.layer.on video')
        .first()
        .evaluate((v: HTMLVideoElement) => v.muted)
    )
    .toBe(false)
  await operator.keyboard.press('ArrowRight')
  await showsText(beamer, '.slide.bare .body', 'Hoe vaak slaat de klok?')
  await shoot('kijken')
})

test('antwoorden: eerst de vraag, dan het antwoord, met een eigen afbeelding', async () => {
  await startNextRound('Antwoorden')
  const beamer = await windowFor('screen/beamer')
  const tiles = operator.locator('.answers .frag')
  await expect(tiles).toHaveCount(5 + 6 + 6 + 1)

  // Vraag 2: de vraag met de twee kleuren, dan "Groen" met de groene schijf.
  await tiles.nth(1).click()
  await showsText(beamer, '.slide .body', 'Welke kleur krijg je als je deze twee mengt?')
  await tiles.nth(1).click()
  await showsText(beamer, '.overlay.answer .ov-answer', 'Groen')
  await expect(beamer.locator('.slide img[src*="groen.png"]')).toBeVisible()
  await shoot('antwoorden')

  // Liedje 1: speelt opnieuw, dan het antwoord met het hoesje.
  await tiles.nth(5).click()
  await expect(beamer.locator('.overlay.fragment .ov-number')).toHaveText('1')
  await tiles.nth(5).click()
  await showsText(beamer, '.overlay.answer .ov-answer', 'Vader Jacob')
  await expect(beamer.locator('.slide img[src*="vader-jacob.png"]')).toBeVisible()
  await shoot('antwoorden-liedje')

  // Vlag 5: een uitsnede als vraag, de hele vlag bij het antwoord.
  await tiles.nth(15).click()
  await expect(beamer.locator('.slide img[src*="japan-uitsnede.png"]')).toBeVisible()
  await tiles.nth(15).click()
  await showsText(beamer, '.overlay.answer .ov-answer', 'Japan')
  await expect(beamer.locator('.slide img[src*="vlag-japan.png"]')).toBeVisible()
})

test('tot slot: uitleg over afdrukken, en stoppen', async () => {
  await startNextRound('Tot slot')
  const beamer = await windowFor('screen/beamer')
  await showsText(beamer, '.slide .title', 'Afdrukken')
  await operator.getByRole('button', { name: 'Stop show' }).click()
  await confirmIn(operator, 'Stop show')
  await expect.poll(() => app.windows().some((w) => w.url().includes('#/screen/'))).toBe(false)

  // Afdrukken: de vier rondes met antwoorden staan klaar.
  await operator.locator('.topbar').getByRole('button', { name: 'Afdrukken' }).click()
  await expect(operator.locator('.print label.option .option-title')).toHaveText([
    'Ronde 1: algemene kennis',
    'Ronde 2: muziek',
    'Ronde 3: vlaggen',
    'Ronde 4: kijken en luisteren'
  ])
  await operator.screenshot({ path: 'test-results/tour-afdrukken.png' })
})
