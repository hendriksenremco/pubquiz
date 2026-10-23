import type { AirPlayDevice } from './airplay'
import type { TemplateOptions } from './template'
import type { DisplayInfo, HardwareMapping, MediaAsset, Notice, Quiz, ShowState } from './types'

export type AutoplayAction = 'start' | 'stop' | 'skip' | 'pause' | 'resume'

export type ShowCommand =
  | { type: 'startRound'; roundId: string }
  | { type: 'endRound' }
  | { type: 'nextRound' }
  | { type: 'setSlide'; index: number }
  | { type: 'nextSlide' }
  | { type: 'prevSlide' }
  | { type: 'playFragment'; fragmentId: string }
  | { type: 'stopFragment' }
  | { type: 'autoplay'; action: AutoplayAction }
  /** Antwoordenronde: volgende/vorige stap, of stoppen. */
  | { type: 'answers'; action: 'next' | 'prev' | 'stop' }
  | { type: 'answerAt'; index: number }
  /** Slide-loop van de ronde pauzeren of laten doorgaan. */
  | { type: 'slideLoop'; paused: boolean }
  /** `id`: een audiokanaal of een scherm (videogeluid). */
  | { type: 'setVolume'; id: string; volume: number }
  | { type: 'toggleBackground' }
  | { type: 'blackout'; screenId?: string; on: boolean }
  | { type: 'stopAll' }
  | { type: 'resetPlayed' }

/** Meldingen van de audio-engine aan main. */
export type AudioEngineEvent =
  | { type: 'fragmentStarted'; key: string; duration: number }
  | { type: 'fragmentEnded'; key: string }
  | { type: 'error'; message: string; key?: string }

/** Opdrachten van main aan de audio-engine die niet uit de show-state volgen. */
export type AudioEngineCommand = { type: 'testTone'; channelId: string }

export interface Snapshot {
  quiz: Quiz | null
  quizDir: string | null
  state: ShowState
  hardware: HardwareMapping
  displays: DisplayInfo[]
  recent: string[]
  recovery: RecoveryInfo | null
  dirty: boolean
  libraryDir: string
  airplay: AirPlayDevice[]
}

export interface RecoveryInfo {
  quizDir: string
  roundTitle: string | null
  savedAt: number
}

/** Samenvatting van een recente quiz voor het home-dashboard. */
export interface RecentQuiz {
  path: string
  /** Map (of quiz.json) niet meer gevonden of onleesbaar. */
  exists: boolean
  title: string
  rounds: number
  screens: number
  /** Laatste wijziging van quiz.json (ms sinds epoch). */
  modifiedAt: number | null
  /** Beeld van het eerste scherm, als artwork. */
  cover: { kind: 'video' | 'image'; file: string } | null
}

export type MenuAction = 'new' | 'open' | 'exportZip' | 'importZip' | 'reveal' | 'undo' | 'redo'

export interface ImportResult {
  assets: MediaAsset[]
  skipped: string[]
  /** Geïmporteerde Finder-mappen, met de ids (uit `assets`) van hun bestanden op naam gesorteerd. */
  folders: { name: string; assetIds: string[] }[]
}

/** API die de preload op `window.pubquiz` zet. */
export interface PubquizApi {
  snapshot(): Promise<Snapshot>
  /** Maakt de quiz in de bibliotheekmap en opent hem; geeft een foutmelding of null terug. */
  createQuiz(
    name: string,
    template?: { source: string; options: TemplateOptions }
  ): Promise<string | null>
  openQuiz(path?: string): Promise<void>
  importZip(): Promise<void>
  exportZip(): Promise<void>
  revealQuiz(path?: string): Promise<void>
  closeQuiz(): Promise<void>
  recentQuizzes(): Promise<RecentQuiz[]>
  removeRecent(path: string): Promise<void>
  updateQuiz(quiz: Quiz): void
  importMedia(paths?: string[]): Promise<ImportResult>
  pathForFile(file: File): string

  command(command: ShowCommand): void
  startShow(resume: boolean): Promise<void>
  stopShow(): Promise<void>
  setHardware(mapping: HardwareMapping): Promise<void>
  identifyDisplays(): Promise<void>
  /** Opent de macOS-instellingen waar je een AirPlay-scherm of -speaker verbindt. */
  openAirPlaySettings(kind: 'screen' | 'audio'): Promise<void>
  testTone(channelId: string): void
  dismissRecovery(): void

  audioEvent(event: AudioEngineEvent): void
  onAudioCommand(cb: (command: AudioEngineCommand) => void): () => void

  onQuiz(cb: (quiz: Quiz | null, quizDir: string | null) => void): () => void
  onState(cb: (state: ShowState) => void): () => void
  onHardware(cb: (hardware: HardwareMapping) => void): () => void
  onDisplays(cb: (displays: DisplayInfo[]) => void): () => void
  onAirPlay(cb: (devices: AirPlayDevice[]) => void): () => void
  onNotice(cb: (notice: Notice) => void): () => void
  onSaved(cb: (dirty: boolean) => void): () => void
  onMenu(cb: (action: MenuAction) => void): () => void
}

export const IPC = {
  snapshot: 'pq:snapshot',
  createQuiz: 'pq:create-quiz',
  openQuiz: 'pq:open-quiz',
  importZip: 'pq:import-zip',
  exportZip: 'pq:export-zip',
  revealQuiz: 'pq:reveal-quiz',
  closeQuiz: 'pq:close-quiz',
  recentQuizzes: 'pq:recent-quizzes',
  removeRecent: 'pq:remove-recent',
  updateQuiz: 'pq:update-quiz',
  importMedia: 'pq:import-media',
  command: 'pq:command',
  startShow: 'pq:start-show',
  stopShow: 'pq:stop-show',
  setHardware: 'pq:set-hardware',
  identifyDisplays: 'pq:identify-displays',
  openAirPlaySettings: 'pq:open-airplay-settings',
  airplay: 'pq:airplay',
  testTone: 'pq:test-tone',
  dismissRecovery: 'pq:dismiss-recovery',
  audioEvent: 'pq:audio-event',
  audioCommand: 'pq:audio-command',
  quiz: 'pq:quiz',
  state: 'pq:state',
  hardware: 'pq:hardware',
  displays: 'pq:displays',
  notice: 'pq:notice',
  saved: 'pq:saved',
  menu: 'pq:menu'
} as const

export const MEDIA_SCHEME = 'pq-media'

const encodePath = (file: string) => file.split('/').map(encodeURIComponent).join('/')

/** URL waarmee renderers een bestand uit de geopende quizmap laden. */
export function mediaUrl(file: string): string {
  return `${MEDIA_SCHEME}://quiz/${encodePath(file)}`
}

/**
 * URL naar een bestand in een recente (niet geopende) quiz, voor previews op het dashboard.
 * De quizmap staat als één gecodeerd padsegment in de URL; main serveert alleen recente quizzen.
 */
export function recentMediaUrl(quizDir: string, file: string): string {
  return `${MEDIA_SCHEME}://recent/${encodeURIComponent(quizDir)}/${encodePath(file)}`
}
