import { app, BrowserWindow, dialog, shell, type Display } from 'electron'
import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import { newId } from '@shared/factory'
import { formFileName, type FormOptions } from '@shared/forms'
import {
  IPC,
  type AudioEngineEvent,
  type RecentQuiz,
  type RecoveryInfo,
  type Snapshot
} from '@shared/ipc'
import { QuizSchema } from '@shared/quiz-schema'
import { findRound } from '@shared/resolve'
import type { TemplateOptions } from '@shared/template'
import type { HardwareMapping, Notice, Quiz, ShowState } from '@shared/types'
import { AirPlayBrowser } from './airplay'
import { listDisplays, ScreenWindows, type DisplayChange } from './displays'
import {
  QUIZ_EXT,
  createQuizDir,
  createQuizFromTemplate,
  exportZip,
  folderNameFor,
  findMissingMedia,
  importMediaFiles,
  importZip,
  isQuizDir,
  readQuiz,
  summarizeQuiz,
  writeQuiz
} from './quiz-files'
import { renderFormPdf } from './pdf'
import { Settings, type RecoveryData } from './settings'
import { ShowController } from './show'
import { headless } from './windows'

const SAVE_DELAY_MS = 600
const RECOVERY_DELAY_MS = 1000
const RECOVERY_MAX_AGE_MS = 12 * 60 * 60 * 1000

/** Lijm tussen quizbestand, show-state, vensters en instellingen. */
export class AppController {
  operator: BrowserWindow | null = null
  audio: BrowserWindow | null = null

  private quiz: Quiz | null = null
  private quizDir: string | null = null
  private hardware: HardwareMapping = { screens: {}, audio: {}, screenSound: {} }
  private dirty = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null
  private recovery: RecoveryData | null = null

  readonly screens = new ScreenWindows(() => this.operator)
  readonly airplay = new AirPlayBrowser((devices) => this.broadcast(IPC.airplay, [devices]))
  readonly show = new ShowController({
    quiz: () => this.quiz,
    publish: (state) => this.onState(state)
  })

  constructor(
    private readonly settings: Settings,
    /** Waar nieuwe en geïmporteerde quizzen komen (standaard Documenten/Pubquizzen). */
    readonly libraryDir: string
  ) {
    this.screens.watch((change, display) => this.onDisplayChange(change, display))
  }

  get mediaRoot(): string | null {
    return this.quizDir
  }

  isRecent(dir: string): boolean {
    return this.settings.recent.includes(dir)
  }

  get windowTitle(): string {
    return this.quiz ? `${this.quiz.title} — Pubquiz` : 'Pubquiz'
  }

  get live(): boolean {
    return this.show.current.live
  }

  snapshot(): Snapshot {
    return {
      quiz: this.quiz,
      quizDir: this.quizDir,
      state: this.show.current,
      hardware: this.hardware,
      displays: listDisplays(),
      recent: this.settings.recent,
      recovery: this.recoveryInfo(),
      libraryDir: this.libraryDir,
      airplay: this.airplay.list,
      dirty: this.dirty
    }
  }

  // ── Quizbestanden ────────────────────────────────────────────────────────────

  async openQuiz(path: string): Promise<void> {
    const dir = basename(path) === 'quiz.json' ? dirname(path) : path
    if (!(await isQuizDir(dir))) {
      this.settings.removeRecent(dir)
      this.notify('error', `Geen quiz gevonden in ${dir}`)
      return
    }
    let quiz: Quiz
    try {
      quiz = await readQuiz(dir)
    } catch (err) {
      this.notify('error', `Quiz openen mislukt: ${(err as Error).message}`)
      return
    }
    if (this.live) await this.stopShow()
    await this.flushSave()

    this.quiz = quiz
    this.quizDir = dir
    this.dirty = false
    this.hardware = this.settings.mappingFor(quiz, listDisplays())
    this.settings.addRecent(dir)
    if (this.recovery && this.recovery.quizDir !== dir) this.recovery = null

    this.broadcast(IPC.quiz, [quiz, dir])
    this.broadcast(IPC.hardware, [this.hardware])
    this.operator?.setTitle(this.windowTitle)

    const missing = await findMissingMedia(dir, quiz)
    if (missing.length > 0) {
      this.notify('warning', `Ontbrekende media: ${missing.slice(0, 5).join(', ')}`)
    }
  }

