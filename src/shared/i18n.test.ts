import { describe, expect, it } from 'vitest'
import { defineMessages, format, pickLocale, placeholders } from './i18n'

describe('pickLocale', () => {
  it('kiest de eerste taal die de app kent', () => {
    expect(pickLocale(['de-DE', 'nl-NL', 'en-US'], ['nl', 'en'])).toBe('nl')
    expect(pickLocale(['en-GB', 'nl'], ['nl', 'en'])).toBe('en')
    expect(pickLocale(['nl_BE'], ['nl', 'en'])).toBe('nl')
  })

  it('valt terug op Engels, of op Nederlands als Engels nog niet aan staat', () => {
    expect(pickLocale(['fr-FR'], ['nl', 'en'])).toBe('en')
    expect(pickLocale([], ['nl', 'en'])).toBe('en')
    expect(pickLocale(['en-US', 'fr-FR'], ['nl'])).toBe('nl')
  })

  it('is Nederlands zolang Engels niet af is', () => {
    expect(pickLocale(['en-US'])).toBe('nl')
  })
})

describe('format', () => {
  it('vult waarden in en laat ontbrekende staan', () => {
    expect(format('Ronde {number} van {total}', { number: 2, total: 6 })).toBe('Ronde 2 van 6')
    expect(format('Hierna: {title}', {})).toBe('Hierna: {title}')
    expect(format('Geen waarden')).toBe('Geen waarden')
  })

  it('vindt de namen van de waarden', () => {
    expect(placeholders('Ronde {number} van {total}')).toEqual(['number', 'total'])
  })
})

describe('defineMessages', () => {
  const book = defineMessages(
    { hello: 'Hallo {name}', bye: 'Dag' },
    { en: { hello: 'Hello {name}', bye: 'Bye' } }
  )

  it('geeft de tekst in de gekozen taal', () => {
    expect(book.in('nl')('hello', { name: 'Remco' })).toBe('Hallo Remco')
    expect(book.in('en')('bye')).toBe('Bye')
  })
})
