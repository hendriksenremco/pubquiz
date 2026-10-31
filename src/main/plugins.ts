import { app } from 'electron'
import { join } from 'path'
import type { ShowCommand } from '@shared/ipc'
import type { PluginId, PluginSettings } from '@shared/plugins'
import type { Notice, Quiz, ShowState } from '@shared/types'
import { MagicHomePlugin } from './magichome'
import { RemotePlugin, type RemoteOptions } from './remote'

export type Notify = (level: Notice['level'], message: string) => void

/** Wat de app een plug-in in main geeft. */
export interface PluginHost {
  notify: Notify
  /** Bewaart zijn eigen instellingen voor deze Mac; daarna volgt configure. */
  saveConfig(config: Record<string, unknown>): void
  /** Een opdracht aan de show, zoals een knop in de app hem geeft. */
  command(command: ShowCommand): void
  /** Waar een bestand uit de geopende quiz staat; null = geen quiz, of buiten de quizmap. */
  mediaFile(file: string): string | null
  /** Een vraag aan een andere plug-in; null als die uit staat. */
  invoke(id: PluginId, action: string, payload?: unknown): Promise<unknown>
  /** Zijn stand is veranderd buiten de show om (bv. met de hand); de andere plug-ins horen het. */
  changed(): void
}

/** Wat een plug-in in main doet. De app maakt hem aan zodra hij aangezet wordt. */
export interface MainPlugin {
  /** Zijn instellingen voor deze Mac; ook bij elke wijziging. */
  configure(config: Record<string, unknown>): void
  /** Na elke wijziging van de quiz of de show. */
  update(quiz: Quiz | null, state: ShowState): void
  /** Een vraag vanuit een venster, bv. "test de verbinding". */
  invoke(action: string, payload: unknown): Promise<unknown>
  /** Een andere plug-in meldt dat zijn stand veranderd is. */
  changed?(id: PluginId): void
  /** Uitgezet, of de app stopt. */
  stop(): void
}

const FACTORIES: Record<PluginId, (host: PluginHost) => MainPlugin> = {
  magichome: (host) => new MagicHomePlugin(host.notify, host.changed),
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
    port: port ? Number(port) : undefined
  }
}

/** De plug-ins die aan staan. */
export class Plugins {
  private running = new Map<PluginId, MainPlugin>()

  constructor(
    private readonly host: Omit<PluginHost, 'saveConfig' | 'invoke' | 'changed'> & {
      saveConfig(id: PluginId, config: Record<string, unknown>): void
    }
  ) {}

  /** Start, stopt en stelt plug-ins in zoals de instellingen zeggen. */
  apply(settings: PluginSettings, quiz: Quiz | null, state: ShowState): void {
    for (const id of Object.keys(FACTORIES) as PluginId[]) {
      const setting = settings[id]
      let plugin = this.running.get(id)
      if (!setting?.enabled) {
        plugin?.stop()
        this.running.delete(id)
        continue
      }
      if (!plugin) {
        plugin = FACTORIES[id](this.hostFor(id))
        this.running.set(id, plugin)
      }
      plugin.configure(setting.config)
      plugin.update(quiz, state)
    }
  }

  update(quiz: Quiz | null, state: ShowState): void {
    for (const plugin of this.running.values()) plugin.update(quiz, state)
  }

  invoke(id: PluginId, action: string, payload: unknown): Promise<unknown> {
    return this.running.get(id)?.invoke(action, payload) ?? Promise.resolve(null)
  }

  stop(): void {
    for (const plugin of this.running.values()) plugin.stop()
    this.running.clear()
  }

  private hostFor(id: PluginId): PluginHost {
    return {
      notify: this.host.notify,
      saveConfig: (config) => this.host.saveConfig(id, config),
      command: this.host.command,
      mediaFile: this.host.mediaFile,
      invoke: (other, action, payload) => this.invoke(other, action, payload),
      changed: () => {
        for (const [other, plugin] of this.running) if (other !== id) plugin.changed?.(id)
      }
    }
  }
}
