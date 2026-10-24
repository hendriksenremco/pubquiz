<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MenuAction } from '@shared/ipc'
import ConfirmHost from '../../components/ConfirmHost.vue'
import Icon from '../../components/Icon.vue'
import NoticeStack from '../../components/NoticeStack.vue'
import { ask } from '../../lib/confirm'
import { useSession } from '../../stores/session'
import EditorView from '../editor/EditorView.vue'
import ShowView from '../show/ShowView.vue'
import HomeView from './HomeView.vue'
import AiDialog from './AiDialog.vue'
import NewQuizDialog from './NewQuizDialog.vue'

const api = window.pubquiz
const session = useSession()
const mode = ref<'edit' | 'show'>('edit')

const title = computed(() => session.quiz?.title || 'Naamloze quiz')

const home = ref<InstanceType<typeof HomeView> | null>(null)

async function open(path?: string, openIn: 'edit' | 'show' = 'edit') {
  session.flush()
  mode.value = openIn
  await api.openQuiz(path)
  // Niet gelukt (bv. verplaatst): het dashboard toont de bijgewerkte lijst.
  if (!session.quiz) await home.value?.reload()
}

/** Open dialoog voor een nieuwe quiz; `source` = "op basis van" die quiz. */
const newQuiz = ref<{ source: { path: string; title: string } | null } | null>(null)
const aiOpen = ref(false)

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
  redo: () => (isEditable(document.activeElement) ? document.execCommand('redo') : session.redo())
}

onMounted(async () => {
  await session.init({ editable: true })
  // Live of een afgebroken show om te hervatten: meteen naar de show-modus.
  if (session.live || session.recovery) mode.value = 'show'
  api.onMenu((action) => actions[action]())
  // Afsluiten (⌘Q of het venster dicht) terwijl de show loopt.
  api.onConfirmQuit(async () => {
    const ok = await ask({
      title: 'De show loopt nog',
      message: 'Wil je echt afsluiten? De schermen gaan uit en de muziek stopt.',
      confirm: 'Afsluiten',
      danger: true
    })
    if (ok) api.quitConfirmed()
  })
})

// Komt de show live (ook via herstel), dan hoort de host in show-modus te zitten.
watch(
  () => session.live,
  (live) => {
    if (live) mode.value = 'show'
  }
)
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="traffic-space" />
      <template v-if="session.quiz">
        <button
          class="home-btn"
          :disabled="session.live"
          :aria-label="session.live ? 'Stop eerst de show' : 'Naar het overzicht'"
          :title="session.live ? 'Stop eerst de show' : 'Naar het overzicht'"
          @click="goHome"
        >
          <Icon name="home" />
        </button>
        <div class="title">
          <span class="name">{{ title }}</span>
          <span class="save" :class="{ dirty: session.dirty }">
            {{ session.dirty ? 'Opslaan…' : 'Opgeslagen' }}
          </span>
        </div>
        <nav class="modes">
          <button class="mode" :class="{ on: mode === 'edit' }" @click="mode = 'edit'">
            Bewerken
          </button>
          <button class="mode" :class="{ on: mode === 'show' }" @click="mode = 'show'">
            <span v-if="session.live" class="pill pill-live"><span class="dot" />Live</span>
            <span v-else>Show</span>
          </button>
        </nav>
        <div class="spacer" />
      </template>
      <span v-else class="brand">Quizmeister</span>
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
      <EditorView v-else-if="mode === 'edit'" @create-from-current="createFromCurrent" />
      <ShowView v-else />
    </main>

    <NewQuizDialog v-if="newQuiz" :source="newQuiz.source" @close="newQuiz = null" />
    <AiDialog v-if="aiOpen" @close="aiOpen = false" />
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
  gap: 12px;
  height: 46px;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.topbar button {
  -webkit-app-region: no-drag;
}

.traffic-space {
  width: 64px;
}

.home-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.home-btn:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text);
}

.home-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.brand {
  font: 700 15px var(--display);
  color: var(--accent);
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.title .popover {
  -webkit-app-region: no-drag;
}

.name {
  font-weight: 650;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.save {
  font-size: 11px;
  color: var(--faint);
}

.save.dirty {
  color: var(--warn);
}

.modes {
  display: flex;
  padding: 3px;
  border-radius: 9px;
  background: var(--bg);
  border: 1px solid var(--line);
}

.mode {
  display: inline-flex;
  align-items: center;
  height: 26px;
  min-width: 92px;
  justify-content: center;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.mode.on {
  background: var(--panel-3);
  color: var(--text);
}

.spacer {
  flex: 1;
}

.body {
  flex: 1;
  min-height: 0;
}
</style>
