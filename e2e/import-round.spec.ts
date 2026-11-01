import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { writeZip } from '../src/main/zip'
import { copyFixture, launch, tempDir } from './helpers'

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string
let files: string

/** 60 × 80 pixels, oranje. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAADwAAABQCAIAAADKqIEEAAAAVklEQVR42u3OAQkAAAgDsBczrjm1hSAMFmCZrnciLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfWkBWVI8zkmlRqcAAAAASUVORK5CYII='

test.beforeAll(async () => {
  userData = tempDir('userdata')
  files = tempDir('rondes')
  quizDir = copyFixture()
  ;({ app, operator } = await launch(userData, quizDir))
})

test.afterAll(async () => {
  await app?.close()
  for (const dir of [userData, files]) rmSync(dir, { recursive: true, force: true })
  rmSync(dirname(quizDir), { recursive: true, force: true })
})

const savedQuiz = () => JSON.parse(readFileSync(join(quizDir, 'quiz.json'), 'utf8'))

/** Laat de open-dialoog van macOS dit bestand kiezen. */
async function chooseFile(path: string) {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [file] })) as never
  }, path)
}

test('importeert een rondebestand na de gekozen ronde', async () => {
  const path = join(files, 'Aardrijkskunde.quiznoteronde')
  writeFileSync(
    path,
    writeZip([
      {
        name: 'ronde.json',
        data: JSON.stringify({
          formatVersion: 1,
          type: 'questions',
          title: 'Aardrijkskunde',
          questions: [
            { question: 'Welke kleur heeft dit vlak?', answer: 'Oranje', image: 'media/vlak.png' },
            { question: 'Hoofdstad van Italië?', answer: 'Rome' }
          ]
        })
      },
      { name: 'media/vlak.png', data: Buffer.from(PNG, 'base64') }
    ])
  )
  const before = savedQuiz()
  await operator.locator('.sidebar .round').first().click()
  await chooseFile(path)
  await operator.getByRole('button', { name: 'Importeren…' }).click()

  await expect(
    operator.locator('.notice', { hasText: 'Ronde “Aardrijkskunde” geïmporteerd' })
  ).toBeVisible()
  const titles = await operator.locator('.sidebar .round-title').allTextContents()
  expect(titles[1]).toBe('Aardrijkskunde')
  await expect(operator.locator('.sidebar .round.on .round-title')).toHaveText('Aardrijkskunde')
  await operator.screenshot({ path: 'test-results/import-round.png' })

  await expect
    .poll(() => savedQuiz().rounds.map((r: { title: string }) => r.title))
    .toEqual([
      before.rounds[0].title,
      'Aardrijkskunde',
      ...before.rounds.slice(1).map((r: { title: string }) => r.title)
    ])
  const quiz = savedQuiz()
  const round = quiz.rounds[1]
  expect(round.slides.map((s: { layout: string }) => s.layout)).toEqual([
    'title',
    'question',
    'question'
  ])
  const image = quiz.assets.find((a: { name: string }) => a.name === 'vlak.png')
  expect(image).toBeTruthy()
  expect(round.slides[1].imageAssetId).toBe(image.id)
  expect(quiz.folders.find((f: { id: string }) => f.id === image.folderId)?.name).toBe(
    'Aardrijkskunde'
  )
  expect(readFileSync(join(quizDir, image.file)).length).toBeGreaterThan(0)
})

test('meldt een fout rondebestand en verandert niets', async () => {
  const path = join(files, 'kapot.quiznoteronde')
  writeFileSync(path, 'geen zip')
  const rounds = savedQuiz().rounds.length
  await chooseFile(path)
  await operator.getByRole('button', { name: 'Importeren…' }).click()
  await expect(
    operator.locator('.notice', { hasText: 'Dit is geen rondebestand van QuizNote' })
  ).toBeVisible()
  expect(savedQuiz().rounds).toHaveLength(rounds)
})
