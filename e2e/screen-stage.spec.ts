import { expect, test } from '@playwright/test'
import { rmSync } from 'fs'
import { dirname } from 'path'
import { copyFixture, launch, openStart, startShow, tempDir, useWindowedScreens } from './helpers'

test('terug naar het vorige beeld terwijl het nieuwe nog laadt: het vorige blijft staan', async () => {
  const userData = tempDir('userdata')
  const quizDir = copyFixture()
  const { app, operator } = await launch(userData, quizDir)
  try {
    await openStart(operator)
    await useWindowedScreens(operator)
    await startShow(operator)
    await operator.locator('.rounds .round').first().click()
    const tv = operator.locator('.live .screen').nth(1)
    await expect(tv.locator('.layer.on img')).toHaveCount(1)

    // Video's in dit venster worden nooit klaar, dus de loop van de pauze blijft laden tot de
    // grens in waitReady.
    await operator.evaluate(() => {
      HTMLMediaElement.prototype.play = () => new Promise<void>(() => {})
    })
    await operator.locator('.rounds .round').nth(2).click()
    await expect(tv.locator('.layer video')).toHaveCount(1)
    await operator.keyboard.press('e')
    await expect(tv.locator('.layer video')).toHaveCount(0)

    // Ook na de grens (READY_TIMEOUT_MS) staat het logo nog in beeld.
    await operator.waitForTimeout(3500)
    await expect(tv.locator('.layer.on img')).toHaveCount(1)
  } finally {
    await app.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(dirname(quizDir), { recursive: true, force: true })
  }
})
