import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fakeController } from './fake-magichome'
import { choose, copyFixture, launch, snap, tempDir } from './helpers'

/** De kleinste maat van het venster: `minWidth` en `minHeight` in src/main/windows.ts. */
const WIDTH = 1100
const HEIGHT = 700

/** Hier mag de inhoud wel opzij schuiven: een lange rij slides, een brede tabel met punten. */
const SCROLLS_SIDEWAYS = '.slides, .table-wrap'

const LABELS = {
  nl: {
    quizzes: 'Quizzen',
    settings: 'Instellingen',
    done: 'Klaar',
    setup: 'Quiz-instellingen',
    round: 'Ronde',
    print: 'Afdrukken',
    edit: 'Bewerk',
    windowed: 'Venster op deze laptop (om te testen)'
  },
  en: {
    quizzes: 'Quizzes',
    settings: 'Settings',
    done: 'Done',
    setup: 'Quiz settings',
    round: 'Round',
    print: 'Print',
    edit: 'Edit',
    windowed: 'Window on this laptop (for testing)'
  }
} as const

/** Maakt het venster van de app zo klein als hij mag. */
async function shrink(app: ElectronApplication, page: Page) {
  await app.evaluate(
    ({ BrowserWindow }, [width, height]) => {
      const operator = BrowserWindow.getAllWindows().find((win) =>
        win.webContents.getURL().includes('#/operator')
      )
      operator?.setContentSize(width!, height!)
    },
    [WIDTH, HEIGHT]
  )
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(WIDTH)
}

/**
 * Wat er opzij niet past: bedieningselementen die buiten het venster of hun paneel vallen, tekst
 * die uit zijn knop steekt, en panelen met een horizontale schuifbalk.
 */
function overflowing(page: Page): Promise<string[]> {
  return page.evaluate((allowed) => {
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 40)}"`
    const shown = (el: Element) => {
      const box = el.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility === 'visible'
    }
    const found = new Set<string>()
    for (const el of document.querySelectorAll('button, input, select, textarea, a, [role]')) {
      if (!shown(el) || el.closest(allowed)) continue
      const box = el.getBoundingClientRect()
      if (box.left < -1 || box.right > window.innerWidth + 1)
        found.add(`buiten venster: ${name(el)}`)
      for (let up = el.parentElement; up; up = up.parentElement) {
        if (getComputedStyle(up).overflowX === 'visible') continue
        const outer = up.getBoundingClientRect()
        if (box.left < outer.left - 1 || box.right > outer.right + 1) {
          found.add(`afgesneden door ${name(up).slice(0, 40)}: ${name(el)}`)
        }
      }
      const style = getComputedStyle(el)
      if (
        el.tagName === 'BUTTON' &&
        style.textOverflow !== 'ellipsis' &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        found.add(`tekst past niet: ${name(el)}`)
      }
    }
    for (const el of document.querySelectorAll('*')) {
      if (!shown(el) || el.matches(allowed)) continue
      const { overflowX } = getComputedStyle(el)
      const hasText = [...el.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()
      )
      if (
        hasText &&
        overflowX === 'visible' &&
        !el.closest(allowed) &&
        el.clientWidth > 0 &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        found.add(`tekst steekt uit: ${name(el)}`)
      }
      // Inline tekst heeft geen eigen breedte: vergelijk hem met het element eromheen.
      const parent = el.parentElement
      if (
        hasText &&
        parent &&
        !el.closest(allowed) &&
        getComputedStyle(parent).overflowX === 'visible' &&
        el.getBoundingClientRect().right > parent.getBoundingClientRect().right + 1
      ) {
        found.add(`tekst steekt uit: ${name(el)}`)
      }
      if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
        found.add(`schuifbalk: ${name(el).slice(0, 60)}`)
      }
    }
    return [...found]
  }, SCROLLS_SIDEWAYS)
}

