import { connect, type Socket } from 'net'
import {
  quizLights,
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
import type { Locale } from '@shared/i18n'
import type { PluginConfig } from '@shared/plugins'
import { MAGICHOME_ERRORS } from './messages'
import type { ActionHandlers, MainPlugin, Notify } from './plugins'

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
export class MagicHomePlugin implements MainPlugin<'magichome'> {
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
  /** De lichten van de geopende quiz, voor de status. */
  private quizLights: Light[] = []
  /** Hoe het licht was voor het voorbeeld begon; null = geen voorbeeld bezig. */
  private before: Promise<Light> | null = null
  private restoring: Promise<void> = Promise.resolve()

  constructor(
    private readonly notify: Notify,
    /** Wat er nu brandt: de werkbalk en de afstandsbediening tonen het meteen. */
    private readonly publish: (status: LightStatus) => void = () => {},
    /** De taal van de foutmeldingen. */
    locale: Locale = 'nl'
  ) {
    this.t = MAGICHOME_ERRORS.in(locale)
  }

  private readonly t: ReturnType<typeof MAGICHOME_ERRORS.in>

  readonly actions: ActionHandlers<'magichome'> = {
    choose: (light) => this.choose(light),
    preview: (light) => this.preview(light),
    probe: (host) => this.probe(host)
  }

  configure(config: PluginConfig<'magichome'>): void {
    const address = parseAddress(config.host)
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
    this.quizLights = quiz ? quizLights(quiz) : []
    this.want(this.manual?.light ?? light)
    this.publishStatus()
  }

  /** Alleen de toestand opvragen; het licht verandert niet. */
  private async probe(host: string): Promise<MagicHomeProbe> {
    const address = parseAddress(host)
    if (!address) return { ok: false, error: this.t('fillAddress') }
    // Dezelfde controller: over de verbinding die er al is, niet nog een erbij.
    const same = this.link && JSON.stringify(address) === JSON.stringify(this.address)
    const link = same ? this.link! : new Link(address)
    try {
      return { ok: true, state: await link.send([]) }
    } catch (err) {
      return { ok: false, error: this.explain(err, address) }
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
    if (!this.live) return { ok: false, error: this.t('onlyLive') }
    if (!this.link) return { ok: false, error: this.t('fillAddressFirst') }
    this.manual = light ? { light, showLight: this.showLight } : null
    this.want(light ?? this.showLight)
    this.publishStatus()
    return { ok: true }
  }

  /** Alleen wat de plug-in weet; dit vraagt de controller niets. */
  private publishStatus(): void {
    this.publish({
      light: this.manual?.light ?? this.showLight,
      manual: !!this.manual,
      quiz: this.quizLights
    })
  }

  /** Stuurt dit licht, of laat het licht zoals het is (null). */
  private want(light: Light | null): void {
    if (!light) return
    this.wanted = light
    void this.flush()
  }

  /** Wat er misging met de controller, in woorden voor wie hem instelt. */
  private explain(err: unknown, address: MagicHomeAddress): string {
    return this.t(explainKey(err), { host: address.host, error: (err as Error).message })
  }

  /** Laat een licht zien zonder show; null = klaar, terug naar hoe het was. */
  private async preview(light: Light | null): Promise<MagicHomeResult> {
    const { address, link } = this
    if (this.live) return { ok: false, error: this.t('followsShow') }
    if (!address || !link) return { ok: false, error: this.t('fillAddressFirst') }
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
      return { ok: false, error: this.explain(err, address) }
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
          if (!this.failing) this.notify('warning', this.explain(err, link.address))
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

function explainKey(err: unknown): 'refused' | 'unreachable' | 'other' {
  const code = (err as NodeJS.ErrnoException).code
  if (code === 'ECONNREFUSED') return 'refused'
  if (
    (err as Error).message === 'timeout' ||
    ['EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'EHOSTDOWN'].includes(code ?? '')
  ) {
    return 'unreachable'
  }
  return 'other'
}
