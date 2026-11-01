import { app } from 'electron'
import { promises as fs } from 'fs'
import { createServer, type Server } from 'net'
import { basename, dirname, isAbsolute, join } from 'path'
import { z } from 'zod'
import {
  AGENT_PARAMS,
  buildRound,
  describeQuiz,
  DraftError,
  draftFiles,
  type AgentTool,
  type RoundDraft
} from '@shared/draft'
import { mediaKindForFile } from '@shared/factory'
import { addImported, createFolder } from '@shared/media-folders'
import { QuizSchema } from '@shared/quiz-schema'
import type { AiSetup } from '@shared/ipc'
import type { Quiz } from '@shared/types'
import type { AppController } from './controller'
import { readJson, writeJson } from './json-store'
import { appLocale } from './locale'
import { NOTICE_MESSAGES } from './messages'
import {
  QUIZ_EXT,
  createQuizDir,
  createQuizFromTemplate,
  folderNameFor,
  importMediaFiles,
  isQuizDir,
  readQuiz,
  summarizeQuiz,
  writeQuiz
} from './quiz-files'

/**
 * Wat een AI-assistent via de MCP-server (src/mcp) met QuizNote kan: quizzen opzoeken, maken en
 * per ronde aanpassen. Alles gaat via de app, zodat de editor meteen meekijkt en een show nooit
 * wordt verstoord.
 */
export async function handleAgent(
  ctl: AppController,
  tool: string,
  input: unknown
): Promise<unknown> {
  const schema = AGENT_PARAMS[tool as AgentTool]
  if (!schema) throw new DraftError(`Unknown tool: ${tool}`)
  const parsed = schema.safeParse(input ?? {})
  if (!parsed.success) throw new DraftError(z.prettifyError(parsed.error))
  const agent = new Agent(ctl)

  switch (tool as AgentTool) {
    case 'list_quizzes':
      return { quizzes: await agent.list() }
    case 'get_quiz': {
      const { quiz } = parsed.data as z.infer<(typeof AGENT_PARAMS)['get_quiz']>
      const dir = await agent.find(quiz)
      return describeQuiz(await agent.read(dir), dir)
    }
    case 'create_quiz':
      return agent.create(parsed.data as z.infer<(typeof AGENT_PARAMS)['create_quiz']>)
    case 'add_rounds': {
      const p = parsed.data as z.infer<(typeof AGENT_PARAMS)['add_rounds']>
      return agent.change(p.quiz, async (quiz, dir) => {
        const at = p.position === undefined ? quiz.rounds.length : roundIndex(quiz, p.position, 1)
        await agent.insert(quiz, dir, p.rounds, at)
      })
    }
    case 'replace_round': {
      const p = parsed.data as z.infer<(typeof AGENT_PARAMS)['replace_round']>
      return agent.change(p.quiz, async (quiz, dir) => {
        const index = roundIndex(quiz, p.round)
        const old = quiz.rounds[index]
        quiz.rounds.splice(index, 1)
        await agent.insert(quiz, dir, [p.with], index)
        // Zelfde id: een antwoordenronde die naar deze ronde wijst, blijft dat doen.
        quiz.rounds[index].id = old.id
      })
    }
    case 'remove_round': {
      const p = parsed.data as z.infer<(typeof AGENT_PARAMS)['remove_round']>
      return agent.change(p.quiz, async (quiz) => {
        const [removed] = quiz.rounds.splice(roundIndex(quiz, p.round), 1)
        for (const r of quiz.rounds) r.answersFor = r.answersFor.filter((id) => id !== removed.id)
      })
    }
  }
}

/** Ronde `number` (1 = eerste) als index; `extra` = mag ook net na de laatste (invoegen). */
function roundIndex(quiz: Quiz, number: number, extra = 0): number {
  if (number > quiz.rounds.length + extra) {
    throw new DraftError(`The quiz has ${quiz.rounds.length} rounds; there is no round ${number}`)
  }
  return number - 1
}

const exists = (path: string) =>
  fs.access(path).then(
    () => true,
    () => false
  )

class Agent {
  constructor(private readonly ctl: AppController) {}

  /** Recente quizzen plus alles in de bibliotheekmap. */
  async list() {
    const library = await fs.readdir(this.ctl.libraryDir).catch(() => [] as string[])
    const dirs = [
      ...new Set([
        ...this.ctl.recentDirs,
        ...library.filter((f) => f.endsWith(QUIZ_EXT)).map((f) => join(this.ctl.libraryDir, f))
      ])
    ]
    const open = this.ctl.current?.dir
    const quizzes = await Promise.all(dirs.map((dir) => summarizeQuiz(dir)))
    return quizzes
      .filter((q) => q.exists)
      .map((q) => ({
        title: q.title,
        path: q.path,
        rounds: q.rounds,
        ...(q.path === open ? { openInApp: true, showRunning: this.ctl.live } : {})
      }))
  }

