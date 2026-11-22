import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { join } from 'path'
import { launch, snap, tempDir } from './helpers'

/** Doet zich voor als de licentieserver op quiznote.app; alleen QNP-GOED-1234 is een geldige code. */
async function fakeLicenseServer(): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      const { key } = JSON.parse(body || '{}') as { key?: string }
      const action = req.url?.split('/').pop()
      res.setHeader('Content-Type', 'application/json')
      if (key !== 'QNP-GOED-1234') {
        res.statusCode = action === 'activate' ? 404 : 200
        res.end(
          JSON.stringify(action === 'activate' ? { error: 'invalid' } : { status: 'disabled' })
        )
      } else if (action === 'activate') {
        res.end(JSON.stringify({ instanceId: 'mac-1', status: 'active', expiresAt: null }))
      } else if (action === 'validate') {
        res.end(JSON.stringify({ status: 'active', expiresAt: null }))
      } else {
        res.end(JSON.stringify({ deactivated: true }))
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${port}/api/licenses` }
}

test('Pro: zonder code gratis, met een code aan, en gratis tijd voor wie de app al gebruikte', async () => {
  const { server, url } = await fakeLicenseServer()
  const env = { PUBQUIZ_LICENSE_READY: '1', PUBQUIZ_LICENSE_URL: url }
  try {
    // Een nieuwe Mac: gratis, en de plug-ins zijn Pro.
    const { app, operator } = await launch(tempDir('pro'), undefined, env)
    await operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
    const settings = operator.getByRole('dialog', { name: 'Instellingen' })
    await expect(settings.getByText(/Gratis: één scherm en één geluidsuitgang/)).toBeVisible()
    const remote = settings.getByRole('checkbox', { name: /Afstandsbediening/ })
    await expect(remote).toBeDisabled()
    await snap(operator, 'test-results/pro-free.png')

    const key = settings.getByRole('textbox', { name: 'Licentiecode' })
    await key.fill('FOUT-0000')
    await settings.getByRole('button', { name: 'Zet Pro aan' }).click()
    await expect(settings.getByText(/Deze code werkt niet/)).toBeVisible()

    await key.fill('QNP-GOED-1234')
    await settings.getByRole('button', { name: 'Zet Pro aan' }).click()
    await expect(settings.getByText('Pro staat aan met code …1234.')).toBeVisible()
    await expect(remote).toBeEnabled()
    await snap(operator, 'test-results/pro-active.png')

    await settings.getByRole('button', { name: 'Haal code van deze Mac' }).click()
    await expect(settings.getByText(/Gratis: één scherm/)).toBeVisible()
    await app.close()

    // Instellingen van voor Pro: 90 dagen gratis.
    const before = tempDir('pro-oud')
    writeFileSync(join(before, 'settings.json'), JSON.stringify({ recent: [] }))
    const old = await launch(before, undefined, env)
    await old.operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
    await expect(old.operator.getByText(/Je hebt Pro gratis tot/)).toBeVisible()
    await old.app.close()
  } finally {
    server.close()
  }
})

test('Pro: zonder winkel staat alles open en is er geen Pro bij Instellingen', async () => {
  const { app, operator } = await launch(tempDir('pro-open'))
  await operator.locator('.topbar').getByRole('button', { name: 'Instellingen' }).click()
  const settings = operator.getByRole('dialog', { name: 'Instellingen' })
  await expect(settings.getByRole('checkbox', { name: /Afstandsbediening/ })).toBeEnabled()
  await expect(settings.getByText('QuizNote Pro')).toHaveCount(0)
  await app.close()
})
