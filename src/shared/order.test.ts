import { describe, expect, it } from 'vitest'
import { createRound, createSlide } from './factory'
import { moveById, renumberSlides } from './order'

const list = (...ids: string[]) => ids.map((id) => ({ id }))
const ids = (items: { id: string }[]) => items.map((item) => item.id)

describe('moveById', () => {
  it('zet een item naar beneden, vóór of na het doel', () => {
    const before = list('a', 'b', 'c', 'd')
    moveById(before, 'a', 'c', false)
    expect(ids(before)).toEqual(['b', 'a', 'c', 'd'])

    const after = list('a', 'b', 'c', 'd')
    moveById(after, 'a', 'c', true)
    expect(ids(after)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('zet een item naar boven, vóór of na het doel', () => {
    const before = list('a', 'b', 'c', 'd')
    moveById(before, 'd', 'b', false)
    expect(ids(before)).toEqual(['a', 'd', 'b', 'c'])

    const after = list('a', 'b', 'c', 'd')
    moveById(after, 'd', 'b', true)
    expect(ids(after)).toEqual(['a', 'b', 'd', 'c'])
  })

  it('zet een item helemaal voorop of achteraan', () => {
    const first = list('a', 'b', 'c')
    moveById(first, 'c', 'a', false)
    expect(ids(first)).toEqual(['c', 'a', 'b'])

    const last = list('a', 'b', 'c')
    moveById(last, 'a', 'c', true)
    expect(ids(last)).toEqual(['b', 'c', 'a'])
  })

  it('laat de lijst staan bij hetzelfde item of een onbekend id', () => {
    const items = list('a', 'b', 'c')
    moveById(items, 'b', 'b', true)
    moveById(items, 'x', 'b', false)
    moveById(items, 'a', 'x', false)
    expect(ids(items)).toEqual(['a', 'b', 'c'])
  })
})

describe('renumberSlides', () => {
  it('nummert standaardtitels naar hun plek en laat eigen titels staan', () => {
    const round = createRound('normal', 1)
    round.slides = [
      createSlide('title', 'Ronde 1'),
      createSlide('question', 'Vraag 3'),
      createSlide('number', '1'),
      createSlide('question', 'Wie ben ik?'),
      createSlide('question', 'Vraag 2')
    ]
    renumberSlides(round)
    expect(round.slides.map((s) => s.title)).toEqual([
      'Ronde 1',
      'Vraag 1',
      '2',
      'Wie ben ik?',
      'Vraag 4'
    ])
  })

  it('houdt een standaardtitel in zijn eigen taal', () => {
    const round = createRound('normal', 1)
    round.slides = [
      createSlide('question', 'Question 2'),
      createSlide('question', 'Vraag 1'),
      createSlide('question', 'Question'),
      createSlide('question', 'Question 2b')
    ]
    renumberSlides(round)
    expect(round.slides.map((s) => s.title)).toEqual([
      'Question 1',
      'Vraag 2',
      'Question',
      'Question 2b'
    ])
  })
})
