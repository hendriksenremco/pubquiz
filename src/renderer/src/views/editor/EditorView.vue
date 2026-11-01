<script setup lang="ts">
import { computed, ref } from 'vue'
import { createRound, newId, type RoundPreset } from '@shared/factory'
import { addRounds, isRoundFile } from '@shared/round-file'
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { ask } from '../../lib/confirm'
import { locale } from '../../lib/locale'
import { useMediaImport } from '../../lib/use-media-import'
import { useSession } from '../../stores/session'
import MediaLibrary from './MediaLibrary.vue'
import PrintPanel from './PrintPanel.vue'
import RoundEditor from './RoundEditor.vue'
import SetupPanel from './SetupPanel.vue'
import { EDITOR_MESSAGES } from './editor-messages'

const session = useSession()
const quiz = computed(() => session.quiz!)
const t = EDITOR_MESSAGES.in(locale)
const emit = defineEmits<{ createFromCurrent: [] }>()
/** Gekozen pagina: een ronde (id), 'setup', 'media' of 'print'. Afdrukken zit in de werkbalk. */
const page = defineModel<string>('page', { required: true })
const PAGES = ['setup', 'media', 'print']
const { importFiles, pathsFromDrop } = useMediaImport()

/** Leeg of een verwijderde ronde: de eerste ronde, of zonder rondes de quiz-instellingen. */
const selected = computed(() =>
  PAGES.includes(page.value) || quiz.value.rounds.some((r) => r.id === page.value)
    ? page.value
    : (quiz.value.rounds[0]?.id ?? 'setup')
)
const round = computed(() => quiz.value.rounds.find((r) => r.id === selected.value) ?? null)

const PRESETS: { preset: RoundPreset; label: string; hint: string }[] = [
  { preset: 'normal', label: t('presetNormal'), hint: t('presetNormalHint') },
  { preset: 'music', label: t('presetMusic'), hint: t('presetMusicHint') },
  { preset: 'pictures', label: t('presetPictures'), hint: t('presetPicturesHint') },
  { preset: 'break', label: t('presetBreak'), hint: t('presetBreakHint') },
  { preset: 'answers', label: t('presetAnswers'), hint: t('presetAnswersHint') }
]

function addRound(preset: RoundPreset, close: () => void) {
  const r = createRound(preset, quiz.value.rounds.length + 1, quiz.value, locale)
  quiz.value.rounds.push(r)
  page.value = r.id
  close()
}

/**
 * Ronde importeren…: de rondes uit een rondebestand komen na de gekozen ronde (issue #99). Zonder
 * pad vraagt main welk bestand; met pad komt het uit Finder of van een drop.
 */
async function importRounds(path?: string) {
  const index = quiz.value.rounds.findIndex((r) => r.id === selected.value)
  const at = index >= 0 ? index + 1 : quiz.value.rounds.length
  const result = await window.pubquiz.importRounds(JSON.parse(JSON.stringify(quiz.value)), at, path)
  if (!result) return
  const added = addRounds(quiz.value, result.drafts, result.assets, at, locale)
  page.value = added[0].id
  session.notify({
    level: 'info',
    message:
      added.length === 1
        ? t('importedOne', { title: added[0].title, file: result.file })
        : t('importedMany', { count: added.length, file: result.file })
  })
}

function duplicate(id: string) {
  const index = quiz.value.rounds.findIndex((r) => r.id === id)
  const source = quiz.value.rounds[index]
  if (!source) return
  const copy = JSON.parse(JSON.stringify(source))
  copy.id = newId()
  copy.title = t('copyTitle', { title: source.title })
  for (const s of copy.slides) s.id = newId()
  for (const f of copy.fragments) f.id = newId()
  quiz.value.rounds.splice(index + 1, 0, copy)
  page.value = copy.id
}

async function remove(id: string) {
  const r = quiz.value.rounds.find((x) => x.id === id)
  if (!r) return
  const ok = await ask({
    title: t('removeRound', { title: r.title }),
    confirm: t('remove'),
    danger: true
  })
  if (!ok) return
  quiz.value.rounds = quiz.value.rounds.filter((x) => x.id !== id)
  for (const other of quiz.value.rounds) {
    other.answersFor = other.answersFor.filter((x) => x !== id)
  }
}

// Rondes herschikken door te slepen.
const dragging = ref<string | null>(null)
const dropTarget = ref<string | null>(null)

function onRoundDrop(targetId: string) {
  const from = quiz.value.rounds.findIndex((r) => r.id === dragging.value)
  const to = quiz.value.rounds.findIndex((r) => r.id === targetId)
  if (from >= 0 && to >= 0 && from !== to) {
    const [moved] = quiz.value.rounds.splice(from, 1)
    quiz.value.rounds.splice(to, 0, moved)
  }
  dragging.value = null
  dropTarget.value = null
}

// Bestanden kunnen overal in de editor heen; secties die zelf iets met een drop doen stoppen hem.
const fileDrag = ref(false)
let dragDepth = 0

