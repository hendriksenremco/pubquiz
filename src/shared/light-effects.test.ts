import { describe, expect, it } from 'vitest'
import { placeholders } from './i18n'
import {
  directionName,
  EFFECT_GROUPS,
  EFFECTS,
  effectInfo,
  effectLabel,
  gridLabel,
  gridRows,
  groupName
} from './light-effects'
import { LIGHT_MESSAGES } from './light-messages'
import { stateLight } from './light'

describe('effectgroepen', () => {
  it('delen alle 300 effecten in, elk met een eigen naam', () => {
    expect(EFFECTS).toHaveLength(300)
    expect(EFFECTS.filter((e) => e.group === 'other')).toEqual([])
    expect(new Set(EFFECTS.map((e) => effectLabel(e, 'nl'))).size).toBe(300)
    expect(new Set(EFFECTS.map((e) => effectLabel(e, 'en'))).size).toBe(300)
    expect(EFFECT_GROUPS.flatMap((g) => g.effects)).toHaveLength(300)
    expect(EFFECT_GROUPS.map((g) => groupName(g.id, 'nl'))).toEqual([
      'Basis',
      'Rennend punt',
      'Opvullen',
      'Vervagend punt',
      'Looplicht',
      'Kleuren punt voor punt',
      'Kleuren in blokken',
      'Vervagen in een kleur',
      'Blokken in een kleur',
      'Vloeiend',
      'Lopend',
      'Combinaties'
    ])
  })

  it('vullen elk raster helemaal: één effect per kleur en richting', () => {
    for (const group of EFFECT_GROUPS) {
      if (!group.grid) continue
      const { colors, directions } = group.grid
      expect(colors.length * directions.length).toBe(group.effects.length)
      const rows = gridRows(group)
      expect(rows.map((r) => r.direction)).toEqual(directions)
      for (const row of rows) {
        expect(row.cells.map((e) => e.color)).toEqual(colors)
        expect(row.cells.every((e) => e.direction === row.direction)).toBe(true)
      }
    }
  })

  it('leest kleur en richting uit de namen van de controller', () => {
    expect(effectInfo(39)).toMatchObject({
      group: 'runningDot',
      color: 'red',
      direction: 'outward'
    })
    // In flux_led staat bij 240 "and return back" vooraan.
    expect(effectInfo(240)).toMatchObject({ color: 'blue', direction: 'backAndForth' })
  })
})

describe('namen van effecten', () => {
  it('in het Nederlands en het Engels', () => {
    expect(effectLabel(effectInfo(39)!, 'nl')).toBe('Rennend punt, rood, naar buiten')
    expect(effectLabel(effectInfo(39)!, 'en')).toBe('Running dot, red, outward')
    expect(effectLabel(effectInfo(5)!, 'nl')).toBe('Flitsen in kleur')
    expect(effectLabel(effectInfo(5)!, 'en')).toBe('Colour flash')
    expect(effectLabel(effectInfo(300)!, 'nl')).toBe(
      'Vloeien + looplicht + snel wisselen + flitsen'
    )
    expect(effectLabel(effectInfo(300)!, 'en')).toBe('Flow + chase + quick change + flash')
    expect(effectLabel({ effect: 400, group: 'other' }, 'en')).toBe('Effect 400')

    const running = EFFECT_GROUPS.find((g) => g.id === 'runningDot')!
    expect(gridLabel(running, 'en')).toBe('Background')
    expect(directionName('outAndBack', 'nl')).toBe('Naar buiten en terug')
    expect(groupName('combinations', 'en')).toBe('Combinations')
  })

  it('hebben in elke taal dezelfde waarden als in het Nederlands', () => {
    const { nl, ...others } = LIGHT_MESSAGES.messages
    for (const messages of Object.values(others)) {
      for (const [key, text] of Object.entries(nl)) {
        expect(placeholders(messages[key as keyof typeof nl]), key).toEqual(placeholders(text))
      }
    }
  })
})

describe('stateLight', () => {
  it('maakt van de toestand van de controller een licht', () => {
    const state = { model: 0xa1, on: true, effect: null, speed: 100, color: '#00ff00', firmware: 3 }
    expect(stateLight(state)).toEqual({ type: 'color', color: '#00ff00' })
    expect(stateLight({ ...state, effect: 7, speed: 40 })).toEqual({
      type: 'effect',
      effect: 7,
      speed: 40
    })
    expect(stateLight({ ...state, on: false })).toEqual({ type: 'off' })
  })
})
