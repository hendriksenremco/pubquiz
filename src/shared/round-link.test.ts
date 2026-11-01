import { describe, expect, it } from 'vitest'
import { isAllowedSource, isRoundLink, roundLinkSource } from './round-link'

const link = (url: string) => `quiznote://ronde?url=${encodeURIComponent(url)}`

describe('roundLinkSource', () => {
  it('geeft het adres van een bestand op quiznote.app', () => {
    const url = 'https://quiznote.app/bibliotheek/aardrijkskunde/europa.quiznoteronde'
    expect(roundLinkSource(link(url))).toBe(url)
    expect(roundLinkSource(`quiznote://ronde/?url=${encodeURIComponent(url)}`)).toBe(url)
  })

  it('weigert andere adressen', () => {
    for (const url of [
      'http://quiznote.app/a.quiznoteronde',
      'https://quiznote.app.example.com/a.quiznoteronde',
      'https://evil.example/a.quiznoteronde',
      'https://www.quiznote.app/a.quiznoteronde',
      'https://quiznote.app:8443/a.quiznoteronde',
      'https://user:pw@quiznote.app/a.quiznoteronde',
      'file:///etc/passwd',
      'niet een adres',
      ''
    ]) {
      expect(roundLinkSource(link(url)), url).toBeNull()
    }
  })

  it('weigert andere links', () => {
    const url = encodeURIComponent('https://quiznote.app/a.quiznoteronde')
    expect(roundLinkSource(`quiznote://quiz?url=${url}`)).toBeNull()
    expect(roundLinkSource(`quiznote://ronde/iets?url=${url}`)).toBeNull()
    expect(roundLinkSource(`https://ronde?url=${url}`)).toBeNull()
    expect(roundLinkSource('quiznote://ronde')).toBeNull()
    expect(roundLinkSource('quiznote')).toBeNull()
  })

  it('kan voor tests een andere bron toestaan', () => {
    const url = 'http://127.0.0.1:4321/sport.quiznoteronde'
    expect(roundLinkSource(link(url), 'http://127.0.0.1:4321')).toBe(url)
    expect(roundLinkSource(link(url))).toBeNull()
  })
})

describe('isRoundLink', () => {
  it('herkent het schema, zonder op hoofdletters te letten', () => {
    expect(isRoundLink('quiznote://ronde?url=x')).toBe(true)
    expect(isRoundLink('QuizNote://ronde')).toBe(true)
    expect(isRoundLink('/Users/remco/Sport.quiznoteronde')).toBe(false)
  })
})

describe('isAllowedSource', () => {
  it('kijkt naar de oorsprong', () => {
    expect(isAllowedSource('https://quiznote.app/x')).toBe(true)
    expect(isAllowedSource('https://example.com/x')).toBe(false)
    expect(isAllowedSource('geen adres')).toBe(false)
  })
})
