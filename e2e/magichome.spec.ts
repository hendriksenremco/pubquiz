import { expect, test, type Page } from '@playwright/test'
import { readFileSync, rmSync } from 'fs'
import { createServer, type AddressInfo } from 'net'
import { dirname, join } from 'path'
import {
  confirmIn,
  copyFixture,
  launch,
  openStart,
  startShow,
  tempDir,
  useWindowedScreens
} from './helpers'

const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')
/** Antwoord op de statusvraag: aan, vaste kleur groen (zo antwoordde de controller op kantoor). */
const STATE = [0x81, 0xa1, 0x23, 0x00, 0x61, 0x64, 0x00, 0xff, 0x00, 0x00, 0x03, 0x00, 0xfa, 0x06]
const ON = '71 23 0f a3'

/** Nooit de echte controller: een nep-controller op localhost die onthoudt wat hij kreeg. */
async function fakeController() {
  const received: string[] = []
  const server = createServer((socket) => {
    const bytes: number[] = []
    socket.on('data', (chunk) => {
      bytes.push(...chunk)
      if (chunk[0] === 0x81) socket.write(Uint8Array.from(STATE))
    })
    socket.on('end', () => {
      received.push(hex(bytes))
      socket.end()
    })
    socket.on('error', () => {})
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { host: `127.0.0.1:${port}`, received, close: () => server.close() }
}

/** Via Instellingen op het dashboard; met `host` ook het adres van de controller. */
async function setPlugin(operator: Page, on: boolean, host?: string) {
  await operator.locator('.topbar').getByRole('button', { name: 'Quizzen' }).click()
  await operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
  const dialog = operator.getByRole('dialog', { name: 'Instellingen' })
  await dialog.getByRole('checkbox', { name: /MagicHome-licht/ }).setChecked(on)
  if (host) {
    const address = dialog.getByLabel('IP-adres van de MagicHome-controller')
    await address.fill(host)
    await address.press('Enter')
    // Testen vraagt alleen de toestand op.
    await expect(dialog.locator('.light-status')).toHaveText('Verbonden. Nu: Groen.')
    await operator.screenshot({ path: 'test-results/magichome-settings.png' })
  }
  await dialog.getByRole('button', { name: 'Klaar' }).click()
  await operator.getByRole('button', { name: 'Bewerken' }).click()
}

async function selectSlide(operator: Page, index: number) {
  await operator.locator('.sidebar .round').first().click()
  await operator.locator('.slide-list .item').nth(index).locator('.thumb').click()
}

const RED = `${ON} 31 ff 00 00 00 00 f0 0f 2f`
const BLUE = `${ON} 31 00 00 ff 00 00 f0 0f 2f`
const GREEN = `${ON} 31 00 ff 00 00 00 f0 0f 2f`
/** Effect 39, "Rennend punt, rood, naar buiten", op snelheid 60. */
const RUNNING = `${ON} 61 00 8a 3c 0f 36`

test('licht per ronde en per slide via de plug-in MagicHome', async () => {
  const device = await fakeController()
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir)
  const savedQuiz = () => JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8'))
  const last = () => device.received.at(-1)
  const slideLight = operator.getByRole('button', { name: 'Licht bij deze slide' })
  try {
    // Uit (standaard): nergens licht te zien.
    await selectSlide(operator, 1)
    await expect(operator.getByRole('button', { name: 'Achtergrond' })).toBeVisible()
    await expect(slideLight).toHaveCount(0)

    await setPlugin(operator, true, device.host)
    expect(device.received).toEqual(['81 8a 8b 96'])

    // De ronde rood, met een voorbeeld op de lamp; dicht = terug naar hoe het was (groen).
    await operator.locator('.sidebar .round').first().click()
    await operator.getByRole('tab', { name: 'Ronde' }).click()
    await operator.getByRole('button', { name: 'Licht in deze ronde' }).click()
    const panel = operator.locator('.popover-panel')
    await panel.getByRole('checkbox', { name: 'Voorbeeld op de lamp' }).check()
    await panel.getByRole('button', { name: 'Kleur', exact: true }).click()
    await expect.poll(last).toBe(RED)
    expect(device.received.slice(1)).toEqual(['81 8a 8b 96', RED])
    await panel.getByRole('button', { name: 'Blauw', exact: true }).click()
    await expect.poll(last).toBe(BLUE)
    await panel.getByRole('button', { name: 'Rood', exact: true }).click()
    await expect.poll(last).toBe(RED)
    await operator.keyboard.press('Escape')
    await expect.poll(last).toBe(GREEN)

    // De tweede slide: een effect uit een raster, een rennend punt op rood naar buiten.
    await selectSlide(operator, 1)
    await expect(slideLight).toContainText('Zoals de ronde')
    await slideLight.click()
    // Het voorbeeld staat nog aan: de lamp toont wat de slide nu krijgt, die van de ronde.
    await expect.poll(last).toBe(RED)
    await panel.getByRole('button', { name: 'Effect', exact: true }).click()
    await expect(panel.getByRole('listbox', { name: 'Basis' })).toBeVisible()
    await panel.getByRole('button', { name: /^Rennend punt/, expanded: false }).click()
    await expect(panel.getByRole('listbox', { name: 'Basis' })).toHaveCount(0)
    await panel
      .getByRole('button', { name: 'Rennend punt, rood, naar buiten', exact: true })
      .click()
    await expect.poll(last).toBe(RUNNING)
    await operator.waitForTimeout(200)
    await operator.screenshot({ path: 'test-results/magichome-effect.png' })
    await operator.keyboard.press('Escape')
    await expect.poll(last).toBe(GREEN)
    await expect(slideLight).toContainText('Rennend punt, rood, naar buiten')

    await expect
      .poll(() => {
        const round = savedQuiz().rounds[0]
        return [round.plugins?.magichome, round.slides[1].plugins?.magichome]
      })
      .toEqual([
        { light: { type: 'color', color: '#ff0000' } },
        { light: { type: 'effect', effect: 39, speed: 60 } }
      ])

    // Show starten: het adres staat er al, en is getest.
    const sheet = await openStart(operator)
    await expect(sheet.getByLabel('IP-adres van de MagicHome-controller')).toHaveValue(device.host)
    await expect(sheet.locator('.light-status')).toHaveText('Verbonden. Nu: Groen.')
    await useWindowedScreens(operator)
    await operator.screenshot({ path: 'test-results/magichome-start.png' })
    const before = device.received.length
    await startShow(operator)

    // Nog geen ronde en geen standaard: het licht blijft zoals het is.
    await operator.waitForTimeout(300)
    expect(device.received).toHaveLength(before)

    await operator.locator('.rounds .round').first().click()
    await expect.poll(last).toBe(RED)
    await operator.keyboard.press('PageDown')
    await expect.poll(last).toBe(RUNNING)

    // Uitgezet: niets meer te zien, maar wat in de quiz staat, blijft.
    await operator.getByRole('button', { name: 'Stop show' }).click()
    await confirmIn(operator, 'Stop show')
    await expect(operator.locator('.live')).toHaveCount(0)
    await setPlugin(operator, false)
    await selectSlide(operator, 1)
    await expect(operator.getByRole('button', { name: 'Achtergrond' })).toBeVisible()
    await expect(slideLight).toHaveCount(0)
    expect(savedQuiz().rounds[0].slides[1].plugins).toEqual({
      magichome: { light: { type: 'effect', effect: 39, speed: 60 } }
    })
  } finally {
    await app.close()
    device.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
