import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  audio,
  confirmIn,
  copyFixture,
  launch,
  openRemote,
  openStart,
  PHONE,
  snap,
  startShow,
  tempDir,
  useWindowedScreens,
  windowFor
} from './helpers'

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
  // De afstandsbediening staat aan, om Stop antwoorden ook op de telefoon te proberen.
  writeFileSync(
    join(userData, 'settings.json'),
    JSON.stringify({ plugins: { remote: { enabled: true, config: {} } } })
  )
  ;({ app, operator } = await launch(userData, quizDir, {
    PUBQUIZ_REMOTE_HOST: '127.0.0.1',
    PUBQUIZ_REMOTE_PORT: '0'
  }))
})

test.afterAll(async () => {
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
  rmSync(dirname(quizDir), { recursive: true, force: true })
})

const addRound = async (preset: string) => {
  await operator.getByRole('button', { name: 'Voeg ronde toe' }).click()
  await operator.locator('.menu-item', { hasText: preset }).click()
}

test('een vraag kan alleen zijn nummer in beeld tonen', async () => {
  await operator.locator('.sidebar .round').first().click()
  const question = operator.locator('.slide-list .item').nth(1)
  await question.locator('.thumb').click()
  await operator
    .getByRole('group', { name: 'Op de slide', exact: true })
    .getByRole('button', { name: 'Alleen het nummer' })
    .click()
  await expect(question).toContainText('alleen het nummer op de slide')
  await expect(question.locator('.slide .number')).toHaveText('1')
  await expect(question.locator('.slide .body')).toHaveCount(0)
})

test('een afbeeldingenronde vul je in één keer met een map uit Media', async () => {
  await addRound('Afbeeldingenronde')
  await expect(operator.locator('#round-title')).toHaveValue('Ronde 5: afbeeldingen')

  await operator.locator('.add-bar').getByRole('button', { name: 'Afbeeldingen' }).click()
  await operator.locator('.menu-item', { hasText: 'Plaatjes' }).click()
  // Titelslide plus drie afbeeldingen; de eerste afbeelding is geselecteerd.
  await expect(operator.locator('.slide-list .item')).toHaveCount(4)
  const picked = operator.locator('.slide-list .item.on')
  await expect(picked.locator('.image-number')).toHaveText('1')
  await picked.getByLabel('Antwoord').fill('De Eiffeltoren')
  // Bij het antwoord een andere afbeelding dan bij de vraag.
  const answerImage = operator.getByRole('button', { name: 'Afbeelding bij het antwoord' })
  await answerImage.click()
  await operator.locator('.popover-panel button[title="Foto 3.png"]').click()
  await expect(answerImage).toContainText('Foto 3')

  // Eindeloos laten rondgaan, elke seconde (kort, voor de test).
  await operator.getByRole('tab', { name: 'Ronde' }).click()
  await operator.getByLabel('Vanzelf wisselen').check()
  await operator.getByLabel('Seconden per slide').fill('1')
  await operator.getByLabel('Seconden per slide').press('Enter')
  await expect
    .poll(
      () => JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8')).rounds[4]?.slideLoopSeconds
    )
    .toBe(1)
  await operator.waitForTimeout(400)
  await snap(operator, 'test-results/pictures-editor.png')
})

test('een antwoordenronde loopt vragen, afbeeldingen en fragmenten langs', async () => {
  await addRound('Antwoordenronde')
  await operator.getByRole('tab', { name: 'Ronde' }).click()
  const sources = operator.locator('.answers .check-row')
  await expect(sources.locator('input:checked')).toHaveCount(4)
  await expect(sources.filter({ hasText: 'Ronde 1: algemeen' })).toContainText('2 vragen')
  await expect(sources.filter({ hasText: 'Ronde 5: afbeeldingen' })).toContainText('3 afbeeldingen')
  await operator.waitForTimeout(300)
  await snap(operator, 'test-results/answers-editor.png')
})

