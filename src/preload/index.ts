import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC, type PubquizApi } from '@shared/ipc'

function subscribe<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, ...args: unknown[]) => cb(...(args as T))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: PubquizApi = {
  snapshot: () => ipcRenderer.invoke(IPC.snapshot),
  createQuiz: (name, template) => ipcRenderer.invoke(IPC.createQuiz, name, template),
  openQuiz: (path) => ipcRenderer.invoke(IPC.openQuiz, path),
  importZip: () => ipcRenderer.invoke(IPC.importZip),
  exportZip: () => ipcRenderer.invoke(IPC.exportZip),
  exportForm: (options) => ipcRenderer.invoke(IPC.exportForm, options),
  revealQuiz: (path) => ipcRenderer.invoke(IPC.revealQuiz, path),
  closeQuiz: () => ipcRenderer.invoke(IPC.closeQuiz),
  recentQuizzes: () => ipcRenderer.invoke(IPC.recentQuizzes),
  aiSetup: () => ipcRenderer.invoke(IPC.aiSetup),
  connectClaude: () => ipcRenderer.invoke(IPC.connectClaude),
  copyText: (text) => ipcRenderer.send(IPC.copyText, text),
  quitConfirmed: () => ipcRenderer.send(IPC.quitConfirmed),
  onConfirmQuit: (cb) => subscribe(IPC.confirmQuit, cb),
  removeRecent: (path) => ipcRenderer.invoke(IPC.removeRecent, path),
  updateQuiz: (quiz) => ipcRenderer.send(IPC.updateQuiz, quiz),
  importMedia: (paths) => ipcRenderer.invoke(IPC.importMedia, paths),
  pathForFile: (file) => webUtils.getPathForFile(file),

  command: (command) => ipcRenderer.send(IPC.command, command),
  startShow: (resume) => ipcRenderer.invoke(IPC.startShow, resume),
  stopShow: () => ipcRenderer.invoke(IPC.stopShow),
  setHardware: (mapping) => ipcRenderer.invoke(IPC.setHardware, mapping),
  identifyDisplays: () => ipcRenderer.invoke(IPC.identifyDisplays),
  openAirPlaySettings: (kind) => ipcRenderer.invoke(IPC.openAirPlaySettings, kind),
  testTone: (channelId) => ipcRenderer.send(IPC.testTone, channelId),
  dismissRecovery: () => ipcRenderer.send(IPC.dismissRecovery),
  setPlugin: (id, setting) => ipcRenderer.invoke(IPC.setPlugin, id, setting),
  pluginAct: (id, name, input) => ipcRenderer.invoke(IPC.pluginAct, id, name, input),

  setAnalytics: (consent) => ipcRenderer.invoke(IPC.setAnalytics, consent),
  reportError: (report) => ipcRenderer.send(IPC.reportError, report),

  audioEvent: (event) => ipcRenderer.send(IPC.audioEvent, event),
  onAudioCommand: (cb) => subscribe(IPC.audioCommand, cb),

  onQuiz: (cb) => subscribe(IPC.quiz, cb),
  onState: (cb) => subscribe(IPC.state, cb),
  onHardware: (cb) => subscribe(IPC.hardware, cb),
  onDisplays: (cb) => subscribe(IPC.displays, cb),
  onAirPlay: (cb) => subscribe(IPC.airplay, cb),
  onPlugins: (cb) => subscribe(IPC.plugins, cb),
  onPluginStatus: (cb) => subscribe(IPC.pluginStatus, cb),
  onNotice: (cb) => subscribe(IPC.notice, cb),
  onSaved: (cb) => subscribe(IPC.saved, cb),
  onMenu: (cb) => subscribe(IPC.menu, cb)
}

contextBridge.exposeInMainWorld('pubquiz', api)
