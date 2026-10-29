import type { PluginId, PluginSettings } from '@shared/plugins'
import type { Notice, Quiz, ShowState } from '@shared/types'
import { MagicHomePlugin } from './magichome'

export type Notify = (level: Notice['level'], message: string) => void

/** Wat een plug-in in main doet. De app maakt hem aan zodra hij aangezet wordt. */
export interface MainPlugin {
  /** Zijn instellingen voor deze Mac; ook bij elke wijziging. */
  configure(config: Record<string, unknown>): void
  /** Na elke wijziging van de quiz of de show. */
  update(quiz: Quiz | null, state: ShowState): void
  /** Een vraag vanuit een venster, bv. "test de verbinding". */
  invoke(action: string, payload: unknown): Promise<unknown>
  /** Uitgezet, of de app stopt. */
  stop(): void
}

const FACTORIES: Record<PluginId, (notify: Notify) => MainPlugin> = {
  magichome: (notify) => new MagicHomePlugin(notify)
}

/** De plug-ins die aan staan. */
export class Plugins {
  private running = new Map<PluginId, MainPlugin>()

  constructor(private readonly notify: Notify) {}

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
        plugin = FACTORIES[id](this.notify)
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
}
