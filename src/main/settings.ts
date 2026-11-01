import { randomUUID } from 'crypto'
import { join } from 'path'
import { promises as fs } from 'fs'
import { sameDisplayName } from '@shared/airplay'
import type { PluginId, PluginSetting, PluginSettings } from '@shared/plugins'
import type {
  AudioTarget,
  DisplayInfo,
  HardwareMapping,
  Quiz,
  ScreenTarget,
  ShowState
} from '@shared/types'
import { readJson, writeJson } from './json-store'

/**
 * Machine-specifieke instellingen (userData), los van de quiz.
 * De koppeling scherm-slot → display en kanaal → uitgang is gekeyed op naam,
 * zodat een nieuwe quiz met dezelfde namen ("Beamer", "Zaal") hem hergebruikt.
 */
interface SettingsData {
  recent: string[]
  screens: Record<string, ScreenTarget>
  audio: Record<string, AudioTarget>
  /** Alleen schermen waarvan het geluid niet naar hun eigen speakers gaat. */
  screenSound: Record<string, AudioTarget>
  /** Waar de rondleiding bij de eerste start is neergezet; null = nog niet gebeurd. */
  tourDir: string | null
  /** Plug-ins die aan of uit staan, met hun instellingen; ontbreekt = uit. */
  plugins: PluginSettings
  /**
   * Anoniem meten (issue #40): null = nog niet gevraagd. `id` is willekeurig en verdwijnt als de
   * toestemming wordt ingetrokken, zodat een nieuwe toestemming niet aan de oude vastzit.
   */
  analytics: { consent: boolean; id: string | null } | null
}

export interface RecoveryData {
  quizDir: string
  state: ShowState
  savedAt: number
}

const MAX_RECENT = 8
export const DEFAULT_AUDIO: AudioTarget = { deviceId: 'default', label: 'Systeemstandaard' }

export class Settings {
  /** Opslaan gebeurt na elkaar: twee snelle wijzigingen kunnen elkaar zo niet inhalen. */
  private saving: Promise<void> = Promise.resolve()

  private constructor(
    private readonly dir: string,
    private data: SettingsData
  ) {}

  static async load(dir: string): Promise<Settings> {
    const stored = await readJson<Partial<SettingsData>>(join(dir, 'settings.json'))
    return new Settings(dir, {
      recent: stored?.recent ?? [],
      screens: stored?.screens ?? {},
      audio: stored?.audio ?? {},
      screenSound: stored?.screenSound ?? {},
      tourDir: stored?.tourDir ?? null,
      plugins: stored?.plugins ?? {},
      analytics: stored?.analytics ?? null
    })
  }

  get recent(): string[] {
    return this.data.recent
  }

  addRecent(path: string): void {
    this.data.recent = [path, ...this.data.recent.filter((p) => p !== path)].slice(0, MAX_RECENT)
    void this.save()
  }

  removeRecent(path: string): void {
    this.data.recent = this.data.recent.filter((p) => p !== path)
    void this.save()
  }

  get plugins(): PluginSettings {
    return this.data.plugins
  }

  setPlugin(id: PluginId, setting: PluginSetting): void {
    this.data.plugins = { ...this.data.plugins, [id]: setting }
    void this.save()
  }

  /** true of false als het gevraagd is; null = nog niet. */
  get analyticsConsent(): boolean | null {
    return this.data.analytics?.consent ?? null
  }

  /** Het anonieme id, alleen met toestemming. */
  get analyticsId(): string | null {
    return this.data.analytics?.consent ? this.data.analytics.id : null
  }

  setAnalytics(consent: boolean): void {
    const id = consent ? (this.data.analytics?.id ?? randomUUID()) : null
    this.data.analytics = { consent, id }
    void this.save()
  }

  get tourDir(): string | null {
    return this.data.tourDir
  }

  /**
   * Rondleiding neergezet in `dir`: op het dashboard op de plek van `replaces` (dezelfde quiz,
   * eerder vanaf een andere plek geopend), anders achteraan, zodat de eigen quizzen voorgaan.
   */
  setTour(dir: string, replaces: string): void {
    this.data.tourDir = dir
    const recent = this.data.recent.filter((p) => p !== dir)
    const at = recent.indexOf(replaces)
    if (at >= 0) recent[at] = dir
    else recent.splice(MAX_RECENT - 1, Infinity, dir)
    this.data.recent = recent
    void this.save()
  }

