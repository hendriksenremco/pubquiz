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
  snap,
  startShow,
  tempDir,
  useWindowedScreens,
  windowFor as windowOf
} from './helpers'

// De rondleiding van begin tot eind, zoals een quizmaster hem speelt, in het Nederlands en het
// Engels. De screenshots zijn ook voor quiznote.app (de job `site` in release.yml):
// test-results/tour-*.png in het Nederlands, tour-*.en.png in het Engels.

/** Wat de test in beeld verwacht; de id's in quiz.json zijn in beide talen gelijk. */
const TEXT = {
  nl: {
    quiz: 'Rondleiding',
    window: 'Venster op deze laptop (om te testen)',
    missing: /bestand ontbreekt/i,
    print: 'Afdrukken',
    welcome: 'Welkom',
    round1: 'Ronde 1: algemene kennis',
    round2: 'Ronde 2: muziek',
    break: 'Pauze',
    round3: 'Ronde 3: vlaggen',
    round4: 'Ronde 4: kijken en luisteren',
    answers: 'Antwoorden',
    finally: 'Tot slot',
    welcomeTitle: 'Welkom bij QuizNote',
    screensTitle: 'Elk scherm z’n eigen beeld',
    mixQuestion: 'Welke kleur krijg je als je deze twee mengt?',
    clockQuestion: 'Hoe vaak slaat de klok?',
    green: 'Groen',
    song: 'Vader Jacob',
    japan: 'Japan',
    file: {
      welcomeLoop: 'welkom-loop.mp4',
      musicLoop: 'muziek-loop.mp4',
      breakLoop: 'pauze-loop.mp4',
      clock: 'klokslagen.mp4',
      blueAndYellow: 'blauw-en-geel.png',
      green: 'groen.png',
      cover: 'vader-jacob.png',
      japanCrop: 'vlag-japan-uitsnede.png',
      japan: 'vlag-japan.png'
    }
  },
  en: {
    quiz: 'Tour',
    window: 'Window on this laptop (for testing)',
    missing: /file missing/i,
    print: 'Print',
    welcome: 'Welcome',
    round1: 'Round 1: general knowledge',
    round2: 'Round 2: music',
    break: 'Break',
    round3: 'Round 3: flags',
    round4: 'Round 4: watch and listen',
    answers: 'Answers',
    finally: 'Finally',
    welcomeTitle: 'Welcome to QuizNote',
    screensTitle: 'Every screen its own picture',
    mixQuestion: 'What colour do you get when you mix these two?',
    clockQuestion: 'How many times does the clock strike?',
    green: 'Green',
    song: 'Frère Jacques',
    japan: 'Japan',
    file: {
      welcomeLoop: 'welcome-loop.mp4',
      musicLoop: 'music-loop.mp4',
      breakLoop: 'break-loop.mp4',
      clock: 'clock-strikes.mp4',
      blueAndYellow: 'blue-and-yellow.png',
      green: 'green.png',
      cover: 'frere-jacques.png',
      japanCrop: 'flag-japan-crop.png',
      japan: 'flag-japan.png'
    }
  }
}

