import { describe, expect, it } from 'vitest'
import { createQuiz, createRound, createImageSlide } from './factory'
import { exceptionProperties, parseStack, quizShape, roundKind, scrub } from './analytics'

describe('roundKind', () => {
  it('herkent de presets van createRound', () => {
    const quiz = createQuiz('Test')
    expect(roundKind(createRound('normal', 1))).toBe('break')
    const normal = createRound('normal', 1)
    normal.slides.push({ ...normal.slides[0]!, layout: 'question' })
    expect(roundKind(normal)).toBe('normal')
    const pictures = createRound('pictures', 2)
    pictures.slides.push(createImageSlide())
    expect(roundKind(pictures)).toBe('pictures')
    const music = createRound('music', 3)
    music.fragments.push({ id: 'f', label: '1', assetId: 'a', channelId: 'c' })
    expect(roundKind(music)).toBe('music')
    quiz.rounds = [music]
    expect(roundKind(createRound('answers', 4, quiz))).toBe('answers')
    expect(roundKind(createRound('break', 5))).toBe('break')
  })
})

describe('quizShape', () => {
  it('geeft alleen aantallen, geen namen', () => {
    const quiz = createQuiz('Geheime quiz')
    quiz.rounds = [createRound('break', 1)]
    const shape = quizShape(quiz)
    expect(shape).toMatchObject({ rounds: 1, rounds_break: 1, rounds_music: 0 })
    expect(Object.values(shape).every((v) => typeof v === 'number')).toBe(true)
    expect(JSON.stringify(shape)).not.toContain('Geheime')
  })
})

describe('scrub', () => {
  it('haalt paden, URLs en IP-adressen weg', () => {
    expect(
      scrub(
        "ENOENT: no such file or directory, open '/Users/remco/Documents/Pubquizzen/Mijn quiz.pubquiz/quiz.json'"
      )
    ).toBe("ENOENT: no such file or directory, open '<pad>'")
    expect(scrub('Kan /Users/remco/x.mp4 niet lezen')).toBe('Kan <pad> niet lezen')
    expect(scrub('Laden van pq-media://quiz/media/geheim.mp4 mislukt')).toBe(
      'Laden van <url> mislukt'
    )
    expect(scrub('connect ETIMEDOUT 192.168.14.133:5577')).toBe('connect ETIMEDOUT <ip>:5577')
    expect(scrub('x is not a function')).toBe('x is not a function')
  })
})

describe('parseStack', () => {
  it('houdt alleen de bestandsnaam over, oudste aanroep eerst', () => {
    const frames = parseStack(
      [
        'TypeError: x is not a function',
        '    at Foo.bar (/Applications/QuizNote.app/Contents/Resources/app.asar/out/main/index.js:12:34)',
        '    at file:///Users/remco/app/out/renderer/assets/index-abc.js?x=1:5:6',
        '    at node:internal/process/task_queues:95:5'
      ].join('\n'),
      'node:javascript'
    )
    expect(frames.map((f) => f.filename)).toEqual(['task_queues', 'index-abc.js', 'index.js'])
    expect(frames[2]).toMatchObject({ function: 'Foo.bar', lineno: 12, colno: 34, in_app: true })
    expect(frames[0]!.in_app).toBe(false)
    expect(JSON.stringify(frames)).not.toContain('remco')
  })
})

describe('exceptionProperties', () => {
  it('maakt een $exception_list zonder paden', () => {
    const props = exceptionProperties(
      {
        name: 'Error',
        message: "open '/Users/remco/quiz.json'",
        stack: 'Error\n    at a (/Users/remco/b.js:1:2)'
      },
      'main'
    )
    const text = JSON.stringify(props)
    expect(text).not.toContain('remco')
    expect(props['source']).toBe('main')
    expect((props['$exception_list'] as { type: string }[])[0]!.type).toBe('Error')
  })
})
