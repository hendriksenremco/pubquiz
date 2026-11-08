import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
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

// De screenshots voor quiznote.app (de job `site` in release.yml): site-*.png in het Nederlands,
// site-*.en.png in het Engels. Het is de rondleiding, maar eenvoudiger: alleen de beamer en één
// geluidskanaal, zodat de site niet de indruk geeft dat je meerdere schermen en speakers nodig hebt.

const TEXT = {
  nl: {
    window: 'Venster op deze laptop (om te testen)',
    print: 'Afdrukken',
    round1: 'Ronde 1: algemene kennis',
    round2: 'Ronde 2: muziek',
    round3: 'Ronde 3: vlaggen',
    answers: 'Antwoorden',
    mixQuestion: 'Welke kleur krijg je als je deze twee mengt?',
    green: 'Groen'
  },
  en: {
    window: 'Window on this laptop (for testing)',
    print: 'Print',
    round1: 'Round 1: general knowledge',
    round2: 'Round 2: music',
    round3: 'Round 3: flags',
    answers: 'Answers',
    mixQuestion: 'What colour do you get when you mix these two?',
    green: 'Green'
  }
}

/** Alleen de beamer en het eerste geluidskanaal: de rest van de quiz blijft zoals hij is. */
function simplify(quizDir: string) {
  const file = join(quizDir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  const screen = quiz.screens[0].id as string
  const channel = quiz.channels[0].id as string
  const others = new Set<string>(
    (quiz.screens as { id: string }[]).map((s) => s.id).filter((id) => id !== screen)
  )
  const isOtherScreen = (id: string) => others.has(id)
  quiz.screens = quiz.screens.slice(0, 1)
  quiz.channels = quiz.channels.slice(0, 1)
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      // Lijsten met scherm-id's, zoals de schermen met het fragmentnummer.
      return node.filter((v) => typeof v !== 'string' || !isOtherScreen(v)).map(walk)
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(node)) {
        if (key === 'channelId' && typeof value === 'string') out[key] = channel
        else if (isOtherScreen(key)) continue
        else out[key] = walk(value)
      }
      return out
    }
    return node
  }
  writeFileSync(file, JSON.stringify(walk(quiz), null, 2))
}

for (const locale of ['nl', 'en'] as const) {
  test.describe(`screenshots voor de site (${locale})`, () => {
    const t = TEXT[locale]
    const shot = (name: string) => `test-results/site-${name}${locale === 'nl' ? '' : '.en'}.png`

    let app: ElectronApplication
    let operator: Page
    let userData: string
    let quizDir: string

    const windowFor = (route: string) => windowOf(app, route)

    test.beforeAll(async () => {
      userData = tempDir('userdata')
      quizDir = copyTour(locale)
      simplify(quizDir)
      ;({ app, operator } = await launch(userData, quizDir, { PUBQUIZ_LOCALE: locale }))
    })

    test.afterAll(async () => {
      await app?.close()
      rmSync(userData, { recursive: true, force: true })
      rmSync(dirname(quizDir), { recursive: true, force: true })
    })

    async function shoot(name: string) {
      const beamer = await windowFor('screen/beamer')
      await operator.waitForTimeout(800)
      await snap(operator, shot(name))
      await snap(beamer, shot(`${name}-beamer`))
    }

    const showsText = (page: Page, selector: string, text: string) =>
      expect(page.locator(selector, { hasText: text }).first()).toBeVisible()

    async function startRound(title: string) {
      for (let i = 0; i < 8; i++) {
        if ((await operator.locator('.now-title').textContent())?.trim() === title) return
        await operator.keyboard.press('Enter')
        await operator.waitForTimeout(300)
      }
      await expect(operator.locator('.now-title')).toHaveText(title)
    }

    test('de editor en de show, met alleen de beamer', async () => {
      await operator.locator('.sidebar .round').nth(2).click()
      await expect(operator.locator('#round-title')).toHaveValue(t.round2)
      await operator.waitForTimeout(800)
      await snap(operator, shot('editor'))

      await openStart(operator)
      await useWindowedScreens(operator, t.window)
      await startShow(operator)
      await expect(operator.locator('.live')).toBeVisible()
      const beamer = await windowFor('screen/beamer')
      expect(app.windows().filter((w) => w.url().includes('#/screen/'))).toHaveLength(1)

      await startRound(t.round1)
      await operator.keyboard.press('ArrowRight')
      await operator.keyboard.press('ArrowRight')
      await showsText(beamer, '.slide .body', t.mixQuestion)
      await shoot('vragen')

      await startRound(t.round2)
      await operator.keyboard.press('ArrowRight')
      await expect(beamer.locator('.overlay .ov-number')).toHaveText('1')
      await shoot('muziek')
      await operator.keyboard.press(' ')

      await startRound(t.round3)
      await operator.keyboard.press('ArrowRight')
      await expect(beamer.locator('.slide .image-number', { hasText: '2' })).toBeVisible({
        timeout: 7_000
      })
      await shoot('vlaggen')

      await startRound(t.answers)
      const tiles = operator.locator('.answers .frag')
      await tiles.nth(1).click()
      await showsText(beamer, '.slide .body', t.mixQuestion)
      await tiles.nth(1).click()
      await showsText(beamer, '.overlay.answer .ov-answer', t.green)
      await shoot('antwoorden')

      await operator.getByRole('button', { name: 'Stop show' }).click()
      await confirmIn(operator, 'Stop show')
      await expect.poll(() => app.windows().some((w) => w.url().includes('#/screen/'))).toBe(false)
      await operator.locator('.topbar').getByRole('button', { name: t.print }).click()
      await expect(operator.locator('.print label.option')).not.toHaveCount(0)
      await snap(operator, shot('afdrukken'))
    })
  })
}
