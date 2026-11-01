import type { z } from 'zod'
import { MAGICHOME } from './light'
import { pluginConfig } from './plugin'
import { REMOTE } from './remote'

/**
 * Ingebouwde plug-ins: extra's die je per Mac aan- of uitzet bij Instellingen. Staat een plug-in
 * uit, dan toont de app er niets van en doet hij niets; wat hij in een quiz bewaarde, blijft staan.
 */
export const PLUGINS = [MAGICHOME, REMOTE] as const

export type PluginId = (typeof PLUGINS)[number]['id']

type DefinitionOf<Id extends PluginId> = Extract<(typeof PLUGINS)[number], { id: Id }>

/** De instellingen per Mac van plug-in `Id`, zoals zijn definitie ze beschrijft. */
export type PluginConfig<Id extends PluginId> = z.output<DefinitionOf<Id>['config']>

export function pluginDefinition<Id extends PluginId>(id: Id): DefinitionOf<Id> {
  return PLUGINS.find((p) => p.id === id) as DefinitionOf<Id>
}

/** Per plug-in, per Mac: aan of uit, en zijn eigen instellingen (bv. het adres van een apparaat). */
export interface PluginSetting {
  enabled: boolean
  config: Record<string, unknown>
}

export type PluginSettings = Partial<Record<PluginId, PluginSetting>>

export const PLUGIN_OFF: PluginSetting = { enabled: false, config: {} }

export function pluginEnabled(settings: PluginSettings, id: PluginId): boolean {
  return settings[id]?.enabled ?? false
}

/** De instellingen van plug-in `id` op deze Mac, gecontroleerd; iets ongeldigs wordt de standaard. */
export function configOf<Id extends PluginId>(settings: PluginSettings, id: Id): PluginConfig<Id> {
  const definition: { config: z.ZodType<object> } = pluginDefinition(id)
  return pluginConfig(definition, settings[id]?.config) as PluginConfig<Id>
}
