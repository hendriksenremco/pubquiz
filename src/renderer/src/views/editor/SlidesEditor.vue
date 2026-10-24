<script setup lang="ts">
import { computed, ref } from 'vue'
import { createImageSlide, createSlide } from '@shared/factory'
import { groupByFolder, naturalCompare } from '@shared/media-folders'
import { loopIndices, slideNumber } from '@shared/resolve'
import type { MediaAsset, Round, Slide } from '@shared/types'
import Icon from '../../components/Icon.vue'
import ImageChip from '../../components/ImageChip.vue'
import Popover from '../../components/Popover.vue'
import SlideView from '../../components/SlideView.vue'
import { useMediaImport } from '../../lib/use-media-import'
import { useSession } from '../../stores/session'

const props = defineProps<{ round: Round }>()
const selected = defineModel<number>('selected', { required: true })
const session = useSession()
const quiz = computed(() => session.quiz!)
const screens = computed(() => quiz.value.screens)
const slide = computed(() => props.round.slides[selected.value] ?? null)
const { importFiles, pathsFromDrop } = useMediaImport()
const dropping = ref(false)

const LAYOUTS: { value: Slide['layout']; label: string }[] = [
  { value: 'title', label: 'Titel' },
  { value: 'question', label: 'Vraag' },
  { value: 'number', label: 'Nummer' },
  { value: 'image', label: 'Afbeelding' }
]

function add(layout: Slide['layout'], close: () => void) {
  const n = props.round.slides.filter((s) => s.layout === layout).length + 1
  // Een nieuwe vraag toont net als de vorige vraag de vraag zelf, of alleen het nummer.
  const lastQuestion = props.round.slides.findLast((s) => s.layout === 'question')
  const next =
    layout === 'question'
      ? { ...createSlide('question', `Vraag ${n}`), numberOnly: lastQuestion?.numberOnly }
      : layout === 'number'
        ? createSlide('number', String(n))
        : layout === 'image'
          ? createImageSlide()
          : createSlide('title', props.round.title)
  props.round.slides.splice(selected.value + 1, 0, next)
  selected.value = selected.value + 1
  close()
}

function setNumberOnly(on: boolean, close: () => void) {
  if (slide.value) slide.value.numberOnly = on || undefined
  close()
}

// ── Loop: slides wisselen vanzelf, eindeloos ────────────────────────────────
const DEFAULT_LOOP_SECONDS = 8
const loopable = computed(() => loopIndices(props.round).length > 1)

function setLoop(on: boolean) {
  props.round.slideLoopSeconds = on ? DEFAULT_LOOP_SECONDS : null
}

function setLoopSeconds(event: Event) {
  const value = Math.round(Number((event.target as HTMLInputElement).value))
  if (Number.isFinite(value) && value >= 1) props.round.slideLoopSeconds = value
}

// ── Afbeeldingenronde: een reeks afbeeldingen in één keer ───────────────────
function addImages(assets: MediaAsset[]) {
  const images = assets.filter((a) => a.kind === 'image')
  if (!images.length) return
  const first = props.round.slides.length
  props.round.slides.push(...images.map((a) => createImageSlide(a.id)))
  selected.value = first
}

async function addImagesFromFiles(close: () => void) {
  close()
  addImages(await importFiles())
}

/** Media-mappen met afbeeldingen, om in één keer als slides toe te voegen. */
const imageFolders = computed(() => groupByFolder(quiz.value, ['image']).filter((g) => g.folder))

function addImageFolder(assets: MediaAsset[], close: () => void) {
  close()
  addImages([...assets].sort((a, b) => naturalCompare(a.name, b.name)))
}