  async find(ref: string): Promise<string> {
    if (isAbsolute(ref) && (await isQuizDir(ref))) return ref
    const name = ref.trim().toLowerCase()
    const matches = (await this.list()).filter((q) => q.title.toLowerCase() === name)
    if (matches.length === 1) return matches[0].path
    if (matches.length > 1)
      throw new DraftError(`Several quizzes are called "${ref}"; use the path`)
    throw new DraftError(`There is no quiz "${ref}"; see list_quizzes`)
  }

  /** De geopende quiz zoals de editor hem heeft, anders van schijf. */
  async read(dir: string): Promise<Quiz> {
    const open = this.ctl.current
    return open?.dir === dir ? structuredClone(open.quiz) : readQuiz(dir)
  }

  async create({ title, rounds, basedOn }: z.infer<(typeof AGENT_PARAMS)['create_quiz']>) {
    const source = basedOn ? await this.find(basedOn) : null
    await fs.mkdir(this.ctl.libraryDir, { recursive: true })
    const dir = await this.freeDir(folderNameFor(title) || 'Quiz')
    let quiz: Quiz
    try {
      if (source) {
        await createQuizFromTemplate(source, dir, { rounds: false, fragments: false }, title)
      } else {
        await createQuizDir(dir, title)
      }
      quiz = await readQuiz(dir)
      await this.insert(quiz, dir, rounds, quiz.rounds.length)
      quiz = validate(quiz)
      await writeQuiz(dir, quiz)
    } catch (err) {
      // Geen halve quiz achterlaten.
      await fs.rm(dir, { recursive: true, force: true })
      throw err
    }

    // Tijdens een show wisselen we nooit van quiz: hij staat dan klaar op het dashboard.
    if (this.ctl.live) {
      this.ctl.remember(dir)
      this.ctl.notify('info', NOTICE_MESSAGES.in(appLocale())('quizReady', { title }))
    } else {
      await this.ctl.openQuiz(dir)
    }
    return {
      message: this.ctl.live
        ? 'Created. A show is running, so the quiz waits on the QuizNote dashboard.'
        : 'Created and opened in QuizNote.',
      quiz: describeQuiz(quiz, dir)
    }
  }

  /** Wijzigt een quiz: de geopende via de editor, een andere op schijf. */
  async change(ref: string, edit: (quiz: Quiz, dir: string) => Promise<void>) {
    const dir = await this.find(ref)
    const isOpen = this.ctl.current?.dir === dir
    if (isOpen && this.ctl.live) {
      throw new DraftError(
        'A show is running with this quiz in QuizNote. Change it after the show.'
      )
    }
    const quiz = await this.read(dir)
    await edit(quiz, dir)
    const valid = validate(quiz)
    if (isOpen) this.ctl.updateQuiz(valid, -1)
    else await writeQuiz(dir, valid)
    return { message: 'Done.', quiz: describeQuiz(valid, dir) }
  }

  /** Bouwt rondes in op plek `at`, na het importeren van hun bestanden. */
  async insert(quiz: Quiz, dir: string, drafts: RoundDraft[], at: number): Promise<void> {
    const assetFor = await this.importFiles(quiz, dir, drafts)
    drafts.forEach((draft, i) => {
      const earlier = { ...quiz, rounds: quiz.rounds.slice(0, at + i) }
      quiz.rounds.splice(at + i, 0, buildRound(earlier, draft, assetFor))
    })
  }

  /**
   * Kopieert de bestanden uit de rondes naar de quiz, elke ronde in een eigen map in Media.
   * Eerst alles nakijken, zodat een fout geen half geïmporteerde bestanden achterlaat.
   */
  private async importFiles(quiz: Quiz, dir: string, drafts: RoundDraft[]) {
    const files = drafts.flatMap((draft) =>
      draftFiles(draft).map((f) => ({ ...f, folder: draft.title?.trim() || 'Media' }))
    )
    for (const f of files) {
      if (!isAbsolute(f.path)) throw new DraftError(`Use an absolute path: ${f.path}`)
      const stat = await fs.stat(f.path).catch(() => null)
      if (!stat?.isFile()) throw new DraftError(`File not found: ${f.path}`)
      if (mediaKindForFile(f.path) !== f.kind) {
        const wanted = f.kind === 'audio' ? 'an audio file' : 'a picture'
        throw new DraftError(`${basename(f.path)} is not ${wanted}`)
      }
    }
    const ids = new Map<string, string>()
    for (const f of files) {
      if (ids.has(f.path)) continue
      const result = await importMediaFiles(dir, [f.path])
      const folder = quiz.folders.find((x) => x.name === f.folder) ?? createFolder(quiz, f.folder)
      const [asset] = addImported(quiz, result, folder.id)
      if (!asset) throw new DraftError(`Could not import ${basename(f.path)}`)
      ids.set(f.path, asset.id)
    }
    return (path: string) => ids.get(path)!
  }

