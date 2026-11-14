import { describe, expect, it } from 'vitest'
import { scrollToShow } from './scroll'

describe('scrollToShow', () => {
  const view = { left: 0, width: 500 }

  it('laat de strook staan als het item al helemaal in beeld is', () => {
    expect(scrollToShow(view, { left: 160, width: 150 }, 8)).toBeNull()
  })

  it('schuift naar rechts tot een item rechts buiten beeld helemaal te zien is', () => {
    expect(scrollToShow(view, { left: 474, width: 150 }, 8)).toBe(474 + 150 + 8 - 500)
  })

  it('schuift naar links tot een item links buiten beeld helemaal te zien is', () => {
    expect(scrollToShow({ left: 600, width: 500 }, { left: 474, width: 150 }, 8)).toBe(466)
  })

  it('schuift niet voorbij het begin', () => {
    expect(scrollToShow({ left: 40, width: 500 }, { left: 0, width: 150 }, 8)).toBe(0)
  })
})
