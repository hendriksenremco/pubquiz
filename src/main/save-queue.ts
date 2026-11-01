/**
 * Houdt bij of de quiz nog opgeslagen moet worden, en schrijft hem één keer tegelijk.
 *
 * Komt er een wijziging binnen terwijl er geschreven wordt, dan blijft de quiz "dirty": de
 * volgende opslag schrijft hem alsnog. Twee schrijfacties lopen nooit door elkaar, zodat een
 * oudere versie nooit na een nieuwere op schijf belandt.
 */
export class SaveQueue {
  private version = 0
  private savedVersion = 0
  private chain: Promise<unknown> = Promise.resolve()

  get dirty(): boolean {
    return this.version !== this.savedVersion
  }

  /** Er is iets veranderd dat nog op schijf moet. */
  changed(): void {
    this.version++
  }

  /** Wat er nu is, hoeft niet meer opgeslagen te worden (net geladen of gesloten). */
  clean(): void {
    this.savedVersion = this.version
  }

  /**
   * Schrijft de nieuwste versie, na een eventuele lopende opslag. `write` moet de quiz
   * meteen (vóór de eerste `await`) vastleggen. Geeft `true` als daarna alles op schijf staat.
   */
  flush(write: () => Promise<void>): Promise<boolean> {
    const run = this.chain.then(async () => {
      if (!this.dirty) return false
      const version = this.version
      await write()
      if (version > this.savedVersion) this.savedVersion = version
      return !this.dirty
    })
    this.chain = run.catch(() => undefined)
    return run
  }
}
