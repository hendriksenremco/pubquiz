/**
 * De 300 ingebouwde effecten van de A1, in groepen. De meeste groepen zijn één beweging met een
 * achtergrondkleur (of een eigen kleur) en een richting; die toont de app als raster. De
 * indeling volgt uit de Engelse namen van `flux_led` (magichome-effects.ts).
 */
import { EFFECT_NAMES } from './magichome-effects'

export interface EffectInfo {
  effect: number
  group: string
  /** Naam in de app, bv. "Rennend punt, rood, naar buiten". */
  name: string
  /** Kleur en richting, voor effecten in een raster. */
  color?: EffectColor
  direction?: string
}

export interface EffectGroup {
  name: string
  effects: EffectInfo[]
  /** Kolommen (kleuren) en rijen (richtingen), in de volgorde van de controller; null = een lijst. */
  grid: { colorLabel: string; colors: EffectColor[]; directions: string[] } | null
}

export const EFFECT_COLORS = {
  black: { name: 'Zwart', swatch: '#000000' },
  red: { name: 'Rood', swatch: '#ff0000' },
  green: { name: 'Groen', swatch: '#00c000' },
  blue: { name: 'Blauw', swatch: '#0040ff' },
  yellow: { name: 'Geel', swatch: '#ffd000' },
  purple: { name: 'Paars', swatch: '#9000ff' },
  cyan: { name: 'Cyaan', swatch: '#00e0e0' },
  white: { name: 'Wit', swatch: '#ffffff' }
} as const

export type EffectColor = keyof typeof EFFECT_COLORS

const DIRECTIONS: [RegExp, string][] = [
  [/^from start to end and return back$/, 'Heen en weer'],
  [/^from start to end$/, 'Vooruit'],
  [/^from end to start$/, 'Achteruit'],
  [/^from middle to both (ends|sides) and return back$/, 'Naar buiten en terug'],
  [/^from middle to both ends$/, 'Naar buiten'],
  [/^from both ends to middle$/, 'Naar binnen']
]

/** Bewegingen met een kleur en een richting: `(\w+)` is de kleur, `(.+)` de richting. */
const FAMILIES: { name: string; colorLabel: string; pattern: RegExp }[] = [
  {
    name: 'Rennend punt',
    colorLabel: 'Achtergrond',
    pattern: /^Run circularly, 7 colors with (\w+) background, 1point (.+)$/
  },
  {
    name: 'Opvullen',
    colorLabel: 'Achtergrond',
    pattern: /^Overlay circularly, 7 colors with (\w+) background (.+)$/
  },
  {
    name: 'Vervagend punt',
    colorLabel: 'Achtergrond',
    pattern: /^Fading out run circularly, 1point with (\w+) background (.+)$/
  },
  {
    name: 'Looplicht',
    colorLabel: 'Achtergrond',
    pattern: /^Flows in olivary circularly, 7 colors with (\w+) background (.+)$/
  },
  {
    name: 'Kleuren punt voor punt',
    colorLabel: 'Achtergrond',
    pattern: /^7 colors run circularly, each color in every 1 point with (\w+) background (.+)$/
  },
  {
    name: 'Kleuren in blokken',
    colorLabel: 'Achtergrond',
    pattern: /^7 colors run circularly, each color in multi points with (\w+) background (.+)$/
  },
  {
    name: 'Vervagen in een kleur',
    colorLabel: 'Kleur',
    pattern: /^Fading out run circularly, 7 colors each in (\w+) fading (.+)$/
  },
  {
    name: 'Blokken in een kleur',
    colorLabel: 'Kleur',
    pattern: /^7 colors each in (\w+) run circularly, multi points (.+)$/
  },
  {
    name: 'Vloeiend',
    colorLabel: 'Achtergrond',
    pattern: /^Flows gradually and circularly, 6 colors with (\w+) background (.+)$/
  },
  {
    name: 'Lopend',
    colorLabel: 'Achtergrond',
    pattern: /^7 colors run with (\w+) background (.+)$/
  }
]

/** De eerste dertien: alle zeven kleuren, zonder achtergrond. */
const BASICS = [
  'Alle effecten na elkaar',
  'Kleuren lopen in elkaar over',
  'Looplicht in kleur',
  'Kleuren wisselen snel',
  'Flitsen in kleur',
  'Eén punt heen en weer',
  'Meerdere punten heen en weer',
  'Opvullen heen en weer',
  'Opvullen vanuit het midden',
  'Regenboog heen en weer',
  'Lichtspoor heen en weer',
  'Looplicht heen en weer',
  'Lichtspoor vanuit wit'
]

/** De laatste: een paar effecten na elkaar, bv. "7 colors run gradually + 7 colors flash". */
const COMBINATION_PARTS: [RegExp, string][] = [
  [/^7 colors? run gradually$/, 'vloeien'],
  [/^7 colors? run in olivary$/, 'looplicht'],
  [/^7 colors? change quickly$/, 'snel wisselen'],
  [/^7 colors? flash$/, 'flitsen']
]

function combinationName(english: string): string | null {
  const parts = english.split(' + ').map((part) => {
    const found = COMBINATION_PARTS.find(([pattern]) => pattern.test(part))
    return found?.[1] ?? null
  })
  if (parts.length < 2 || parts.includes(null)) return null
  const name = parts.join(' + ')
  return name[0].toUpperCase() + name.slice(1)
}

function classify(effect: number, english: string): EffectInfo {
  if (effect <= BASICS.length) return { effect, group: 'Basis', name: BASICS[effect - 1] }
  // In `flux_led` staat bij effect 240 "and return back" vooraan.
  const text = english.replace(/^and return back(.+)$/, '$1 and return back')
  for (const family of FAMILIES) {
    const match = family.pattern.exec(text)
    const direction = match && DIRECTIONS.find(([pattern]) => pattern.test(match[2]))?.[1]
    if (!match || !direction || !(match[1] in EFFECT_COLORS)) continue
    const color = match[1] as EffectColor
    return {
      effect,
      group: family.name,
      name: `${family.name}, ${EFFECT_COLORS[color].name.toLowerCase()}, ${direction.toLowerCase()}`,
      color,
      direction
    }
  }
  const combination = combinationName(text)
  if (combination) return { effect, group: 'Combinaties', name: combination }
  return { effect, group: 'Overig', name: `Effect ${effect}` }
}

export const EFFECTS: EffectInfo[] = EFFECT_NAMES.map((english, i) => classify(i + 1, english))

const unique = <T>(list: T[]) => [...new Set(list)]

export const EFFECT_GROUPS: EffectGroup[] = unique(EFFECTS.map((e) => e.group)).map((name) => {
  const effects = EFFECTS.filter((e) => e.group === name)
  const family = FAMILIES.find((f) => f.name === name)
  return {
    name,
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
export function gridRows(group: EffectGroup): { direction: string; cells: EffectInfo[] }[] {
  const grid = group.grid
  if (!grid) return []
  return grid.directions.map((direction) => ({
    direction,
    cells: grid.colors.flatMap((color) =>
      group.effects.filter((e) => e.color === color && e.direction === direction)
    )
  }))
}
