/**
 * De 300 ingebouwde effecten van de A1, in groepen. De meeste groepen zijn één beweging met een
 * achtergrondkleur (of een eigen kleur) en een richting; die toont de app als raster. De
 * indeling volgt uit de Engelse namen van `flux_led` (magichome-effects.ts).
 */
import type { Locale } from './i18n'
import { LIGHT_MESSAGES, type LightMessage } from './light-messages'
import { EFFECT_NAMES } from './magichome-effects'

export interface EffectInfo {
  effect: number
  group: EffectGroupId
  /** Kleur en richting, voor effecten in een raster. */
  color?: EffectColor
  direction?: EffectDirection
  /** Delen van een combinatie, bv. vloeien + flitsen. */
  parts?: CombinationPart[]
}

export interface EffectGroup {
  id: EffectGroupId
  effects: EffectInfo[]
  /** Kolommen (kleuren) en rijen (richtingen), in de volgorde van de controller; null = een lijst. */
  grid: { colorLabel: GridLabel; colors: EffectColor[]; directions: EffectDirection[] } | null
}

export type EffectGroupId =
  | 'basics'
  | 'runningDot'
  | 'fill'
  | 'fadingDot'
  | 'chase'
  | 'dotByDot'
  | 'colorBlocks'
  | 'fadeInColor'
  | 'blocksInColor'
  | 'flowing'
  | 'running'
  | 'combinations'
  | 'other'

type GridLabel = 'background' | 'color'

/** De kleuren in de effecten; de naam staat in LIGHT_MESSAGES (`color.<sleutel>`). */
export const EFFECT_COLORS = {
  black: { swatch: '#000000' },
  red: { swatch: '#ff0000' },
  green: { swatch: '#00c000' },
  blue: { swatch: '#0040ff' },
  yellow: { swatch: '#ffd000' },
  purple: { swatch: '#9000ff' },
  cyan: { swatch: '#00e0e0' },
  white: { swatch: '#ffffff' }
} as const

export type EffectColor = keyof typeof EFFECT_COLORS

export type EffectDirection =
  'backAndForth' | 'forward' | 'backward' | 'outAndBack' | 'outward' | 'inward'

const DIRECTIONS: [RegExp, EffectDirection][] = [
  [/^from start to end and return back$/, 'backAndForth'],
  [/^from start to end$/, 'forward'],
  [/^from end to start$/, 'backward'],
  [/^from middle to both (ends|sides) and return back$/, 'outAndBack'],
  [/^from middle to both ends$/, 'outward'],
  [/^from both ends to middle$/, 'inward']
]

/** Bewegingen met een kleur en een richting: `(\w+)` is de kleur, `(.+)` de richting. */
const FAMILIES: { id: EffectGroupId; colorLabel: GridLabel; pattern: RegExp }[] = [
  {
    id: 'runningDot',
    colorLabel: 'background',
    pattern: /^Run circularly, 7 colors with (\w+) background, 1point (.+)$/
  },
  {
    id: 'fill',
    colorLabel: 'background',
    pattern: /^Overlay circularly, 7 colors with (\w+) background (.+)$/
  },
  {
    id: 'fadingDot',
    colorLabel: 'background',
    pattern: /^Fading out run circularly, 1point with (\w+) background (.+)$/
  },
  {
    id: 'chase',
    colorLabel: 'background',
    pattern: /^Flows in olivary circularly, 7 colors with (\w+) background (.+)$/
  },
  {
    id: 'dotByDot',
    colorLabel: 'background',
    pattern: /^7 colors run circularly, each color in every 1 point with (\w+) background (.+)$/
  },
  {
    id: 'colorBlocks',
    colorLabel: 'background',
    pattern: /^7 colors run circularly, each color in multi points with (\w+) background (.+)$/
  },
  {
    id: 'fadeInColor',
    colorLabel: 'color',
    pattern: /^Fading out run circularly, 7 colors each in (\w+) fading (.+)$/
  },
  {
    id: 'blocksInColor',
    colorLabel: 'color',
    pattern: /^7 colors each in (\w+) run circularly, multi points (.+)$/
  },
  {
    id: 'flowing',
    colorLabel: 'background',
    pattern: /^Flows gradually and circularly, 6 colors with (\w+) background (.+)$/
  },
  {
    id: 'running',
    colorLabel: 'background',
    pattern: /^7 colors run with (\w+) background (.+)$/
  }
]

