<script setup lang="ts">
import { computed } from 'vue'
import { createSlide } from '@shared/factory'
import { findAsset } from '@shared/resolve'
import type { Round, Slide } from '@shared/types'
import AssetGrid from '../../components/AssetGrid.vue'
import Icon from '../../components/Icon.vue'
import MediaThumb from '../../components/MediaThumb.vue'
import Popover from '../../components/Popover.vue'
import SlideView from '../../components/SlideView.vue'
import { useSession } from '../../stores/session'

const props = defineProps<{ round: Round }>()
const selected = defineModel<number>('selected', { required: true })
const session = useSession()
const quiz = computed(() => session.quiz!)
const screens = computed(() => quiz.value.screens)
const slide = computed(() => props.round.slides[selected.value] ?? null)

const LAYOUTS: { value: Slide['layout']; label: string }[] = [
  { value: 'title', label: 'Titel' },
  { value: 'question', label: 'Vraag' },
  { value: 'number', label: 'Nummer' }
]

function add(layout: Slide['layout'], close: () => void) {
  const n = props.round.slides.filter((s) => s.layout === layout).length + 1
  const next =
    layout === 'question'
      ? createSlide('question', `Vraag ${n}`)
      : layout === 'number'
        ? createSlide('number', String(n))
        : createSlide('title', props.round.title)
  props.round.slides.splice(selected.value + 1, 0, next)
  selected.value = selected.value + 1
  close()
}

function move(delta: number) {
  const from = selected.value
  const to = from + delta
  if (to < 0 || to >= props.round.slides.length) return
  const [moved] = props.round.slides.splice(from, 1)
  props.round.slides.splice(to, 0, moved)
  selected.value = to
}

function remove() {
  props.round.slides.splice(selected.value, 1)
  selected.value = Math.min(selected.value, props.round.slides.length - 1)
}

// ── Opties als chips ────────────────────────────────────────────────────────
const BACKDROPS = [
  { value: 'dim', label: 'Video gedimd' },
  { value: 'over-video', label: 'Over de video' },
  { value: 'color', label: 'Effen kleur' }
] as const
type BackdropKind = (typeof BACKDROPS)[number]['value']

function backdropKind(s: Slide): BackdropKind {
  return typeof s.backdrop === 'object' ? 'color' : s.backdrop
}
function setBackdrop(s: Slide, kind: BackdropKind) {
  s.backdrop = kind === 'color' ? { color: '#1d2433' } : kind
}

const image = computed(() => findAsset(quiz.value, slide.value?.imageAssetId))

function clearImage(close: () => void) {
  if (slide.value) slide.value.imageAssetId = undefined
  close()
}

function targets(s: Slide, screenId: string): boolean {
  return s.targetScreens === 'all' || s.targetScreens.includes(screenId)
}
function toggleTarget(s: Slide, screenId: string) {
  const all = screens.value.map((x) => x.id)
  const current = s.targetScreens === 'all' ? all : s.targetScreens
  const next = current.includes(screenId)
    ? current.filter((id) => id !== screenId)
    : [...current, screenId]
  if (next.length === 0) return
  s.targetScreens = next.length === all.length ? 'all' : next
}
function targetText(s: Slide): string {
  if (s.targetScreens === 'all') return 'alle schermen'
  return screens.value
    .filter((x) => targets(s, x.id))
    .map((x) => x.name)
    .join(' en ')
}
</script>

