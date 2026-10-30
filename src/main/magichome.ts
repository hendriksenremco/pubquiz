import { connect, type Socket } from 'net'
import {
  LightSchema,
  resolveLight,
  sameLight,
  stateLight,
  type Light,
  type LightStatus
} from '@shared/light'
import {
  lightMessages,
  parseAddress,
  queryState,
  readStates,
  type MagicHomeAddress,
  type MagicHomeProbe,
  type MagicHomeResult,
  type MagicHomeState
} from '@shared/magichome'
import type { Quiz, ShowState } from '@shared/types'
import type { MainPlugin, Notify } from './plugins'

const TIMEOUT_MS = 2000
/** Zo lang blijft de verbinding open na de laatste opdracht. */
const IDLE_MS = 15_000
/** Tussen twee berichten, zodat de controller ze los verwerkt. */
const GAP_MS = 50

/**
 * Plug-in MagicHome-licht: stuurt tijdens de show het licht van de slide, de ronde of de quiz
 * naar de controller. Een onbereikbare controller houdt de show nooit op: alles gaat op de
 * achtergrond met een korte timeout, en van snel na elkaar gevraagde lichten gaat alleen het
 * laatste nog weg. Lukt het niet, dan één melding, en bij de volgende wijziging een nieuwe poging.
 *
 * Buiten de show kan de editor een licht als voorbeeld laten zien; daarna gaat de controller terug
 * naar hoe hij was. Tijdens de show kan de afstandsbediening met de hand een licht kiezen.
 */
export class MagicHomePlugin implements MainPlugin {
  private address: MagicHomeAddress | null = null
  private link: Link | null = null
  /** Het licht van de show zelf (slide ⊕ ronde ⊕ quiz); null = de show stuurt het niet aan. */
  private showLight: Light | null = null
  /**
   * Met de hand gekozen tijdens de show. Geldt tot de show zelf een ander licht kiest dan toen
   * (`showLight`), of tot de show stopt.
   */
  private manual: { light: Light; showLight: Light | null } | null = null
  private wanted: Light | null = null
  private sent: Light | null = null
  /** Loopt er al een verzending, dan neemt die het nieuwste licht ook mee. */
  private sending = false
  /** Klaar als alles verstuurd is (of het mislukte). */
  private idle: Promise<void> = Promise.resolve()
  private failing = false
  private live = false
  /** Hoe het licht was voor het voorbeeld begon; null = geen voorbeeld bezig. */
  private before: Promise<Light> | null = null
  private restoring: Promise<void> = Promise.resolve()

  constructor(private readonly notify: Notify) {}

  configure(config: Record<string, unknown>): void {
    const address = parseAddress(typeof config.host === 'string' ? config.host : '')
    if (JSON.stringify(address) === JSON.stringify(this.address)) return
    this.address = address
    this.link?.close()
    this.link = address ? new Link(address) : null
    // Een andere controller weet nog van niets.
    this.sent = null
    this.failing = false
    void this.flush()
  }

  update(quiz: Quiz | null, state: ShowState): void {
    // Bij het begin van de show altijd sturen: iemand kan het licht intussen anders hebben gezet.
    // De show neemt het over van een voorbeeld.
    if (state.live && !this.live) {
      this.sent = null
      this.before = null
    }
    this.live = state.live
    const light = quiz ? resolveLight(quiz, state) : null
    if (!state.live || (this.manual && light && !sameLight(light, this.manual.showLight))) {
      this.manual = null
    }
    this.showLight = light
    this.want(this.manual?.light ?? light)
  }

  async invoke(
    action: string,
    payload: unknown
  ): Promise<MagicHomeProbe | MagicHomeResult | LightStatus | null> {
    if (action === 'preview' || action === 'choose') {
      const light = LightSchema.nullable().safeParse(payload)
      if (!light.success) return null
      return action === 'preview' ? this.preview(light.data) : this.choose(light.data)
    }
    if (action === 'status')
      return { light: this.manual?.light ?? this.showLight, manual: !!this.manual }
    if (action !== 'probe') return null
    const address = parseAddress(typeof payload === 'string' ? payload : '')
    if (!address) return { ok: false, error: 'Vul het IP-adres van de controller in' }
    // Dezelfde controller: over de verbinding die er al is, niet nog een erbij.
    const same = this.link && JSON.stringify(address) === JSON.stringify(this.address)
    const link = same ? this.link! : new Link(address)
    try {
      return { ok: true, state: await link.send([]) }
    } catch (err) {
      return { ok: false, error: explain(err, address) }
    } finally {
      if (!same) link.close()
    }
  }

  stop(): void {
    this.link?.close()
    this.link = null
    this.address = null
    this.wanted = null
    this.manual = null
    this.before = null
  }

  /** Tijdens de show met de hand een licht kiezen; null = weer het licht van de show. */
  private choose(light: Light | null): MagicHomeResult {
    if (!this.live) return { ok: false, error: 'Alleen tijdens de show' }
    if (!this.link) return { ok: false, error: 'Vul eerst het adres van de controller in' }
    this.manual = light ? { light, showLight: this.showLight } : null
    this.want(light ?? this.showLight)
    return { ok: true }
  }

  /** Stuurt dit licht, of laat het licht zoals het is (null). */
  private want(light: Light | null): void {
    if (!light) return
    this.wanted = light
    void this.flush()
  }