  /**
   * Nieuwe quiz in de bibliotheekmap (Documenten/Pubquizzen); de map krijgt de naam van de quiz.
   * Geeft een foutmelding voor in het dialoogvenster terug, of null als het gelukt is.
   */
  async createNamedQuiz(
    name: string,
    template?: { source: string; options: TemplateOptions }
  ): Promise<string | null> {
    const title = name.trim()
    const folder = folderNameFor(title)
    if (!folder) return 'Geef de quiz een naam'
    if (template?.source === this.quizDir) await this.flushSave()
    try {
      await fs.mkdir(this.libraryDir, { recursive: true })
      const path = join(this.libraryDir, folder)
      const { dir } = template
        ? await createQuizFromTemplate(template.source, path, template.options, title)
        : await createQuizDir(path, title)
      await this.openQuiz(dir)
      return null
    } catch (err) {
      return (err as Error).message
    }
  }

  async promptOpenQuiz(): Promise<void> {
    const result = await dialog.showOpenDialog(this.operator!, {
      title: 'Quiz openen',
      buttonLabel: 'Open',
      message: `Kies een ${QUIZ_EXT}-map (of het quiz.json-bestand erin)`,
      properties: ['openDirectory', 'openFile', 'treatPackageAsDirectory']
    })
    const path = result.filePaths[0]
    if (!result.canceled && path) await this.openQuiz(path)
  }

  async promptImportZip(): Promise<void> {
    const source = await dialog.showOpenDialog(this.operator!, {
      title: 'Quiz importeren uit zip',
      filters: [{ name: 'Zip', extensions: ['zip'] }],
      properties: ['openFile']
    })
    const zip = source.filePaths[0]
    if (source.canceled || !zip) return
    try {
      await fs.mkdir(this.libraryDir, { recursive: true })
      await this.openQuiz(await importZip(zip, this.libraryDir))
    } catch (err) {
      this.notify('error', `Importeren mislukt: ${(err as Error).message}`)
    }
  }

