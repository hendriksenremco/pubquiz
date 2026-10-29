import { describe, expect, it } from 'vitest'
import { EFFECT_GROUPS, EFFECTS, effectInfo, gridRows } from './light-effects'
import { stateLight } from './light'

describe('effectgroepen', () => {
  it('delen alle 300 effecten in, elk met een eigen naam', () => {
    expect(EFFECTS).toHaveLength(300)
    expect(EFFECTS.filter((e) => e.group === 'Overig')).toEqual([])
    expect(new Set(EFFECTS.map((e) => e.name)).size).toBe(300)
    expect(EFFECT_GROUPS.flatMap((g) => g.effects)).toHaveLength(300)
    expect(EFFECT_GROUPS.map((g) => g.name)).toEqual([
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
      group: 'Rennend punt',
      color: 'red',
      direction: 'Naar buiten'
    })
    // In flux_led staat bij 240 "and return back" vooraan.
    expect(effectInfo(240)).toMatchObject({ color: 'blue', direction: 'Heen en weer' })
    expect(effectInfo(5)?.name).toBe('Flitsen in kleur')
    expect(effectInfo(300)?.name).toBe('Vloeien + looplicht + snel wisselen + flitsen')
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