  /** "Italië", of "Italië 2" als die al bestaat. */
  private async freeDir(name: string): Promise<string> {
    for (let n = 1; ; n++) {
      const dir = join(this.ctl.libraryDir, `${n === 1 ? name : `${name} ${n}`}${QUIZ_EXT}`)
      if (!(await exists(dir))) return dir
    }
  }
}

function validate(quiz: Quiz): Quiz {
  const parsed = QuizSchema.safeParse(quiz)
  if (!parsed.success) throw new DraftError(z.prettifyError(parsed.error))
  return parsed.data
}

/**
 * Lokale verbinding voor de MCP-server: een Unix-socket die alleen deze gebruiker kan openen.
 * Per regel één JSON-verzoek `{ id, tool, input }`, per regel één antwoord `{ id, result | error }`.
 */
export class AgentBridge {
  private server: Server | null = null

  constructor(
    readonly socketPath: string,
    private readonly handle: (tool: string, input: unknown) => Promise<unknown>
  ) {}

  async start(): Promise<void> {
    // Er draait maar één app (single-instance lock): een oude socket is van een crash.
    await fs.rm(this.socketPath, { force: true })
    const server = createServer((socket) => {
      let buffer = ''
      socket.setEncoding('utf8')
      socket.on('data', (chunk: string) => {
        buffer += chunk
        let newline: number
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newline)
          buffer = buffer.slice(newline + 1)
          if (line.trim()) void this.respond(line).then((reply) => socket.write(reply + '\n'))
        }
      })
      socket.on('error', () => socket.destroy())
    })
    this.server = server
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.socketPath, () => resolve())
    })
    await fs.chmod(this.socketPath, 0o600)
  }

  stop(): void {
    this.server?.close()
    this.server = null
    void fs.rm(this.socketPath, { force: true })
  }

  private async respond(line: string): Promise<string> {
    let id: unknown = null
    try {
      const request = JSON.parse(line) as { id: unknown; tool: string; input: unknown }
      id = request.id
      return JSON.stringify({ id, result: await this.handle(request.tool, request.input) })
    } catch (err) {
      return JSON.stringify({ id, error: (err as Error).message || String(err) })
    }
  }
}

// ── Koppelen aan een AI-app ─────────────────────────────────────────────────────

/** De app-binary als Node met out/main/mcp.js; werkt in de gebouwde app en tijdens het ontwikkelen. */
function mcpServer(): AiSetup['server'] {
  return {
    command: process.execPath,
    args: [join(__dirname, 'mcp.js')],
    env: { ELECTRON_RUN_AS_NODE: '1' }
  }
}

/** QUIZNOTE_CLAUDE_CONFIG: voor tests, zodat de echte instellingen van Claude ongemoeid blijven. */
const claudeConfig = () =>
  process.env['QUIZNOTE_CLAUDE_CONFIG'] ??
  join(app.getPath('appData'), 'Claude', 'claude_desktop_config.json')

export async function aiSetup(): Promise<AiSetup> {
  const path = claudeConfig()
  const config = await readJson<{ mcpServers?: Record<string, unknown> }>(path)
  return {
    server: mcpServer(),
    claudeInstalled: await exists(dirname(path)),
    claudeConnected: !!config?.mcpServers?.['quiznote']
  }
}

/** Voegt QuizNote toe aan de MCP-servers van Claude Desktop; de rest blijft staan. */
export async function connectClaude(): Promise<string | null> {
  const path = claudeConfig()
  if (!(await exists(dirname(path)))) return 'Claude Desktop is niet gevonden op deze Mac.'
  let config: Record<string, unknown> = {}
  if (await exists(path)) {
    try {
      config = JSON.parse(await fs.readFile(path, 'utf8')) as Record<string, unknown>
    } catch {
      return 'De instellingen van Claude Desktop zijn niet te lezen. Voeg QuizNote daar zelf toe met de instellingen hieronder.'
    }
  }
  const servers = (config['mcpServers'] ?? {}) as Record<string, unknown>
  config['mcpServers'] = { ...servers, quiznote: mcpServer() }
  await writeJson(path, config)
  return null
}
