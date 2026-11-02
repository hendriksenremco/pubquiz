import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'fs'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { dirname, join } from 'path'
import { writeZip } from '../src/main/zip'
import { copyFixture, launch, tempDir } from './helpers'

let app: ElectronApplication
let operator: Page
let userData: string
let quizDir: string
let files: string
/** Speelt quiznote.app na voor de link `quiznote://ronde?url=…`. */
let site: Server
let siteOrigin: string

/** 60 × 80 pixels, oranje. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAADwAAABQCAIAAADKqIEEAAAAVklEQVR42u3OAQkAAAgDsBczrjm1hSAMFmCZrnciLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfWkBWVI8zkmlRqcAAAAASUVORK5CYII='

test.beforeAll(async () => {
  userData = tempDir('userdata')
  files = tempDir('rondes')
  quizDir = copyFixture()
  site = createServer((req, res) => {
    const name = decodeURIComponent((req.url ?? '').slice(1))
    try {
      res.end(readFileSync(join(files, name)))
    } catch {
      res.statusCode = 404
      res.end()
    }
  })
  await new Promise<void>((done) => site.listen(0, '127.0.0.1', done))
  siteOrigin = `http://127.0.0.1:${(site.address() as AddressInfo).port}`
  ;({ app, operator } = await launch(userData, quizDir, {
    PUBQUIZ_ROUND_LINK_ORIGIN: siteOrigin
  }))
})

test.afterAll(async () => {
  await app?.close()
  site?.close()
  for (const dir of [userData, files]) rmSync(dir, { recursive: true, force: true })
  rmSync(dirname(quizDir), { recursive: true, force: true })
})

/** Een rondebestand met één ronde zonder media. */
function roundFile(name: string, title: string): string {
  const path = join(files, `${name}.quiznoteronde`)
  writeFileSync(
    path,
    writeZip([
      {
        name: 'ronde.json',
        data: JSON.stringify({
          formatVersion: 1,
          type: 'questions',
          title,
          questions: [{ question: 'Hoeveel spelers heeft een voetbalteam?', answer: '11' }]
        })
      }
    ])
  )
  return path
}

/** Zoals dubbelklikken in Finder: macOS geeft de app een `open-file`. */
async function openInFinder(path: string) {
  await app.evaluate(({ app }, file) => {
    app.emit('open-file', { preventDefault() {} }, file)
  }, path)
}

/** Zoals een klik op "Openen in QuizNote" op de site: macOS geeft de app een `open-url`. */
async function openLink(url: string) {
  await app.evaluate(
    ({ app }, link) => {
      app.emit('open-url', { preventDefault() {} }, link)
    },
    `quiznote://ronde?url=${encodeURIComponent(url)}`
  )
}

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
  await operator.getByRole('button', { name: 'Importeer ronde…' }).click()

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
  await operator.getByRole('button', { name: 'Importeer ronde…' }).click()
  await expect(
    operator.locator('.notice.error', { hasText: 'Dit is geen rondebestand van QuizNote' })
  ).toBeVisible()
  await operator.screenshot({ path: 'test-results/notice-error.png' })
  expect(savedQuiz().rounds).toHaveLength(rounds)
})

test('importeert een rondebestand dat in Finder geopend wordt', async () => {
  await openInFinder(roundFile('Sport', 'Sport'))
  await expect(operator.locator('.notice', { hasText: 'Ronde “Sport” geïmporteerd' })).toBeVisible()
  await expect(operator.locator('.sidebar .round.on .round-title')).toHaveText('Sport')
  await expect
    .poll(() => savedQuiz().rounds.some((r: { title: string }) => r.title === 'Sport'))
    .toBe(true)
})

test('vraagt in welke quiz als er geen quiz open is', async () => {
  await operator.locator('.topbar .back').click()
  await expect(operator.locator('.sidebar')).toHaveCount(0)
  await chooseFile(quizDir)
  await openInFinder(roundFile('Film', 'Film en tv'))
  await expect(
    operator.locator('.notice', { hasText: 'Ronde “Film en tv” geïmporteerd' })
  ).toBeVisible()
  await expect(operator.locator('.sidebar .round.on .round-title')).toHaveText('Film en tv')
  await expect
    .poll(() => savedQuiz().rounds.some((r: { title: string }) => r.title === 'Film en tv'))
    .toBe(true)
})

test('importeert een ronde via een link vanaf de site', async () => {
  roundFile('Muziekkennis', 'Muziekkennis')
  await openLink(`${siteOrigin}/Muziekkennis.quiznoteronde`)
  await expect(
    operator.locator('.notice', { hasText: 'Ronde “Muziekkennis” geïmporteerd' })
  ).toBeVisible()
  await expect(operator.locator('.sidebar .round.on .round-title')).toHaveText('Muziekkennis')
  await expect
    .poll(() => savedQuiz().rounds.some((r: { title: string }) => r.title === 'Muziekkennis'))
    .toBe(true)
})

test('weigert een link naar een andere site', async () => {
  const rounds = savedQuiz().rounds.length
  await openLink('https://example.com/Muziekkennis.quiznoteronde')
  await expect(
    operator.locator('.notice', { hasText: 'QuizNote opent alleen rondes van quiznote.app' })
  ).toBeVisible()
  expect(savedQuiz().rounds).toHaveLength(rounds)
})
