<script setup lang="ts">
import { computed, ref } from 'vue'
import { createRound, newId, ROUND_PRESETS, type RoundPreset } from '@shared/factory'
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { ask } from '../../lib/confirm'
import { useMediaImport } from '../../lib/use-media-import'
import { useSession } from '../../stores/session'
import MediaLibrary from './MediaLibrary.vue'
import PrintPanel from './PrintPanel.vue'
import RoundEditor from './RoundEditor.vue'
import SetupPanel from './SetupPanel.vue'

const session = useSession()
const quiz = computed(() => session.quiz!)
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

const PRESET_HINTS: Record<RoundPreset, string> = {
  normal: 'Vragen met slides',
  music: 'Fragmenten, achtergrond pauzeert',
  pictures: 'Een reeks afbeeldingen, genummerd in beeld',
  break: 'Eigen sfeer op de schermen',
  answers: 'Vragen, afbeeldingen en fragmenten met hun antwoord'
}

function addRound(preset: RoundPreset, close: () => void) {
  const r = createRound(preset, quiz.value.rounds.length + 1, quiz.value)
  quiz.value.rounds.push(r)
  page.value = r.id
  close()
}

function duplicate(id: string) {
  const index = quiz.value.rounds.findIndex((r) => r.id === id)
  const source = quiz.value.rounds[index]
  if (!source) return
  const copy = JSON.parse(JSON.stringify(source))
  copy.id = newId()
  copy.title = `${source.title} (kopie)`
  for (const s of copy.slides) s.id = newId()
  for (const f of copy.fragments) f.id = newId()
  quiz.value.rounds.splice(index + 1, 0, copy)
  page.value = copy.id
}

async function remove(id: string) {
  const r = quiz.value.rounds.find((x) => x.id === id)
  if (!r) return
  const ok = await ask({
    title: `Ronde “${r.title}” verwijderen?`,
    confirm: 'Verwijder',
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
  const paths = pathsFromDrop(event)
  if (!paths.length) return
  const added = await importFiles(paths)
  if (added.length) {
    session.notify({
      level: 'info',
      message: `${added.length} bestand${added.length > 1 ? 'en' : ''} toegevoegd aan Media`
    })
  }
}
function onDropCapture() {
  dragDepth = 0
  fileDrag.value = false
}
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
      <div class="rounds-head label">Rondes</div>
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
          <span class="round-title grow">{{ r.title || 'Naamloze ronde' }}</span>
        </div>
        <Popover :width="250">
          <template #trigger="{ open, toggle }">
            <button
              class="nav-item add-round"
              :class="{ active: open }"
              aria-label="Ronde toevoegen"
              @click="toggle"
            >
              <Icon name="plus" :size="14" />
              <span>Ronde</span>
            </button>
          </template>
          <template #default="{ close }">
            <button
              v-for="(label, preset) in ROUND_PRESETS"
              :key="preset"
              class="menu-item"
              @click="addRound(preset, close)"
            >
              <span>
                {{ label }}
                <span class="menu-hint">{{ PRESET_HINTS[preset] }}</span>
              </span>
            </button>
          </template>
        </Popover>
      </div>

      <nav class="nav">
        <button class="nav-item" :class="{ on: selected === 'media' }" @click="page = 'media'">
          <Icon name="images" />
          <span class="grow">Media</span>
          <span class="badge">{{ quiz.assets.length }}</span>
        </button>
        <button class="nav-item" :class="{ on: selected === 'setup' }" @click="page = 'setup'">
          <Icon name="sliders" />
          <span class="grow">Quiz-instellingen</span>
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
        <Icon name="upload" :size="28" />
        <span>Laat los om toe te voegen</span>
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

.badge {
  color: var(--faint);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
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

.num {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--surface-3);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.round.on .num {
  background: var(--accent);
  color: var(--accent-ink);
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
