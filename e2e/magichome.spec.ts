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

async function setPlugin(operator: Page, on: boolean) {
  await operator.locator('.topbar').getByRole('button', { name: 'Quizzen' }).click()
  await operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
  const dialog = operator.getByRole('dialog', { name: 'Instellingen' })
  await dialog.getByRole('checkbox', { name: /MagicHome-licht/ }).setChecked(on)
  await dialog.getByRole('button', { name: 'Klaar' }).click()
  await operator.getByRole('button', { name: 'Bewerken' }).click()
}

async function selectSlide(operator: Page, index: number) {
  await operator.locator('.sidebar .round').first().click()
  await operator.locator('.slide-list .item').nth(index).locator('.thumb').click()
}

test('licht per ronde en per slide via de plug-in MagicHome', async () => {
  const device = await fakeController()
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir)
  const savedQuiz = () => JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8'))
  const slideLight = operator.getByRole('button', { name: 'Licht bij deze slide' })
  try {
    // Uit (standaard): nergens licht te zien.
    await selectSlide(operator, 1)
    await expect(operator.getByRole('button', { name: 'Achtergrond' })).toBeVisible()
    await expect(slideLight).toHaveCount(0)

    await setPlugin(operator, true)

    // De ronde rood.
    await operator.locator('.sidebar .round').first().click()
    await operator.getByRole('tab', { name: 'Ronde' }).click()
    await operator.getByRole('button', { name: 'Licht in deze ronde' }).click()
    const panel = operator.locator('.popover-panel')
    await panel.getByRole('button', { name: 'Kleur', exact: true }).click()
    await panel.getByRole('button', { name: 'Rood', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Rood', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await operator.keyboard.press('Escape')

    // De tweede slide flitst.
    await selectSlide(operator, 1)
    await expect(slideLight).toContainText('Zoals de ronde')
    await slideLight.click()
    await panel.getByRole('button', { name: 'Effect', exact: true }).click()
    await panel.getByRole('option', { name: 'Flitsen in kleur' }).click()
    await expect(panel.getByLabel('Effectnummer')).toHaveValue('5')
    await operator.waitForTimeout(200)
    await operator.screenshot({ path: 'test-results/magichome-effect.png' })
    await operator.keyboard.press('Escape')
    await expect(slideLight).toContainText('Flitsen in kleur')

    await expect
      .poll(() => {
        const round = savedQuiz().rounds[0]
        return [round.plugins?.magichome, round.slides[1].plugins?.magichome]
      })
      .toEqual([
        { light: { type: 'color', color: '#ff0000' } },
        { light: { type: 'effect', effect: 5, speed: 60 } }
      ])

    // Show starten: het adres van vanavond, en testen vraagt alleen de toestand op.
    const sheet = await openStart(operator)
    const address = sheet.getByLabel('IP-adres van de MagicHome-controller')
    await address.fill(device.host)
    await address.press('Enter')
    await expect(sheet.locator('.light-status')).toHaveText('Verbonden. Nu: Groen.')
    expect(device.received).toEqual(['81 8a 8b 96'])
    await useWindowedScreens(operator)
    await operator.screenshot({ path: 'test-results/magichome-start.png' })
    await startShow(operator)

    // Nog geen ronde en geen standaard: het licht blijft zoals het is.
    await operator.waitForTimeout(300)
    expect(device.received).toHaveLength(1)

    await operator.locator('.rounds .round').first().click()
    await expect.poll(() => device.received[1]).toBe(`${ON} 31 ff 00 00 00 00 f0 0f 2f`)
    await operator.keyboard.press('PageDown')
    await expect.poll(() => device.received[2]).toBe(`${ON} 61 00 68 3c 0f 14`)

    // Uitgezet: niets meer te zien, maar wat in de quiz staat, blijft.
    await operator.getByRole('button', { name: 'Stop show' }).click()
    await confirmIn(operator, 'Stop show')
    await expect(operator.locator('.live')).toHaveCount(0)
    await setPlugin(operator, false)
    await selectSlide(operator, 1)
    await expect(operator.getByRole('button', { name: 'Achtergrond' })).toBeVisible()
    await expect(slideLight).toHaveCount(0)
    expect(savedQuiz().rounds[0].slides[1].plugins).toEqual({
      magichome: { light: { type: 'effect', effect: 5, speed: 60 } }
    })
  } finally {
    await app.close()
    device.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