test('live: eerst de vraag, afbeelding of het fragment, dan het antwoord', async () => {
  await openStart(operator)
  await useWindowedScreens(operator)
  await startShow(operator)
  const beamer = await windowFor(app, 'screen/beamer')
  const tv = await windowFor(app, 'screen/tv')

  // Ronde 1: vraag 1 met alleen het nummer in beeld.
  await operator.locator('.rounds .round').first().click()
  await operator.keyboard.press('ArrowRight')
  await expect(beamer.locator('.slide.layout-question .number')).toHaveText('1')
  await expect(beamer.locator('.slide .body')).toHaveCount(0)
  await beamer.waitForTimeout(500)
  await snap(beamer, 'test-results/question-number-only.png')

  // De afbeeldingenronde zelf: → naar de eerste afbeelding, daarna wisselen de slides vanzelf.
  await operator.locator('.rounds .round').nth(4).click()
  await operator.keyboard.press('ArrowRight')
  const number = beamer.locator('.slide.layout-image .image-number').last()
  await expect(number).toHaveText('1')
  await expect(number).toHaveText('2', { timeout: 3_000 })
  await expect(number).toHaveText('3', { timeout: 3_000 })
  await expect(number).toHaveText('1', { timeout: 3_000 })
  // Pauzeren met L: hij blijft staan.
  await operator.keyboard.press('l')
  await expect(operator.getByRole('button', { name: /Hervat wisselen/ })).toBeVisible()
  const paused = await number.textContent()
  await operator.waitForTimeout(1_600)
  await expect(number).toHaveText(paused!)

  // Op de telefoon staat het wisselen bij Slides, met dezelfde tekst ernaast als op de Mac.
  await operator.locator('.live-controls').getByRole('button', { name: 'Telefoon' }).click()
  const url = (await operator.locator('.popover-panel .remote-qr .url').textContent())!
  await operator.keyboard.press('Escape')
  const phone = await openRemote(app, url, PHONE)
  const phoneSlides = phone.getByRole('region', { name: 'Slides' })
  await expect(phoneSlides.locator('.title-status')).toHaveText('Wisselen gepauzeerd')
  await phoneSlides.getByRole('button', { name: 'Hervat wisselen' }).click()
  await expect(operator.getByRole('button', { name: /Pauzeer wisselen/ })).toBeVisible()
  // Eén seconde per slide: de telefoon telt nooit verder terug dan dat.
  await expect(phoneSlides.locator('.title-status')).toHaveText('Volgende over 1 s')
  await phoneSlides.getByRole('button', { name: 'Pauzeer wisselen' }).click()
  await expect(operator.getByRole('button', { name: /Hervat wisselen/ })).toBeVisible()
  await expect(phoneSlides.locator('.title-status')).toHaveText('Wisselen gepauzeerd')
  await phoneSlides.evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await snap(phone, 'test-results/remote-phone-loop.png')

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
  await snap(beamer, 'test-results/answers-question.png')

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
  await snap(beamer, 'test-results/answers-picture.png')

  // Alleen wat echt in beeld is geweest staat op gedaan.
  await expect(tiles.nth(0)).toContainText('gedaan')
  await expect(tiles.nth(1)).not.toContainText('gedaan')
  await operator.waitForTimeout(400)
  await snap(operator, 'test-results/answers-live.png')

  // Vorige en volgende staan alleen in de zijbalk; het blok zegt wat → hierna doet.
  await expect(operator.locator('.answers .next-step')).toContainText('Volgende afbeelding')
  await expect(operator.locator('.answers').getByRole('button', { name: 'Vorige' })).toHaveCount(0)
  await operator.getByRole('button', { name: 'Volgende stap' }).click()
  await expect(operator.locator('.answers .next-step')).toContainText('Toon antwoord')

  // Stop antwoorden staat ook op de telefoon, met dezelfde naam.
  const stopOnPhone = phone.getByRole('button', { name: 'Stop antwoorden' })
  await stopOnPhone.click()
  await expect(beamer.locator('.overlay')).toHaveCount(0)
  await expect(stopOnPhone).toHaveCount(0)
  await expect(
    operator.locator('.answers').getByRole('button', { name: 'Stop antwoorden' })
  ).toHaveCount(0)

  // En op de Mac.
  await operator.keyboard.press('ArrowRight')
  await expect(stopOnPhone).toBeVisible()
  await operator.locator('.answers').getByRole('button', { name: 'Stop antwoorden' }).click()
  await expect(beamer.locator('.overlay')).toHaveCount(0)
  await expect(stopOnPhone).toHaveCount(0)

  // Eén vraag kiezen op de telefoon, zoals een tik bij Antwoorden op de Mac: eerst de vraag, nog
  // eens tikken toont het antwoord, en nog eens verbergt het weer.
  const phoneTiles = phone.locator('.frag')
  await expect(phoneTiles).toHaveCount(await tiles.count())
  await expect(phoneTiles.nth(0)).toContainText('Canberra')
  // Met de vraag zelf, zoals de tegel op de Mac, en het kopje Antwoorden erboven.
  await expect(phoneTiles.nth(0).locator('.frag-question')).toHaveText(
    'Wat is de hoofdstad van Australië?'
  )
  await expect(
    phone.getByRole('region', { name: 'Antwoorden' }).locator('.slides-title')
  ).toHaveText('Antwoorden')
  await phoneTiles.nth(0).click()
  await expect(beamer.locator('.slide.layout-question .body')).toHaveText(
    'Wat is de hoofdstad van Australië?'
  )
  await expect(beamer.locator('.overlay')).toHaveCount(0)
  await expect(tiles.nth(0)).toHaveClass(/\bon\b/)
  await expect(phoneTiles.nth(0)).toHaveAttribute('aria-pressed', 'true')
  await expect(phoneTiles.nth(0)).toContainText('vraag in beeld')
  // Naast het kopje staat wat er in beeld staat, met dezelfde tekst als naast Antwoorden op de Mac.
  const phoneStatus = phone.getByRole('region', { name: 'Antwoorden' }).locator('.title-status')
  const macStatus = operator.locator('.answers .card-head .pill-accent')
  await expect(phoneStatus).toHaveText('Vraag 1 in beeld')
  await expect(macStatus).toHaveText('Vraag 1 in beeld')
  await phoneTiles.nth(0).click()
  await expect(beamer.locator('.overlay.answer.bottom .ov-answer')).toHaveText('Canberra')
  await expect(phoneTiles.nth(0)).toContainText('antwoord in beeld')
  await expect(phoneStatus).toHaveText('Vraag 1: antwoord in beeld')
  await expect(macStatus).toHaveText('Vraag 1: antwoord in beeld')
  await expect(phone.locator('.group-title').first()).toHaveText('Ronde 1: algemeen')
  // De tegels midden in beeld, met het kopje van de ronde erboven.
  await phoneTiles.nth(0).evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await snap(phone, 'test-results/remote-phone-answers.png')
  await phoneTiles.nth(0).click()
  await expect(beamer.locator('.overlay')).toHaveCount(0)
  await expect(phoneTiles.nth(0)).toContainText('vraag in beeld')

  await operator.getByRole('button', { name: 'Stop show' }).click()
  await confirmIn(operator, 'Stop show')
  await expect.poll(() => app.windows().some((w) => w.url().includes('#/screen/'))).toBe(false)
})
