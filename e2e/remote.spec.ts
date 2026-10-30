import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { rmSync } from 'fs'
import { dirname } from 'path'
import { command, fakeController } from './fake-magichome'
import {
  confirmIn,
  copyFixture,
  launch,
  openStart,
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
    await operator.screenshot({ path: 'test-results/remote-settings.png' })
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
    await operator.screenshot({ path: 'test-results/remote-qr.png' })
    await operator.keyboard.press('Escape')

    // Rondes en slides.
    await expect(phone.locator('h1')).toHaveText('Hierna: Ronde 1: algemeen')
    await expect(phone.getByRole('button', { name: 'Volgende slide' })).toBeDisabled()
    await phone.getByRole('button', { name: /Volgende ronde/ }).click()
    await expect(macRound).toContainText('Ronde 1: algemeen')
    await expect(phone.locator('h1')).toHaveText('Ronde 1: algemeen')
    await expect(phone.getByText(/^Slide 1 van \d+$/)).toBeVisible()
    await phone.getByRole('button', { name: 'Volgende slide' }).click()
    await expect(macSlide).toHaveText('2')
    await phone.getByRole('button', { name: 'Volgende slide' }).click()
    await expect(macSlide).toHaveText('3')
    await phone.getByRole('button', { name: 'Vorige slide' }).click()
    await expect(macSlide).toHaveText('2')
    await phone.getByRole('button', { name: /Volgende ronde/ }).click()
    await expect(macRound).toContainText('Ronde 2: muziek')
    await phone.getByRole('button', { name: /Vorige ronde/ }).click()
    await expect(macRound).toContainText('Ronde 1: algemeen')
    await expect(phone.getByText(/^Slide 1 van \d+$/)).toBeVisible()

    // Beeld op zwart en geluid uit doen hetzelfde als de knoppen op de Mac.
    await phone.getByRole('button', { name: 'Beeld op zwart' }).click()
    await expect(toolbar.getByRole('button', { name: /Beeld terug/ })).toBeVisible()
    await phone.getByRole('button', { name: 'Geluid uit' }).click()
    await expect(toolbar.getByRole('button', { name: /Geluid aan/ })).toBeVisible()
    await expect(phone.getByRole('button', { name: 'Beeld terug' })).toBeVisible()
    await expect(phone.getByRole('button', { name: 'Geluid aan' })).toBeVisible()
    await phone.screenshot({ path: 'test-results/remote-phone-black.png' })
    await phone.getByRole('button', { name: 'Beeld terug' }).click()
    await phone.getByRole('button', { name: 'Geluid aan' }).click()
    await expect(toolbar.getByRole('button', { name: /Beeld op zwart/ })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: /Geluid uit/ })).toBeVisible()
    await phone.screenshot({ path: 'test-results/remote-phone.png' })

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
    await phone.screenshot({ path: 'test-results/remote-phone-light.png', fullPage: true })
    await light.getByRole('button', { name: 'Volg de show' }).click()
    await expect(light.getByRole('button', { name: 'Volg de show' })).toHaveCount(0)

    // Een tablet: de bediening links, het licht rechts.
    const tablet = await openRemote(app, url, TABLET)
    await expect(tablet.locator('h1')).toHaveText('Ronde 1: algemeen')
    await tablet.screenshot({ path: 'test-results/remote-tablet.png' })

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
    await expect(after.getByRole('button', { name: 'Volgende slide' })).toBeDisabled()
    await expect(after.locator('.status')).toHaveText('Niet live')
  } finally {
    await app.close()
    await device.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