/** De drukste opzet: alle plug-ins aan, teams met punten en een antwoordenronde. */
function busyQuiz(userData: string, quizDir: string, host: string) {
  writeFileSync(
    join(userData, 'settings.json'),
    JSON.stringify({
      plugins: {
        magichome: { enabled: true, config: { host } },
        remote: { enabled: true, config: {} },
        scores: { enabled: true, config: {} }
      }
    })
  )
  const file = join(quizDir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  const [one] = quiz.rounds
  quiz.plugins = {
    ...quiz.plugins,
    scores: {
      teams: ['De Slimmeriken', 'Quizzly Bears', 'Team Kroket'].map((name, i) => ({
        id: `t${i}`,
        name
      })),
      points: { [one.id]: { t0: 7.5, t1: 9, t2: 6 } }
    }
  }
  quiz.rounds.push({ ...one, id: 'antwoorden', title: 'Antwoorden', answersFor: [one.id] })
  writeFileSync(file, JSON.stringify(quiz, null, 2))
}

for (const locale of ['nl', 'en'] as const) {
  test(`alles past in het kleinste venster, in het ${locale === 'nl' ? 'Nederlands' : 'Engels'}`, async () => {
    test.setTimeout(120_000)
    const labels = LABELS[locale]
    const device = await fakeController()
    const userData = tempDir('userdata')
    const quizDir = copyFixture()

    busyQuiz(userData, quizDir, device.host)

    const { app, operator } = await launch(userData, quizDir, {
      PUBQUIZ_LOCALE: locale,
      PUBQUIZ_REMOTE_HOST: '127.0.0.1',
      PUBQUIZ_REMOTE_PORT: '0'
    })

    /** Controleert het scherm dat nu open is, en bewaart de screenshot. */
    const check = async (screen: string) => {
      await operator.waitForTimeout(400) // previews en overgangen laten uitlopen
      expect.soft(await overflowing(operator), screen).toEqual([])
      // Het adres bevat de willekeurige poort van de nep-controller.
      await snap(operator, `test-results/min-window-${locale}-${screen}.png`, {
        mask: [operator.locator('input[aria-label*="MagicHome"]:visible')]
      })
    }

    try {
      await shrink(app, operator)
      await expect(operator.locator('.topbar .name')).toHaveText('Demo-pubquiz')

      // De editor.
      await operator.locator('.sidebar .round').first().click()
      await check('slides')
      await operator.locator('.slide-list .item').first().locator('.thumb').click()
      await check('slide-inspector')
      await operator.getByRole('tab', { name: labels.round }).click()
      await check('round-settings')
      await operator.locator('.sidebar .round').nth(1).click()
      await operator.locator('.track').first().click()
      await check('fragment')
      await operator.getByRole('button', { name: labels.setup }).click()
      await check('setup')
      await operator.getByRole('button', { name: /^Media/ }).click()
      await check('media')
      await operator.locator('.topbar').getByRole('button', { name: labels.print }).click()
      await check('print')
      await operator.locator('.topbar').getByRole('button', { name: labels.print }).click()

      // Het startscherm en Instellingen.
      await operator.locator('.topbar').getByRole('button', { name: labels.quizzes }).click()
      await check('home')
      await operator.locator('.topbar').getByRole('button', { name: labels.settings }).click()
      await check('settings')
      await operator
        .getByRole('dialog', { name: labels.settings })
        .getByRole('button', { name: labels.done })
        .click()
      await operator.getByRole('button', { name: labels.edit, exact: true }).click()

      // De show, met de meeste knoppen in de werkbalk.
      await operator.locator('.topbar').getByRole('button', { name: 'Start show' }).click()
      const sheet = operator.getByRole('dialog', { name: 'Start show' })
      for (const box of await sheet.locator('.screen .screen-target [role="combobox"]').all()) {
        await choose(operator, box, labels.windowed)
      }
      await check('start')
      await sheet.getByRole('button', { name: 'Start show' }).click()
      await expect(operator.locator('.live')).toBeVisible()
      await operator.locator('.rounds .round').first().click()
      // De schermen staan naast elkaar, zodat de bediening eronder ook zonder schuiven in beeld is.
      const [beamer, tv] = await operator.locator('.live .screen').all()
      expect((await beamer!.boundingBox())!.y).toBe((await tv!.boundingBox())!.y)
      await expect(operator.locator('.slides-section')).toBeInViewport({ ratio: 1 })
      // De naam van de quiz past, en de vensterknoppen van macOS houden hun plek.
      const name = operator.locator('.topbar .name')
      await expect(name).toBeVisible()
      expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      expect((await operator.locator('.traffic-space').boundingBox())!.width).toBe(64)
      await check('show-slides')
      await operator.locator('.rounds .round').nth(1).click()
      await check('show-fragments')
      await operator.locator('.rounds .round').last().click()
      await check('show-answers')
    } finally {
      await app.close()
      await device.close()
      rmSync(userData, { recursive: true, force: true })
      rmSync(dirname(quizDir), { recursive: true, force: true })
    }
  })
}

/** Een lange titel loopt door op een volgende regel: niets valt weg, ook niet opzij. */
async function wholeTitle(field: Locator): Promise<void> {
  const size = await field.evaluate((el) => ({
    fits: el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight,
    lines: el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)
  }))
  expect.soft(size.fits).toBe(true)
  expect.soft(size.lines).toBeGreaterThan(1.5)
}

test('een titel blijft één regel tekst, wat je ook typt of plakt', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir)
  try {
    await operator.locator('.sidebar .round').first().click()
    const field = operator.locator('#round-title')
    await field.fill('Ronde 1\nalgemeen')
    await expect(field).toHaveValue('Ronde 1 algemeen')
    await field.press('Enter')
    await expect(field).toHaveValue('Ronde 1 algemeen')
    await expect(operator.locator('.sidebar .round.on .round-title')).toHaveText('Ronde 1 algemeen')
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})