for (const locale of ['nl', 'en'] as const) {
  test.describe(`rondleiding (${locale})`, () => {
    const t = TEXT[locale]
    const f = t.file
    /** tour-welkom.png in het Nederlands, tour-welkom.en.png in het Engels. */
    const shot = (name: string) => `test-results/tour-${name}${locale === 'nl' ? '' : '.en'}.png`

    let app: ElectronApplication
    let operator: Page
    let userData: string
    let quizDir: string

    const windowFor = (route: string) => windowOf(app, route)
    const audio = () => audioOf(app)

    test.beforeAll(async () => {
      userData = tempDir('userdata')
      quizDir = copyTour(locale)
      ;({ app, operator } = await launch(userData, quizDir, { PUBQUIZ_LOCALE: locale }))
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
      await snap(operator, shot(name))
      await snap(beamer, shot(`${name}-beamer`))
    }

    /** Staat deze tekst in beeld? Tijdens het overvloeien staan oude en nieuwe slide er allebei. */
    const showsText = (page: Page, selector: string, text: string) =>
      expect(page.locator(selector, { hasText: text }).first()).toBeVisible()

    async function startNextRound(title: string) {
      await operator.keyboard.press('Enter')
      await expect(operator.locator('.now-title')).toHaveText(title)
    }

    test('opent de rondleiding en start de show zonder ontbrekende bestanden', async () => {
      await expect(operator.locator('.topbar .name')).toHaveText(t.quiz)
      await expect(operator.locator('.sidebar .round')).toHaveCount(8)
      await operator.locator('.sidebar .round').nth(2).click()
      await expect(operator.locator('#round-title')).toHaveValue(t.round2)
      await operator.waitForTimeout(800)
      await snap(operator, shot('editor'))

      await openStart(operator)
      await useWindowedScreens(operator, t.window)
      await expect(operator.getByText(t.missing)).toHaveCount(0)
      await startShow(operator)
      await expect(operator.locator('.live')).toBeVisible()
      const beamer = await windowFor('screen/beamer')
      await expect.poll(() => activeVideo(beamer)).toContain(f.welcomeLoop)
      await expect.poll(async () => (await audio()).background?.key).toBe('achtergrond@zaal')
    })

    test('welkom: uitleg op de beamer, de tv houdt zijn logo', async () => {
      await startNextRound(t.welcome)
      const beamer = await windowFor('screen/beamer')
      const tv = await windowFor('screen/tv')
      await showsText(beamer, '.slide .title', t.welcomeTitle)
      await expect(tv.locator('.slide')).toHaveCount(0)
      await shoot('welkom')
      await operator.keyboard.press('ArrowRight')
      await showsText(beamer, '.slide .title', t.screensTitle)
    })

    test('ronde 1: een vraag met afbeelding en een vraag met alleen het nummer', async () => {
      await startNextRound(t.round1)
      const beamer = await windowFor('screen/beamer')
      await operator.keyboard.press('ArrowRight')
      await operator.keyboard.press('ArrowRight')
      await showsText(beamer, '.slide .body', t.mixQuestion)
      await expect(beamer.locator(`.slide img.image[src*="${f.blueAndYellow}"]`)).toBeVisible()
      await shoot('vragen')
      await operator.keyboard.press('ArrowRight')
      await expect(beamer.locator('.slide .number')).toHaveText('3')
      await expect(beamer.locator('.slide .body')).toHaveCount(0)
    })

    test('ronde 2: liedjes met de pijltjes, het nummer alleen op de beamer', async () => {
      await startNextRound(t.round2)
      const beamer = await windowFor('screen/beamer')
      const tv = await windowFor('screen/tv')
      await expect.poll(() => activeVideo(beamer)).toContain(f.musicLoop)
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
      await startNextRound(t.break)
      const beamer = await windowFor('screen/beamer')
      const tv = await windowFor('screen/tv')
      await expect.poll(() => activeVideo(beamer)).toContain(f.breakLoop)
      await expect.poll(() => activeVideo(tv)).toContain(f.breakLoop)
      await expect.poll(async () => (await audio()).background?.key).toBe('pauzemuziek@zaal')
      await shoot('pauze')
    })

    test('ronde 3: de vlaggen lopen vanzelf rond', async () => {
      await startNextRound(t.round3)
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
      await startNextRound(t.round4)
      const beamer = await windowFor('screen/beamer')
      await expect.poll(() => activeVideo(beamer)).toContain(f.clock)
      await expect
        .poll(() =>
          beamer
            .locator('.layer.on video')
            .first()
            .evaluate((v: HTMLVideoElement) => v.muted)
        )
        .toBe(false)
      await operator.keyboard.press('ArrowRight')
      await showsText(beamer, '.slide.bare .body', t.clockQuestion)
      await shoot('kijken')
    })

    test('antwoorden: eerst de vraag, dan het antwoord, met een eigen afbeelding', async () => {
      await startNextRound(t.answers)
      const beamer = await windowFor('screen/beamer')
      const tiles = operator.locator('.answers .frag')
      await expect(tiles).toHaveCount(5 + 6 + 6 + 1)

      // Vraag 2: de vraag met de twee kleuren, dan "Groen" met de groene schijf.
      await tiles.nth(1).click()
      await showsText(beamer, '.slide .body', t.mixQuestion)
      await tiles.nth(1).click()
      await showsText(beamer, '.overlay.answer .ov-answer', t.green)
      await expect(beamer.locator(`.slide img[src*="${f.green}"]`)).toBeVisible()
      await shoot('antwoorden')

      // Liedje 1: speelt opnieuw, dan het antwoord met het hoesje.
      await tiles.nth(5).click()
      await expect(beamer.locator('.overlay.fragment .ov-number')).toHaveText('1')
      await tiles.nth(5).click()
      await showsText(beamer, '.overlay.answer .ov-answer', t.song)
      await expect(beamer.locator(`.slide img[src*="${f.cover}"]`)).toBeVisible()
      await shoot('antwoorden-liedje')

      // Vlag 5: een uitsnede als vraag, de hele vlag bij het antwoord.
      await tiles.nth(15).click()
      await expect(beamer.locator(`.slide img[src*="${f.japanCrop}"]`)).toBeVisible()
      await tiles.nth(15).click()
      await showsText(beamer, '.overlay.answer .ov-answer', t.japan)
      await expect(beamer.locator(`.slide img[src*="${f.japan}"]`)).toBeVisible()
    })

    test('tot slot: uitleg over afdrukken, en stoppen', async () => {
      await startNextRound(t.finally)
      const beamer = await windowFor('screen/beamer')
      await showsText(beamer, '.slide .title', t.print)
      await operator.getByRole('button', { name: 'Stop show' }).click()
      await confirmIn(operator, 'Stop show')
      await expect.poll(() => app.windows().some((w) => w.url().includes('#/screen/'))).toBe(false)

      // Afdrukken: de vier rondes met antwoorden staan klaar.
      await operator.locator('.topbar').getByRole('button', { name: t.print }).click()
      await expect(operator.locator('.print label.option .option-title')).toHaveText([
        t.round1,
        t.round2,
        t.round3,
        t.round4
      ])
      await snap(operator, shot('afdrukken'))
    })
  })
}
