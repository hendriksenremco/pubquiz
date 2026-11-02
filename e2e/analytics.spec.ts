import { expect, test } from '@playwright/test'
import { readFileSync } from 'fs'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { join } from 'path'
import { launch, tempDir } from './helpers'

/** Doet zich voor als PostHog en onthoudt elk event; er gaat niets naar de echte dienst. */
async function fakePostHog(): Promise<{ server: Server; url: string; events: string[] }> {
  const events: string[] = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      for (const e of JSON.parse(body).batch) events.push(e.event)
      res.end('{}')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${port}`, events }
}

function consent(userData: string): boolean | null {
  try {
    const file = readFileSync(join(userData, 'settings.json'), 'utf8')
    return JSON.parse(file).analytics?.consent ?? null
  } catch {
    return null // nog niet weggeschreven
  }
}

/** Een fout in de app mag de test niet laten vallen; het gaat hier om het start-event. */
const starts = (events: string[]) => events.filter((e) => e === 'app_started')

test('meten: de vraag bij de eerste start, en niets zonder toestemming', async () => {
  const userData = tempDir('userdata')
  const { server, url, events } = await fakePostHog()
  const env = { PUBQUIZ_ANALYTICS_URL: url }
  try {
    // Eerste start: de vraag staat er, en wegklikken is geen antwoord.
    let { app, operator } = await launch(userData, undefined, env)
    let question = operator.getByRole('dialog', { name: 'Help QuizNote beter maken?' })
    await expect(question).toBeVisible()
    await operator.screenshot({ path: 'test-results/analytics-question.png' })
    await operator.keyboard.press('Escape')
    await expect(question).toBeHidden()
    await app.close()

    // Nog niet beantwoord: de volgende start opnieuw. Nu "Niet meten".
    ;({ app, operator } = await launch(userData, undefined, env))
    question = operator.getByRole('dialog', { name: 'Help QuizNote beter maken?' })
    await question.getByRole('button', { name: 'Niet meten' }).click()
    await expect(question).toBeHidden()
    await expect.poll(() => consent(userData)).toBe(false)
    await app.close()

    // Geweigerd: geen vraag meer, de schakelaar staat uit, en er is niets verstuurd.
    ;({ app, operator } = await launch(userData, undefined, env))
    await operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
    const settings = operator.getByRole('dialog', { name: 'Instellingen' })
    await expect(operator.getByRole('dialog', { name: /beter maken\?/ })).toHaveCount(0)
    const toggle = settings.getByRole('checkbox', { name: /Help QuizNote beter maken/ })
    await expect(toggle).not.toBeChecked()
    await operator.screenshot({ path: 'test-results/analytics-settings.png' })
    expect(events).toEqual([])

    // Alsnog aanzetten bij Instellingen; pas bij de volgende start telt er iets.
    await toggle.check()
    await expect.poll(() => consent(userData)).toBe(true)
    await app.close()
    ;({ app, operator } = await launch(userData, undefined, env))
    await expect.poll(() => starts(events)).toEqual(['app_started'])
    await app.close()
  } finally {
    server.close()
  }
})

test('meten: "Meten" bij de eerste start telt die start meteen', async () => {
  const userData = tempDir('userdata')
  const { server, url, events } = await fakePostHog()
  try {
    const { app, operator } = await launch(userData, undefined, { PUBQUIZ_ANALYTICS_URL: url })
    const question = operator.getByRole('dialog', { name: 'Help QuizNote beter maken?' })
    expect(events).toEqual([])
    await question.getByRole('button', { name: 'Meten', exact: true }).click()
    await expect(question).toBeHidden()
    await expect.poll(() => starts(events)).toEqual(['app_started'])
    await app.close()
  } finally {
    server.close()
  }
})

test('zonder nep-server meet een test niets en stelt hij de vraag niet', async () => {
  const userData = tempDir('userdata')
  const { app, operator } = await launch(userData)
  await expect(operator.getByRole('heading', { name: 'Maak je eerste pubquiz' })).toBeVisible()
  await expect(operator.getByRole('dialog', { name: /beter maken\?/ })).toHaveCount(0)
  await app.close()
})
