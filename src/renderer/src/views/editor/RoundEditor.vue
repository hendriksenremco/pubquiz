<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createFragment, createImageSlide, createSlide, fragmentChannel } from '@shared/factory'
import { groupByFolder, naturalCompare } from '@shared/media-folders'
import { createStandingsSlide, isStandingsSlide } from '@shared/scores'
import type { MediaAsset, Round, Slide } from '@shared/types'
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { locale } from '../../lib/locale'
import { useMediaImport } from '../../lib/use-media-import'
import { useSession } from '../../stores/session'
import FragmentInspector from './FragmentInspector.vue'
import { ROUND_MESSAGES } from './editor-messages'
import FragmentList from './FragmentList.vue'
import RoundSettings from './RoundSettings.vue'
import SlideInspector from './SlideInspector.vue'
import SlideList from './SlideList.vue'

/**
 * Een ronde, zoals Keynote: in het midden de inhoud (slides en fragmenten, meteen te typen),
 * rechts het paneel met de instellingen van wat je gekozen hebt, of van de ronde zelf.
 */
const props = defineProps<{ round: Round }>()
const emit = defineEmits<{ duplicate: []; remove: [] }>()
const session = useSession()
const quiz = computed(() => session.quiz!)
const { importFiles, pathsFromDrop } = useMediaImport()
const t = ROUND_MESSAGES.in(locale)

type Selection = { kind: 'slide' | 'fragment'; id: string } | null

function first(): Selection {
  const s = props.round.slides[0]
  if (s) return { kind: 'slide', id: s.id }
  const f = props.round.fragments[0]
  return f ? { kind: 'fragment', id: f.id } : null
}

const selection = ref<Selection>(first())
const tab = ref<'item' | 'round'>(selection.value ? 'item' : 'round')

const slide = computed(() =>
  selection.value?.kind === 'slide'
    ? (props.round.slides.find((s) => s.id === selection.value!.id) ?? null)
    : null
)
const fragment = computed(() =>
  selection.value?.kind === 'fragment'
    ? (props.round.fragments.find((f) => f.id === selection.value!.id) ?? null)
    : null
)

// Weg (verwijderd of ongedaan gemaakt): dan het paneel van de ronde.
watch([slide, fragment], ([s, f]) => {
  if (selection.value && !s && !f) {
    selection.value = null
    tab.value = 'round'
  }
})

function select(kind: 'slide' | 'fragment', id: string | null) {
  selection.value = id ? { kind, id } : null
  tab.value = id ? 'item' : 'round'
}

const itemLabel = computed(() => {
  if (fragment.value) return t('tabFragment')
  const layout = slide.value?.layout
  if (slide.value && session.pluginOn('scores') && isStandingsSlide(slide.value)) {
    return t('tabStandings')
  }
  return layout === 'question'
    ? t('tabQuestion')
    : layout === 'title'
      ? t('tabTitle')
      : layout === 'number'
        ? t('tabNumber')
        : t('tabImage')
})

// ── Toevoegen ────────────────────────────────────────────────────────────────

/** Na de gekozen slide, of achteraan. */
function insertSlides(...slides: Slide[]) {
  const at = slide.value ? props.round.slides.indexOf(slide.value) + 1 : props.round.slides.length
  props.round.slides.splice(at, 0, ...slides)
  select('slide', slides[0].id)
}

function addQuestion() {
  const n = props.round.slides.filter((s) => s.layout === 'question').length + 1
  // Een nieuwe vraag toont net als de vorige vraag de vraag zelf, of alleen het nummer.
  const lastQuestion = props.round.slides.findLast((s) => s.layout === 'question')
  insertSlides({
    ...createSlide('question', t('newQuestion', { number: n })),
    numberOnly: lastQuestion?.numberOnly
  })
}

function addSlide(layout: 'title' | 'number' | 'image', close: () => void) {
  close()
  const n = props.round.slides.filter((s) => s.layout === 'number').length + 1
  insertSlides(
    layout === 'title'
      ? createSlide('title', props.round.title)
      : layout === 'number'
        ? createSlide('number', String(n))
        : createImageSlide()
  )
}

/** Plug-in Tussenstand: een titelslide die de stand van dat moment toont. */
function addStandings(close: () => void) {
  close()
  insertSlides(createStandingsSlide(t('newStandings')))
}

function addImages(assets: MediaAsset[]) {
  const images = assets.filter((a) => a.kind === 'image')
  if (images.length) insertSlides(...images.map((a) => createImageSlide(a.id)))
}

