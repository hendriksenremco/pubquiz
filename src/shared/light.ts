/**
 * Plug-in MagicHome-licht: een kleur of effect op de quiz (standaard), een ronde of een slide.
 * Net als de schermen: slide ⊕ ronde ⊕ standaard. Staat nergens iets, dan blijft het licht zoals het is.
 */
import { z } from 'zod'
import { effectInfo } from './light-effects'
import { EFFECT_MAX, EFFECT_MIN, type MagicHomeState } from './magichome'
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

/** Wat het licht tijdens de show doet; `light` null = de show stuurt het niet aan. */
export interface LightStatus {
  light: Light | null
  /** Met de hand gekozen (afstandsbediening), tot de show zelf een ander licht kiest. */
  manual: boolean
}

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

/** De lichten die de quiz gebruikt, elk één keer: eerst de standaard, dan per ronde en slide. */
export function quizLights(quiz: Quiz): Light[] {
  const all = [lightOf(quiz), ...quiz.rounds.flatMap((r) => [lightOf(r), ...r.slides.map(lightOf)])]
  const seen = new Set<string>()
  return all.filter((light): light is Light => {
    const key = JSON.stringify(light)
    if (!light || seen.has(key)) return false
    seen.add(key)
    return true
  })
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

/** Waar "Effect" mee begint: rustig, alle kleuren. */
export const DEFAULT_EFFECT = 2
export const DEFAULT_SPEED = 60

export function effectName(effect: number): string {
  return effectInfo(effect)?.name ?? `Effect ${effect}`
}

/** Het licht zoals de controller het meldt, om na een voorbeeld naar terug te gaan. */
export function stateLight(state: MagicHomeState): Light {
  if (!state.on) return { type: 'off' }
  if (state.effect !== null) {
    return { type: 'effect', effect: state.effect, speed: Math.min(state.speed, 100) }
  }
  return { type: 'color', color: state.color }
}

export function lightLabel(light: Light): string {
  if (light.type === 'off') return 'Uit'
  if (light.type === 'effect') return effectName(light.effect)
  const known = LIGHT_COLORS.find((c) => c.color === light.color.toLowerCase())
  return known?.name ?? light.color.toLowerCase()
}
