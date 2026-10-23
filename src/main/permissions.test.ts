import { describe, expect, it } from 'vitest'
import { isOwnOrigin } from './permissions'

describe('isOwnOrigin', () => {
  it('accepteert de gebouwde app (file://)', () => {
    expect(isOwnOrigin('file:///')).toBe(true)
  })

  it('accepteert de dev-server, ook met afsluitende slash', () => {
    const dev = 'http://localhost:5173'
    expect(isOwnOrigin('http://localhost:5173/', dev)).toBe(true)
    expect(isOwnOrigin('http://localhost:5173', `${dev}/`)).toBe(true)
  })

  it('weigert andere origins', () => {
    expect(isOwnOrigin('http://localhost:5174/', 'http://localhost:5173')).toBe(false)
    expect(isOwnOrigin('https://www.youtube.com/', 'http://localhost:5173')).toBe(false)
    expect(isOwnOrigin('http://localhost:5173/')).toBe(false)
    expect(isOwnOrigin('', 'http://localhost:5173')).toBe(false)
  })
})