/** Fragmenten gaan standaard naar het kanaal "Fragmenten" of "Clips", anders naar het laatste. */
const defaultChannel = computed(() => fragmentChannel(quiz.value)?.id)

function addFragments(assets: MediaAsset[]) {
  const audio = assets.filter((a) => a.kind === 'audio')
  if (!audio.length) return
  const channelId = defaultChannel.value
  if (!channelId) {
    session.notify({
      level: 'warning',
      message: t('noChannel')
    })
    return
  }
  const added = audio.map((asset, i) => {
    const number = props.round.fragments.length + i + 1
    return createFragment(asset.id, channelId, number, t('fragmentName', { number }))
  })
  props.round.fragments.push(...added)
  select('fragment', added[0].id)
}

async function fromFiles(close: () => void) {
  close()
  const assets = await importFiles()
  addImages(assets)
  addFragments(assets)
}

const imageFolders = computed(() => groupByFolder(quiz.value, ['image']).filter((g) => g.folder))
const audioFolders = computed(() => groupByFolder(quiz.value, ['audio']).filter((g) => g.folder))

function fromFolder(assets: MediaAsset[], close: () => void) {
  close()
  const used = new Set(props.round.fragments.map((f) => f.assetId))
  const sorted = [...assets].sort((a, b) => naturalCompare(a.name, b.name))
  addImages(sorted)
  addFragments(sorted.filter((a) => !used.has(a.id)))
}

// Bestanden op de ronde: afbeeldingen worden slides, geluid wordt fragmenten.
const dropping = ref(false)

// Alleen bestanden lichten de ronde op; een slide op volgorde slepen is geen import.
function onDragOver(event: DragEvent) {
  if ([...(event.dataTransfer?.types ?? [])].includes('Files')) dropping.value = true
}

async function onDrop(event: DragEvent) {
  dropping.value = false
  const paths = pathsFromDrop(event)
  if (!paths.length) return
  const assets = await importFiles(paths)
  addImages(assets)
  addFragments(assets)
}

const both = computed(() => props.round.slides.length > 0 && props.round.fragments.length > 0)
const empty = computed(() => !props.round.slides.length && !props.round.fragments.length)
</script>

