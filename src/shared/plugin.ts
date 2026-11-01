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

declare const TYPE: unique symbol

/** Alleen voor TypeScript: draagt een type mee, zonder waarde. Maak er een met `typeOnly<T>()`. */
export interface TypeOnly<T> {
  readonly [TYPE]?: T
}

export const typeOnly = <T>(): TypeOnly<T> => ({})

/** Iets wat een knop, de telefoon of de AI een plug-in kan vragen. */
export interface PluginAction<Input extends z.ZodType = z.ZodType, Result = unknown> {
  /** Wat de actie meekrijgt; main controleert het voordat de plug-in het ziet. */
  input: Input
  /** Wat de actie teruggeeft. */
  result: TypeOnly<Result>
}

/** Een actie met invoer `input` die `Result` teruggeeft: `action<Result>()(schema)`. */
export function action<Result>() {
  return <Input extends z.ZodType>(input: Input): PluginAction<Input, Result> => ({
    input,
    result: typeOnly<Result>()
  })
}

export type PluginActions = Record<string, PluginAction>

export interface PluginDefinition<
  Id extends string = string,
  Config extends z.ZodType<object> = z.ZodType<object>,
  Data extends z.ZodType<object> | undefined = z.ZodType<object> | undefined,
  Status = unknown,
  Actions extends PluginActions = PluginActions
> {
  id: Id
  name: string
  description: string
  /** Instellingen per Mac. Wat ongeldig is, wordt de standaard: geef elk veld een `.catch`. */
  config: Config
  /** Gegevens op de quiz, een ronde of een slide (slide ⊕ ronde ⊕ quiz); ongeldig telt als niets. */
  data?: Data
  /** Wat main naar de vensters en de telefoons duwt zodra het verandert (`PluginHost.publish`). */
  status: TypeOnly<Status>
  /** Wat de vensters de plug-in kunnen vragen; main weigert een onbekende actie of foute invoer. */
  actions: Actions
}

/** Geeft de definitie terug zoals hij is, maar TypeScript onthoudt het id, de schema's en de types. */
export function definePlugin<
  const Id extends string,
  Config extends z.ZodType<object>,
  Status,
  Actions extends PluginActions,
  Data extends z.ZodType<object> | undefined = undefined
>(
  definition: PluginDefinition<Id, Config, Data, Status, Actions>
): PluginDefinition<Id, Config, Data, Status, Actions> {
  return definition
}

/**
 * Controleert een actie met de definitie: de invoer zoals zod hem teruggeeft, of null als de actie
 * niet bestaat of de invoer niet klopt.
 */
export function parseAction(
  definition: { actions: PluginActions },
  name: string,
  input: unknown
): { input: unknown } | null {
  if (!Object.hasOwn(definition.actions, name)) return null
  const parsed = definition.actions[name].input.safeParse(input)
  return parsed.success ? { input: parsed.data } : null
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
