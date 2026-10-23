<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createRound, newId, ROUND_PRESETS, type RoundPreset } from '@shared/factory'
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { useMediaImport } from '../../lib/use-media-import'
import { useSession } from '../../stores/session'
import MediaLibrary from './MediaLibrary.vue'
import RoundEditor from './RoundEditor.vue'
import SetupPanel from './SetupPanel.vue'

const session = useSession()
const quiz = computed(() => session.quiz!)
const selected = ref<'setup' | 'media' | string>('setup')
const { importFiles, pathsFromDrop } = useMediaImport()

const round = computed(() => quiz.value.rounds.find((r) => r.id === selected.value) ?? null)
watch(round, (r) => {
  if (!r && selected.value !== 'setup' && selected.value !== 'media') selected.value = 'setup'
})

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
  selected.value = r.id
  close()
}

function duplicate(id: string, close: () => void) {
  close()
  const index = quiz.value.rounds.findIndex((r) => r.id === id)
  const source = quiz.value.rounds[index]
  if (!source) return
  const copy = JSON.parse(JSON.stringify(source))
  copy.id = newId()
  copy.title = `${source.title} (kopie)`
  for (const s of copy.slides) s.id = newId()
  for (const f of copy.fragments) f.id = newId()
  quiz.value.rounds.splice(index + 1, 0, copy)
  selected.value = copy.id
}

function remove(id: string, close: () => void) {
  close()
  const r = quiz.value.rounds.find((x) => x.id === id)
  if (!r || !confirm(`Ronde "${r.title}" verwijderen?`)) return
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
      <nav class="nav">
        <button class="nav-item" :class="{ on: selected === 'setup' }" @click="selected = 'setup'">
          <Icon name="sliders" />
          <span class="grow">Quiz</span>
        </button>
        <button class="nav-item" :class="{ on: selected === 'media' }" @click="selected = 'media'">
          <Icon name="images" />
          <span class="grow">Media</span>
          <span class="badge">{{ quiz.assets.length }}</span>
        </button>
      </nav>

      <div class="rounds-head">
        <span class="label grow">Rondes</span>
        <Popover align="right" :width="250">
          <template #trigger="{ toggle }">
            <button
              class="btn btn-ghost btn-sm btn-icon"
              aria-label="Ronde toevoegen"
              title="Ronde toevoegen"
              @click="toggle"
            >
              <Icon name="plus" />
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

      <div class="rounds scroll">
        <div
          v-for="(r, i) in quiz.rounds"
          :key="r.id"
          class="round"
          :class="{ on: selected === r.id, drop: dropTarget === r.id && dragging !== r.id }"
          draggable="true"
          @click="selected = r.id"
          @dragstart="dragging = r.id"
          @dragend="dragging = dropTarget = null"
          @dragover.prevent="dragging && (dropTarget = r.id)"
          @drop.prevent.stop="dragging && onRoundDrop(r.id)"
        >
          <span class="num mono">{{ i + 1 }}</span>
          <span class="round-title grow">{{ r.title || 'Naamloze ronde' }}</span>
          <Popover align="right" :width="170" class="round-menu" @click.stop>
            <template #trigger="{ toggle }">
              <button class="btn btn-ghost btn-sm btn-icon" aria-label="Meer" @click.stop="toggle">
                <Icon name="more" />
              </button>
            </template>
            <template #default="{ close }">
              <button class="menu-item" @click.stop="duplicate(r.id, close)">
                <Icon name="copy" /> Dupliceer
              </button>
              <button class="menu-item danger" @click.stop="remove(r.id, close)">
                <Icon name="trash" /> Verwijder
              </button>
            </template>
          </Popover>
        </div>
        <p v-if="!quiz.rounds.length" class="muted hint">Nog geen rondes. Voeg er een toe met +.</p>
      </div>
    </aside>

    <section class="main scroll">
      <SetupPanel v-if="selected === 'setup'" />
      <MediaLibrary v-else-if="selected === 'media'" />
      <RoundEditor v-else-if="round" :key="round.id" :round="round" />
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
  gap: 18px;
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
  display: flex;
  align-items: center;
  padding: 0 4px 0 10px;
  margin-bottom: -10px;
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

.round-menu {
  visibility: hidden;
}

.round:hover .round-menu,
.round.on .round-menu {
  visibility: visible;
}

.menu-item.danger {
  color: var(--live);
}

.hint {
  padding: 6px 10px;
  font-size: 12px;
}

.main {
  min-width: 0;
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
