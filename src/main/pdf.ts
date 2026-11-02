import { BrowserWindow } from 'electron'
import type { FormDoc, FormOptions } from '@shared/forms'
import { NoticeError } from './messages'
import { loadRoute, webPreferences } from './windows'

const READY_TIMEOUT_MS = 15_000
const MM = 1 / 25.4

/**
 * Formulieren op A4; vragenkaarten vier per liggende A4, zonder marges: elke kaart heeft er zelf
 * een, zodat de knip-stippellijnen tot aan de rand lopen. Maten in inch.
 */
const PAGES: Record<
  FormDoc,
  Pick<Electron.PrintToPDFOptions, 'pageSize' | 'landscape' | 'margins'>
> = {
  sheet: {
    pageSize: 'A4',
    margins: { top: 16 * MM, bottom: 16 * MM, left: 18 * MM, right: 18 * MM }
  },
  key: {
    pageSize: 'A4',
    margins: { top: 16 * MM, bottom: 16 * MM, left: 18 * MM, right: 18 * MM }
  },
  cards: {
    pageSize: 'A4',
    landscape: true,
    margins: { top: 0, bottom: 0, left: 0, right: 0 }
  }
}

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
      setTimeout(() => reject(new NoticeError('formNotLoading')), READY_TIMEOUT_MS)
    )
    await Promise.race([ready, timeout])
    // Marges hier en niet in CSS (@page): anders rekent Chromium met andere marges dan hij tekent.
    return await win.webContents.printToPDF({ ...PAGES[options.doc], printBackground: true })
  } finally {
    win.destroy()
  }
}
