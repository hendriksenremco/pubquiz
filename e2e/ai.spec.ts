import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import {
  confirmIn,
  launch,
  openStart,
  startShow,
  tempDir,
  tourFixture,
  useWindowedScreens
} from './helpers'

// Een AI-assistent maakt een quiz via de MCP-server (out/main/mcp.js), die met de draaiende app
// praat. De client hier doet wat Claude Desktop doet.

let app: ElectronApplication
let operator: Page
let userData: string
let claudeConfig: string
let ai: Client

const media = (file: string) => join(tourFixture, 'media', file)

async function connect(command: string, args: string[], env: Record<string, string> = {}) {
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(
    new StdioClientTransport({
      command,
      args,
      env: {
        ...(process.env as Record<string, string>),
        ...env,
        QUIZMEISTER_SOCKET: join(userData, 'mcp.sock'),
        QUIZMEISTER_NO_LAUNCH: '1'
      }
    })
  )
  return client
}

/** Roept een gereedschap aan; geeft de tekst terug en of het een fout was. */
async function call(name: string, args: Record<string, unknown>, client = ai) {
  const result = await client.callTool({ name, arguments: args })
  const text = (result.content as { type: string; text: string }[])[0].text
  return { error: !!result.isError, text, json: result.isError ? null : JSON.parse(text) }
}

test.beforeAll(async () => {
  userData = tempDir('userdata')
  const claudeDir = join(userData, 'Claude')
  mkdirSync(claudeDir)
  claudeConfig = join(claudeDir, 'claude_desktop_config.json')
  writeFileSync(
    claudeConfig,
    JSON.stringify({ mcpServers: { ander: { command: 'iets' } }, theme: 'dark' })
  )
  ;({ app, operator } = await launch(userData, undefined, {
    QUIZMEISTER_CLAUDE_CONFIG: claudeConfig
  }))
  ai = await connect(process.execPath, [resolve('out/main/mcp.js')])
})

test.afterAll(async () => {
  await ai?.close()
  await app?.close()
  rmSync(userData, { recursive: true, force: true })
})

test('een AI maakt een quiz met vragen, muziek, plaatjes, een pauze en antwoorden', async () => {
  const tools = (await ai.listTools()).tools.map((t) => t.name)
  expect(tools).toEqual([
    'list_quizzes',
    'get_quiz',
    'create_quiz',
    'add_rounds',
    'replace_round',
    'remove_round'
  ])

  const created = await call('create_quiz', {
    title: 'Pubquiz Italië',
    rounds: [
      {
        type: 'questions',
        title: 'Ronde 1: Italië',
        intro: 'Vijf vragen over Italië',
        notes: 'Vraag 2 lees je zelf voor',
        questions: [
          { question: 'Wat is de hoofdstad van Italië?', answer: 'Rome' },
          { question: 'Welke vulkaan verwoestte Pompeii?', answer: 'De Vesuvius', readAloud: true },
          { question: 'Welke kleuren heeft de Italiaanse vlag?', answer: 'Groen, wit en rood' }
        ]
      },
      {
        type: 'music',
        title: 'Ronde 2: muziek',
        intro: 'Welk liedje hoor je?',
        songs: [
          { audio: media('vader-jacob.m4a'), answer: 'Vader Jacob' },
          { audio: media('fur-elise.m4a'), answer: 'Für Elise', end: 6 }
        ]
      },
      {
        type: 'pictures',
        title: 'Ronde 3: vlaggen',
        loopSeconds: 6,
        pictures: [
          { image: media('vlag-italie.png'), answer: 'Italië' },
          { image: media('vlag-ierland.png'), answer: 'Ierland' }
        ]
      },
      { type: 'break' },
      { type: 'answers' }
    ]
  })
  expect(created.error, created.text).toBe(false)
  expect(created.json.quiz.rounds).toHaveLength(5)

  // De app opent hem meteen, met de bestanden in een map per ronde.
  await expect(operator.locator('.topbar .name')).toHaveText('Pubquiz Italië')
  await expect(operator.locator('.sidebar .round')).toHaveCount(5)
  const dir = join(userData, 'Pubquiz', 'Pubquiz Italië.pubquiz')
  const saved = JSON.parse(readFileSync(join(dir, 'quiz.json'), 'utf8'))
  expect(saved.folders.map((f: { name: string }) => f.name)).toEqual([
    'Ronde 2: muziek',
    'Ronde 3: vlaggen'
  ])
  expect(saved.rounds[4].answersFor).toEqual([
    saved.rounds[0].id,
    saved.rounds[1].id,
    saved.rounds[2].id
  ])

  await operator.locator('.sidebar .round').nth(1).click()
  await expect(operator.locator('.track')).toHaveCount(2)
  // De duur van de liedjes meet de editor zelf, en die gaat mee in het bestand.
  await expect
    .poll(() => {
      const quiz = JSON.parse(readFileSync(join(dir, 'quiz.json'), 'utf8'))
      return quiz.assets.filter(
        (a: { kind: string; duration?: number }) => a.kind === 'audio' && a.duration
      ).length
    })
    .toBe(2)
  await operator.waitForTimeout(600)
  await operator.screenshot({ path: 'test-results/ai-music-round.png' })

  // Aanpassen terwijl hij open staat: de editor laat het meteen zien.
  await operator.locator('.sidebar .round').first().click()
  const replaced = await call('replace_round', {
    quiz: 'Pubquiz Italië',
    round: 1,
    with: {
      type: 'questions',
      title: 'Ronde 1: Italië (moeilijk)',
      questions: [{ question: 'In welk jaar werd Italië één land?', answer: '1861' }]
    }
  })
  expect(replaced.error, replaced.text).toBe(false)
  await expect(operator.locator('#round-title')).toHaveValue('Ronde 1: Italië (moeilijk)')
  // De antwoordenronde wijst nog steeds naar ronde 1.
  expect(replaced.json.quiz.rounds[4].answersFor[0]).toBe('Ronde 1: Italië (moeilijk)')

  // Een bestand dat niet bestaat: een duidelijke fout, en de quiz blijft zoals hij was.
  const missing = await call('add_rounds', {
    quiz: 'Pubquiz Italië',
    rounds: [
      { type: 'music', title: 'Extra', songs: [{ audio: '/bestaat/niet.mp3', answer: 'x' }] }
    ]
  })
  expect(missing).toMatchObject({ error: true, text: 'File not found: /bestaat/niet.mp3' })
  await expect(operator.locator('.sidebar .round')).toHaveCount(5)

  const list = await call('list_quizzes', {})
  expect(list.json.quizzes).toContainEqual(
    expect.objectContaining({ title: 'Pubquiz Italië', openInApp: true, rounds: 5 })
  )
  expect(existsSync(join(dir, 'media'))).toBe(true)
})

