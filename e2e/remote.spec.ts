import { expect, test } from '@playwright/test'
import { rmSync } from 'fs'
import { dirname } from 'path'
import { command, fakeController } from './fake-magichome'
import {
  confirmIn,
  copyFixture,
  launch,
  openRemote,
  openStart,
  PHONE,
  snap,
  startShow,
  TABLET,
  tempDir,
  useWindowedScreens
} from './helpers'

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
    // De nep-controller krijgt elke run een andere poort.
    await snap(operator, 'test-results/remote-settings.png', { mask: [address] })
    await settings.getByRole('button', { name: 'Klaar' }).click()
    await operator.getByRole('button', { name: 'Bewerk', exact: true }).click()

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
    await expect(qr.getByText('Op een open wifi-netwerk')).toBeVisible()
    await snap(operator, 'test-results/remote-qr.png')
    await operator.keyboard.press('Escape')

    // Rondes en slides, met een voorbeeld van de slide die in beeld staat.
    const preview = phone.getByLabel('Voorbeeld van de slide')
    await expect(phone.locator('h1')).toHaveText('Hierna: Ronde 1: algemeen')
    await expect(phone.getByRole('button', { name: 'Volgende', exact: true })).toBeDisabled()
    const notes = phone.getByRole('region', { name: 'Notities' })
    await expect(notes).toHaveCount(0)
    await phone.getByRole('button', { name: /Volgende ronde/ }).click()
    await expect(macRound).toContainText('Ronde 1: algemeen')
    await expect(phone.locator('h1')).toHaveText('Ronde 1: algemeen')
    await expect(phone.getByText('Slide 1 van 3')).toBeVisible()
    // De notities bij de ronde, zoals onder de rondes op de Mac.
    await expect(notes).toContainText('Vragen staan op papier. Antwoorden: zie map.')
    await expect(preview).toContainText('Algemene kennis')
    const nextSlide = phone.getByRole('button', { name: 'Volgende slide' })
    // De naam staat op de knop zelf, niet alleen voor een schermlezer.
    await expect(nextSlide).toHaveText('Volgende slide')
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

    // Eén slide kiezen, of Geen slide, zoals bij Slides in de show op de Mac.
    const slides = phone.getByRole('region', { name: 'Slides' })
    const slideTiles = slides.getByRole('button')
    await expect(slideTiles).toHaveCount(4)
    await expect(slideTiles.nth(2)).toHaveAttribute('aria-pressed', 'true')
    await slideTiles.nth(3).click()
    await expect(macSlide).toHaveText('3')
    await expect(slideTiles.nth(3)).toHaveAttribute('aria-pressed', 'true')
    await slides.getByRole('button', { name: 'Geen slide' }).click()
    await expect(operator.locator('.live .slide.on')).toHaveText('Geen slide')
    await expect(slideTiles.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await slides.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await snap(phone, 'test-results/remote-phone-slides.png')
    await slideTiles.nth(2).click()
    await expect(macSlide).toHaveText('2')

    // In een muziekronde bladeren dezelfde knoppen door de fragmenten, zoals ← → op de Mac.
    const frag = (n: number) => operator.locator('.frag').nth(n - 1)
    await phone.getByRole('button', { name: /Volgende ronde/ }).click()
    await expect(macRound).toContainText('Ronde 2: muziek')
    await expect(phone.getByText('8 fragmenten', { exact: true })).toBeVisible()
    await expect(notes).toContainText('Speel de 8 fragmenten; achtergrond staat op pauze.')
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

    // De reeks: dezelfde knoppen als bij Fragmenten op de Mac.
    const reeks = phone.getByRole('region', { name: 'Fragmenten' })
    const pad = operator.locator('.pad', { has: operator.locator('.frag') })
    await reeks.getByRole('button', { name: 'Speel reeks' }).click()
    await expect(pad.getByRole('button', { name: /Pauzeer/ })).toBeVisible()
    await expect(frag(1)).toHaveClass(/on/)
    await reeks.getByRole('button', { name: 'Pauzeer' }).click()
    await expect(pad.getByRole('button', { name: /Hervat/ })).toBeVisible()
    await expect(reeks.getByRole('button', { name: 'Hervat' })).toBeVisible()
    await reeks.scrollIntoViewIfNeeded()
    await snap(phone, 'test-results/remote-phone-sequence.png')
    await reeks.getByRole('button', { name: 'Stop reeks' }).click()
    await expect(pad.getByRole('button', { name: /Speel reeks/ })).toBeVisible()
    await reeks.getByRole('button', { name: 'Fragmenten opnieuw' }).click()
    await expect(operator.locator('.frag.played')).toHaveCount(0)

    // Eén fragment kiezen, zoals een tik op een fragment op de Mac: nog eens tikken stopt het.
    const tegel = reeks.locator('.frag').nth(1)
    await tegel.click()
    await expect(frag(2)).toHaveClass(/on/)
    await expect(tegel).toHaveAttribute('aria-pressed', 'true')
    await expect(tegel).toContainText('Speelt')
    // Altijd dezelfde stand, los van waar de vorige stap de pagina liet staan.
    await tegel.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await snap(phone, 'test-results/remote-phone-fragments.png')
    await tegel.click()
    await expect(frag(2)).not.toHaveClass(/on/)
    await expect(tegel).toHaveAttribute('aria-pressed', 'false')
    // Terug naar boven, zoals de schermen hierna altijd gemaakt zijn.
    await phone.evaluate(() => window.scrollTo(0, 0))

    // Op de Mac dezelfde knoppen als op de telefoon.
    await mac.getByRole('button', { name: /Vorige ronde/ }).click()
    await expect(macRound).toContainText('Ronde 1: algemeen')
    await expect(phone.getByText('Slide 1 van 3')).toBeVisible()
    await expect(mac.getByText('Slide 1 van 3')).toBeVisible()
    await expect(mac.getByRole('button', { name: 'Vorige slide' })).toBeEnabled()
    await expect(mac.getByRole('button', { name: 'Vorige slide' })).toHaveText('Vorige slide')
    await mac.getByRole('button', { name: 'Volgende slide' }).click()
    await expect(phone.getByText('Slide 2 van 3')).toBeVisible()
    await mac.getByRole('button', { name: 'Vorige slide' }).click()
    await expect(macSlide).toHaveText('1')

    // Beeld op zwart en geluid uit doen hetzelfde als de knoppen op de Mac.
    await phone.getByRole('button', { name: 'Beeld op zwart', exact: true }).click()
    await expect(toolbar.getByRole('button', { name: /Beeld terug/ })).toBeVisible()
    await phone.getByRole('button', { name: 'Geluid uit' }).click()
    await expect(toolbar.getByRole('button', { name: /Geluid aan/ })).toBeVisible()
    await expect(phone.getByRole('button', { name: 'Beeld terug', exact: true })).toBeVisible()
    await expect(phone.getByRole('button', { name: 'Geluid aan' })).toBeVisible()
    await snap(phone, 'test-results/remote-phone-black.png')
    await phone.getByRole('button', { name: 'Beeld terug', exact: true }).click()
    await phone.getByRole('button', { name: 'Geluid aan' }).click()
    await expect(toolbar.getByRole('button', { name: /Beeld op zwart/ })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: /Geluid uit/ })).toBeVisible()
    await snap(phone, 'test-results/remote-phone.png')

    // Aftellen: dezelfde knop als op de Mac.
    await phone.getByRole('button', { name: 'Aftellen', exact: true }).click()
    await expect(toolbar.getByRole('button', { name: /Stop aftellen/ })).toBeVisible()
    await expect(phone.getByRole('button', { name: 'Stop aftellen' })).toBeVisible()
    await phone.getByRole('button', { name: 'Stop aftellen' }).click()
    await expect(toolbar.getByRole('button', { name: /^Aftellen/ })).toBeVisible()

    // Eén scherm op zwart, zoals onder elk scherm in de show op de Mac.
    const macFrame = (n: number) => operator.locator('.live .screen .frame').nth(n)
    const screens = phone.getByRole('region', { name: 'Schermen' })
    const tvBar = screens.getByRole('button', { name: /TV bar/ })
    await expect(screens.getByRole('button')).toHaveCount(2)
    await tvBar.click()
    await expect(macFrame(1)).toHaveClass(/black/)
    await expect(macFrame(0)).not.toHaveClass(/black/)
    await expect(tvBar).toHaveAttribute('aria-pressed', 'true')
    await expect(tvBar).toContainText('Beeld terug')
    await expect(phone.getByRole('button', { name: 'Beeld op zwart', exact: true })).toBeVisible()
    await screens.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await snap(phone, 'test-results/remote-phone-screens.png')
    await tvBar.click()
    await expect(macFrame(1)).not.toHaveClass(/black/)
    await expect(tvBar).toHaveAttribute('aria-pressed', 'false')

    // Geluid, zoals rechts in de show op de Mac: de muziek aan of uit, en het volume per kanaal.
    const sound = phone.getByRole('region', { name: 'Geluid' })
    const macSound = operator.getByRole('region', { name: 'Geluid' })
    await expect(sound.getByText('Speelt')).toBeVisible()
    await sound.getByRole('button', { name: 'Muziek uit' }).click()
    await expect(macSound.getByRole('button', { name: 'Muziek aan' })).toBeVisible()
    await expect(sound.getByText('Uit', { exact: true })).toBeVisible()
    await sound.getByRole('button', { name: 'Muziek aan' }).click()
    await expect(macSound.getByRole('button', { name: 'Muziek uit' })).toBeVisible()
    await sound.getByRole('slider', { name: 'Volume Zaal' }).fill('0.3')
    await expect(macSound.getByRole('slider', { name: 'Volume Zaal' })).toHaveValue('0.3')
    await expect(sound.getByText('30%')).toBeVisible()
    await sound.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await snap(phone, 'test-results/remote-phone-sound.png')
    await macSound.getByRole('slider', { name: 'Volume Zaal' }).fill('0.9')
    await expect(sound.getByText('90%')).toBeVisible()

    // Elke ronde met één tik, zoals de lijst Rondes links in de show op de Mac.
    const roundList = phone.getByRole('region', { name: 'Alle rondes' })
    const roundTile = (name: string) => roundList.getByRole('button', { name: new RegExp(name) })
    await expect(roundList.getByRole('button')).toHaveCount(4)
    await expect(roundTile('Ronde 1: algemeen')).toHaveAttribute('aria-pressed', 'true')
    await expect(roundTile('Ronde 1: algemeen')).toContainText('Nu')
    await expect(roundTile('Ronde 2: muziek')).toContainText('Hierna')
    await roundList.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await snap(phone, 'test-results/remote-phone-rounds.png')
    await roundTile('Pauze').click()
    await expect(macRound).toContainText('Pauze')
    await expect(roundTile('Pauze')).toHaveAttribute('aria-pressed', 'true')
    await roundTile('Ronde 1: algemeen').click()
    await expect(macRound).toContainText('Ronde 1: algemeen')
    await phone.evaluate(() => window.scrollTo(0, 0))

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
    await qr.getByRole('button', { name: 'Vernieuw code' }).click()
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
