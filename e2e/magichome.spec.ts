import { expect, test, type Page } from '@playwright/test'
import { readFileSync, rmSync } from 'fs'
import { dirname, join } from 'path'
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

const { on: ON } = command
const RED = [ON, command.color(0xff, 0, 0)]
const BLUE = [ON, command.color(0, 0, 0xff)]
const GREEN = [ON, command.color(0, 0xff, 0)]
/** Effect 39, "Rennend punt, rood, naar buiten", op snelheid 60. */
const RUNNING = [ON, '61 00 8a 3c 0f 36']

test('licht per ronde en per slide via de plug-in MagicHome', async () => {
  const device = await fakeController()
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir)
  const savedQuiz = () => JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8'))
  /** De laatste opdracht die de nep-controller verwerkte, met het aanzetten ervoor. */
  const last = () => device.log.slice(-2)
  const slideLight = operator.getByRole('button', { name: 'Licht bij deze slide' })
  try {
    // Uit (standaard): nergens licht te zien.
    await selectSlide(operator, 1)
    await expect(operator.getByRole('button', { name: 'Achtergrond' })).toBeVisible()
    await expect(slideLight).toHaveCount(0)

    await setPlugin(operator, true, device.host)
    expect(device.log).toEqual([])

    // De ronde rood, met een voorbeeld op de lamp; dicht = terug naar hoe het was (groen).
    await operator.locator('.sidebar .round').first().click()
    await operator.getByRole('tab', { name: 'Ronde' }).click()
    await operator.getByRole('button', { name: 'Licht in deze ronde' }).click()
    const panel = operator.locator('.popover-panel')
    await panel.getByRole('checkbox', { name: 'Voorbeeld op de lamp' }).check()
    await panel.getByRole('button', { name: 'Kleur', exact: true }).click()
    await expect.poll(() => device.log).toEqual(RED)
    await panel.getByRole('button', { name: 'Blauw', exact: true }).click()
    await expect.poll(last).toEqual(BLUE)
    await panel.getByRole('button', { name: 'Rood', exact: true }).click()
    await expect.poll(last).toEqual(RED)
    await operator.keyboard.press('Escape')
    await expect.poll(last).toEqual(GREEN)

    // De tweede slide: een effect uit een raster, een rennend punt op rood naar buiten.
    await selectSlide(operator, 1)
    await expect(slideLight).toContainText('Zoals de ronde')
    await slideLight.click()
    // Het voorbeeld staat nog aan: de lamp toont wat de slide nu krijgt, die van de ronde.
    await expect.poll(last).toEqual(RED)
    await panel.getByRole('button', { name: 'Effect', exact: true }).click()
    await expect(panel.getByRole('listbox', { name: 'Basis' })).toBeVisible()
    await panel.getByRole('button', { name: /^Rennend punt/, expanded: false }).click()
    await expect(panel.getByRole('listbox', { name: 'Basis' })).toHaveCount(0)
    await panel
      .getByRole('button', { name: 'Rennend punt, rood, naar buiten', exact: true })
      .click()
    await expect.poll(last).toEqual(RUNNING)
    await operator.waitForTimeout(200)
    await operator.screenshot({ path: 'test-results/magichome-effect.png' })
    await operator.keyboard.press('Escape')
    await expect.poll(last).toEqual(GREEN)
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

    // Start show: het adres staat er al, en is getest.
    const sheet = await openStart(operator)
    await expect(sheet.getByLabel('IP-adres van de MagicHome-controller')).toHaveValue(device.host)
    await expect(sheet.locator('.light-status')).toHaveText('Verbonden. Nu: Groen.')
    await useWindowedScreens(operator)
    await operator.screenshot({ path: 'test-results/magichome-start.png' })
    const before = device.log.length
    await startShow(operator)

    // Nog geen ronde en geen standaard: het licht blijft zoals het is.
    await operator.waitForTimeout(300)
    expect(device.log).toHaveLength(before)

    await operator.locator('.rounds .round').first().click()
    await expect.poll(last).toEqual(RED)
    await operator.keyboard.press('PageDown')
    await expect.poll(last).toEqual(RUNNING)

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
    await device.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
