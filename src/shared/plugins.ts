import type { z } from 'zod'
import { MAGICHOME } from './light'
import { pluginConfig, type PluginAction, type TypeOnly } from './plugin'
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

/** Wat plug-in `Id` naar de vensters duwt; zie `PluginHost.publish`. */
export type PluginStatus<Id extends PluginId> =
  DefinitionOf<Id>['status'] extends TypeOnly<infer Status> ? Status : never

/** De laatste status van elke plug-in die aan staat. */
export type PluginStatuses = { [Id in PluginId]?: PluginStatus<Id> }

type ActionsOf<Id extends PluginId> = DefinitionOf<Id>['actions']

/** De acties van plug-in `Id`. */
export type PluginActionName<Id extends PluginId> = keyof ActionsOf<Id> & string

/** Wat je een actie meegeeft. */
export type ActionInput<Id extends PluginId, Name extends PluginActionName<Id>> =
  ActionsOf<Id>[Name] extends PluginAction<infer Input> ? z.input<Input> : never

/** Wat de plug-in van een actie krijgt, na de controle. */
export type ActionValue<Id extends PluginId, Name extends PluginActionName<Id>> =
  ActionsOf<Id>[Name] extends PluginAction<infer Input> ? z.output<Input> : never

/** Wat een actie teruggeeft. */
export type ActionResult<Id extends PluginId, Name extends PluginActionName<Id>> =
  ActionsOf<Id>[Name] extends PluginAction<z.ZodType, infer Result> ? Result : never

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
