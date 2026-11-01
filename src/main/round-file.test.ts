import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { addRounds } from '@shared/round-file'
import { NoticeError, type NoticeKey } from './messages'
import { createQuizDir } from './quiz-files'
import { readRoundFile } from './round-file'
import { writeZip } from './zip'

const dirs: string[] = []
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pubquiz-ronde-'))
  dirs.push(dir)
  return dir
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

const round = {
  formatVersion: 1,
  type: 'questions',
  title: 'Aardrijkskunde',
  questions: [
    { question: 'Welke stad?', answer: 'Rome', image: 'media/rome.jpg' },
    { question: 'Welke stad nog eens?', answer: 'Rome', answerImage: 'media/rome.jpg' }
  ]
}

function roundFile(files: { name: string; data: Buffer | string }[]): string {
  const path = join(temp(), 'Aardrijkskunde.quiznoteronde')
  writeFileSync(path, writeZip(files))
  return path
}

async function failure(promise: Promise<unknown>): Promise<NoticeKey | undefined> {
  try {
    await promise
  } catch (err) {
    if (err instanceof NoticeError) return err.key
    throw err
  }
  return undefined
}

describe('readRoundFile', () => {
  it('leest de rondes en kopieert elk bestand één keer naar de quiz', async () => {
    const { dir, quiz } = await createQuizDir(join(temp(), 'Vrijdag'))
    const path = roundFile([
      { name: 'ronde.json', data: JSON.stringify(round) },
      { name: 'media/rome.jpg', data: 'jpg' },
      { name: 'media/ongebruikt.jpg', data: 'niet nodig' }
    ])
    const result = await readRoundFile(path, dir, quiz, 0, 'nl')

    expect(result.file).toBe('Aardrijkskunde.quiznoteronde')
    expect(result.drafts[0].title).toBe('Aardrijkskunde')
    expect(Object.keys(result.assets)).toEqual(['media/rome.jpg'])
    expect(result.assets['media/rome.jpg']).toMatchObject({ kind: 'image', name: 'rome.jpg' })
    expect(readdirSync(join(dir, 'media'))).toHaveLength(1)

    const [added] = addRounds(quiz, result.drafts, result.assets, 0, 'nl')
    expect(added.slides.map((s) => s.layout)).toEqual(['title', 'question', 'question'])
  })

  it('geeft een duidelijke fout bij een fout bestand, en kopieert dan niets', async () => {
    const { dir, quiz } = await createQuizDir(join(temp(), 'Vrijdag'))
    const json = { name: 'ronde.json', data: JSON.stringify(round) }
    const jpg = { name: 'media/rome.jpg', data: 'jpg' }
    const cases: [string, NoticeKey][] = [
      [roundFile([jpg]), 'notRoundFile'],
      [roundFile([{ name: 'ronde.json', data: '{' }]), 'notRoundFile'],
      [roundFile([json]), 'missingRoundMedia'],
      [roundFile([json, jpg, { name: '../../etc/passwd', data: 'x' }]), 'unsafeRoundPath'],
      [roundFile([json, jpg, { name: '/tmp/x', data: 'x' }]), 'unsafeRoundPath'],
      [
        roundFile([
          {
            name: 'ronde.json',
            data: JSON.stringify({
              ...round,
              questions: [{ question: 'V', answer: 'A', image: 'media/a.mp3' }]
            })
          },
          { name: 'media/a.mp3', data: 'mp3' }
        ]),
        'notAPicture'
      ],
      [
        roundFile([
          {
            name: 'ronde.json',
            data: JSON.stringify({ formatVersion: 1, type: 'answers', rounds: ['Bestaat niet'] })
          }
        ]),
        'invalidRoundFile'
      ],
      [join(temp(), 'bestaat-niet.quiznoteronde'), 'notRoundFile']
    ]
    for (const [path, key] of cases) {
      expect(await failure(readRoundFile(path, dir, quiz, 0, 'nl')), key).toBe(key)
    }
    const notZip = join(temp(), 'tekst.quiznoteronde')
    writeFileSync(notZip, 'geen zip')
    expect(await failure(readRoundFile(notZip, dir, quiz, 0, 'nl'))).toBe('notRoundFile')
    expect(readdirSync(join(dir, 'media'))).toEqual([])
  })
})