  async promptExportZip(): Promise<void> {
    if (!this.quizDir) return
    await this.flushSave()
    const result = await dialog.showSaveDialog(this.operator!, {
      title: 'Exporteer als zip',
      defaultPath: `${basename(this.quizDir, QUIZ_EXT)}.zip`,
      filters: [{ name: 'Zip', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return
    try {
      await exportZip(this.quizDir, result.filePath)
      this.notify('info', `Geëxporteerd naar ${basename(result.filePath)}`)
    } catch (err) {
      this.notify('error', `Exporteren mislukt: ${(err as Error).message}`)
    }
  }

  /** Antwoordformulier of antwoorden als pdf; standaard in Downloads, daarna open in Voorvertoning. */
  async exportForm(options: FormOptions): Promise<void> {
    if (!this.quiz) return
    const name = formFileName(this.quiz, options.doc)
    // Voor tests: zonder dialoog in een vaste map.
    const fixedDir = process.env['PUBQUIZ_SAVE_DIR']
    let target = fixedDir ? join(fixedDir, name) : null
    if (!target) {
      const result = await dialog.showSaveDialog(this.operator!, {
        title: options.doc === 'sheet' ? 'Antwoordformulier opslaan' : 'Antwoorden opslaan',
        defaultPath: join(app.getPath('downloads'), name),
        filters: [{ name: 'Pdf', extensions: ['pdf'] }]
      })
      if (result.canceled || !result.filePath) return
      target = result.filePath
    }
    try {
      await fs.writeFile(target, await renderFormPdf(options))
      this.notify('info', `Opgeslagen: ${basename(target)}`)
      if (!headless) void shell.openPath(target)
    } catch (err) {
      this.notify('error', `Pdf maken mislukt: ${(err as Error).message}`)
    }
  }

  openAirPlaySettings(kind: 'screen' | 'audio'): void {
    const pane = kind === 'screen' ? 'Displays-Settings' : 'Sound-Settings'
    void shell.openExternal(`x-apple.systempreferences:com.apple.${pane}.extension`)
  }

  revealQuiz(path?: string): void {
    const target = path ?? this.quizDir
    if (target) shell.showItemInFolder(target)
  }

  /** Terug naar het dashboard. Niet tijdens een show. */
  async closeQuiz(): Promise<void> {
    if (this.live) {
      this.notify('warning', 'Stop eerst de show voordat je naar het overzicht gaat')
      return
    }
    await this.flushSave()
    this.quiz = null
    this.quizDir = null
    this.dirty = false
    this.hardware = { screens: {}, audio: {}, screenSound: {} }
    this.broadcast(IPC.quiz, [null, null])
    this.broadcast(IPC.hardware, [this.hardware])
    this.operator?.setTitle(this.windowTitle)
  }

  recentQuizzes(): Promise<RecentQuiz[]> {
    return Promise.all(this.settings.recent.map((dir) => summarizeQuiz(dir)))
  }

  removeRecent(path: string): void {
    this.settings.removeRecent(path)
  }

  async importMedia(paths: string[] | undefined) {
    if (!this.quizDir) return { assets: [], skipped: [], folders: [] }
    let sources = paths
    if (!sources) {
      const result = await dialog.showOpenDialog(this.operator!, {
        title: 'Media importeren',
        message: 'Kies bestanden of een hele map',
        buttonLabel: 'Importeer',
        properties: ['openFile', 'openDirectory', 'multiSelections'],
        filters: [
          {
            name: 'Video, audio en afbeeldingen',
            extensions: [
              'mp4',
              'm4v',
              'mov',
              'webm',
              'mp3',
              'm4a',
              'aac',
              'wav',
              'aiff',
              'flac',
              'ogg',
              'png',
              'jpg',
              'jpeg',
              'gif',
              'webp'
            ]
          }
        ]
      })
      if (result.canceled) return { assets: [], skipped: [], folders: [] }
      sources = result.filePaths
    }
    const result = await importMediaFiles(this.quizDir, sources)
    if (result.skipped.length > 0) {
      this.notify('warning', `Niet geïmporteerd (onbekend type): ${result.skipped.join(', ')}`)
    }
    return result
  }

  /** Wijziging vanuit de editor. De afzender krijgt hem niet terug, anders overschrijven we lopende invoer. */
  updateQuiz(input: Quiz, senderId: number): void {
    if (!this.quiz || !this.quizDir) return
    const parsed = QuizSchema.safeParse(input)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      this.notify('error', `Ongeldige wijziging bij ${issue?.path.join('.')}: ${issue?.message}`)
      return
    }
    const previous = this.quiz
    this.quiz = parsed.data
    this.dirty = true
    this.scheduleSave()
    this.broadcast(IPC.quiz, [this.quiz, this.quizDir], senderId)
    if (previous.title !== this.quiz.title) this.operator?.setTitle(this.windowTitle)

    this.refreshHardware()
    if (this.live) {
      this.show.reconcile()
      this.syncScreens(false)
    }
  }

  async flushSave(): Promise<void> {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (!this.dirty || !this.quiz || !this.quizDir) return
    try {
      await writeQuiz(this.quizDir, this.quiz)
      this.dirty = false
      this.broadcast(IPC.saved, [false])
    } catch (err) {
      this.notify('error', `Opslaan mislukt: ${(err as Error).message}`)
    }
  }

  // ── Show ─────────────────────────────────────────────────────────────────────

  async startShow(resume: boolean): Promise<void> {
    if (!this.quiz) return
    const restore =
      resume && this.recovery?.quizDir === this.quizDir ? this.recovery.state : undefined
    this.recovery = null
    this.show.start(restore)
    this.syncScreens(true)
  }

  async stopShow(): Promise<void> {
    this.show.stop()
    this.screens.closeAll()
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer)
    this.recoveryTimer = null
    await this.settings.clearRecovery()
  }

  setHardware(mapping: HardwareMapping): void {
    if (!this.quiz) return
    this.hardware = mapping
    this.settings.saveMapping(this.quiz, mapping)
    this.broadcast(IPC.hardware, [mapping])
    if (this.live) this.syncScreens(true)
  }

  audioEvent(event: AudioEngineEvent): void {
    if (event.type === 'error') this.notify('error', `Audio: ${event.message}`)
    this.show.audioEvent(event)
  }

  testTone(channelId: string): void {
    this.audio?.webContents.send(IPC.audioCommand, { type: 'testTone', channelId })
  }

  dismissRecovery(): void {
    this.recovery = null
    void this.settings.clearRecovery()
  }

  /** Bij het opstarten: was er een show bezig toen de app stopte? */
  async loadRecovery(): Promise<string | null> {
    const data = await this.settings.readRecovery()
    if (!data || Date.now() - data.savedAt > RECOVERY_MAX_AGE_MS || !data.state.live) {
      await this.settings.clearRecovery()
      return null
    }
    this.recovery = data
    return data.quizDir
  }

  // ── Intern ───────────────────────────────────────────────────────────────────

  notify(level: Notice['level'], message: string): void {
    this.operator?.webContents.send(IPC.notice, { id: newId(), level, message } satisfies Notice)
  }

  broadcast(channel: string, args: unknown[], exceptId?: number): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed() || win.webContents.id === exceptId) continue
      win.webContents.send(channel, ...args)
    }
  }

  private recoveryInfo(): RecoveryInfo | null {
    if (!this.recovery) return null
    const round = this.quiz && findRound(this.quiz, this.recovery.state.activeRoundId)
    return {
      quizDir: this.recovery.quizDir,
      roundTitle: round?.title ?? null,
      savedAt: this.recovery.savedAt
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.broadcast(IPC.saved, [true])
    this.saveTimer = setTimeout(() => void this.flushSave(), SAVE_DELAY_MS)
  }

  /** Nieuwe slots/kanalen krijgen een koppeling; bestaande houden de hunne. */
  private refreshHardware(): void {
    if (!this.quiz) return
    const suggested = this.settings.mappingFor(this.quiz, listDisplays())
    const next: HardwareMapping = {
      screens: Object.fromEntries(
        this.quiz.screens.map((s) => [s.id, this.hardware.screens[s.id] ?? suggested.screens[s.id]])
      ),
      audio: Object.fromEntries(
        this.quiz.channels.map((c) => [c.id, this.hardware.audio[c.id] ?? suggested.audio[c.id]])
      ),
      screenSound: Object.fromEntries(
        this.quiz.screens.flatMap((s) => {
          const sound = this.hardware.screenSound[s.id] ?? suggested.screenSound[s.id]
          return sound ? [[s.id, sound]] : []
        })
      )
    }
    if (JSON.stringify(next) === JSON.stringify(this.hardware)) return
    this.hardware = next
    this.broadcast(IPC.hardware, [next])
  }

  private syncScreens(reportMissing: boolean): void {
    const missing = this.screens.sync(this.quiz, this.hardware, this.live)
    if (reportMissing) {
      for (const slot of missing) {
        this.notify('warning', `Scherm "${slot.name}": gekoppeld display is niet aangesloten`)
      }
    }
  }

  private onState(state: ShowState): void {
    this.broadcast(IPC.state, [state])
    if (!state.live || !this.quizDir || this.recoveryTimer) return
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null
      if (!this.live || !this.quizDir) return
      void this.settings.writeRecovery({
        quizDir: this.quizDir,
        state: this.show.current,
        savedAt: Date.now()
      })
    }, RECOVERY_DELAY_MS)
  }

  private onDisplayChange(change: DisplayChange, display: Display): void {
    this.broadcast(IPC.displays, [listDisplays()])
    const label = display.label || `Scherm ${display.id}`
    if (change === 'removed') this.notify('warning', `Display losgekoppeld: ${label}`)
    if (change === 'added') this.notify('info', `Display aangesloten: ${label}`)
    if (this.live) this.syncScreens(false)
  }
}
