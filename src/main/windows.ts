import { app, BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'

const preload = join(__dirname, '../preload/index.js')

/** Voor tests: vensters blijven onzichtbaar, zodat de gebruiker niet gestoord wordt. */
export const headless = !!process.env['PUBQUIZ_HEADLESS']

/** Toont een venster, behalve in headless-modus; `inactive` pakt de focus niet af. */
export function reveal(win: BrowserWindow, inactive = false): void {
  if (headless) return
  if (inactive) win.showInactive()
  else win.show()
}

export function webPreferences(): BrowserWindowConstructorOptions['webPreferences'] {
  return {
    preload,
    sandbox: true,
    contextIsolation: true,
    backgroundThrottling: false,
    autoplayPolicy: 'no-user-gesture-required'
  }
}

/** Laadt de renderer met een hash-route, bv. `/screen/abc`. */
export function loadRoute(win: BrowserWindow, route: string): Promise<void> {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    return win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${route}`)
  }
  return win.loadFile(join(__dirname, '../renderer/index.html'), { hash: route })
}

function openLinksExternally(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
}

export function createOperatorWindow(title: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#14161c',
    webPreferences: webPreferences()
  })
  win.once('ready-to-show', () => reveal(win))
  openLinksExternally(win)
  loadRoute(win, '/operator')
  return win
}

/** Verborgen venster dat alle audio speelt, zodat een reload van de UI de muziek niet onderbreekt. */
export function createAudioWindow(): BrowserWindow {
  const win = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    title: 'Quizmeister audio',
    webPreferences: webPreferences()
  })
  loadRoute(win, '/audio')
  return win
}
