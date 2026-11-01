import { app, BrowserWindow, dialog, shell, type Display } from 'electron'
import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import { quizShape } from '@shared/analytics'
import { newId } from '@shared/factory'
import { formFileName, type FormOptions } from '@shared/forms'
import {
  IPC,
  mediaUrl,
  type AudioEngineEvent,
  type RecentQuiz,
  type RecoveryInfo,
  type Snapshot
} from '@shared/ipc'
import { PLUGIN_OFF, PLUGINS, type PluginId, type PluginSetting } from '@shared/plugins'
import { QuizSchema } from '@shared/quiz-schema'
import { findRound } from '@shared/resolve'
import { ROUND_FILE_EXT, type RoundImport } from '@shared/round-file'
import { ROUND_LINK_ORIGIN, roundLinkSource } from '@shared/round-link'
import type { TemplateOptions } from '@shared/template'
import type { HardwareMapping, Notice, Quiz, ShowState } from '@shared/types'
import { AirPlayBrowser } from './airplay'
import type { Analytics } from './analytics'
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
  quizBaseName,
  readQuiz,
  summarizeQuiz,
  writeQuiz
} from './quiz-files'
import { appLocale } from './locale'
import { locateMedia } from './media-path'
import { DIALOG_MESSAGES, errorText, NoticeError, NOTICE_MESSAGES, TOUR_MESSAGES } from './messages'
import { renderFormPdf } from './pdf'
import { Plugins } from './plugins'
import { SaveQueue } from './save-queue'
import { Settings, type RecoveryData } from './settings'
import { readRoundFile } from './round-file'
import { downloadRoundFile } from './round-link'
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
  private readonly saves = new SaveQueue()
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null
  private recovery: RecoveryData | null = null
  /** Rondebestanden uit Finder die de editor nog moet importeren (zie `openRoundFile`). */
  private roundFiles: string[] = []

  readonly screens = new ScreenWindows(() => this.operator)
  readonly airplay = new AirPlayBrowser((devices) => this.broadcast(IPC.airplay, [devices]))
  readonly show = new ShowController({
    quiz: () => this.quiz,
    publish: (state) => this.onState(state),
    timerEnded: (channelId) =>
      this.audio?.webContents.send(IPC.audioCommand, { type: 'timerEnd', channelId })
  })
  readonly plugins = new Plugins({
    notify: (level, message) => this.notify(level, message),
    saveConfig: (id, config) =>
      this.setPlugin(id, { ...(this.settings.plugins[id] ?? PLUGIN_OFF), config }),
    command: (command) => this.show.handle(command),
    publishStatus: (id, status) => this.broadcast(IPC.pluginStatus, [id, status]),
    mediaFile: (file) => {
      const location = locateMedia(mediaUrl(file), {
        current: () => this.quizDir,
        isRecent: () => false
      })
      return 'file' in location ? location.file : null
    }
  })

  constructor(
    private readonly settings: Settings,
    /** Waar nieuwe en geïmporteerde quizzen komen (standaard Documenten/QuizNote). */
    readonly libraryDir: string,
    /** Anoniem meten; null = uit voor deze build (ontwikkelen en tests). */
    readonly analytics: Analytics | null = null,
    /** Oudere bibliotheekmappen (Documenten/Pubquizzen): alleen nog lezen, er komt niets nieuws in. */
    readonly legacyLibraryDirs: readonly string[] = []
  ) {
    this.screens.watch((change, display) => this.onDisplayChange(change, display))
    this.plugins.apply(settings.plugins, null, this.show.current)
  }

  get mediaRoot(): string | null {
    return this.quizDir
  }

  isRecent(dir: string): boolean {
    return this.settings.recent.includes(dir)
  }

  /** Meldingen in de taal van de app. */
  private get t() {
    return NOTICE_MESSAGES.in(appLocale())
  }

  private get dialogText() {
    return DIALOG_MESSAGES.in(appLocale())
  }

  private failed(err: unknown): string {
    return errorText(err, appLocale())
  }

  get windowTitle(): string {
    return this.quiz ? `${this.quiz.title} — QuizNote` : 'QuizNote'
  }

  get live(): boolean {
    return this.show.current.live
  }

  /** De geopende quiz, voor de AI-koppeling (src/main/agent.ts). */
  get current(): { quiz: Quiz; dir: string } | null {
    return this.quiz && this.quizDir ? { quiz: this.quiz, dir: this.quizDir } : null
  }

  get recentDirs(): string[] {
    return this.settings.recent
  }

  /** Op het dashboard zetten zonder te openen. */
  remember(dir: string): void {
    this.settings.addRecent(dir)
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
      plugins: this.settings.plugins,
      pluginStatus: this.plugins.statuses(),
      analytics: this.analytics ? this.settings.analyticsConsent : false,
      dirty: this.saves.dirty
    }
  }

  // ── Quizbestanden ────────────────────────────────────────────────────────────

  async openQuiz(path: string): Promise<void> {
    const dir = basename(path) === 'quiz.json' ? dirname(path) : path
    if (!(await isQuizDir(dir))) {
      this.settings.removeRecent(dir)
      this.notify('error', this.t('noQuizIn', { dir }))
      return
    }
    let quiz: Quiz
    try {
      quiz = await readQuiz(dir)
    } catch (err) {
      this.notify('error', this.t('openFailed', { error: this.failed(err) }))
      return
    }
    if (this.live) await this.stopShow()
    await this.flushSave()

    this.quiz = quiz
    this.quizDir = dir
    this.saves.clean()
    this.hardware = this.settings.mappingFor(quiz, listDisplays())
    this.settings.addRecent(dir)
    if (this.recovery && this.recovery.quizDir !== dir) this.recovery = null

    this.broadcast(IPC.quiz, [quiz, dir])
    this.broadcast(IPC.hardware, [this.hardware])
    this.operator?.setTitle(this.windowTitle)

    const missing = await findMissingMedia(dir, quiz)
    if (missing.length > 0) {
      this.notify('warning', this.t('missingMedia', { files: missing.slice(0, 5).join(', ') }))
    }
  }

  /**
   * Nieuwe quiz in de bibliotheekmap (Documenten/QuizNote); de map krijgt de naam van de quiz.
   * Geeft een foutmelding voor in het dialoogvenster terug, of null als het gelukt is.
   */
  async createNamedQuiz(
    name: string,
    template?: { source: string; options: TemplateOptions }
  ): Promise<string | null> {
    const title = name.trim()
    const folder = folderNameFor(title)
    if (!folder) return this.t('nameQuiz')
    if (template?.source === this.quizDir) await this.flushSave()
    try {
      await fs.mkdir(this.libraryDir, { recursive: true })
      const path = join(this.libraryDir, folder)
      const { dir } = template
        ? await createQuizFromTemplate(template.source, path, template.options, title)
        : await createQuizDir(path, title, appLocale())
      await this.openQuiz(dir)
      return null
    } catch (err) {
      return this.failed(err)
    }
  }

  async promptOpenQuiz(): Promise<void> {
    const result = await dialog.showOpenDialog(this.operator!, {
      title: this.dialogText('openTitle'),
      buttonLabel: this.dialogText('openButton'),
      message: this.dialogText('openMessage', { ext: QUIZ_EXT }),
      properties: ['openDirectory', 'openFile', 'treatPackageAsDirectory']
    })
    const path = result.filePaths[0]
    if (!result.canceled && path) await this.openQuiz(path)
  }

  async promptImportZip(): Promise<void> {
    const source = await dialog.showOpenDialog(this.operator!, {
      title: this.dialogText('importZipTitle'),
      filters: [{ name: 'Zip', extensions: ['zip'] }],
      properties: ['openFile']
    })
    const zip = source.filePaths[0]
    if (source.canceled || !zip) return
    try {
      await fs.mkdir(this.libraryDir, { recursive: true })
      await this.openQuiz(await importZip(zip, this.libraryDir))
    } catch (err) {
      this.notify('error', this.t('importFailed', { error: this.failed(err) }))
    }
  }

  async promptExportZip(): Promise<void> {
    if (!this.quizDir) return
    await this.flushSave()
    const result = await dialog.showSaveDialog(this.operator!, {
      title: this.dialogText('exportZipTitle'),
      defaultPath: `${quizBaseName(this.quizDir)}.zip`,
      filters: [{ name: 'Zip', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return
    try {
      await exportZip(this.quizDir, result.filePath)
      this.notify('info', this.t('exported', { file: basename(result.filePath) }))
    } catch (err) {
      this.notify('error', this.t('exportFailed', { error: this.failed(err) }))
    }
  }

  /** Antwoordformulier of antwoorden als pdf; standaard in Downloads, daarna open in Voorvertoning. */
  async exportForm(options: FormOptions): Promise<void> {
    if (!this.quiz) return
    const name = formFileName(this.quiz, options.doc, appLocale())
    // Voor tests: zonder dialoog in een vaste map.
    const fixedDir = process.env['PUBQUIZ_SAVE_DIR']
    let target = fixedDir ? join(fixedDir, name) : null
    if (!target) {
      const result = await dialog.showSaveDialog(this.operator!, {
        title: this.dialogText('savePdfTitle'),
        defaultPath: join(app.getPath('downloads'), name),
        filters: [{ name: 'Pdf', extensions: ['pdf'] }]
      })
      if (result.canceled || !result.filePath) return
      target = result.filePath
    }
    try {
      await fs.writeFile(target, await renderFormPdf(options))
      this.notify('info', this.t('saved', { file: basename(target) }))
      if (!headless) void shell.openPath(target)
    } catch (err) {
      this.notify('error', this.t('pdfFailed', { error: this.failed(err) }))
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
      this.notify('warning', this.t('stopShowFirst'))
      return
    }
    await this.flushSave()
    this.quiz = null
    this.quizDir = null
    this.saves.clean()
    this.hardware = { screens: {}, audio: {}, screenSound: {} }
    this.broadcast(IPC.quiz, [null, null])
    this.broadcast(IPC.hardware, [this.hardware])
    this.operator?.setTitle(this.windowTitle)
  }

  recentQuizzes(): Promise<RecentQuiz[]> {
    return Promise.all(
      this.settings.recent.map(async (dir) => ({
        ...(await summarizeQuiz(dir)),
        tour: dir === this.settings.tourDir
      }))
    )
  }

  /**
   * Eerste start: de meegeleverde rondleiding (in de taal van de app) naar de bibliotheek kopiëren
   * en op het dashboard zetten. Eén keer: wie hem uit de lijst haalt, krijgt hem niet terug.
   */
  async installTour(source: string | null): Promise<void> {
    if (!source || this.settings.tourDir !== null || !(await isQuizDir(source))) return
    const target = join(this.libraryDir, `${TOUR_MESSAGES.in(appLocale())('folder')}${QUIZ_EXT}`)
    try {
      if (!(await isQuizDir(target))) {
        await fs.mkdir(this.libraryDir, { recursive: true })
        await fs.cp(source, target, {
          recursive: true,
          errorOnExist: true,
          force: false,
          preserveTimestamps: true
        })
      }
      this.settings.setTour(target, source)
    } catch (err) {
      console.error('Rondleiding klaarzetten mislukt', err)
    }
  }

  removeRecent(path: string): void {
    this.settings.removeRecent(path)
  }

  /** Ronde importeren… in de editor (issue #99): leest een rondebestand voor de werkkopie `input`. */
  async importRounds(input: unknown, at: number, path?: string): Promise<RoundImport | null> {
    const parsed = QuizSchema.safeParse(input)
    if (!this.quizDir || !parsed.success || !Number.isInteger(at)) return null
    let source = path
    if (!source) {
      const result = await dialog.showOpenDialog(this.operator!, {
        title: this.dialogText('importRoundsTitle'),
        filters: [
          { name: this.dialogText('roundFileFilter'), extensions: [ROUND_FILE_EXT.slice(1)] }
        ],
        properties: ['openFile']
      })
      if (result.canceled || !result.filePaths[0]) return null
      source = result.filePaths[0]
    }
    try {
      return await readRoundFile(source, this.quizDir, parsed.data, at, appLocale())
    } catch (err) {
      this.notify('error', this.t('importFailed', { error: this.failed(err) }))
      return null
    }
  }

  /**
   * Een rondebestand uit Finder (dubbelklik): de editor importeert het in de open quiz. Is er geen
   * quiz open, dan vraagt de app eerst in welke. De editor haalt het op met `takeRoundFiles`.
   */
  async openRoundFile(path: string): Promise<void> {
    if (!this.quizDir) {
      const result = await dialog.showOpenDialog(this.operator!, {
        title: this.dialogText('importRoundsTitle'),
        message: this.dialogText('chooseQuizForRound', { file: basename(path) }),
        buttonLabel: this.dialogText('openButton'),
        defaultPath: this.libraryDir,
        properties: ['openDirectory', 'openFile', 'treatPackageAsDirectory']
      })
      const dir = result.filePaths[0]
      if (result.canceled || !dir) return
      await this.openQuiz(dir)
      if (!this.quizDir) return
    }
    this.roundFiles.push(path)
    this.operator?.webContents.send(IPC.roundFiles)
  }

  /**
   * De link vanaf de site: `quiznote://ronde?url=https://quiznote.app/…`. Haalt het rondebestand
   * op en importeert het daarna net als een bestand uit Finder. Andere adressen weigert hij.
   */
  async openRoundLink(link: string): Promise<void> {
    try {
      const origin = process.env['PUBQUIZ_ROUND_LINK_ORIGIN'] || ROUND_LINK_ORIGIN
      const source = roundLinkSource(link, origin)
      if (!source) throw new NoticeError('badRoundLink')
      await this.openRoundFile(await downloadRoundFile(source, origin))
    } catch (err) {
      this.notify('error', this.failed(err))
    }
  }

  takeRoundFiles(): string[] {
    const files = this.roundFiles
    this.roundFiles = []
    return files
  }

  async importMedia(paths: string[] | undefined) {
    if (!this.quizDir) return { assets: [], skipped: [], folders: [] }
    let sources = paths
    if (!sources) {
      const result = await dialog.showOpenDialog(this.operator!, {
        title: this.dialogText('importMediaTitle'),
        message: this.dialogText('importMediaMessage'),
        buttonLabel: this.dialogText('importMediaButton'),
        properties: ['openFile', 'openDirectory', 'multiSelections'],
        filters: [
          {
            name: this.dialogText('mediaFilter'),
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
      this.notify('warning', this.t('notImported', { files: result.skipped.join(', ') }))
    }
    return result
  }

  /** Wijziging vanuit de editor. De afzender krijgt hem niet terug, anders overschrijven we lopende invoer. */
  updateQuiz(input: Quiz, senderId: number): void {
    if (!this.quiz || !this.quizDir) return
    const parsed = QuizSchema.safeParse(input)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      this.notify(
        'error',
        this.t('invalidChange', { path: issue?.path.join('.') ?? '', error: issue?.message ?? '' })
      )
      return
    }
    const previous = this.quiz
    this.quiz = parsed.data
    this.saves.changed()
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
    if (!this.quiz || !this.quizDir) return
    try {
      // Pas lezen als deze opslag aan de beurt is: dan gaat altijd de nieuwste versie naar schijf.
      // Een wijziging die binnenkomt terwijl er geschreven wordt, blijft staan voor de volgende.
      const saved = await this.saves.flush(() =>
        this.quiz && this.quizDir ? writeQuiz(this.quizDir, this.quiz) : Promise.resolve()
      )
      if (saved) this.broadcast(IPC.saved, [false])
    } catch (err) {
      this.notify('error', this.t('saveFailed', { error: this.failed(err) }))
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
    this.analytics?.capture('show_started', {
      resumed: Boolean(restore),
      ...quizShape(this.quiz),
      plugins: PLUGINS.filter((p) => this.settings.plugins[p.id]?.enabled).map((p) => p.id)
    })
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

  /** Toestemming voor anoniem meten, gegeven of ingetrokken. */
  setAnalytics(consent: boolean): void {
    if (!this.analytics) return
    this.settings.setAnalytics(consent)
    if (!consent) this.analytics.clear()
  }

  setPlugin(id: PluginId, setting: PluginSetting): void {
    if (!PLUGINS.some((p) => p.id === id)) return
    this.settings.setPlugin(id, setting)
    this.broadcast(IPC.plugins, [this.settings.plugins])
    this.plugins.apply(this.settings.plugins, this.quiz, this.show.current)
  }

  audioEvent(event: AudioEngineEvent): void {
    if (event.type === 'error') this.notify('error', this.t('audioError', { error: event.message }))
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
        this.notify('warning', this.t('screenMissing', { name: slot.name }))
      }
    }
  }

  private onState(state: ShowState): void {
    this.broadcast(IPC.state, [state])
    this.plugins.update(this.quiz, state)
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
    const name = display.label || this.t('displayName', { id: display.id })
    if (change === 'removed') this.notify('warning', this.t('displayRemoved', { name }))
    if (change === 'added') this.notify('info', this.t('displayAdded', { name }))
    if (this.live) this.syncScreens(false)
  }
}
