import { execFile, spawn } from 'child_process'
import { connect, type Socket } from 'net'
import { homedir } from 'os'
import { join } from 'path'
import { z } from 'zod'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool
} from '@modelcontextprotocol/sdk/types.js'
import { AGENT_PARAMS, type AgentTool } from '@shared/draft'

/**
 * MCP-server van QuizNote: zo vraagt iemand zijn eigen AI-assistent (Claude Desktop, …)
 * "maak een pubquiz in QuizNote met zes rondes over Italië". Elke opdracht gaat naar de app
 * (src/main/agent.ts), die zo nodig eerst gestart wordt.
 *
 * Starten: `ELECTRON_RUN_AS_NODE=1 <QuizNote-binary> <dit bestand>`, of met gewone Node.
 * QUIZNOTE_SOCKET: een andere socket (tests); QUIZNOTE_NO_LAUNCH: de app niet zelf starten.
 */

const SOCKET =
  process.env['QUIZNOTE_SOCKET'] ??
  join(homedir(), 'Library', 'Application Support', 'QuizNote', 'mcp.sock')
const BUNDLE_ID = 'com.gutsgusto.pubquiz'

const TOOLS: Record<AgentTool, string> = {
  list_quizzes:
    'List the pub quizzes in QuizNote: title, path and number of rounds, and which one is open in the app.',
  get_quiz:
    'Read a quiz in QuizNote: its rounds with questions and answers, pictures and songs, and its media. Use this before changing a quiz.',
  create_quiz: [
    'Create a new pub quiz in QuizNote and open it in the app.',
    'Write everything (titles, intros, questions, answers, notes) in the language of the user.',
    'Round types: "questions" (one question per slide, with its answer), "pictures" (numbered pictures, optionally looping), "music" (songs to guess), "break", and "answers", which goes through the answers of earlier rounds (usually the last round, or after a few rounds).',
    'Pictures and songs must be files that exist on this Mac, given as absolute paths; you cannot invent or download them. Without files, make question rounds, or suggest songs in the notes of a round so the quizmaster can add them.',
    'Give every round a short intro for its title slide, and keep answers short enough for an answer sheet.',
    'A new quiz has one screen ("Beamer"); use basedOn to copy the screens, background music and look of an earlier quiz.'
  ].join(' '),
  add_rounds: 'Add rounds to a quiz in QuizNote, in the same format as create_quiz.',
  replace_round:
    'Replace one round of a quiz with a new version, e.g. to make it harder or change its topic. It keeps its place.',
  remove_round: 'Remove one round from a quiz in QuizNote.'
}

// ── Verbinding met de app ────────────────────────────────────────────────────

let socket: Socket | null = null
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function tryConnect(): Promise<Socket | null> {
  return new Promise((resolve) => {
    const s = connect(SOCKET)
    s.once('connect', () => resolve(s))
    s.once('error', () => resolve(null))
  })
}

/** Start de app. Vanuit de app-binary zelf: dezelfde binary zonder ELECTRON_RUN_AS_NODE. */
function launchApp(): void {
  if (process.env['ELECTRON_RUN_AS_NODE']) {
    const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env
    const packaged = __dirname.includes('app.asar')
    const args = packaged ? [] : [join(__dirname, 'index.js')]
    spawn(process.execPath, args, { detached: true, stdio: 'ignore', env }).unref()
  } else {
    execFile('open', ['-b', BUNDLE_ID], () => {})
  }
}

async function bridge(): Promise<Socket> {
  if (socket && !socket.destroyed) return socket
  let s = await tryConnect()
  if (!s) {
    if (process.env['QUIZNOTE_NO_LAUNCH']) {
      throw new Error('QuizNote is not running. Ask the user to start the app and try again.')
    }
    launchApp()
    for (let i = 0; i < 60 && !s; i++) {
      await sleep(500)
      s = await tryConnect()
    }
    if (!s) throw new Error('Could not reach QuizNote. Ask the user to start the app.')
  }

  let buffer = ''
  s.setEncoding('utf8')
  s.on('data', (chunk: string) => {
    buffer += chunk
    let newline: number
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const reply = JSON.parse(buffer.slice(0, newline)) as {
        id: number
        result?: unknown
        error?: string
      }
      buffer = buffer.slice(newline + 1)
      const waiting = pending.get(reply.id)
      pending.delete(reply.id)
      if (reply.error !== undefined) waiting?.reject(new Error(reply.error))
      else waiting?.resolve(reply.result)
    }
  })
  s.on('close', () => {
    socket = null
    for (const waiting of pending.values()) waiting.reject(new Error('QuizNote was closed'))
    pending.clear()
  })
  socket = s
  return s
}

async function call(tool: string, input: unknown): Promise<unknown> {
  const s = await bridge()
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    s.write(JSON.stringify({ id, tool, input }) + '\n')
  })
}

// ── MCP ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const server = new Server(
    { name: 'quiznote', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions:
        'QuizNote is a Mac app for making and running pub quizzes: slides on screens, ' +
        'music fragments, answer sheets. Use these tools to create or change quizzes in it.'
    }
  )
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(TOOLS).map(([name, description]) => ({
      name,
      description,
      inputSchema: z.toJSONSchema(AGENT_PARAMS[name as AgentTool]) as Tool['inputSchema']
    }))
  }))
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await call(request.params.name, request.params.arguments ?? {})
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: (err as Error).message }], isError: true }
    }
  })
  await server.connect(new StdioServerTransport())
}

void main()
