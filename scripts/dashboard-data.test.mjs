import { describe, expect, it } from 'vitest'
import {
  datum,
  doorVanActie,
  doorVanPr,
  heeftClaudeTrailer,
  maakTodos,
  onderdeelVan,
  resultaatVanRun,
  wanneer,
  wieVan
} from './dashboard-data.mjs'

describe('tijd in Amsterdam', () => {
  it('schrijft dag, maand en tijd zonder voorloopnul op de dag', () => {
    expect(wanneer('2026-11-01T08:12:00Z')).toBe('1 nov 09:12')
    expect(wanneer('2026-03-29T00:30:00Z')).toBe('29 mrt 01:30')
  })

  it('rekent de zomertijd en de datumgrens mee', () => {
    expect(wanneer('2026-07-01T22:30:00Z')).toBe('2 jul 00:30')
    expect(datum('2026-07-01T22:30:00Z')).toBe('2026-07-02')
  })
})

describe('door', () => {
  const trailer = 'Fix\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'

  it('herkent de trailer van Claude', () => {
    expect(heeftClaudeTrailer(trailer)).toBe(true)
    expect(heeftClaudeTrailer('Fix\n\nCo-Authored-By: Iemand <a@b.nl>')).toBe(false)
    expect(heeftClaudeTrailer(undefined)).toBe(false)
  })

  it('is alleen Remco als hij het zelf deed, zonder Claude', () => {
    expect(doorVanActie('hendriksenremco', false)).toBe('Remco')
    expect(doorVanActie('hendriksenremco', true)).toBe('Claude')
    expect(doorVanActie('github-actions[bot]', false)).toBe('Claude')
  })

  it('is Agent bij een pull request met het label agent', () => {
    const pr = { labels: ['agent'], auteur: 'hendriksenremco', berichten: [trailer] }
    expect(doorVanPr(pr)).toBe('Agent')
    expect(doorVanPr({ ...pr, labels: [] })).toBe('Claude')
    expect(doorVanPr({ ...pr, labels: [], berichten: ['Fix'] })).toBe('Remco')
  })
})

describe('resultaat van een run', () => {
  it('kent gelukt, mislukt en bezig', () => {
    expect(resultaatVanRun({ status: 'completed', conclusion: 'success' })).toBe('gelukt')
    expect(resultaatVanRun({ status: 'completed', conclusion: 'failure' })).toBe('mislukt')
    expect(resultaatVanRun({ status: 'in_progress', conclusion: null })).toBe('bezig')
  })
})

describe('todos', () => {
  it('kiest het onderwerp, anders overig', () => {
    expect(onderdeelVan(['claude', 'site', 'prio-3'])).toBe('site')
    expect(onderdeelVan(['claude'])).toBe('overig')
  })

  it('bepaalt wie het doet', () => {
    expect(wieVan(['claude', 'remco'])).toBe('Samen')
    expect(wieVan(['claude'])).toBe('Claude')
    expect(wieVan(['remco'])).toBe('Remco')
    expect(wieVan(['vraag', 'claude'])).toBe('Remco')
    expect(wieVan([])).toBe('Claude')
  })

  it('laat later en idee weg, en sorteert op prio en dan nummer', () => {
    const issue = (number, ...labels) => ({ number, title: `T${number}`, labels })
    const todos = maakTodos([
      issue(1, 'claude'),
      issue(2, 'claude', 'prio-2'),
      issue(3, 'claude', 'later'),
      issue(4, 'idee'),
      issue(6, 'remco', 'prio-1'),
      issue(5, 'claude', 'prio-1')
    ])
    expect(todos.map((t) => t.taak)).toEqual(['#5 T5', '#6 T6', '#2 T2', '#1 T1'])
    expect(todos[1]).toEqual({ onderdeel: 'overig', wie: 'Remco', taak: '#6 T6' })
  })
})
