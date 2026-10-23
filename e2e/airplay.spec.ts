import { expect, test } from '@playwright/test'
import { rmSync } from 'fs'
import { dirname } from 'path'
import { copyFixture, launch, tempDir } from './helpers'

// Vaste lijst i.p.v. het echte netwerk; zelfde soort apparaten als op kantoor gevonden.
const FAKE_AIRPLAY = [
  { name: 'BEAMER-KANTINE', model: 'AppleTV3,2', screen: true, audio: true },
  { name: 'Studio', model: 'Bookshelf', screen: false, audio: true }
]

test('AirPlay in de buurt: schermen in de lijst, met hulp bij verbinden', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir, {
    PUBQUIZ_FAKE_AIRPLAY: JSON.stringify(FAKE_AIRPLAY)
  })
  try {
    // Niet echt Systeeminstellingen openen; alleen onthouden wat de app wilde openen.
    await app.evaluate(({ shell }) => {
      const opened: string[] = []
      Object.assign(globalThis, { __opened: opened })
      shell.openExternal = async (url: string) => {
        opened.push(url)
      }
    })

    await operator.getByRole('button', { name: 'Show', exact: true }).click()
    const select = operator.locator('.screen select.screen-target').first()
    const options = await select.locator('option').allTextContents()
    expect(options.map((o) => o.trim())).toContain('BEAMER-KANTINE')
    expect(options.map((o) => o.trim())).not.toContain('Studio')

    await select.selectOption('ap:BEAMER-KANTINE')
    await expect(operator.locator('.airplay-hint').first()).toContainText(
      'Nog niet verbonden. Kies in Beeldschermen'
    )
    await expect
      .poll(() => app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened))
      .toEqual(['x-apple.systempreferences:com.apple.Displays-Settings.extension'])

    // Speakers zonder scherm staan bij de audio, met de waarschuwing over vertraging.
    await expect(operator.locator('.airplay-hint').last()).toContainText('Studio')
    await expect(operator.locator('.airplay-hint').last()).toContainText('±2 seconden')
    // Wachten tot macOS de uitgangen heeft doorgegeven (eerst staat er "Uitgangen laden…").
    await expect(operator.locator('.channel select').first().locator('option').first()).toHaveText(
      /Systeemstandaard/
    )
    await operator.screenshot({ path: 'test-results/airplay.png' })
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
