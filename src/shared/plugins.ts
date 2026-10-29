import { z } from 'zod'

/**
 * Ingebouwde plug-ins: extra's die je per Mac aan- of uitzet bij Instellingen. Staat een plug-in
 * uit, dan toont de app er niets van en doet hij niets; wat hij in een quiz bewaarde, blijft staan.
 */
export const PLUGINS = [
  {
    id: 'magichome',
    name: 'MagicHome-licht',
    description:
      'Ledstrips met een MagicHome-controller een kleur of effect geven, per ronde en per slide.'
  }
] as const

export type PluginId = (typeof PLUGINS)[number]['id']

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

/**
 * Gegevens van plug-ins in de quiz, op de quiz zelf, een ronde of een slide, onder het id van de
 * plug-in. De app kijkt er niet in; elke plug-in controleert zijn eigen deel.
 */
export const PluginDataSchema = z.record(z.string(), z.unknown())

export type PluginData = z.infer<typeof PluginDataSchema>
