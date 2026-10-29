/**
 * Plug-in MagicHome-licht: een kleur of effect op de quiz (standaard), een ronde of een slide.
 * Net als de schermen: slide ⊕ ronde ⊕ standaard. Staat nergens iets, dan blijft het licht zoals het is.
 */
import { z } from 'zod'
import { EFFECT_MAX, EFFECT_MIN } from './magichome'
import { EFFECT_NAMES } from './magichome-effects'
import type { PluginData } from './plugins'
import { activeRound } from './resolve'
import type { Quiz, ShowState } from './types'

export const LightSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('color'), color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
  z.object({
    type: z.literal('effect'),
    effect: z.number().int().min(EFFECT_MIN).max(EFFECT_MAX),
    /** 0–100. */
    speed: z.number().int().min(0).max(100)
  }),
  z.object({ type: z.literal('off') })
])

export type Light = z.infer<typeof LightSchema>

const PLUGIN = 'magichome'

interface HasPlugins {
  plugins?: PluginData
}

/** Het licht van een slide, ronde of quiz; iets ongeldigs telt als niets. */
export function lightOf(holder: HasPlugins | null | undefined): Light | undefined {
  const data = holder?.plugins?.[PLUGIN] as { light?: unknown } | undefined
  const parsed = LightSchema.safeParse(data?.light)
  return parsed.success ? parsed.data : undefined
}

export function setLight(holder: HasPlugins, light: Light | undefined): void {
  const { [PLUGIN]: _, ...rest } = holder.plugins ?? {}
  const plugins = light ? { ...rest, [PLUGIN]: { light } } : rest
  if (Object.keys(plugins).length) holder.plugins = plugins
  else delete holder.plugins
}

/** Welk licht er nu hoort; null = niets aan veranderen. Alleen tijdens de show. */
export function resolveLight(quiz: Quiz, state: ShowState): Light | null {
  if (!state.live) return null
  const round = activeRound(quiz, state)
  const slide = round && state.slideIndex >= 0 ? round.slides[state.slideIndex] : undefined
  return lightOf(slide) ?? lightOf(round) ?? lightOf(quiz) ?? null
}

/** Stuurt de quiz ergens het licht aan? */
export function quizUsesLight(quiz: Quiz): boolean {
  return (
    !!lightOf(quiz) || quiz.rounds.some((r) => !!lightOf(r) || r.slides.some((s) => !!lightOf(s)))
  )
}

export const sameLight = (a: Light | null, b: Light | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/** Kleuren die op een ledstrip goed uit elkaar te houden zijn; daarnaast kan elke kleur. */
export const LIGHT_COLORS = [
  { color: '#ff0000', name: 'Rood' },
  { color: '#ff5000', name: 'Oranje' },
  { color: '#ffc000', name: 'Geel' },
  { color: '#00ff00', name: 'Groen' },
  { color: '#00ffff', name: 'Cyaan' },
  { color: '#0000ff', name: 'Blauw' },
  { color: '#8000ff', name: 'Paars' },
  { color: '#ff0080', name: 'Roze' },
  { color: '#ffffff', name: 'Wit' },
  { color: '#ffa040', name: 'Warm wit' }
] as const

/** Een handvol duidelijk verschillende effecten; de andere kies je op nummer. */
export const LIGHT_EFFECTS = [
  { effect: 2, name: 'Kleuren lopen in elkaar over' },
  { effect: 4, name: 'Kleuren wisselen snel' },
  { effect: 5, name: 'Flitsen in kleur' },
  { effect: 3, name: 'Kleuren lopen door' },
  { effect: 10, name: 'Regenboog heen en weer' },
  { effect: 6, name: 'Lichtpunt heen en weer' },
  { effect: 9, name: 'Vanuit het midden naar buiten' },
  { effect: 11, name: 'Lichtspoor' },
  { effect: 299, name: 'Alles door elkaar' },
  { effect: 1, name: 'Alle effecten na elkaar' }
] as const

export const DEFAULT_SPEED = 60

/** Naam voor in de app: de eigen naam, of het nummer met de Engelse naam van de controller. */
export function effectName(effect: number): string {
  const own = LIGHT_EFFECTS.find((e) => e.effect === effect)
  return own ? own.name : `Effect ${effect}`
}

export function effectDescription(effect: number): string {
  return EFFECT_NAMES[effect - 1] ?? ''
}

export function lightLabel(light: Light): string {
  if (light.type === 'off') return 'Uit'
  if (light.type === 'effect') return effectName(light.effect)
  const known = LIGHT_COLORS.find((c) => c.color === light.color.toLowerCase())
  return known?.name ?? light.color.toLowerCase()
}
