import { app } from 'electron'
import { join } from 'path'
import type { ShowCommand } from '@shared/ipc'
import { parseAction, type ActionSource } from '@shared/plugin'
import {
  configOf,
  pluginDefinition,
  type ActionInput,
  type ActionResult,
  type ActionValue,
  type PluginActionName,
  type PluginConfig,
  type PluginId,
  type PluginSettings,
  type PluginStatus,
  type PluginStatuses
} from '@shared/plugins'
import type { Notice, Quiz, ShowState } from '@shared/types'
import { MagicHomePlugin } from './magichome'
import { StatusBoard } from './plugin-status'
import { appLocale } from './locale'
import { RemotePlugin, type RemoteOptions } from './remote'

export type Notify = (level: Notice['level'], message: string) => void

/** Wat de app een plug-in in main geeft. */
export interface PluginHost<Id extends PluginId> {
  notify: Notify
  /** Bewaart zijn eigen instellingen voor deze Mac; daarna volgt configure. */
  saveConfig(config: PluginConfig<Id>): void
  /** Een opdracht aan de show, zoals een knop in de app hem geeft. */
  command(command: ShowCommand): void
  /** Waar een bestand uit de geopende quiz staat; null = geen quiz, of buiten de quizmap. */
  mediaFile(file: string): string | null
  /**
   * Zijn status voor de vensters, de telefoons en de andere plug-ins. Mag vaak: alleen een echte
   * verandering gaat weg, en hooguit een paar keer per seconde (StatusBoard).
   */
  publish(status: PluginStatus<Id>): void
  /** De laatste status van een andere plug-in; null als die uit staat. */
  status<Other extends PluginId>(id: Other): PluginStatus<Other> | null
  /** Een actie van een andere plug-in; null als die uit staat of de actie niet klopt. */
  act<Other extends PluginId, Name extends PluginActionName<Other>>(
    id: Other,
    name: Name,
    input: ActionInput<Other, Name>
  ): Promise<ActionResult<Other, Name> | null>
  /**
   * Een actie namens een telefoon: alleen wat de andere plug-in in `remoteActions` toestaat, met
   * ongecontroleerde invoer. null = die plug-in staat uit, de actie mag niet of de invoer klopt niet.
   */
  remoteAct(id: PluginId, name: string, input: unknown): Promise<unknown>
}

/** Per actie van plug-in `Id`: wat hij doet met de gecontroleerde invoer. */
export type ActionHandlers<Id extends PluginId> = {
  [Name in PluginActionName<Id>]: (
    input: ActionValue<Id, Name>
  ) => Promise<ActionResult<Id, Name>> | ActionResult<Id, Name>
}

/** Wat een plug-in in main doet. De app maakt hem aan zodra hij aangezet wordt. */
export interface MainPlugin<Id extends PluginId> {
  /** Zijn instellingen voor deze Mac, gecontroleerd met zijn definitie; ook bij elke wijziging. */
  configure(config: PluginConfig<Id>): void
  /** Na elke wijziging van de quiz of de show. */
  update(quiz: Quiz | null, state: ShowState): void
  /** De acties uit zijn definitie; main heeft de invoer al gecontroleerd. */
  readonly actions: ActionHandlers<Id>
  /** Een andere plug-in heeft een nieuwe status. */
  statusChanged?(id: PluginId): void
  /** Uitgezet, of de app stopt. */
  stop(): void
}

type Factories = {
  [Id in PluginId]: (host: PluginHost<Id>) => MainPlugin<Id>
}

const FACTORIES: Factories = {
  magichome: (host) => new MagicHomePlugin(host.notify, host.publish, appLocale()),
  remote: (host) => new RemotePlugin(host, remoteOptions())
}

/**
 * De pagina voor de telefoon: uit de build, of tijdens het ontwikkelen van Vite.
 * PUBQUIZ_REMOTE_HOST en _PORT: voor tests, alleen op localhost en een vrije poort.
 */