function hasFiles(event: DragEvent) {
  return [...(event.dataTransfer?.types ?? [])].includes('Files')
}
function onDragEnter(event: DragEvent) {
  if (!hasFiles(event)) return
  dragDepth++
  fileDrag.value = true
}
function onDragLeave(event: DragEvent) {
  if (!hasFiles(event)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) fileDrag.value = false
}
async function onDrop(event: DragEvent) {
  dragDepth = 0
  fileDrag.value = false
  const dropped = pathsFromDrop(event)
  // Rondebestanden worden rondes; de rest gaat naar Media.
  for (const path of dropped.filter(isRoundFile)) await importRounds(path)
  const paths = dropped.filter((p) => !isRoundFile(p))
  if (!paths.length) return
  const added = await importFiles(paths)
  if (added.length) {
    session.notify({
      level: 'info',
      message: added.length === 1 ? t('addedOne') : t('addedMany', { count: added.length })
    })
  }
}
function onDropCapture() {
  dragDepth = 0
  fileDrag.value = false
}

defineExpose({ importRounds })
</script>

<template>
  <div
    class="editor"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover.prevent
    @drop.prevent="onDrop"
    @drop.capture="onDropCapture"
  >
    <aside class="sidebar">
      <div class="rounds-head label">{{ t('rounds') }}</div>
      <div class="rounds scroll">
        <div
          v-for="(r, i) in quiz.rounds"
          :key="r.id"
          class="round"
          :class="{ on: selected === r.id, drop: dropTarget === r.id && dragging !== r.id }"
          draggable="true"
          @click="page = r.id"
          @dragstart="dragging = r.id"
          @dragend="dragging = dropTarget = null"
          @dragover.prevent="dragging && (dropTarget = r.id)"
          @drop.prevent.stop="dragging && onRoundDrop(r.id)"
        >
          <span class="num mono">{{ i + 1 }}</span>
          <span class="round-title grow">{{ r.title || t('untitled') }}</span>
        </div>
        <Popover :width="250">
          <template #trigger="{ open, toggle }">
            <button class="nav-item add-round" :class="{ active: open }" @click="toggle">
              <Icon name="plus" :size="14" />
              <span>{{ t('addRound') }}</span>
            </button>
          </template>
          <template #default="{ close }">
            <button
              v-for="p in PRESETS"
              :key="p.preset"
              class="menu-item"
              @click="addRound(p.preset, close)"
            >
              <span>
                {{ p.label }}
                <span class="menu-hint">{{ p.hint }}</span>
              </span>
            </button>
          </template>
        </Popover>
        <button class="nav-item add-round" :title="t('importRoundsHint')" @click="importRounds()">
          <Icon name="download" :size="14" />
          <span>{{ t('importRounds') }}</span>
        </button>
      </div>

      <nav class="nav">
        <button class="nav-item" :class="{ on: selected === 'media' }" @click="page = 'media'">
          <Icon name="images" />
          <span class="grow">{{ t('media') }}</span>
        </button>
        <button class="nav-item" :class="{ on: selected === 'setup' }" @click="page = 'setup'">
          <Icon name="sliders" />
          <span class="grow">{{ t('setup') }}</span>
        </button>
      </nav>
    </aside>

    <section class="main" :class="{ scroll: !round }">
      <SetupPanel v-if="selected === 'setup'" @create-from-current="emit('createFromCurrent')" />
      <MediaLibrary v-else-if="selected === 'media'" />
      <PrintPanel v-else-if="selected === 'print'" />
      <RoundEditor
        v-else-if="round"
        :key="round.id"
        :round="round"
        @duplicate="duplicate(round.id)"
        @remove="remove(round.id)"
      />
    </section>

    <Transition name="fade">
      <div v-if="fileDrag" class="drop-overlay">
        <Icon name="download" :size="28" />
        <span>{{ t('dropHere') }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.editor {
  position: relative;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  height: 100%;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  padding: 14px 10px;
  background: var(--surface-1);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item,
.round {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-weight: 550;
  text-align: left;
  cursor: pointer;
}

.nav-item:hover,
.round:hover {
  background: var(--surface-2);
  color: var(--text);
}

.nav-item.on,
.round.on {
  background: var(--accent-soft);
  color: var(--text);
}

.nav-item.on .icon {
  color: var(--accent);
}

.rounds-head {
  padding: 4px 10px 6px;
}

.rounds {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  flex: 1;
}

.round {
  padding-right: 4px;
}

/* Alleen het nummer: de achtergrond van de rij laat al zien welke ronde gekozen is. */
.num {
  flex: none;
  width: 18px;
  color: var(--faint);
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.round.on .num {
  color: var(--muted);
}

.round-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.round.drop {
  box-shadow: inset 0 2px 0 var(--accent);
}

.add-round {
  gap: 8px;
  color: var(--muted);
}

.add-round.active {
  background: var(--surface-2);
  color: var(--text);
}

.main {
  min-width: 0;
  min-height: 0;
}

.drop-overlay {
  position: absolute;
  inset: 10px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: var(--radius-xl);
  background: rgba(15, 20, 32, 0.82);
  box-shadow: inset 0 0 0 2px var(--accent);
  color: var(--accent);
  font-weight: 650;
  pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