  /** Laat een licht zien zonder show; null = klaar, terug naar hoe het was. */
  private async preview(light: Light | null): Promise<MagicHomeResult> {
    const { address, link } = this
    if (this.live) return { ok: false, error: 'Tijdens de show volgt het licht de show' }
    if (!address || !link) return { ok: false, error: 'Vul eerst het adres van de controller in' }
    if (!light) {
      await this.endPreview()
      return { ok: true }
    }
    if (!this.before) {
      // Eerst een vorig voorbeeld laten terugzetten, anders lijkt dat voorbeeld "hoe het was".
      await this.restoring
      this.before ??= link.send([]).then(stateLight)
    }
    const before = this.before
    try {
      await before
    } catch (err) {
      if (this.before === before) this.before = null
      return { ok: false, error: explain(err, address) }
    }
    if (this.live || this.before !== before) return { ok: true }
    this.wanted = light
    void this.flush()
    return { ok: true }
  }

  private endPreview(): Promise<void> {
    const before = this.before
    this.before = null
    if (!before) return this.restoring
    this.restoring = before.then(
      (light) => {
        if (this.live) return
        this.wanted = light
        return this.flush()
      },
      () => {}
    )
    return this.restoring
  }

  private flush(): Promise<void> {
    if (!this.sending) this.idle = this.drain()
    return this.idle
  }

  private async drain(): Promise<void> {
    this.sending = true
    try {
      while (this.link && this.wanted && !sameLight(this.wanted, this.sent)) {
        const link = this.link
        const light = this.wanted
        try {
          await link.send(lightMessages(light))
          this.sent = light
          this.failing = false
        } catch (err) {
          if (this.link !== link) continue
          if (!this.failing) this.notify('warning', explain(err, link.address))
          this.failing = true
          return
        }
      }
    } finally {
      // In dezelfde stap als de laatste controle: een nieuw licht start dan een nieuwe ronde.
      this.sending = false
    }
  }
}

/**
 * Eén verbinding met de controller, die open blijft zolang er iets te sturen is. Meteen na het
 * sturen sluiten werkt niet: wat dan nog niet verwerkt was, laat de controller vallen. En veel
 * verbindingen kort na elkaar laten hem vastlopen (beide gezien op 2026-10-29).
 */
class Link {
  private socket: Socket | null = null
  private opening: Promise<Socket> | null = null
  private buffer: Uint8Array = new Uint8Array(0)
  private waiting: { resolve: (state: MagicHomeState) => void; reject: (err: Error) => void }[] = []
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  /** Telt bij elke close: een verbinding die daarna nog tot stand komt, is niet meer nodig. */
  private generation = 0

  constructor(readonly address: MagicHomeAddress) {}

  /**
   * Stuurt de berichten en daarna de statusvraag. Komt het antwoord, dan heeft de controller alles
   * verwerkt (hij werkt op volgorde); het antwoord is wat hij nu toont.
   */
  async send(messages: Uint8Array[]): Promise<MagicHomeState> {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    try {
      const socket = await this.open()
      for (const m of messages) {
        socket.write(m)
        await delay(GAP_MS)
      }
      const reply = this.nextState()
      socket.write(queryState())
      return await reply
    } catch (err) {
      this.close()
      throw err
    } finally {
      this.idleTimer = setTimeout(() => this.close(), IDLE_MS)
    }
  }

  close(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
    this.generation++
    this.opening = null
    const socket = this.socket
    this.reset(new Error('gesloten'))
    // Netjes sluiten: alles is al beantwoord. Sluit de controller niet terug, dan alsnog weg.
    socket?.end()
    socket?.setTimeout(TIMEOUT_MS, () => socket.destroy())
  }

  private open(): Promise<Socket> {
    if (this.socket) return Promise.resolve(this.socket)
    if (this.opening) return this.opening
    const generation = this.generation
    const opening = new Promise<Socket>((resolve, reject) => {
      const socket = connect(this.address)
      const fail = (err: Error) => {
        if (this.opening === opening) this.opening = null
        socket.destroy()
        reject(err)
      }
      socket.setTimeout(TIMEOUT_MS, () => fail(new Error('timeout')))
      socket.once('error', fail)
      socket.once('connect', () => {
        if (generation !== this.generation) return fail(new Error('gesloten'))
        socket.setTimeout(0)
        socket.off('error', fail)
        socket.on('error', (err) => this.drop(socket, err))
        socket.on('close', () => this.drop(socket, new Error('verbinding verbroken')))
        socket.on('data', (chunk: Buffer) => this.receive(chunk))
        this.socket = socket
        this.opening = null
        resolve(socket)
      })
    })
    this.opening = opening
    return opening
  }

  /** De volgende toestand die binnenkomt; ook als hij die uit zichzelf meldt. */
  private nextState(): Promise<MagicHomeState> {
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve: (state: MagicHomeState) => {
          clearTimeout(timer)
          resolve(state)
        },
        reject: (err: Error) => {
          clearTimeout(timer)
          reject(err)
        }
      }
      const timer = setTimeout(() => {
        this.waiting = this.waiting.filter((w) => w !== waiter)
        reject(new Error('timeout'))
      }, TIMEOUT_MS)
      this.waiting.push(waiter)
    })
  }

  private receive(chunk: Buffer): void {
    const { states, rest } = readStates(Uint8Array.from([...this.buffer, ...chunk]))
    this.buffer = rest
    const state = states.at(-1)
    if (!state) return
    const waiting = this.waiting
    this.waiting = []
    for (const w of waiting) w.resolve(state)
  }

  /** De controller of het netwerk verbrak de verbinding. */
  private drop(socket: Socket, err: Error): void {
    if (socket !== this.socket) return
    socket.destroy()
    this.reset(err)
  }

  private reset(err: Error): void {
    this.socket = null
    this.buffer = new Uint8Array(0)
    const waiting = this.waiting
    this.waiting = []
    for (const w of waiting) w.reject(err)
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