  mappingFor(quiz: Quiz, displays: DisplayInfo[]): HardwareMapping {
    // Laptop: alles behalve het ingebouwde scherm. Zonder ingebouwd scherm: alles behalve het hoofdscherm.
    const hasInternal = displays.some((d) => d.internal)
    const external = displays.filter((d) => (hasInternal ? !d.internal : !d.primary))
    const screens = Object.fromEntries(
      quiz.screens.map((slot, i) => {
        const stored = this.data.screens[slot.name]
        if (stored) return [slot.id, stored]
        const suggestion = external[i]
        const target: ScreenTarget = suggestion
          ? { kind: 'display', displayId: suggestion.id, label: suggestion.label }
          : { kind: 'window' }
        return [slot.id, target]
      })
    )
    const audio = Object.fromEntries(
      quiz.channels.map((c) => [c.id, this.data.audio[c.name] ?? DEFAULT_AUDIO])
    )
    const screenSound = Object.fromEntries(
      quiz.screens.flatMap((slot) => {
        const stored = this.data.screenSound[slot.name]
        return stored ? [[slot.id, stored]] : []
      })
    )
    return { screens, audio, screenSound }
  }

  saveMapping(quiz: Quiz, mapping: HardwareMapping): void {
    for (const slot of quiz.screens) {
      const target = mapping.screens[slot.id]
      if (target) this.data.screens[slot.name] = target
      const sound = mapping.screenSound[slot.id]
      if (sound) this.data.screenSound[slot.name] = sound
      else delete this.data.screenSound[slot.name]
    }
    for (const channel of quiz.channels) {
      const target = mapping.audio[channel.id]
      if (target) this.data.audio[channel.name] = target
    }
    void this.save()
  }

  async readRecovery(): Promise<RecoveryData | null> {
    return readJson<RecoveryData>(join(this.dir, 'recovery.json'))
  }

  writeRecovery(data: RecoveryData): Promise<void> {
    return writeJson(join(this.dir, 'recovery.json'), data)
  }

  clearRecovery(): Promise<void> {
    return fs.rm(join(this.dir, 'recovery.json'), { force: true })
  }

  /** Klaar als alles is weggeschreven. */
  whenSaved(): Promise<void> {
    return this.saving
  }

  private save(): Promise<void> {
    this.saving = this.saving
      .then(() => writeJson(join(this.dir, 'settings.json'), this.data))
      .catch((err) => {
        console.error('Instellingen opslaan mislukt', err)
      })
    return this.saving
  }
}

/**
 * Eén keer bij een nieuwe naam: instellingen en herstelgegevens overnemen uit de map van de
 * jongste eerdere naam die ze heeft (`from`, nieuwste eerst), zodat recente quizzen en
 * koppelingen blijven.
 */
export async function adoptSettings(from: string[], to: string): Promise<void> {
  if (await exists(join(to, 'settings.json'))) return
  await fs.mkdir(to, { recursive: true })
  for (const dir of from) {
    if (!(await exists(join(dir, 'settings.json')))) continue
    for (const file of ['settings.json', 'recovery.json']) {
      await fs.copyFile(join(dir, file), join(to, file), fs.constants.COPYFILE_EXCL).catch(() => {})
    }
    return
  }
}

const exists = (path: string) =>
  fs.access(path).then(
    () => true,
    () => false
  )

/** Zoekt het display bij een doel: eerst op id, dan op naam (ids veranderen soms na opnieuw aansluiten). */
export function findDisplay<T extends { id: number; label: string }>(
  target: ScreenTarget | undefined,
  displays: T[]
): T | null {
  if (target?.kind !== 'display') return null
  return (
    displays.find((d) => d.id === target.displayId) ??
    displays.find((d) => d.label === target.label) ??
    // AirPlay-schermen heten in macOS soms net iets anders dan op het netwerk.
    displays.find((d) => sameDisplayName(d.label, target.label)) ??
    null
  )
}
