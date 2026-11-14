import { describe, expect, it } from 'vitest'
import { channelUses } from './channels'
import { createChannel, createQuiz, createRound } from './factory'

describe('geluidskanalen verwijderen', () => {
  it('een nieuw kanaal is niet in gebruik', () => {
    const quiz = createQuiz('Test')
    const extra = createChannel('Extra')
    quiz.channels.push(extra)
    expect(channelUses(quiz, extra.id)).toBe(0)
  })

  it('telt de achtergrondmuziek en de fragmenten in alle rondes', () => {
    const quiz = createQuiz('Test')
    const channel = quiz.channels[0].id
    quiz.background = { assetId: 'muziek', channelId: channel, volume: 0.7, duckTo: 0.25 }
    for (const n of [1, 2]) {
      const round = createRound('normal', n, quiz)
      round.fragments.push({ id: `f${n}`, label: `${n}`, assetId: 'a', channelId: channel })
      quiz.rounds.push(round)
    }
    expect(channelUses(quiz, channel)).toBe(3)
    expect(channelUses(quiz, quiz.channels[1].id)).toBe(0)
  })
})
