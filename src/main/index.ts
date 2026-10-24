import { app, BrowserWindow, dialog, ipcMain, session } from 'electron'
import { join } from 'path'
import { IPC, type AudioEngineEvent, type ShowCommand } from '@shared/ipc'
import type { TemplateOptions } from '@shared/template'
import type { FormOptions } from '@shared/forms'
import type { HardwareMapping, Quiz } from '@shared/types'
import { AppController } from './controller'
import { handleMediaProtocol, registerMediaScheme } from './media-protocol'
import { buildMenu } from './menu'
import { configurePermissions } from './permissions'
import { QUIZ_EXT } from './quiz-files'
import { Settings } from './settings'
import { createAudioWindow, createOperatorWindow, headless } from './windows'

registerMediaScheme()

// Voor e2e-tests: eigen instellingenmap en geen geluid uit de speakers.
if (process.env['PUBQUIZ_USER_DATA']) app.setPath('userData', process.env['PUBQUIZ_USER_DATA'])
if (process.env['PUBQUIZ_MUTE']) app.commandLine.appendSwitch('mute-audio')

// macOS kan een .pubquiz openen vóór `ready`; bewaar het pad tot de controller er is.
let pendingOpen: string | null =
  process.argv.find((arg) => arg.endsWith(QUIZ_EXT) || arg.endsWith(`${QUIZ_EXT}/`)) ?? null
let controller: AppController | null = null

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (controller) void controller.openQuiz(path)
  else pendingOpen = path
})

if (!app.requestSingleInstanceLock()) app.quit()

app.whenReady().then(async () => {
  // Headless (tests): geen Dock-icoon en nooit de focus afpakken.
  if (headless && process.platform === 'darwin') app.setActivationPolicy('accessory')
  configurePermissions(session.defaultSession, process.env['ELECTRON_RENDERER_URL'])

  const settings = await Settings.load(app.getPath('userData'))
  // PUBQUIZ_LIBRARY: voor tests, zodat er niets in Documenten belandt.
  // Niet "Pubquiz": macOS negeert hoofdletters, dus dat zou dezelfde map zijn als de broncode in
  // Documenten/pubquiz, en nieuwe quizzen zouden dan in de repo (en in de build) belanden.
  const library = process.env['PUBQUIZ_LIBRARY'] ?? join(app.getPath('documents'), 'Pubquizzen')
  const ctl = new AppController(settings, library)
  controller = ctl
  handleMediaProtocol({ current: () => ctl.mediaRoot, isRecent: (dir) => ctl.isRecent(dir) })
  registerIpc(ctl)
  buildMenu(ctl)
  ctl.airplay.start()

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
  operator.on('close', (event) => {
    // Headless (tests) is er niemand om de vraag te beantwoorden.
    if (!ctl.live || headless) return
    const choice = dialog.showMessageBoxSync(operator, {
      type: 'warning',
      message: 'De show loopt nog. Wil je echt afsluiten?',
      buttons: ['Annuleer', 'Afsluiten'],
      defaultId: 0,
      cancelId: 0
    })
    if (choice === 0) event.preventDefault()
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
  void ctl.flushSave().finally(() => app.quit())
})

app.on('window-all-closed', () => app.quit())

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
  ipcMain.on(IPC.audioEvent, (_e, event: AudioEngineEvent) => ctl.audioEvent(event))
}

app.on('second-instance', () => {
  const win = controller?.operator ?? BrowserWindow.getAllWindows()[0]
  if (win?.isMinimized()) win.restore()
  win?.focus()
})
