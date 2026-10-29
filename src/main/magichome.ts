import { connect } from 'net'
import { resolveLight, sameLight, type Light } from '@shared/light'
import {
  lightMessages,
  parseAddress,
  queryState,
  readStates,
  type MagicHomeAddress,
  type MagicHomeProbe,
  type MagicHomeState
} from '@shared/magichome'
import type { Quiz, ShowState } from '@shared/types'
import type { MainPlugin, Notify } from './plugins'

const TIMEOUT_MS = 2000

/**
 * Plug-in MagicHome-licht: stuurt tijdens de show het licht van de slide, de ronde of de quiz
 * naar de controller. Een onbereikbare controller houdt de show nooit op: alles gaat op de
 * achtergrond met een korte timeout, en van snel na elkaar gevraagde lichten gaat alleen het
 * laatste nog weg. Lukt het niet, dan één melding, en bij de volgende wijziging een nieuwe poging.
 */
export class MagicHomePlugin implements MainPlugin {
  private address: MagicHomeAddress | null = null
  private wanted: Light | null = null
  private sent: Light | null = null
  private sending = false
  private failing = false
  private live = false

  constructor(private readonly notify: Notify) {}

  configure(config: Record<string, unknown>): void {
    const address = parseAddress(typeof config.host === 'string' ? config.host : '')
    if (JSON.stringify(address) === JSON.stringify(this.address)) return
    this.address = address
    // Een andere controller weet nog van niets.
    this.sent = null
    this.failing = false
    void this.flush()
  }

  update(quiz: Quiz | null, state: ShowState): void {
    // Bij het begin van de show altijd sturen: iemand kan het licht intussen anders hebben gezet.
    if (state.live && !this.live) this.sent = null
    this.live = state.live
    const light = quiz ? resolveLight(quiz, state) : null
    if (!light) return
    this.wanted = light
    void this.flush()
  }

  async invoke(action: string, payload: unknown): Promise<MagicHomeProbe | null> {
    if (action !== 'probe') return null
    const host = typeof payload === 'string' ? payload : ''
    const address = parseAddress(host)
    if (!address) return { ok: false, error: 'Vul het IP-adres van de controller in' }
    try {
      return { ok: true, state: await probe(address) }
    } catch (err) {
      return { ok: false, error: explain(err, address) }
    }
  }

  stop(): void {
    this.address = null
    this.wanted = null
  }

  private async flush(): Promise<void> {
    if (this.sending) return
    this.sending = true
    try {
      while (this.address && this.wanted && !sameLight(this.wanted, this.sent)) {
        const address = this.address
        const light = this.wanted
        try {
          await send(address, lightMessages(light))
          this.sent = light
          this.failing = false
        } catch (err) {
          if (this.address !== address) continue
          if (!this.failing) this.notify('warning', explain(err, address))
          this.failing = true
          return
        }
      }
    } finally {
      this.sending = false
    }
  }
}

/** Eén verbinding per wijziging: niets om open te houden of te herstellen als het wifi hapert. */
function send(address: MagicHomeAddress, messages: Uint8Array[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect(address)
    let connected = false
    // Na het versturen sluit de controller zelf, of ruimen we hem na de timeout op.
    socket.setTimeout(TIMEOUT_MS, () =>
      socket.destroy(connected ? undefined : new Error('timeout'))
    )
    socket.on('error', reject)
    // Antwoorden lezen we niet, maar wel weghalen, zodat de verbinding netjes dichtgaat.
    socket.on('data', () => {})
    socket.once('connect', () => {
      connected = true
      for (const m of messages) socket.write(m)
      socket.end(() => resolve())
    })
  })
}

/** Vraagt alleen de toestand op; verandert niets aan het licht. */
function probe(address: MagicHomeAddress): Promise<MagicHomeState> {
  return new Promise((resolve, reject) => {
    const socket = connect(address)
    let buffer: Uint8Array = new Uint8Array(0)
    const finish = (err: Error | null, state?: MagicHomeState) => {
      socket.destroy()
      if (err) reject(err)
      else resolve(state!)
    }
    socket.setTimeout(TIMEOUT_MS, () => finish(new Error('timeout')))
    socket.on('error', (err) => finish(err))
    socket.once('connect', () => socket.write(queryState()))
    socket.on('data', (chunk: Buffer) => {
      const { states, rest } = readStates(Uint8Array.from([...buffer, ...chunk]))
      buffer = rest
      if (states[0]) finish(null, states[0])
    })
  })
}

function explain(err: unknown, address: MagicHomeAddress): string {
  const code = (err as NodeJS.ErrnoException).code
  const where = address.host
  if (code === 'ECONNREFUSED') {
    return `${where} weigert de verbinding. Is dit de MagicHome-controller?`
  }
  if (
    (err as Error).message === 'timeout' ||
    ['EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'EHOSTDOWN'].includes(code ?? '')
  ) {
    return `MagicHome-controller op ${where} niet bereikbaar. Zit hij op hetzelfde wifi-netwerk als deze Mac?`
  }
  return `MagicHome-controller op ${where}: ${(err as Error).message}`
}
