import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { rmSync } from 'fs'
import { dirname } from 'path'
import { command, fakeController } from './fake-magichome'
import {
  confirmIn,
  copyFixture,
  launch,
  openStart,
  snap,
  startShow,
  tempDir,
  useWindowedScreens
} from './helpers'

const PHONE = { width: 390, height: 844 }
const TABLET = { width: 1024, height: 768 }

/** Opent de link uit de QR-code in een verborgen venster zo groot als een telefoon of tablet. */
async function openRemote(
  app: ElectronApplication,
  url: string,
  size: { width: number; height: number }
): Promise<Page> {
  const before = new Set(app.windows())
  await app.evaluate(
    ({ BrowserWindow }, { url, size }) => {
      const win = new BrowserWindow({
        ...size,
        show: false,
        useContentSize: true,
        webPreferences: { sandbox: true, backgroundThrottling: false }
      })
      void win.loadURL(url)
    },
    { url, size }
  )
  // Niet het eerste nieuwe venster: tegelijk kunnen er schermvensters van de show opengaan.
  let page: Page | undefined
  await expect
    .poll(() => (page = app.windows().find((w) => !before.has(w) && w.url() === url)))
    .toBeTruthy()
  await page!.waitForLoadState('domcontentloaded')
  return page!
}

test('de show bedienen met een telefoon via de QR-code', async () => {
  const device = await fakeController()
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  // Alleen op localhost en een vrije poort: geen vraag van de firewall, en een eigen QuizNote die
  // misschien draait, blijft ongemoeid.
  const { app, operator } = await launch(userData, quizDir, {
    PUBQUIZ_REMOTE_HOST: '127.0.0.1',
    PUBQUIZ_REMOTE_PORT: '0'
  })
  const toolbar = operator.locator('.live-controls')
  const macRound = operator.locator('.live .round.on')
  const macSlide = operator.locator('.live .slide.on .slide-kind')
  const mac = operator.getByRole('region', { name: 'Bediening' })
  try {
    // Aanzetten bij Instellingen; daar staat de QR-code meteen, om vóór de show te koppelen.
    await operator.locator('.topbar').getByRole('button', { name: 'Quizzen' }).click()
    await operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
    const settings = operator.getByRole('dialog', { name: 'Instellingen' })
    await settings.getByRole('checkbox', { name: /Afstandsbediening/ }).check()
    await expect(
      settings.getByRole('img', { name: 'QR-code voor de afstandsbediening' })
    ).toBeVisible()
    await settings.getByRole('checkbox', { name: /MagicHome-licht/ }).check()
    const address = settings.getByLabel('IP-adres van de MagicHome-controller')
    await address.fill(device.host)
    await address.press('Enter')
    await expect(settings.locator('.light-status')).toHaveText('Verbonden. Nu: Groen.')
    await snap(operator, 'test-results/remote-settings.png')
    await settings.getByRole('button', { name: 'Klaar' }).click()
    await operator.getByRole('button', { name: 'Bewerken' }).click()

    await openStart(operator)
    await useWindowedScreens(operator)
    await startShow(operator)

    // In de werkbalk van de show: de QR-code met het adres.
    await toolbar.getByRole('button', { name: 'Telefoon' }).click()
    const qr = operator.locator('.popover-panel .remote-qr')
    await expect(qr.getByText('Nog niets verbonden')).toBeVisible()
    const url = (await qr.locator('.url').textContent())!
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/\?key=[\w-]{22}$/)

    const phone = await openRemote(app, url, PHONE)
    await expect(phone.locator('.status')).toHaveText('Live')
    await expect(qr.getByText('1 apparaat verbonden')).toBeVisible()
    await snap(operator, 'test-results/remote-qr.png')
    await operator.keyboard.press('Escape')

    // Rondes en slides, met een preview van de slide die in beeld staat.
    const preview = phone.getByLabel('Preview van de slide')
    await expect(phone.locator('h1')).toHaveText('Hierna: Ronde 1: algemeen')
    await expect(phone.getByRole('button', { name: 'Volgende', exact: true })).toBeDisabled()
    await phone.getByRole('button', { name: /Volgende ronde/ }).click()
    await expect(macRound).toContainText('Ronde 1: algemeen')
    await expect(phone.locator('h1')).toHaveText('Ronde 1: algemeen')
    await expect(phone.getByText('Slide 1 van 3')).toBeVisible()
    await expect(preview).toContainText('Algemene kennis')
    const nextSlide = phone.getByRole('button', { name: 'Volgende slide' })
    const before = await nextSlide.boundingBox()
    await nextSlide.click()
    await expect(macSlide).toHaveText('2')
    // De vraag staat in de preview, en leesbaar onder de knoppen: die verspringen er niet door.
    const question = 'Wat is de hoofdstad van Australië?'
    await expect(preview).toContainText(question)
    await expect(phone.locator('.step-text')).toHaveText(question)
    expect(await nextSlide.boundingBox()).toEqual(before)
    await snap(phone, 'test-results/remote-phone-question.png')
    await phone.getByRole('button', { name: 'Volgende slide' }).click()
    await expect(macSlide).toHaveText('3')
    await expect(phone.locator('.step-text')).toHaveCount(0)
    await phone.getByRole('button', { name: 'Vorige slide' }).click()
    await expect(macSlide).toHaveText('2')

    // In een muziekronde bladeren dezelfde knoppen door de fragmenten, zoals ← → op de Mac.
    const frag = (n: number) => operator.locator('.frag').nth(n - 1)
    await phone.getByRole('button', { name: /Volgende ronde/ }).click()
    await expect(macRound).toContainText('Ronde 2: muziek')
    await expect(phone.getByText('8 fragmenten', { exact: true })).toBeVisible()
    await expect(phone.getByRole('button', { name: 'Vorig fragment' })).toBeDisabled()
    await phone.getByRole('button', { name: 'Volgend fragment' }).click()
    await expect(frag(1)).toHaveClass(/on/)
    await expect(phone.getByText('Fragment 1 van 8')).toBeVisible()
    await expect(phone.locator('.playing')).toHaveText('Speelt')
    await phone.getByRole('button', { name: 'Volgend fragment' }).click()
    await expect(frag(2)).toHaveClass(/on/)
    await expect(phone.getByText('Fragment 2 van 8')).toBeVisible()
    await snap(phone, 'test-results/remote-phone-fragment.png')
    await phone.getByRole('button', { name: 'Vorig fragment' }).click()
    await expect(frag(1)).toHaveClass(/on/)

    // Ronde opnieuw: alles weer ongespeeld, en volgende begint weer bij het eerste fragment.
    await phone.getByRole('button', { name: /Ronde opnieuw/ }).click()
    await expect(phone.getByText('8 fragmenten', { exact: true })).toBeVisible()
    await expect(operator.locator('.frag.played')).toHaveCount(0)
    await expect(operator.locator('.frag.on')).toHaveCount(0)
    await phone.getByRole('button', { name: 'Volgend fragment' }).click()
    await expect(frag(1)).toHaveClass(/on/)

    // Na Einde ronde start Ronde opnieuw de ronde van net; hier met dezelfde knop op de Mac.
    await phone.getByRole('button', { name: /Einde ronde/ }).click()
    await expect(macRound).toHaveCount(0)
    await expect(phone.locator('h1')).toHaveText('Hierna: Pauze')
    await expect(mac.getByRole('button', { name: /Ronde opnieuw/ })).toContainText(
      'Ronde 2: muziek'
    )
    await mac.getByRole('button', { name: /Ronde opnieuw/ }).click()
    await expect(macRound).toContainText('Ronde 2: muziek')
    await expect(phone.getByText('8 fragmenten', { exact: true })).toBeVisible()
    await snap(operator, 'test-results/remote-mac-controls.png')

    // Op de Mac dezelfde knoppen als op de telefoon.
    await mac.getByRole('button', { name: /Vorige ronde/ }).click()
    await expect(macRound).toContainText('Ronde 1: algemeen')
    await expect(phone.getByText('Slide 1 van 3')).toBeVisible()
    await expect(mac.getByText('Slide 1 van 3')).toBeVisible()
    await expect(mac.getByRole('button', { name: 'Vorige slide' })).toBeEnabled()
    await mac.getByRole('button', { name: 'Volgende slide' }).click()
    await expect(phone.getByText('Slide 2 van 3')).toBeVisible()
    await mac.getByRole('button', { name: 'Vorige slide' }).click()
    await expect(macSlide).toHaveText('1')

    // Beeld op zwart en geluid uit doen hetzelfde als de knoppen op de Mac.
    await phone.getByRole('button', { name: 'Beeld op zwart' }).click()
    await expect(toolbar.getByRole('button', { name: /Beeld terug/ })).toBeVisible()
    await phone.getByRole('button', { name: 'Geluid uit' }).click()
    await expect(toolbar.getByRole('button', { name: /Geluid aan/ })).toBeVisible()
    await expect(phone.getByRole('button', { name: 'Beeld terug' })).toBeVisible()
    await expect(phone.getByRole('button', { name: 'Geluid aan' })).toBeVisible()
    await snap(phone, 'test-results/remote-phone-black.png')
    await phone.getByRole('button', { name: 'Beeld terug' }).click()
    await phone.getByRole('button', { name: 'Geluid aan' }).click()
    await expect(toolbar.getByRole('button', { name: /Beeld op zwart/ })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: /Geluid uit/ })).toBeVisible()
    await snap(phone, 'test-results/remote-phone.png')

    // Het licht, via de plug-in MagicHome-licht; de demo-quiz stuurt het zelf niet aan.
    const light = phone.getByRole('region', { name: 'Licht' })
    await expect(light.getByText('De show stuurt het licht nu niet aan')).toBeVisible()
    await light.getByRole('button', { name: 'Blauw', exact: true }).click()
    await expect.poll(() => device.log.at(-1)).toBe(command.color(0, 0, 0xff))
    await expect(light.getByText(/^Met de hand gekozen/)).toBeVisible()
    await light.getByRole('button', { name: /^Rennend punt/, expanded: false }).click()
    await light
      .getByRole('button', { name: 'Rennend punt, rood, naar buiten', exact: true })
      .click()
    // Effect 39 op snelheid 60.
    await expect.poll(() => device.log.at(-1)).toBe('61 00 8a 3c 0f 36')
    await expect(light.locator('.current-label')).toHaveText('Rennend punt, rood, naar buiten')
    await light.scrollIntoViewIfNeeded()
    await snap(phone, 'test-results/remote-phone-light.png', { fullPage: true })
    await light.getByRole('button', { name: 'Volg de show' }).click()
    await expect(light.getByRole('button', { name: 'Volg de show' })).toHaveCount(0)

    // Hetzelfde licht-paneel in de werkbalk op de Mac; de telefoon ziet de keuze meteen.
    await toolbar.getByRole('button', { name: 'Licht' }).click()
    const macLight = operator.locator('.popover-panel').getByRole('region', { name: 'Licht' })
    await macLight.getByRole('button', { name: 'Rood', exact: true }).click()
    await expect.poll(() => device.log.at(-1)).toBe(command.color(0xff, 0, 0))
    await expect(light.getByText(/^Met de hand gekozen/)).toBeVisible()
    await expect(macLight.locator('.current-label')).toHaveText('Rood')
    await snap(operator, 'test-results/remote-mac-light.png')
    await macLight.getByRole('button', { name: 'Volg de show' }).click()
    await expect(light.getByRole('button', { name: 'Volg de show' })).toHaveCount(0)
    await operator.keyboard.press('Escape')

    // Een tablet: de bediening links, het licht rechts.
    const tablet = await openRemote(app, url, TABLET)
    await expect(tablet.locator('h1')).toHaveText('Ronde 1: algemeen')
    await snap(tablet, 'test-results/remote-tablet.png')

    // Een nieuwe code sluit beide buiten.
    await toolbar.getByRole('button', { name: 'Telefoon' }).click()
    await expect(qr.getByText('2 apparaten verbonden')).toBeVisible()
    await qr.getByRole('button', { name: 'Nieuwe code' }).click()
    await expect(qr.locator('.url')).not.toHaveText(url)
    await expect(phone.getByRole('heading', { name: 'Scan de QR-code opnieuw' })).toBeVisible()
    await expect(tablet.getByRole('heading', { name: 'Scan de QR-code opnieuw' })).toBeVisible()
    const renewed = (await qr.locator('.url').textContent())!
    await operator.keyboard.press('Escape')

    // Na de show staat de bediening stil.
    await toolbar.getByRole('button', { name: 'Stop show' }).click()
    await confirmIn(operator, 'Stop show')
    const after = await openRemote(app, renewed, PHONE)
    await expect(after.locator('h1')).toHaveText('Start de show op de Mac')
    await expect(after.getByRole('button', { name: 'Volgende', exact: true })).toBeDisabled()
    await expect(after.locator('.status')).toHaveText('Niet live')
  } finally {
    await app.close()
    await device.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