test('lange namen en drie schermen passen in het kleinste venster', async () => {
  test.setTimeout(120_000)
  const labels = LABELS.nl
  const device = await fakeController()
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  busyQuiz(userData, quizDir, device.host)

  // Namen die de quizmaster zelf kiest: lang, en ook een lang woord dat niet kan afbreken.
  const WORD = 'Muziekherkenningsfragmentenachtergrondgeluidenronde'
  const file = join(quizDir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  quiz.title = 'De allerlangste pubquiz van het hele dorp en de wijde omgeving, editie 2026'
  quiz.screens[0].name = 'Beamer boven de bar in de grote zaal achterin het café'
  quiz.screens[1].name = WORD
  quiz.screens.push({ ...quiz.screens[0], id: 'derde', name: 'Derde scherm bij de ingang' })
  quiz.channels[0].name = WORD
  quiz.channels[1].name = 'Fragmenten voor de muziekronde via de kleine speakers'
  quiz.rounds[0].title = 'Ronde 1: algemene kennis, sport, geschiedenis en aardrijkskunde'
  quiz.rounds[1].title = WORD
  quiz.plugins.scores.teams[0].name = 'De Slimmeriken van de Tweede Tafel bij het Raam'
  quiz.plugins.scores.teams[1].name = WORD
  quiz.folders = [
    ...(quiz.folders ?? []),
    {
      id: 'lange-map',
      name: "Alle foto's en filmpjes voor de fotoronde over de geschiedenis van ons dorp"
    },
    { id: 'lang-woord', name: WORD + WORD }
  ]
  writeFileSync(file, JSON.stringify(quiz, null, 2))

  const { app, operator } = await launch(userData, quizDir, {
    PUBQUIZ_REMOTE_HOST: '127.0.0.1',
    PUBQUIZ_REMOTE_PORT: '0'
  })

  const check = async (screen: string) => {
    await operator.waitForTimeout(400) // previews en overgangen laten uitlopen
    expect.soft(await overflowing(operator), screen).toEqual([])
    await snap(operator, `test-results/min-window-long-${screen}.png`, {
      mask: [operator.locator('input[aria-label*="MagicHome"]:visible')]
    })
  }

  try {
    await shrink(app, operator)
    await expect(operator.locator('.topbar .name')).toBeVisible()

    // De editor.
    await operator.locator('.sidebar .round').first().click()
    await check('slides')
    await operator.getByRole('tab', { name: labels.round }).click()
    await check('round-settings')
    await operator.locator('.sidebar .round').nth(1).click()
    await wholeTitle(operator.locator('#round-title'))
    await operator.locator('.track').first().click()
    await check('fragment')
    await operator.getByRole('button', { name: labels.setup }).click()
    await wholeTitle(operator.locator('#quiz-title'))
    await check('setup')
    await operator.getByRole('button', { name: /^Media/ }).click()
    await check('media')
    await operator.locator('.folder', { hasText: 'Alle foto' }).click()
    await wholeTitle(operator.getByLabel('Naam van de map'))
    await check('media-folder')
    await operator.locator('.crumb').click()
    await operator.locator('.folder', { hasText: WORD }).click()
    await wholeTitle(operator.getByLabel('Naam van de map'))
    await check('media-folder-word')
    await operator.locator('.topbar').getByRole('button', { name: labels.print }).click()
    await check('print')
    await operator.locator('.topbar').getByRole('button', { name: labels.print }).click()

    // Het startscherm.
    await operator.locator('.topbar').getByRole('button', { name: labels.quizzes }).click()
    await check('home')
    await operator.getByRole('button', { name: labels.edit, exact: true }).click()

    // De show.
    await operator.locator('.topbar').getByRole('button', { name: 'Start show' }).click()
    const sheet = operator.getByRole('dialog', { name: 'Start show' })
    for (const box of await sheet.locator('.screen .screen-target [role="combobox"]').all()) {
      await choose(operator, box, labels.windowed)
    }
    await check('start')
    await sheet.getByRole('button', { name: 'Start show' }).click()
    await expect(operator.locator('.live')).toBeVisible()
    await operator.locator('.rounds .round').first().click()
    await expect(operator.locator('.topbar .name')).toBeVisible()
    // Het derde scherm staat eronder, even groot als de andere, en de slides blijven in beeld.
    const [first, , third] = await operator.locator('.live .screen').all()
    expect((await third!.boundingBox())!.width).toBe((await first!.boundingBox())!.width)
    await expect(operator.locator('.slides-section')).toBeInViewport({ ratio: 1 })
    await check('show-slides')
    await operator.locator('.rounds .round').nth(1).click()
    await check('show-fragments')
    await operator.locator('.rounds .round').last().click()
    await check('show-answers')
  } finally {
    await app.close()
    await device.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
