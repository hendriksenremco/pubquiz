import { BrowserWindow, powerSaveBlocker, screen, type Display } from 'electron'
import type { DisplayInfo, HardwareMapping, Quiz, ScreenSlot } from '@shared/types'
import { appLocale } from './locale'
import { NOTICE_MESSAGES } from './messages'
import { findDisplay } from './settings'
import { loadRoute, reveal, webPreferences } from './windows'

interface ScreenWindow {
  win: BrowserWindow
  kind: 'display' | 'window'
  displayId: number | null
}

/** Een display zonder naam van macOS. */
const displayName = (id: number) => NOTICE_MESSAGES.in(appLocale())('displayName', { id })

export type DisplayChange = 'added' | 'removed' | 'changed'

export function listDisplays(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label || displayName(d.id),
    width: d.size.width,
    height: d.size.height,
    internal: d.internal,
    primary: d.id === primary
  }))
}

/**
 * Beheert één venster per scherm-slot tijdens de show.
 * Geen native fullscreen (maakt een Space aan en gedraagt zich anders per macOS-instelling):
 * een frameloos venster ter grootte van het display op screen-saver-niveau.
 */
export class ScreenWindows {
  private windows = new Map<string, ScreenWindow>()
  private sleepBlocker: number | null = null

  constructor(private readonly operator: () => BrowserWindow | null) {}

  /**
   * Opent, verplaatst en sluit vensters zodat ze overeenkomen met quiz + koppeling.
   * Geeft de slots terug waarvan het display ontbreekt.
   */
  sync(quiz: Quiz | null, mapping: HardwareMapping, live: boolean): ScreenSlot[] {
    if (!quiz || !live) {
      this.closeAll()
      return []
    }
    this.setSleepBlock(true)

    const displays = screen.getAllDisplays()
    const operatorDisplay = this.operatorDisplayId()
    const wanted = new Set<string>()
    const missing: ScreenSlot[] = []

    for (const slot of quiz.screens) {
      const target = mapping.screens[slot.id] ?? { kind: 'off' }
      if (target.kind === 'off') continue

      let display: Display | null = null
      if (target.kind === 'display') {
        display = findDisplay(target, displays)
        if (!display) {
          missing.push(slot)
          continue
        }
        // Nooit een screen-saver-venster over de bediening heen leggen.
        if (display.id === operatorDisplay) display = null
      }
      wanted.add(slot.id)
      this.ensure(slot, display)
    }

    for (const [id, sw] of this.windows) {
      if (!wanted.has(id)) this.destroy(id, sw)
    }
    return missing
  }

  /** Bij het loskoppelen direct verbergen, anders schuift macOS de video over de operator-UI. */
  watch(onChange: (change: DisplayChange, display: Display) => void): void {
    screen.on('display-removed', (_event, display) => {
      for (const [id, sw] of this.windows) {
        if (sw.displayId === display.id) this.destroy(id, sw)
      }
      onChange('removed', display)
    })
    screen.on('display-added', (_event, display) => onChange('added', display))
    screen.on('display-metrics-changed', (_event, display) => onChange('changed', display))
  }

  /** Toont even een label op elk display, zodat de host weet welk scherm welk is. */
  identify(): void {
    for (const d of screen.getAllDisplays()) {
      const width = 640
      const height = 320
      const win = new BrowserWindow({
        x: Math.round(d.bounds.x + (d.bounds.width - width) / 2),
        y: Math.round(d.bounds.y + (d.bounds.height - height) / 2),
        width,
        height,
        frame: false,
        resizable: false,
        focusable: false,
        transparent: true,
        hasShadow: false,
        skipTaskbar: true,
        show: false,
        webPreferences: webPreferences()
      })
      win.setAlwaysOnTop(true, 'screen-saver')
      win.once('ready-to-show', () => reveal(win, true))
      const label = `${d.label || displayName(d.id)} · ${d.size.width}×${d.size.height}`
      loadRoute(win, `/identify/${encodeURIComponent(label)}`)
      setTimeout(() => !win.isDestroyed() && win.destroy(), 4000)
    }
  }

  closeAll(): void {
    for (const [id, sw] of this.windows) this.destroy(id, sw)
    this.setSleepBlock(false)
  }

  private ensure(slot: ScreenSlot, display: Display | null): void {
    const kind = display ? 'display' : 'window'
    const existing = this.windows.get(slot.id)
    if (existing && existing.kind === kind && existing.displayId === (display?.id ?? null)) {
      if (display) existing.win.setBounds(display.bounds)
      existing.win.setTitle(slot.name)
      return
    }
    if (existing) this.destroy(slot.id, existing)

    const win = display ? this.createOnDisplay(slot, display) : this.createWindowed(slot)
    win.webContents.on('render-process-gone', () => !win.isDestroyed() && win.webContents.reload())
    win.on('closed', () => {
      if (this.windows.get(slot.id)?.win === win) this.windows.delete(slot.id)
    })
    this.windows.set(slot.id, { win, kind, displayId: display?.id ?? null })
    loadRoute(win, `/screen/${slot.id}`)
  }

  private createOnDisplay(slot: ScreenSlot, display: Display): BrowserWindow {
    const win = new BrowserWindow({
      ...display.bounds,
      title: slot.name,
      frame: false,
      // macOS rondt de hoeken van vensters zonder rand af; een beamer hoort tot in de hoeken te vullen.
      roundedCorners: false,
      show: false,
      focusable: false,
      hasShadow: false,
      fullscreenable: false,
      resizable: false,
      movable: false,
      enableLargerThanScreen: true,
      skipTaskbar: true,
      backgroundColor: '#000000',
      webPreferences: webPreferences()
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true })
    win.once('ready-to-show', () => {
      reveal(win, true)
      win.setBounds(display.bounds)
    })
    return win
  }

  private createWindowed(slot: ScreenSlot): BrowserWindow {
    const win = new BrowserWindow({
      width: 960,
      height: 540,
      title: NOTICE_MESSAGES.in(appLocale())('windowed', { name: slot.name }),
      backgroundColor: '#000000',
      show: false,
      webPreferences: webPreferences()
    })
    win.setAspectRatio(16 / 9)
    win.once('ready-to-show', () => reveal(win, true))
    return win
  }

  private destroy(id: string, sw: ScreenWindow): void {
    this.windows.delete(id)
    if (!sw.win.isDestroyed()) sw.win.destroy()
  }

  private operatorDisplayId(): number | null {
    const op = this.operator()
    return op && !op.isDestroyed() ? screen.getDisplayMatching(op.getBounds()).id : null
  }

  private setSleepBlock(on: boolean): void {
    if (on && this.sleepBlocker === null) {
      this.sleepBlocker = powerSaveBlocker.start('prevent-display-sleep')
    } else if (!on && this.sleepBlocker !== null) {
      powerSaveBlocker.stop(this.sleepBlocker)
      this.sleepBlocker = null
    }
  }
}
