<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MenuAction } from '@shared/ipc'
import ConfirmHost from '../../components/ConfirmHost.vue'
import Icon from '../../components/Icon.vue'
import NoticeStack from '../../components/NoticeStack.vue'
import { ask } from '../../lib/confirm'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import EditorView from '../editor/EditorView.vue'
import LiveControls from '../show/LiveControls.vue'
import ShowLive from '../show/ShowLive.vue'
import StartSheet from '../show/StartSheet.vue'
import HomeView from './HomeView.vue'
import AiDialog from './AiDialog.vue'
import NewQuizDialog from './NewQuizDialog.vue'
import SettingsDialog from './SettingsDialog.vue'
import { OPERATOR_MESSAGES } from './operator-messages'

const api = window.pubquiz
const session = useSession()
const t = OPERATOR_MESSAGES.in(locale)
/** Tijdens de show wissel je tussen de show en bewerken; daarbuiten is er alleen bewerken. */
const mode = ref<'edit' | 'show'>('edit')
/** Wat de editor toont: een ronde (id), 'setup', 'media' of 'print'; leeg = de eerste ronde. */
const page = ref('')
const starting = ref(false)

const title = computed(() => session.quiz?.title || t('untitled'))

const home = ref<InstanceType<typeof HomeView> | null>(null)

async function open(path?: string, openIn: 'edit' | 'show' = 'edit') {
  session.flush()
  mode.value = 'edit'
  await api.openQuiz(path)
  // Niet gelukt (bv. verplaatst): het dashboard toont de bijgewerkte lijst.
  if (!session.quiz) await home.value?.reload()
  else if (openIn === 'show') starting.value = true
}

/** Open dialoog voor een nieuwe quiz; `source` = "op basis van" die quiz. */
const newQuiz = ref<{ source: { path: string; title: string } | null } | null>(null)
const aiOpen = ref(false)
const settingsOpen = ref(false)

function create() {
  session.flush()
  mode.value = 'edit'
  newQuiz.value = { source: null }
}

function createFrom(path: string, title: string) {
  session.flush()
  mode.value = 'edit'
  newQuiz.value = { source: { path, title } }
}

function createFromCurrent() {
  if (session.quizDir && session.quiz) createFrom(session.quizDir, session.quiz.title)
}

async function goHome() {
  session.flush()
  await api.closeQuiz()
}

function togglePrint() {
  page.value = page.value === 'print' ? '' : 'print'
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

const actions: Record<MenuAction, () => void> = {
  new: () => void create(),
  open: () => void open(),
  importZip: () => void api.importZip(),
  exportZip: () => {
    session.flush()
    void api.exportZip()
  },
  reveal: () => void api.revealQuiz(),
  // In tekstvelden laat het menu ⌘Z aan het veld zelf.
  undo: () => (isEditable(document.activeElement) ? document.execCommand('undo') : session.undo()),
  redo: () => (isEditable(document.activeElement) ? document.execCommand('redo') : session.redo()),
  settings: () => (settingsOpen.value = true)
}

onMounted(async () => {
  await session.init({ editable: true })
  if (session.live) mode.value = 'show'
  api.onMenu((action) => actions[action]())
  // Afsluiten (⌘Q of het venster dicht) terwijl de show loopt.
  api.onConfirmQuit(async () => {
    const ok = await ask({
      title: t('quitTitle'),
      message: t('quitMessage'),
      confirm: t('quit'),
      danger: true
    })
    if (ok) api.quitConfirmed()
  })
})

// Komt de show live (ook via herstel), dan naar de show; stopt hij, dan terug naar bewerken.
watch(
  () => session.live,
  (live) => {
    mode.value = live ? 'show' : 'edit'
    if (live) starting.value = false
  }
)

// Een andere quiz: weer bij de eerste ronde beginnen.
watch(
  () => session.quizDir,
  () => (page.value = '')
)

// Een afgebroken show van deze quiz: meteen het venster om hem te hervatten.
watch(
  () => !!session.recovery && session.recovery.quizDir === session.quizDir && !!session.quiz,
  (pending) => {
    if (pending && !session.live) starting.value = true
  },
  { immediate: true }
)
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="traffic-space" />
      <template v-if="session.quiz">
        <button
          class="btn btn-ghost back"
          :disabled="session.live"
          :title="session.live ? t('stopShowFirst') : undefined"
          @click="goHome"
        >
          <Icon name="left" :size="15" /> {{ t('quizzes') }}
        </button>
        <span class="name">{{ title }}</span>
        <span v-if="session.live && mode === 'edit'" class="pill pill-live">
          <span class="dot" />{{ t('live') }}
        </span>
        <div class="spacer" />

        <LiveControls v-if="session.live && mode === 'show'" @edit="mode = 'edit'" />
        <div v-else class="actions">
          <button v-if="session.live" class="btn btn-primary" @click="mode = 'show'">
            {{ t('toShow') }}
          </button>
          <template v-else>
            <button
              class="btn btn-ghost"
              :class="{ active: page === 'print' }"
              :aria-pressed="page === 'print'"
              @click="togglePrint"
            >
              <Icon name="printer" :size="15" /> {{ t('print') }}
            </button>
            <button class="btn btn-primary" @click="starting = true">
              <Icon name="play" :size="13" /> {{ t('startShow') }}
            </button>
          </template>
        </div>
      </template>
      <template v-else>
        <div class="spacer" />
        <button class="btn btn-ghost" @click="settingsOpen = true">
          <Icon name="sliders" :size="15" /> {{ t('settings') }}
        </button>
      </template>
    </header>

    <main v-if="session.ready" class="body">
      <HomeView
        v-if="!session.quiz"
        ref="home"
        @open="open"
        @create="create"
        @create-from="createFrom"
        @ai="aiOpen = true"
      />
      <ShowLive v-else-if="session.live && mode === 'show'" />
      <EditorView v-else v-model:page="page" @create-from-current="createFromCurrent" />
    </main>

    <StartSheet v-if="starting && session.quiz && !session.live" @close="starting = false" />
    <NewQuizDialog v-if="newQuiz" :source="newQuiz.source" @close="newQuiz = null" />
    <AiDialog v-if="aiOpen" @close="aiOpen = false" />
    <SettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
    <ConfirmHost />
    <NoticeStack />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 46px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.topbar button,
.actions {
  -webkit-app-region: no-drag;
}

.traffic-space {
  width: 64px;
}

.back {
  gap: 2px;
  padding-left: 6px;
  color: var(--muted);
  font-weight: 550;
}

.back:hover:not(:disabled) {
  color: var(--text);
}

.name {
  min-width: 0;
  font-weight: 650;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spacer {
  flex: 1;
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.body {
  flex: 1;
  min-height: 0;
}
</style>