test('tijdens een show past de AI de lopende quiz niet aan en wisselt hij niet van quiz', async () => {
  await openStart(operator)
  await useWindowedScreens(operator)
  await startShow(operator)
  await expect(operator.locator('.live')).toBeVisible()

  const blocked = await call('remove_round', { quiz: 'Pubquiz Italië', round: 4 })
  expect(blocked).toMatchObject({ error: true, text: expect.stringContaining('show is running') })

  const waiting = await call('create_quiz', {
    title: 'Volgende week',
    rounds: [
      { type: 'questions', title: 'Ronde 1', questions: [{ question: 'Vraag?', answer: 'Ja' }] }
    ]
  })
  expect(waiting.json.message).toContain('waits on the Quizmeister dashboard')
  await expect(operator.locator('.now-title')).toBeVisible()
  await expect(operator.locator('.notice')).toContainText('Volgende week')

  await operator.getByRole('button', { name: 'Stop show' }).click()
  await confirmIn(operator, 'Stop show')
})

test('vanaf het dashboard koppel je Quizmeister in één keer aan Claude Desktop', async () => {
  await operator.getByRole('button', { name: 'Quizzen' }).click()
  await operator.locator('.new-tile').click()
  await operator.getByRole('button', { name: 'Met je AI…' }).click()
  const dialog = operator.getByRole('dialog', { name: 'Een quiz maken met je AI' })
  await expect(dialog.locator('.snippet')).toContainText('mcp.js')
  await dialog.getByRole('button', { name: 'Koppel aan Claude Desktop' }).click()
  await expect(dialog.locator('.ok')).toContainText('Gekoppeld')
  await operator.waitForTimeout(300)
  await operator.screenshot({ path: 'test-results/ai-dialog.png' })

  // De andere instellingen van Claude blijven staan.
  const config = JSON.parse(readFileSync(claudeConfig, 'utf8'))
  expect(config.theme).toBe('dark')
  expect(Object.keys(config.mcpServers)).toEqual(['ander', 'quizmeister'])

  // Precies zoals Claude Desktop hem start (de app-binary als Node) werkt hij ook.
  const { command, args, env } = config.mcpServers.quizmeister
  expect(env).toEqual({ ELECTRON_RUN_AS_NODE: '1' })
  const claude = await connect(command, args, env)
  try {
    const list = await call('list_quizzes', {}, claude)
    expect(list.json.quizzes.map((q: { title: string }) => q.title)).toContain('Volgende week')
  } finally {
    await claude.close()
  }
})