/** De eerste dertien: alle zeven kleuren, zonder achtergrond (`basic.<nummer>`). */
const BASICS = 13

type CombinationPart = 'flow' | 'chase' | 'quickChange' | 'flash'

/** De laatste: een paar effecten na elkaar, bv. "7 colors run gradually + 7 colors flash". */
const COMBINATION_PARTS: [RegExp, CombinationPart][] = [
  [/^7 colors? run gradually$/, 'flow'],
  [/^7 colors? run in olivary$/, 'chase'],
  [/^7 colors? change quickly$/, 'quickChange'],
  [/^7 colors? flash$/, 'flash']
]

function combinationParts(english: string): CombinationPart[] | null {
  const parts = english.split(' + ').map((part) => {
    const found = COMBINATION_PARTS.find(([pattern]) => pattern.test(part))
    return found?.[1] ?? null
  })
  if (parts.length < 2 || parts.includes(null)) return null
  return parts as CombinationPart[]
}

function classify(effect: number, english: string): EffectInfo {
  if (effect <= BASICS) return { effect, group: 'basics' }
  // In `flux_led` staat bij effect 240 "and return back" vooraan.
  const text = english.replace(/^and return back(.+)$/, '$1 and return back')
  for (const family of FAMILIES) {
    const match = family.pattern.exec(text)
    const direction = match && DIRECTIONS.find(([pattern]) => pattern.test(match[2]))?.[1]
    if (!match || !direction || !(match[1] in EFFECT_COLORS)) continue
    return { effect, group: family.id, color: match[1] as EffectColor, direction }
  }
  const parts = combinationParts(text)
  if (parts) return { effect, group: 'combinations', parts }
  return { effect, group: 'other' }
}

export const EFFECTS: EffectInfo[] = EFFECT_NAMES.map((english, i) => classify(i + 1, english))

const unique = <T>(list: T[]) => [...new Set(list)]

export const EFFECT_GROUPS: EffectGroup[] = unique(EFFECTS.map((e) => e.group)).map((id) => {
  const effects = EFFECTS.filter((e) => e.group === id)
  const family = FAMILIES.find((f) => f.id === id)
  return {
    id,
    effects,
    grid: family
      ? {
          colorLabel: family.colorLabel,
          colors: unique(effects.map((e) => e.color!)),
          directions: unique(effects.map((e) => e.direction!))
        }
      : null
  }
})

export function effectInfo(effect: number): EffectInfo | undefined {
  return EFFECTS[effect - 1]
}

/** Een raster per richting: de effecten in de volgorde van de kleuren. */
export function gridRows(
  group: EffectGroup
): { direction: EffectDirection; cells: EffectInfo[] }[] {
  const grid = group.grid
  if (!grid) return []
  return grid.directions.map((direction) => ({
    direction,
    cells: grid.colors.flatMap((color) =>
      group.effects.filter((e) => e.color === color && e.direction === direction)
    )
  }))
}

// ── Namen, in de taal van het venster ────────────────────────────────────────

export const groupName = (id: EffectGroupId, locale: Locale): string =>
  LIGHT_MESSAGES.in(locale)(`group.${id}`)

export const directionName = (direction: EffectDirection, locale: Locale): string =>
  LIGHT_MESSAGES.in(locale)(`direction.${direction}`)

export const gridLabel = (group: EffectGroup, locale: Locale): string =>
  group.grid ? LIGHT_MESSAGES.in(locale)(`gridLabel.${group.grid.colorLabel}`) : ''

/** Naam in de app, bv. "Rennend punt, rood, naar buiten" of "Vloeien + flitsen". */
export function effectLabel(info: EffectInfo, locale: Locale): string {
  const t = LIGHT_MESSAGES.in(locale)
  if (info.group === 'basics') return t(`basic.${info.effect}` as LightMessage)
  if (info.color && info.direction) {
    return t('effectInGrid', {
      group: groupName(info.group, locale),
      color: t(`color.${info.color}`).toLowerCase(),
      direction: directionName(info.direction, locale).toLowerCase()
    })
  }
  if (info.parts) {
    const name = info.parts.map((part) => t(`part.${part}`)).join(' + ')
    return name[0].toUpperCase() + name.slice(1)
  }
  return t('effectNumber', { number: info.effect })
}
