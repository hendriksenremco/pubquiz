import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync } from 'fs'
import { join } from 'path'
import type { AppController } from './controller'
import { appLocale } from './locale'
import { NOTICE_MESSAGES } from './messages'
import { CHECK_EVERY_MS, FIRST_CHECK_MS, Updater } from './updater'
import { headless } from './windows'

/**
 * Alleen in de gesigneerde app van een release: die heeft `app-update.yml` (electron-builder.release.yml,
 * `publish`). Een ongesigneerde build (`pnpm build:mac`) kan zich niet bijwerken. Nooit in tests
 * (PUBQUIZ_USER_DATA) of headless; PUBQUIZ_NO_UPDATES zet het ook uit.
 */
function updating(): boolean {
  return (
    app.isPackaged &&
    !headless &&
    !process.env['PUBQUIZ_USER_DATA'] &&
    !process.env['PUBQUIZ_NO_UPDATES'] &&
    existsSync(join(process.resourcesPath, 'app-update.yml'))
  )
}

/** Zoekt op de achtergrond naar updates en haalt ze binnen (issue #46). */
export function startUpdates(ctl: AppController): void {
  if (!updating()) return
  autoUpdater.autoDownload = true
  // Installeren alleen bij het afsluiten, nooit midden in een show.
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = null

  const updater = new Updater({
    check: () => autoUpdater.checkForUpdates(),
    isLive: () => ctl.live,
    notify: (version) =>
      ctl.notify('info', NOTICE_MESSAGES.in(appLocale())('updateReady', { version })),
    log: (message, err) => console.error(message, err)
  })
  ctl.updater = updater
  autoUpdater.on('update-downloaded', (info) => updater.downloaded(info.version))
  // Zonder luisteraar gooit electron-updater fouten als onverwerkte fout; tick() vangt ze al.
  autoUpdater.on('error', () => {})

  setTimeout(() => void updater.tick(), FIRST_CHECK_MS)
  setInterval(() => void updater.tick(), CHECK_EVERY_MS)
}
