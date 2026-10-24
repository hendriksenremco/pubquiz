import { BrowserWindow } from 'electron'
import type { FormOptions } from '@shared/forms'
import { loadRoute, webPreferences } from './windows'

const READY_TIMEOUT_MS = 15_000
const MM = 1 / 25.4

/**
 * Zet een formulier om naar pdf: een verborgen venster rendert de route `#/print` met de app-
 * stijlen en fonts, en Chromium drukt die af. Het venster meldt zelf wanneer alles geladen is.
 */
export async function renderFormPdf(options: FormOptions): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 820,
    height: 1160,
    webPreferences: webPreferences()
  })
  try {
    await loadRoute(win, `/print/${encodeURIComponent(JSON.stringify(options))}`)
    const ready = win.webContents.executeJavaScript('window.__pubquizPrintReady')
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('het formulier laadt niet')), READY_TIMEOUT_MS)
    )
    await Promise.race([ready, timeout])
    // Marges hier en niet in CSS (@page): anders rekent Chromium met andere marges dan hij tekent.
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 16 * MM, bottom: 16 * MM, left: 18 * MM, right: 18 * MM }
    })
  } finally {
    win.destroy()
  }
}