<template>
  <div class="round-page">
    <div
      class="canvas scroll"
      :class="{ dropping }"
      @dragover.prevent="onDragOver"
      @dragleave.self="dropping = false"
      @drop.prevent.stop="onDrop"
    >
      <div class="inner">
        <input
          id="round-title"
          v-model="round.title"
          class="quiet round-title"
          :aria-label="t('roundTitle')"
        />

        <section v-if="round.slides.length" class="part">
          <h3 v-if="both" class="part-label">{{ t('slides') }}</h3>
          <SlideList
            :round="round"
            :selected-id="slide?.id ?? null"
            @select="select('slide', $event)"
          />
        </section>

        <section v-if="round.fragments.length" class="part">
          <h3 v-if="both" class="part-label">{{ t('fragments') }}</h3>
          <FragmentList
            :round="round"
            :selected-id="fragment?.id ?? null"
            @select="select('fragment', $event)"
          />
        </section>

        <p v-if="empty" class="muted empty-hint">
          {{ t('empty') }}
        </p>

        <div class="add-bar">
          <button class="btn add" @click="addQuestion">
            <Icon name="plus" :size="14" /> {{ t('addQuestion') }}
          </button>
          <Popover :width="260">
            <template #trigger="{ open, toggle }">
              <button class="btn add" :class="{ active: open }" @click="toggle">
                <Icon name="plus" :size="14" /> {{ t('addImages') }}
              </button>
            </template>
            <template #default="{ close }">
              <button class="menu-item" @click="fromFiles(close)">
                <Icon name="download" /> {{ t('fromFiles') }}
              </button>
              <template v-if="imageFolders.length">
                <div class="menu-label">{{ t('fromMedia') }}</div>
                <button
                  v-for="g in imageFolders"
                  :key="g.folder!.id"
                  class="menu-item"
                  @click="fromFolder(g.assets, close)"
                >
                  <Icon name="folder" />
                  <span class="grow">{{ g.folder!.name }}</span>
                  <span class="muted">{{ g.assets.length }}</span>
                </button>
              </template>
            </template>
          </Popover>
          <Popover :width="260">
            <template #trigger="{ open, toggle }">
              <button class="btn add" :class="{ active: open }" @click="toggle">
                <Icon name="plus" :size="14" /> {{ t('addFragments') }}
              </button>
            </template>
            <template #default="{ close }">
              <button class="menu-item" @click="fromFiles(close)">
                <Icon name="download" /> {{ t('fromFiles') }}
              </button>
              <template v-if="audioFolders.length">
                <div class="menu-label">{{ t('fromMedia') }}</div>
                <button
                  v-for="g in audioFolders"
                  :key="g.folder!.id"
                  class="menu-item"
                  @click="fromFolder(g.assets, close)"
                >
                  <Icon name="folder" />
                  <span class="grow">{{ g.folder!.name }}</span>
                  <span class="muted">{{ g.assets.length }}</span>
                </button>
              </template>
            </template>
          </Popover>
          <Popover :width="200">
            <template #trigger="{ open, toggle }">
              <button class="btn add" :class="{ active: open }" @click="toggle">
                <Icon name="plus" :size="14" /> {{ t('addSlide') }}
              </button>
            </template>
            <template #default="{ close }">
              <button class="menu-item" @click="addSlide('title', close)">
                <Icon name="text" /> {{ t('slideTitle') }}
              </button>
              <button class="menu-item" @click="addSlide('number', close)">
                <Icon name="hash" /> {{ t('slideNumber') }}
              </button>
              <button class="menu-item" @click="addSlide('image', close)">
                <Icon name="image" /> {{ t('slideImage') }}
              </button>
              <button
                v-if="session.pluginOn('scores')"
                class="menu-item"
                @click="addStandings(close)"
              >
                <Icon name="standings" /> {{ t('slideStandings') }}
              </button>
            </template>
          </Popover>
        </div>

        <section class="part notes-part">
          <label class="part-label" for="round-notes">{{ t('notes') }}</label>
          <textarea
            id="round-notes"
            v-model="round.hostNotes"
            class="quiet notes"
            rows="2"
            :placeholder="t('notesPlaceholder')"
          />
        </section>
      </div>
    </div>

    <aside class="inspector scroll" :aria-label="t('inspector')">
      <div v-if="selection" class="segmented tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'item'"
          :class="{ on: tab === 'item' }"
          @click="tab = 'item'"
        >
          {{ itemLabel }}
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'round'"
          :class="{ on: tab === 'round' }"
          @click="tab = 'round'"
        >
          {{ t('tabRound') }}
        </button>
      </div>

      <SlideInspector
        v-if="tab === 'item' && slide"
        :key="slide.id"
        :round="round"
        :slide="slide"
        @select="select('slide', $event)"
      />
      <FragmentInspector
        v-else-if="tab === 'item' && fragment"
        :key="fragment.id"
        :round="round"
        :fragment="fragment"
        @select="select('fragment', $event)"
      />
      <RoundSettings
        v-else
        :round="round"
        @duplicate="emit('duplicate')"
        @remove="emit('remove')"
      />
    </aside>
  </div>
</template>

<style scoped>
.round-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  height: 100%;
}

.canvas {
  min-width: 0;
  transition: box-shadow 0.15s;
}

.canvas.dropping {
  box-shadow: inset 0 0 0 2px var(--accent);
}

.inner {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 820px;
  margin: 0 auto;
  padding: 32px 40px 80px;
}

.round-title {
  font: 700 30px/1.15 var(--display);
  letter-spacing: -0.02em;
}

.part {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.part-label {
  padding-left: 10px;
  color: var(--muted);
  font: 600 12px var(--font);
  letter-spacing: 0;
}

.empty-hint {
  padding: 4px 0;
}

.add-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: -8px;
  padding-left: 10px;
}

.add {
  height: 30px;
  border-radius: 999px;
  background: var(--surface-2);
  font-weight: 550;
}

.add:hover:not(:disabled),
.add.active {
  background: var(--surface-3);
}

.menu-label {
  padding: 8px 10px 4px;
  color: var(--muted);
  font-size: 12px;
}

.notes-part {
  margin-top: 12px;
}

.notes {
  display: block;
  margin: 0 0 0 4px;
  padding: 8px 10px;
  border-radius: var(--radius);
  background: var(--surface-1);
  line-height: 1.5;
  field-sizing: content;
  min-height: 64px;
}

.inspector {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px 20px 24px;
  background: var(--surface-1);
}

.tabs {
  flex: none;
}
</style>