<template>
  <section>
    <div class="section-head">
      <h3>Slides</h3>
      <span class="count">{{ round.slides.length || '' }}</span>
    </div>

    <div class="strip">
      <button
        v-for="(s, i) in round.slides"
        :key="s.id"
        type="button"
        class="thumb"
        :class="{ on: selected === i }"
        :aria-label="`Slide ${i + 1}`"
        @click="selected = selected === i ? -1 : i"
      >
        <span class="thumb-stage" :class="{ video: typeof s.backdrop !== 'object' }">
          <SlideView :slide="s" :quiz="quiz" />
        </span>
      </button>

      <Popover :width="200">
        <template #trigger="{ toggle }">
          <button type="button" class="thumb add" aria-label="Slide toevoegen" @click="toggle">
            <Icon name="plus" :size="20" />
          </button>
        </template>
        <template #default="{ close }">
          <button
            v-for="l in LAYOUTS"
            :key="l.value"
            class="menu-item"
            @click="add(l.value, close)"
          >
            {{ l.label }}
          </button>
        </template>
      </Popover>
    </div>

    <div v-if="slide" class="editor tile">
      <div class="editor-top">
        <div class="segments">
          <button
            v-for="l in LAYOUTS"
            :key="l.value"
            type="button"
            class="seg"
            :class="{ on: slide.layout === l.value }"
            @click="slide.layout = l.value"
          >
            {{ l.label }}
          </button>
        </div>
        <span class="grow" />
        <button
          class="btn btn-ghost btn-sm btn-icon"
          aria-label="Naar links"
          :disabled="selected === 0"
          @click="move(-1)"
        >
          <Icon name="left" />
        </button>
        <button
          class="btn btn-ghost btn-sm btn-icon"
          aria-label="Naar rechts"
          :disabled="selected === round.slides.length - 1"
          @click="move(1)"
        >
          <Icon name="right" />
        </button>
        <button
          class="btn btn-ghost btn-sm btn-icon btn-danger"
          aria-label="Verwijder slide"
          @click="remove"
        >
          <Icon name="trash" />
        </button>
      </div>

      <input
        v-model="slide.title"
        class="quiet slide-title"
        :placeholder="
          slide.layout === 'number' ? 'Nummer' : slide.layout === 'question' ? 'Vraag 1' : 'Titel'
        "
        aria-label="Titel"
      />
      <textarea
        v-model="slide.body"
        class="quiet slide-body"
        rows="2"
        :placeholder="slide.layout === 'question' ? 'Vraagtekst' : 'Ondertitel'"
        aria-label="Tekst"
      />

      <div class="options">
        <Popover :width="220">
          <template #trigger="{ open, toggle }">
            <button type="button" class="chip small" :class="{ open }" @click="toggle">
              <span class="chip-key">Achtergrond</span>
              <span class="chip-value">{{
                BACKDROPS.find((b) => b.value === backdropKind(slide!))?.label
              }}</span>
              <Icon name="chevron" :size="13" class="chev" />
            </button>
          </template>
          <button
            v-for="b in BACKDROPS"
            :key="b.value"
            class="menu-item"
            :class="{ on: backdropKind(slide) === b.value }"
            @click="setBackdrop(slide, b.value)"
          >
            <span class="grow">{{ b.label }}</span>
            <Icon v-if="backdropKind(slide) === b.value" name="check" />
          </button>
          <label v-if="typeof slide.backdrop === 'object'" class="row color-row">
            <input v-model="slide.backdrop.color" type="color" class="color" />
            <span class="muted mono">{{ slide.backdrop.color }}</span>
          </label>
        </Popover>

        <Popover v-if="slide.layout !== 'number'" :width="380">
          <template #trigger="{ open, toggle }">
            <button
              type="button"
              class="chip small"
              :class="{ open }"
              :title="image ? `Afbeelding: ${image.name}` : undefined"
              @click="toggle"
            >
              <MediaThumb v-if="image" :asset="image" class="opt-thumb" />
              <span class="chip-key">Afbeelding</span>
              <span class="chip-value">{{
                image ? image.name.replace(/\.[^.]+$/, '') : 'geen'
              }}</span>
              <Icon name="chevron" :size="13" class="chev" />
            </button>
          </template>
          <template #default="{ close }">
            <AssetGrid v-model="slide.imageAssetId" kind="image" @picked="close" />
            <button v-if="slide.imageAssetId" class="menu-item clear" @click="clearImage(close)">
              <Icon name="x" /> Geen afbeelding
            </button>
          </template>
        </Popover>

        <Popover v-if="screens.length > 1" :width="220">
          <template #trigger="{ open, toggle }">
            <button type="button" class="chip small" :class="{ open }" @click="toggle">
              <span class="chip-key">Op</span>
              <span class="chip-value">{{ targetText(slide) }}</span>
              <Icon name="chevron" :size="13" class="chev" />
            </button>
          </template>
          <label v-for="x in screens" :key="x.id" class="menu-item">
            <input
              type="checkbox"
              :checked="targets(slide, x.id)"
              @change="toggleTarget(slide, x.id)"
            />
            {{ x.name }}
          </label>
        </Popover>
      </div>
    </div>
  </section>
</template>

<style scoped>
.strip {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 3px 3px 6px;
  margin: -3px -3px 0;
}

.thumb {
  flex: 0 0 176px;
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  cursor: pointer;
}

.thumb-stage {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--surface-2);
  container-type: size;
}

/* Hint dat er video achter zit, zonder video's te decoderen. */
.thumb-stage.video {
  background:
    radial-gradient(circle at 25% 30%, rgba(124, 177, 255, 0.22), transparent 60%),
    radial-gradient(circle at 80% 80%, rgba(255, 165, 61, 0.18), transparent 55%), var(--surface-2);
}

.thumb.on .thumb-stage {
  box-shadow: 0 0 0 2px var(--accent);
}

.thumb:hover:not(.on) .thumb-stage {
  box-shadow: 0 0 0 2px var(--surface-4);
}

.thumb.add {
  display: grid;
  place-items: center;
  flex-basis: 100px;
  aspect-ratio: 100 / 99;
  height: 99px;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
  color: var(--muted);
}

.thumb.add:hover {
  background: var(--surface-1);
  color: var(--text);
}

.editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
  padding: 12px 16px 14px;
}

.editor-top {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 6px;
}

.segments {
  display: flex;
  padding: 3px;
  border-radius: var(--radius);
  background: var(--surface-1);
}

.seg {
  height: 24px;
  padding: 0 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.seg.on {
  background: var(--surface-4);
  color: var(--text);
}

.slide-title {
  font: 650 20px var(--display);
}

.slide-body {
  line-height: 1.45;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.chip.small {
  height: 26px;
  padding: 0 9px;
  gap: 6px;
  font-size: 12px;
}

.opt-thumb {
  width: 26px;
  height: 16px;
  margin-left: -4px;
}

.color-row {
  padding: 6px 10px;
}

.color {
  width: 34px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
}

.clear {
  margin-top: 6px;
}
</style>
