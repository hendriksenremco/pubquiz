import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { createShowState } from '@shared/factory'
import type { AirPlayDevice } from '@shared/airplay'
import type { RecoveryInfo } from '@shared/ipc'
import {
  pluginEnabled,
  type PluginId,
  type PluginSetting,
  type PluginSettings
} from '@shared/plugins'
import type { DisplayInfo, HardwareMapping, Notice, Quiz, ShowState } from '@shared/types'
import { probeDuration } from '../lib/media'

const api = window.pubquiz
const SYNC_DELAY_MS = 250
const MAX_HISTORY = 100

/**
 * Spiegel van de main-state in elk venster. In het operator-venster is `quiz` bovendien
 * de werkkopie van de editor: wijzigingen gaan (gedebounced) terug naar main, met undo/redo.
 */
export const useSession = defineStore('session', () => {
  const quiz = ref<Quiz | null>(null)
  const quizDir = ref<string | null>(null)
  const state = shallowRef<ShowState>(createShowState())
  const hardware = shallowRef<HardwareMapping>({ screens: {}, audio: {}, screenSound: {} })
  const displays = shallowRef<DisplayInfo[]>([])
  const recent = ref<string[]>([])
  const recovery = ref<RecoveryInfo | null>(null)
  const dirty = ref(false)
  const libraryDir = ref('')
  const airplay = shallowRef<AirPlayDevice[]>([])
  const plugins = shallowRef<PluginSettings>({})
  const notices = ref<Notice[]>([])
  const ready = ref(false)

  const live = computed(() => state.value.live)

  // ── Editor-sync en geschiedenis ──────────────────────────────────────────────
  let editable = false
  let committed = 'null'
  let syncTimer: ReturnType<typeof setTimeout> | null = null
  const undoStack = ref<string[]>([])
  const redoStack = ref<string[]>([])

  function applyRemoteQuiz(next: Quiz | null, dir: string | null) {
    committed = JSON.stringify(next)
    quiz.value = next
    if (dir !== quizDir.value) {
      undoStack.value = []
      redoStack.value = []
    }
    quizDir.value = dir
  }

  function flush() {
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = null
    if (!quiz.value) return
    const json = JSON.stringify(quiz.value)
    if (json === committed) return
    undoStack.value = [...undoStack.value, committed].slice(-MAX_HISTORY)
    redoStack.value = []
    committed = json
    api.updateQuiz(JSON.parse(json))
  }

  function restore(json: string) {
    committed = json
    quiz.value = JSON.parse(json)
    api.updateQuiz(JSON.parse(json))
  }

  function undo() {
    flush()
    const previous = undoStack.value.at(-1)
    if (!previous) return
    undoStack.value = undoStack.value.slice(0, -1)
    redoStack.value = [...redoStack.value, committed]
    restore(previous)
  }

  function redo() {
    flush()
    const next = redoStack.value.at(-1)
    if (!next) return
    redoStack.value = redoStack.value.slice(0, -1)
    undoStack.value = [...undoStack.value, committed]
    restore(next)
  }

  watch(
    quiz,
    () => {
      if (!editable || JSON.stringify(quiz.value) === committed) return
      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(flush, SYNC_DELAY_MS)
    },
    { deep: true }
  )

  /** Wijziging die geen stap in de geschiedenis is (zoals een gemeten duur): meteen naar main. */
  function patchQuietly(change: (quiz: Quiz) => void) {
    if (!quiz.value) return
    const clean = JSON.stringify(quiz.value) === committed
    change(quiz.value)
    // Loopt er een eigen wijziging, dan gaat dit daarmee mee.
    if (!clean) return
    committed = JSON.stringify(quiz.value)
    api.updateQuiz(JSON.parse(committed))
  }

  // Video en geluid zonder duur (net geïmporteerd, ook door een AI) alsnog meten: Media en de
  // fragmenten tonen hem, en een fragment zonder eindtijd speelt tot het einde.
  const measured = new Set<string>()
  watch(
    () =>
      quiz.value?.assets.filter(
        (a) => a.kind !== 'image' && a.duration === undefined && !measured.has(a.id)
      ) ?? [],
    (assets) => {
      // Alleen in het operator-venster; de andere vensters spiegelen alleen.
      if (!editable) return
      for (const asset of assets) {
        measured.add(asset.id)
        void probeDuration(asset).then((duration) => {
          if (duration === null) return
          patchQuietly((q) => {
            const target = q.assets.find((a) => a.id === asset.id)
            if (target) target.duration = Math.round(duration * 100) / 100
          })
        })
      }
    }
  )

  // ── Meldingen ───────────────────────────────────────────────────────────────
  function notify(notice: Omit<Notice, 'id'> & { id?: string }) {
    const full = { id: notice.id ?? crypto.randomUUID(), ...notice }
    notices.value = [...notices.value.filter((n) => n.message !== full.message), full].slice(-5)
    const ttl = full.level === 'error' ? 12_000 : 6_000
    setTimeout(() => dismiss(full.id), ttl)
  }

  function dismiss(id: string) {
    notices.value = notices.value.filter((n) => n.id !== id)
  }

  // ── Plug-ins ────────────────────────────────────────────────────────────────
  const pluginOn = (id: PluginId) => pluginEnabled(plugins.value, id)

  function setPlugin(id: PluginId, setting: PluginSetting) {
    plugins.value = { ...plugins.value, [id]: setting }
    void api.setPlugin(id, JSON.parse(JSON.stringify(setting)))
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  async function init(options: { editable?: boolean } = {}) {
    editable = options.editable ?? false
    const snap = await api.snapshot()
    applyRemoteQuiz(snap.quiz, snap.quizDir)
    state.value = snap.state
    hardware.value = snap.hardware
    displays.value = snap.displays
    recent.value = snap.recent
    recovery.value = snap.recovery
    dirty.value = snap.dirty
    libraryDir.value = snap.libraryDir
    airplay.value = snap.airplay
    plugins.value = snap.plugins

    api.onQuiz((q, dir) => {
      applyRemoteQuiz(q, dir)
      if (dir && !recent.value.includes(dir)) recent.value = [dir, ...recent.value]
      if (recovery.value && recovery.value.quizDir !== dir) recovery.value = null
    })
    api.onState((s) => (state.value = s))
    api.onHardware((h) => (hardware.value = h))
    api.onDisplays((d) => (displays.value = d))
    api.onAirPlay((d) => (airplay.value = d))
    api.onPlugins((p) => (plugins.value = p))
    api.onSaved((d) => (dirty.value = d))
    api.onNotice((n) => notify(n))
    ready.value = true
  }

  return {
    quiz,
    quizDir,
    state,
    hardware,
    displays,
    recent,
    recovery,
    dirty,
    libraryDir,
    airplay,
    plugins,
    notices,
    ready,
    live,
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0),
    init,
    flush,
    undo,
    redo,
    notify,
    dismiss,
    pluginOn,
    setPlugin
  }
})
