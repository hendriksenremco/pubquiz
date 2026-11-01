import { app, BrowserWindow, clipboard, ipcMain, session } from 'electron'
import { join } from 'path'
import type { ErrorReport } from '@shared/analytics'
import { IPC, type AudioEngineEvent, type ShowCommand } from '@shared/ipc'
import type { TemplateOptions } from '@shared/template'
import type { FormOptions } from '@shared/forms'
import type { PluginId, PluginSetting } from '@shared/plugins'
import type { HardwareMapping, Quiz } from '@shared/types'
import { aboutPanelOptions } from './about'
import { AgentBridge, aiSetup, connectClaude, handleAgent } from './agent'
import { Analytics } from './analytics'
import { AppController } from './controller'
import { handleMediaProtocol, registerMediaScheme } from './media-protocol'
import { buildMenu } from './menu'
import { configurePermissions } from './permissions'
import { QUIZ_EXT } from './quiz-files'
import { adoptSettings, Settings } from './settings'
import { createAudioWindow, createOperatorWindow, headless } from './windows'

registerMediaScheme()

// Voor e2e-tests: eigen instellingenmap en geen geluid uit de speakers.
if (process.env['PUBQUIZ_USER_DATA']) app.setPath('userData', process.env['PUBQUIZ_USER_DATA'])
if (process.env['PUBQUIZ_MUTE']) app.commandLine.appendSwitch('mute-audio')

// macOS kan een .pubquiz openen vóór `ready`; bewaar het pad tot de controller er is.
let pendingOpen: string | null =
  process.argv.find((arg) => arg.endsWith(QUIZ_EXT) || arg.endsWith(`${QUIZ_EXT}/`)) ?? null
let controller: AppController | null = null
let bridge: AgentBridge | null = null
let quitConfirmed = false

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (controller) void controller.openQuiz(path)
  else pendingOpen = path
})

if (!app.requestSingleInstanceLock()) app.quit()

/**
 * De meegeleverde rondleiding: in de app (electron-builder extraResources), of tijdens het
 * ontwikkelen die uit `pnpm tour`. PUBQUIZ_TOUR: voor tests; leeg = geen rondleiding.
 */
function tourSource(): string | null {
  const override = process.env['PUBQUIZ_TOUR']
  if (override !== undefined) return override || null
  return app.isPackaged
    ? join(process.resourcesPath, 'Rondleiding.pubquiz')
    : join(__dirname, '../../fixtures/rondleiding.pubquiz')
}

