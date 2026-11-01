/**
 * Wat elke plug-in gemeen heeft: één definitie met zijn instellingen per Mac en zijn gegevens in
 * de quiz, allebei met een zod-schema. De lijst van plug-ins staat in plugins.ts.
 */
import { z } from 'zod'
import { activeRound } from './resolve'
import type { Quiz, ShowState } from './types'

/**
 * Gegevens van plug-ins in de quiz, op de quiz zelf, een ronde of een slide, onder het id van de
 * plug-in. De app kijkt er niet in; elke plug-in controleert zijn eigen deel met `data`.
 */
export const PluginDataSchema = z.record(z.string(), z.unknown())

export type PluginData = z.infer<typeof PluginDataSchema>

export interface PluginDefinition<
  Id extends string = string,
  Config extends z.ZodType<object> = z.ZodType<object>,
  Data extends z.ZodType<object> | undefined = z.ZodType<object> | undefined
> {
  id: Id
  name: string
  description: string
  /** Instellingen per Mac. Wat ongeldig is, wordt de standaard: geef elk veld een `.catch`. */
  config: Config
  /** Gegevens op de quiz, een ronde of een slide (slide ⊕ ronde ⊕ quiz); ongeldig telt als niets. */
  data?: Data
}

/** Geeft de definitie terug zoals hij is, maar TypeScript onthoudt het id en de schema's. */
export function definePlugin<
  const Id extends string,
  Config extends z.ZodType<object>,
  Data extends z.ZodType<object> | undefined = undefined
>(definition: PluginDefinition<Id, Config, Data>): PluginDefinition<Id, Config, Data> {
  return definition
}

/** De instellingen van een plug-in, gecontroleerd; iets ongeldigs wordt de standaard. */
export function pluginConfig<Config extends z.ZodType<object>>(
  definition: { config: Config },
  raw: unknown
): z.output<Config> {
  const parsed = definition.config.safeParse(raw)
  return parsed.success ? parsed.data : definition.config.parse({})
}

/** Iets met plug-ingegevens: de quiz, een ronde of een slide. */
export interface HasPlugins {
  plugins?: PluginData
}

interface WithData<Data extends z.ZodType<object>> {
  id: string
  data?: Data
}

/** De gegevens van een plug-in op een quiz, ronde of slide; iets ongeldigs telt als niets. */
export function pluginData<Data extends z.ZodType<object>>(
  definition: WithData<Data>,
  holder: HasPlugins | null | undefined
): z.output<Data> | undefined {
  const raw = holder?.plugins?.[definition.id]
  if (raw === undefined || !definition.data) return undefined
  const parsed = definition.data.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

/**
 * Bewaart de gegevens van een plug-in; undefined haalt ze weg. Gegevens van andere plug-ins
 * blijven staan, en zonder gegevens verdwijnt `plugins` helemaal.
 */
export function setPluginData<Data extends z.ZodType<object>>(
  definition: WithData<Data>,
  holder: HasPlugins,
  value: z.input<Data> | undefined
): void {
  const { [definition.id]: _, ...rest } = holder.plugins ?? {}
  const plugins = value === undefined ? rest : { ...rest, [definition.id]: value }
  if (Object.keys(plugins).length) holder.plugins = plugins
  else delete holder.plugins
}

/**
 * De gegevens die nu gelden: van de slide, anders van de ronde, anders van de quiz. Net als de
 * schermen in resolve.ts; de gegevens van één plek gaan in hun geheel voor, ze worden niet gemengd.
 */
export function resolvePluginData<Data extends z.ZodType<object>>(
  definition: WithData<Data>,
  quiz: Quiz,
  state: ShowState
): z.output<Data> | undefined {
  const round = activeRound(quiz, state)
  const slide = round && state.slideIndex >= 0 ? round.slides[state.slideIndex] : undefined
  return (
    pluginData(definition, slide) ?? pluginData(definition, round) ?? pluginData(definition, quiz)
  )
}