async function onDrop(event: DragEvent) {
  dropping.value = false
  const paths = pathsFromDrop(event)
  if (paths.length) addImages(await importFiles(paths))
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
  <section
    class="slides"
    :class="{ dropping }"
    @dragover.prevent="dropping = true"
    @dragleave.self="dropping = false"
    @drop.prevent.stop="onDrop"
  >
    <div class="section-head">
      <h3>Slides</h3>
      <span class="count">{{ round.slides.length || '' }}</span>
      <span class="grow" />

      <Popover v-if="loopable" align="right" :width="290">
        <template #trigger="{ open, toggle }">
          <button
            type="button"
            class="chip loop-chip"
            :class="{ open, dimmed: !round.slideLoopSeconds }"
            @click="toggle"
          >
            <Icon name="repeat" :size="14" />
            <span>Loop</span>
            <span class="chip-key chip-value">{{
              round.slideLoopSeconds ? `elke ${round.slideLoopSeconds} s` : 'uit'
            }}</span>
            <Icon name="chevron" :size="14" class="chev" />
          </button>
        </template>
        <div class="loop-menu">
          <label class="loop-row">
            <input
              type="checkbox"
              :checked="!!round.slideLoopSeconds"
              @change="setLoop(($event.target as HTMLInputElement).checked)"
            />
            <span>Slides vanzelf laten wisselen</span>
          </label>
          <label v-if="round.slideLoopSeconds" class="loop-row">
            <span class="grow">Elke</span>
            <input
              :value="round.slideLoopSeconds"
              type="number"
              min="1"
              step="1"
              class="input input-sm loop-seconds"
              aria-label="Seconden per slide"
              @change="setLoopSeconds"
            />
            <span class="muted">seconden</span>
          </label>
          <p class="muted loop-hint">
            Begint zodra je de eerste slide na de titel toont. Na de laatste komt de eerste weer,
            tot je de ronde beëindigt. Live kun je hem pauzeren.
          </p>
        </div>
      </Popover>
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
          <SlideView :slide="s" :quiz="quiz" :number="slideNumber(round, s)" />
        </span>
      </button>

      <Popover :width="240">
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
          <div class="menu-label">Meerdere afbeeldingen</div>
          <button class="menu-item" @click="addImagesFromFiles(close)">
            <Icon name="upload" /> Bestanden of map…
          </button>
          <button
            v-for="g in imageFolders"
            :key="g.folder!.id"
            class="menu-item"
            @click="addImageFolder(g.assets, close)"
          >
            <Icon name="folder" />
            <span class="grow">{{ g.folder!.name }}</span>
            <span class="muted">{{ g.assets.length }}</span>
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
          slide.layout === 'number'
            ? 'Nummer'
            : slide.layout === 'question'
              ? 'Vraag 1'
              : slide.layout === 'image'
                ? 'Bijschrift (mag leeg)'
                : 'Titel'
        "
        aria-label="Titel"
      />
      <textarea
        v-if="slide.layout !== 'image'"
        v-model="slide.body"
        class="quiet slide-body"
        rows="2"
        :placeholder="
          slide.layout !== 'question'
            ? 'Ondertitel'
            : slide.numberOnly
              ? 'Vraagtekst, alleen voor jou (en de pdf)'
              : 'Vraagtekst'
        "
        aria-label="Tekst"
      />

      <div v-if="slide.layout !== 'title'" class="answer-row">
        <span class="muted">Antwoord</span>
        <input
          v-model="slide.answer"
          class="input input-sm grow"
          placeholder="Voor de antwoordenronde"
          aria-label="Antwoord"
        />
        <ImageChip v-model="slide.answerImageAssetId" label="Met afbeelding" />
      </div>

      <div class="options">
        <Popover v-if="slide.layout === 'question'" :width="250">
          <template #trigger="{ open, toggle }">
            <button type="button" class="chip small shown-chip" :class="{ open }" @click="toggle">
              <span class="chip-key">In beeld</span>
              <span class="chip-value">{{
                slide.numberOnly ? 'alleen het nummer' : 'de vraag'
              }}</span>
              <Icon name="chevron" :size="13" class="chev" />
            </button>
          </template>
          <template #default="{ close }">
            <button
              class="menu-item"
              :class="{ on: !slide.numberOnly }"
              @click="setNumberOnly(false, close)"
            >
              <span class="grow">De vraag</span>
              <Icon v-if="!slide.numberOnly" name="check" />
            </button>
            <button
              class="menu-item"
              :class="{ on: slide.numberOnly }"
              @click="setNumberOnly(true, close)"
            >
              <span class="grow">
                Alleen het nummer
                <span class="menu-hint">Jij leest de vraag voor</span>
              </span>
              <Icon v-if="slide.numberOnly" name="check" />
            </button>
          </template>
        </Popover>
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

        <ImageChip
          v-if="slide.layout !== 'number'"
          v-model="slide.imageAssetId"
          label="Afbeelding"
        />

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

.loop-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.loop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
}

.loop-seconds {
  width: 64px;
}

.loop-hint {
  padding: 4px 10px 6px;
  font-size: 12px;
  line-height: 1.45;
}

.answer-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0 2px;
  font-size: 13px;
}

.slides.dropping .strip {
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 2px var(--accent);
}

.menu-label {
  padding: 8px 10px 4px;
  color: var(--muted);
  font-size: 12px;
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
</style>