app.whenReady().then(async () => {
  // Headless (tests): geen Dock-icoon en nooit de focus afpakken.
  if (headless && process.platform === 'darwin') app.setActivationPolicy('accessory')
  // Tijdens het ontwikkelen draait de Electron-binary en toont de Dock diens icoon; de gebouwde app
  // haalt het icoon uit build/icon.icns.
  else if (!app.isPackaged) app.dock?.setIcon(join(__dirname, '../../resources/icon.png'))
  configurePermissions(session.defaultSession, process.env['ELECTRON_RENDERER_URL'])

  // De app heette eerst Pubquiz en daarna even Quizmeister; zijn instellingen verhuizen één keer mee.
  if (!process.env['PUBQUIZ_USER_DATA']) {
    const appData = app.getPath('appData')
    await adoptSettings(
      [join(appData, 'Quizmeister'), join(appData, 'Pubquiz')],
      app.getPath('userData')
    )
  }
  const settings = await Settings.load(app.getPath('userData'))
  // PUBQUIZ_LIBRARY: voor tests, zodat er niets in Documenten belandt.
  // Niet "Pubquiz": macOS negeert hoofdletters, dus dat zou dezelfde map zijn als de broncode in
  // Documenten/pubquiz, en nieuwe quizzen zouden dan in de repo (en in de build) belanden.
  const library = process.env['PUBQUIZ_LIBRARY'] ?? join(app.getPath('documents'), 'Pubquizzen')
  const analytics = measuring() ? createAnalytics(settings) : null
  const ctl = new AppController(settings, library, analytics)
  controller = ctl
  handleMediaProtocol({ current: () => ctl.mediaRoot, isRecent: (dir) => ctl.isRecent(dir) })
  registerIpc(ctl)
  app.setAboutPanelOptions(aboutPanelOptions(app.name, app.getVersion()))
  buildMenu(ctl)
  // AI-assistenten praten via de MCP-server (src/mcp) over deze socket met de app.
  bridge = new AgentBridge(join(app.getPath('userData'), 'mcp.sock'), (tool, input) =>
    handleAgent(ctl, tool, input)
  )
  await bridge.start().catch((err) => console.error('AI-koppeling starten mislukt', err))
  ctl.airplay.start()

  await ctl.installTour(tourSource())

  // Eerst de quiz (en een eventuele afgebroken show) laden, zodat de vensters bij hun eerste
  // snapshot meteen alles hebben. Zonder bestand of herstel start de app op het dashboard.
  const recovered = await ctl.loadRecovery()
  const toOpen = pendingOpen ?? recovered
  pendingOpen = null
  if (toOpen) await ctl.openQuiz(toOpen)

  ctl.audio = createAudioWindow()
  ctl.audio.webContents.on('render-process-gone', () => {
    ctl.notify('error', 'De audio-engine is gecrasht en wordt herstart')
    ctl.audio?.webContents.reload()
  })

  const operator = createOperatorWindow(ctl.windowTitle)
  ctl.operator = operator
  // Tijdens een show eerst vragen, in de app zelf (zie OperatorApp). Headless (tests) is er
  // niemand om te antwoorden.
  operator.on('close', (event) => {
    if (!ctl.live || headless || quitConfirmed) return
    event.preventDefault()
    operator.show()
    operator.webContents.send(IPC.confirmQuit)
  })
  ipcMain.on(IPC.quitConfirmed, () => {
    quitConfirmed = true
    operator.close()
  })
  operator.on('closed', () => {
    ctl.operator = null
    app.quit()
  })
})

let quitting = false
app.on('before-quit', (event) => {
  if (quitting || !controller) return
  event.preventDefault()
  quitting = true
  const ctl = controller
  ctl.screens.closeAll()
  ctl.airplay.stop()
  ctl.plugins.stop()
  ctl.analytics?.stop()
  bridge?.stop()
  void Promise.all([ctl.flushSave(), ctl.analytics?.whenSaved()]).finally(() => app.quit())
})

app.on('window-all-closed', () => app.quit())

/**
 * Anoniem meten (issue #40) alleen in de gebouwde app: niet tijdens het ontwikkelen en nooit in
 * tests (die zetten PUBQUIZ_USER_DATA). PUBQUIZ_NO_ANALYTICS zet het ook uit.
 */
function measuring(): boolean {
  return (
    app.isPackaged &&
    !headless &&
    !process.env['PUBQUIZ_USER_DATA'] &&
    !process.env['PUBQUIZ_NO_ANALYTICS']
  )
}

function createAnalytics(settings: Settings): Analytics {
  const analytics = new Analytics({
    dir: app.getPath('userData'),
    identity: () => settings.analyticsId,
    base: {
      app_version: app.getVersion(),
      os_version: process.getSystemVersion(),
      // arm64 = Apple Silicon, x64 = Intel.
      arch: process.arch,
      $lib: 'quiznote'
    }
  })
  // Alleen meekijken: het gedrag bij een fout (melding van Electron) blijft hetzelfde.
  process.on('uncaughtExceptionMonitor', (err) => analytics.captureError(asReport(err), 'main'))
  process.on('unhandledRejection', (reason) => {
    console.error('Onverwerkte fout', reason)
    analytics.captureError(asReport(reason), 'main')
  })
  analytics.capture('app_started')
  void analytics.flush()
  return analytics
}

function asReport(value: unknown): ErrorReport {
  if (value instanceof Error)
    return { name: value.name, message: value.message, stack: value.stack }
  return { name: 'Error', message: String(value) }
}

