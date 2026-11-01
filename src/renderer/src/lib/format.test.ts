import { describe, expect, it } from 'vitest'
import { placeholders } from '@shared/i18n'
import { DATE_MESSAGES, formatTime, parseTime, relativeDate } from './format'

describe('formatTime', () => {
  it('formatteert minuten en seconden', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(75.5)).toBe('1:15')
    expect(formatTime(75.5, 1)).toBe('1:15.5')
    expect(formatTime(5.25, 1)).toBe('0:05.3')
    expect(formatTime(undefined)).toBe('–')
  })
})

describe('parseTime', () => {
  it('leest seconden en m:ss', () => {
    expect(parseTime('')).toBeUndefined()
    expect(parseTime('12')).toBe(12)
    expect(parseTime('1:15.5')).toBe(75.5)
    expect(parseTime('0,5')).toBe(0.5)
    expect(parseTime('a')).toBeUndefined()
    expect(parseTime('1:2:3')).toBeUndefined()
  })
})

describe('relativeDate', () => {
  const now = new Date(2026, 9, 23, 20, 0).getTime()
  const at = (d: number, h: number, m = 0, year = 2026, month = 9) =>
    new Date(year, month, d, h, m).getTime()

  it('beschrijft recente momenten in gewone taal', () => {
    expect(relativeDate(now - 20_000, now)).toBe('zojuist')
    expect(relativeDate(now - 60_000, now)).toBe('1 minuut geleden')
    expect(relativeDate(now - 45 * 60_000, now)).toBe('45 minuten geleden')
    expect(relativeDate(at(23, 14, 5), now)).toBe('vandaag om 14:05')
    expect(relativeDate(at(22, 9, 30), now)).toBe('gisteren om 09:30')
    expect(relativeDate(at(19, 12), now)).toBe('4 dagen geleden')
    expect(relativeDate(at(12, 12), now)).toBe('12 okt')
    expect(relativeDate(at(3, 12, 0, 2025, 2), now)).toBe('3 mrt 2025')
  })

  it('kent ook Engels', () => {
    expect(relativeDate(now - 20_000, now, 'en')).toBe('just now')
    expect(relativeDate(now - 60_000, now, 'en')).toBe('1 minute ago')
    expect(relativeDate(at(22, 9, 30), now, 'en')).toBe('yesterday at 09:30')
    expect(relativeDate(at(12, 12), now, 'en')).toBe('Oct 12')
    expect(relativeDate(at(3, 12, 0, 2025, 2), now, 'en')).toBe('Mar 3, 2025')
  })

  it('heeft in elke taal dezelfde waarden en twaalf maanden', () => {
    const { nl, ...others } = DATE_MESSAGES.messages
    for (const messages of [nl, ...Object.values(others)]) {
      expect(messages.months.split(' ')).toHaveLength(12)
      for (const [key, text] of Object.entries(nl)) {
        expect(placeholders(messages[key as keyof typeof nl]), key).toEqual(placeholders(text))
      }
    }
  })
})
