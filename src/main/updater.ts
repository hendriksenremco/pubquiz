/**
 * Automatische updates (issue #46), met electron-updater en GitHub Releases. De release zet er de
 * zip en `latest-mac.yml` bij (.github/workflows/release.yml).
 *
 * Nooit iets tijdens een show: niet zoeken, en een update die klaarstaat meldt de app pas na "Stop
 * show". Installeren gebeurt alleen bij het afsluiten (`autoInstallOnAppQuit`).
 *
 * Deze klasse kent Electron niet, zodat de tests de regels kunnen nalopen; `startUpdates` koppelt
 * hem aan electron-updater.
 */

export interface UpdaterDeps {
  /** Zoekt naar een nieuwe versie en haalt hem binnen. */
  check(): Promise<unknown>
  isLive(): boolean
  /** Meldt dat versie `version` klaarstaat. */
  notify(version: string): void
  log?(message: string, err: unknown): void
}

/** Na het starten even wachten, zodat de app eerst zijn quiz opent. */
export const FIRST_CHECK_MS = 30_000
/** Daarna één keer per zes uur. */
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000

export class Updater {
  private checking = false
  /** De versie die klaarstaat maar nog niet gemeld is, omdat er een show liep. */
  private pending: string | null = null
  private notified: string | null = null

  constructor(private readonly deps: UpdaterDeps) {}

  /** Zoeken, tenzij er een show loopt of er al gezocht wordt. */
  async tick(): Promise<void> {
    if (this.checking || this.deps.isLive()) return
    this.checking = true
    try {
      await this.deps.check()
    } catch (err) {
      // Geen netwerk of GitHub onbereikbaar: de volgende keer opnieuw, zonder melding.
      this.deps.log?.('Zoeken naar updates mislukt', err)
    } finally {
      this.checking = false
    }
  }

  /** Een nieuwe versie is binnengehaald. */
  downloaded(version: string): void {
    if (version === this.notified) return
    if (this.deps.isLive()) this.pending = version
    else this.announce(version)
  }

  /** Na "Stop show": een update die tijdens de show binnenkwam, alsnog melden. */
  showStopped(): void {
    if (this.pending) this.announce(this.pending)
  }

  private announce(version: string): void {
    this.pending = null
    this.notified = version
    this.deps.notify(version)
  }
}