/** Een foutrapport uit een venster: alleen tekst, en niet te lang. */
function reportFrom(input: unknown): ErrorReport | null {
  if (typeof input !== 'object' || input === null) return null
  const { name, message, stack } = input as Record<string, unknown>
  if (typeof message !== 'string') return null
  return {
    name: typeof name === 'string' ? name.slice(0, 200) : 'Error',
    message: message.slice(0, 1000),
    ...(typeof stack === 'string' ? { stack: stack.slice(0, 8000) } : {})
  }
}

function registerIpc(ctl: AppController): void {
  ipcMain.handle(IPC.snapshot, () => ctl.snapshot())
  ipcMain.handle(
    IPC.createQuiz,
    (_e, name: string, template?: { source: string; options: TemplateOptions }) =>
      ctl.createNamedQuiz(name, template)
  )
  ipcMain.handle(IPC.openQuiz, (_e, path?: string) =>
    path ? ctl.openQuiz(path) : ctl.promptOpenQuiz()
  )
  ipcMain.handle(IPC.importZip, () => ctl.promptImportZip())
  ipcMain.handle(IPC.exportZip, () => ctl.promptExportZip())
  ipcMain.handle(IPC.exportForm, (_e, options: FormOptions) => ctl.exportForm(options))
  ipcMain.handle(IPC.revealQuiz, (_e, path?: string) => ctl.revealQuiz(path))
  ipcMain.handle(IPC.closeQuiz, () => ctl.closeQuiz())
  ipcMain.handle(IPC.recentQuizzes, () => ctl.recentQuizzes())
  ipcMain.handle(IPC.aiSetup, () => aiSetup())
  ipcMain.handle(IPC.connectClaude, () => connectClaude())
  ipcMain.on(IPC.copyText, (_e, text: string) => clipboard.writeText(text))
  ipcMain.handle(IPC.removeRecent, (_e, path: string) => ctl.removeRecent(path))
  ipcMain.handle(IPC.importMedia, (_e, paths?: string[]) => ctl.importMedia(paths))
  ipcMain.on(IPC.updateQuiz, (e, quiz: Quiz) => ctl.updateQuiz(quiz, e.sender.id))

  ipcMain.on(IPC.command, (_e, command: ShowCommand) => ctl.show.handle(command))
  ipcMain.handle(IPC.startShow, (_e, resume: boolean) => ctl.startShow(resume))
  ipcMain.handle(IPC.stopShow, () => ctl.stopShow())
  ipcMain.handle(IPC.setHardware, (_e, mapping: HardwareMapping) => ctl.setHardware(mapping))
  ipcMain.handle(IPC.identifyDisplays, () => ctl.screens.identify())
  ipcMain.handle(IPC.openAirPlaySettings, (_e, kind: 'screen' | 'audio') =>
    ctl.openAirPlaySettings(kind)
  )
  ipcMain.on(IPC.testTone, (_e, channelId: string) => ctl.testTone(channelId))
  ipcMain.on(IPC.dismissRecovery, () => ctl.dismissRecovery())
  ipcMain.handle(IPC.setPlugin, (_e, id: PluginId, setting: PluginSetting) =>
    ctl.setPlugin(id, setting)
  )
  ipcMain.handle(IPC.pluginAct, (_e, id: PluginId, name: string, input: unknown) =>
    ctl.plugins.act(id, name, input)
  )
  ipcMain.handle(IPC.setAnalytics, (_e, consent: unknown) => {
    if (typeof consent === 'boolean') ctl.setAnalytics(consent)
  })
  ipcMain.on(IPC.reportError, (_e, input: unknown) => {
    const report = reportFrom(input)
    if (report) ctl.analytics?.captureError(report, 'renderer')
  })
  ipcMain.on(IPC.audioEvent, (_e, event: AudioEngineEvent) => ctl.audioEvent(event))
}

app.on('second-instance', () => {
  const win = controller?.operator ?? BrowserWindow.getAllWindows()[0]
  if (win?.isMinimized()) win.restore()
  win?.focus()
})
