import { expect, test, type Locator } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { copyFixture, launch, tempDir } from './helpers'

// Echte namen van gedownloade video's, zoals ze in de praktijk binnenkomen.
const LONG_NAMES: Record<string, string> = {
  loop: 'Spooky Horror Ambience _ 1 Hour Of Scary Sounds And Music For Halloween Night.mp4',
  logo: 'YTDown.com_YouTube_Media_f-v-CjCJJCs_Halloween-Window-Projection-2026-2-Hour-Ultimate-Loop-v.png',
  'music-loop':
    'YTDown.com_YouTube_Media_f-v-CjCJJCs_Halloween-Window-Projection-2026-2-Hour-Ultimate-Loop-v2.mp4'
}

/** Rechterkant van `inner` valt binnen die van `outer` (met 1px marge voor afronding). */
async function expectInside(inner: Locator, outer: Locator) {
  const a = (await inner.boundingBox())!
  const b = (await outer.boundingBox())!
  expect(a.x).toBeGreaterThanOrEqual(b.x - 1)
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 1)
}

test('lange bestandsnamen blijven binnen hun chip en tegel', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const file = join(quizDir, 'quiz.json')
  const quiz = JSON.parse(readFileSync(file, 'utf8'))
  for (const asset of quiz.assets) if (LONG_NAMES[asset.id]) asset.name = LONG_NAMES[asset.id]
  writeFileSync(file, JSON.stringify(quiz))

  const { app, operator } = await launch(userData, quizDir)
  try {
    // Quiz-instellingen: chip "Toont …" in elke schermtegel.
    await operator.getByRole('button', { name: 'Quiz-instellingen' }).click()
    for (const tile of await operator.locator('.screen.tile').all()) {
      await expectInside(tile.locator('.chip'), tile)
    }
    await expect(operator.locator('.screen.tile .chip').first()).toHaveAttribute(
      'title',
      /Spooky Horror Ambience/
    )
    await operator.screenshot({ path: 'test-results/long-names-setup.png' })

    // Ronde-kop: scherm-chips binnen de rij.
    await operator.locator('.sidebar .round').nth(1).click()
    const chips = operator.locator('.hero-text .chips')
    for (const chip of await chips.locator('.chip').all()) await expectInside(chip, chips)
    await operator.screenshot({ path: 'test-results/long-names-round.png' })
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