function remoteOptions(): RemoteOptions {
  const devServer = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined
  const port = process.env['PUBQUIZ_REMOTE_PORT']
  return {
    page: devServer ? { devServer } : { dir: join(__dirname, '../renderer') },
    host: process.env['PUBQUIZ_REMOTE_HOST'],
    port: port ? Number(port) : undefined,
    locale: appLocale()
  }
}

/** De plug-ins die aan staan. */
export class Plugins {
  private running = new Map<PluginId, MainPlugin<never>>()
  private readonly board: StatusBoard

  constructor(
    private readonly host: Pick<PluginHost<PluginId>, 'notify' | 'command' | 'mediaFile'> & {
      saveConfig(id: PluginId, config: Record<string, unknown>): void
      /** Naar alle vensters; null = de plug-in staat uit. */
      publishStatus(id: PluginId, status: unknown): void
    }
  ) {
    this.board = new StatusBoard((id, status) => {
      this.host.publishStatus(id, status)
      for (const [other, plugin] of this.running) if (other !== id) plugin.statusChanged?.(id)
    })
  }

  /** Start, stopt en stelt plug-ins in zoals de instellingen zeggen. */
  apply(settings: PluginSettings, quiz: Quiz | null, state: ShowState): void {
    for (const id of Object.keys(FACTORIES) as PluginId[]) {
      const setting = settings[id]
      let plugin = this.running.get(id)
      if (!setting?.enabled) {
        if (plugin) this.end(id, plugin)
        continue
      }
      if (!plugin) {
        plugin = this.create(id)
        this.running.set(id, plugin)
      }
      // De config hoort bij dit id; TypeScript kan dat over de lus heen niet volgen.
      ;(plugin as unknown as MainPlugin<typeof id>).configure(configOf(settings, id))
      plugin.update(quiz, state)
    }
  }

  update(quiz: Quiz | null, state: ShowState): void {
    for (const plugin of this.running.values()) plugin.update(quiz, state)
  }

  /**
   * Een actie, gecontroleerd met de definitie; null = de plug-in staat uit of de actie klopt niet.
   * Vraagt een telefoon hem (`remote`), dan alleen wat in `remoteActions` staat.
   */
  async act(
    id: PluginId,
    name: string,
    input: unknown,
    source: ActionSource = 'app'
  ): Promise<unknown> {
    const plugin = this.running.get(id)
    if (!plugin) return null
    const parsed = parseAction(pluginDefinition(id), name, input, source)
    if (!parsed) return null
    const handlers = plugin.actions as Record<string, (input: unknown) => unknown>
    return (await handlers[name](parsed.input)) ?? null
  }

  /** De laatste status van elke plug-in die aan staat, voor een venster dat net opent. */
  statuses(): PluginStatuses {
    return this.board.all()
  }

  stop(): void {
    for (const [id, plugin] of this.running) this.end(id, plugin)
  }

  private end(id: PluginId, plugin: MainPlugin<never>): void {
    plugin.stop()
    this.running.delete(id)
    this.board.clear(id)
  }

  private create<Id extends PluginId>(id: Id): MainPlugin<never> {
    return FACTORIES[id](this.hostFor(id)) as unknown as MainPlugin<never>
  }

  private hostFor<Id extends PluginId>(id: Id): PluginHost<Id> {
    return {
      notify: this.host.notify,
      saveConfig: (config) => this.host.saveConfig(id, { ...config }),
      command: this.host.command,
      mediaFile: this.host.mediaFile,
      publish: (status) => {
        if (this.running.has(id)) this.board.publish(id, status)
      },
      status: <Other extends PluginId>(other: Other) =>
        this.board.get(other) as PluginStatus<Other> | null,
      act: <Other extends PluginId, Name extends PluginActionName<Other>>(
        other: Other,
        name: Name,
        input: ActionInput<Other, Name>
      ) => this.act(other, name, input) as Promise<ActionResult<Other, Name> | null>,
      remoteAct: (other, name, input) => this.act(other, name, input, 'remote')
    }
  }
}
