<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  assetsIn,
  createFolder,
  deleteFolder,
  moveToFolder,
  naturalCompare
} from '@shared/media-folders'
import { findAssetUsages } from '@shared/resolve'
import type { MediaAsset, MediaKind } from '@shared/types'
import Icon from '../../components/Icon.vue'
import MediaPreview from '../../components/MediaPreview.vue'
import MediaThumb from '../../components/MediaThumb.vue'
import MediaTile from '../../components/MediaTile.vue'
import { formatTime } from '../../lib/format'
import { locale } from '../../lib/locale'
import { ask } from '../../lib/confirm'
import { useMediaImport } from '../../lib/use-media-import'
import { usePreviewPlayer } from '../../lib/use-preview-player'
import { useSession } from '../../stores/session'
import { MEDIA_MESSAGES } from './editor-messages'

const ASSET_TYPE = 'application/x-pubquiz-asset'

const session = useSession()
const t = MEDIA_MESSAGES.in(locale)
const quiz = computed(() => session.quiz!)
const { importFiles, pathsFromDrop } = useMediaImport()
const preview = usePreviewPlayer()
const filter = ref<MediaKind | 'all'>('all')
const openFolderId = ref<string | null>(null)
const folderTitle = ref<HTMLInputElement | null>(null)
const dropFolder = ref<string | null>(null)
const previewId = ref<string | null>(null)
const page = ref<HTMLElement | null>(null)
const draggingId = ref<string | null>(null)
const dockX = ref(0)

const FILTERS: { value: MediaKind | 'all'; label: string }[] = [
  { value: 'all', label: t('all') },
  { value: 'video', label: t('videos') },
  { value: 'image', label: t('images') },
  { value: 'audio', label: t('audio') }
]

const folder = computed(() => quiz.value.folders.find((f) => f.id === openFolderId.value) ?? null)
watch(folder, (f) => {
  if (!f) openFolderId.value = null
})

const matches = (a: MediaAsset) => filter.value === 'all' || a.kind === filter.value
const here = computed(() => assetsIn(quiz.value, openFolderId.value).filter(matches))
const visual = computed(() => here.value.filter((a) => a.kind !== 'audio'))
const sounds = computed(() => here.value.filter((a) => a.kind === 'audio'))
/** Bladeren in het grote voorbeeld: in dezelfde volgorde als op de pagina. */
const shown = computed(() => [...visual.value, ...sounds.value])

const folderTiles = computed(() =>
  openFolderId.value
    ? []
    : [...quiz.value.folders]
        .sort((a, b) => naturalCompare(a.name, b.name))
        .map((f) => {
          const assets = assetsIn(quiz.value, f.id)
          // Beeld eerst, dan geluid: de mozaïek toont liefst echte thumbnails.
          const mosaic = [
            ...assets.filter((a) => a.kind !== 'audio'),
            ...assets.filter((a) => a.kind === 'audio')
          ].slice(0, 4)
          return { folder: f, count: assets.length, mosaic }
        })
)

/**
 * Waar een bestand heen kan terwijl je het sleept: de balk die dan onderin verschijnt. Zo kan een
 * bestand ook rechtstreeks van de ene map naar de andere, of in een nieuwe map.
 */
const dockTargets = computed(() => [
  ...(folder.value ? [{ key: 'root', label: t('title'), icon: 'images' as const }] : []),
  ...[...quiz.value.folders]
    .filter((f) => f.id !== openFolderId.value)
    .sort((a, b) => naturalCompare(a.name, b.name))
    .map((f) => ({ key: f.id, label: f.name, icon: 'folder' as const })),
  { key: 'new', label: t('newFolder'), icon: 'folder-plus' as const }
])

const isEmpty = computed(
  () => !folderTiles.value.length && !visual.value.length && !sounds.value.length
)

function plural(n: number) {
  return n === 1 ? t('filesOne') : t('filesMany', { count: n })
}

/** Nieuwe map (eventueel meteen met een bestand erin), open en klaar om een naam te geven. */
async function newFolder(asset?: MediaAsset) {
  const names = new Set(quiz.value.folders.map((f) => f.name))
  let name = t('newFolder')
  for (let n = 2; names.has(name); n++) name = t('newFolderNumber', { number: n })
  const created = createFolder(quiz.value, name)
  if (asset) moveToFolder(asset, created.id)
  openFolderId.value = created.id
  await nextTick()
  folderTitle.value?.focus()
  folderTitle.value?.select()
}

async function removeFolder() {
  const f = folder.value
  if (!f) return
  const ok = await ask({
    title: t('removeFolderTitle', { name: f.name }),
    message: t('removeFolderMessage'),
    confirm: t('removeFolder')
  })
  if (!ok) return
  deleteFolder(quiz.value, f.id)
  openFolderId.value = null
}

function remove(asset: MediaAsset) {
  const used = findAssetUsages(quiz.value, asset.id, locale)
  if (used.length) {
    session.notify({
      level: 'warning',
      message: t('inUse', { name: asset.name, places: used.join(', ') })
    })
    return
  }
  quiz.value.assets = quiz.value.assets.filter((a) => a.id !== asset.id)
}

// ── Slepen ──────────────────────────────────────────────────────────────────

function draggedAsset(event: DragEvent): MediaAsset | null {
  const id = event.dataTransfer?.getData(ASSET_TYPE)
  return quiz.value.assets.find((a) => a.id === id) ?? null
}

function isAssetDrag(event: DragEvent) {
  return [...(event.dataTransfer?.types ?? [])].includes(ASSET_TYPE)
}

let dragToken = 0

function onDragStart(event: DragEvent) {
  if (!isAssetDrag(event)) return
  const id = event.dataTransfer!.getData(ASSET_TYPE)
  const rect = page.value!.getBoundingClientRect()
  const token = ++dragToken
  // Een tik later: de pagina aanpassen tijdens dragstart kan het slepen in Chromium afbreken.
  setTimeout(() => {
    if (token !== dragToken) return
    draggingId.value = id
    dockX.value = rect.left + rect.width / 2
  })
}

function endDrag() {
  dragToken++
  draggingId.value = null
  dropFolder.value = null
}

/** `target`: een map-id, 'root' (Media zelf) of 'new' (een nieuwe map). */
function onTargetDragOver(event: DragEvent, target: string) {
  if (!isAssetDrag(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropFolder.value = target
}

/** Niet uitgaan als de muis alleen naar iets binnen het doel gaat (bv. het icoon). */
function onTargetDragLeave(event: DragEvent, target: string) {
  const inside = (event.currentTarget as Node).contains(event.relatedTarget as Node | null)
  if (dropFolder.value === target && !inside) dropFolder.value = null
}

function onTargetDrop(event: DragEvent, target: string) {
  const asset = draggedAsset(event)
  endDrag()
  if (!asset) return
  event.preventDefault()
  event.stopPropagation()
  if (target === 'new') void newFolder(asset)
  else moveToFolder(asset, target === 'root' ? null : target)
}

/** Bestanden uit Finder: in de open map (de editor zelf importeert alleen in de hoofdmap). */
async function onFilesDrop(event: DragEvent) {
  endDrag()
  const paths = pathsFromDrop(event)
  if (!paths.length) return
  event.stopPropagation()
  await importFiles(paths, openFolderId.value)
}

function onSoundDragStart(event: DragEvent, asset: MediaAsset) {
  event.dataTransfer?.setData(ASSET_TYPE, asset.id)
}
</script>

<template>
  <div
    ref="page"
    class="page"
    @dragstart="onDragStart"
    @dragend="endDrag"
    @drop.prevent="onFilesDrop"
  >
    <header class="head">
      <template v-if="folder">
        <button
          class="crumb"
          :class="{ drop: dropFolder === 'root', receptive: draggingId }"
          :title="t('back')"
          @click="openFolderId = null"
          @dragenter="onTargetDragOver($event, 'root')"
          @dragover="onTargetDragOver($event, 'root')"
          @dragleave="onTargetDragLeave($event, 'root')"
          @drop="onTargetDrop($event, 'root')"
        >
          <Icon name="left" :size="18" /> {{ t('title') }}
        </button>
        <input
          ref="folderTitle"
          v-model="folder.name"
          class="quiet folder-title"
          :aria-label="t('folderName')"
        />
        <span class="count">{{ plural(assetsIn(quiz, folder.id).length) }}</span>
        <button class="btn btn-ghost btn-sm danger" @click="removeFolder">
          <Icon name="trash" :size="14" /> {{ t('removeFolder') }}
        </button>
      </template>
      <h2 v-else>{{ t('title') }}</h2>

      <span class="grow" />
      <div class="filters">
        <button
          v-for="f in FILTERS"
          :key="f.value"
          class="btn btn-sm"
          :class="filter === f.value ? 'active' : 'btn-ghost'"
          @click="filter = f.value"
        >
          {{ f.label }}
        </button>
      </div>
      <button v-if="!folder" class="btn btn-ghost" @click="newFolder()">
        <Icon name="folder-plus" /> {{ t('newFolder') }}
      </button>
      <button class="btn" @click="importFiles(undefined, openFolderId)">
        <Icon name="upload" /> {{ t('import') }}
      </button>
    </header>

    <div v-if="isEmpty" class="empty">
      {{ folder ? t('emptyFolder') : t('empty') }}
    </div>

    <section v-if="folderTiles.length" class="grid">
      <button
        v-for="t in folderTiles"
        :key="t.folder.id"
        class="folder"
        :class="{ drop: dropFolder === t.folder.id, receptive: draggingId }"
        @click="openFolderId = t.folder.id"
        @dragenter="onTargetDragOver($event, t.folder.id)"
        @dragover="onTargetDragOver($event, t.folder.id)"
        @dragleave="onTargetDragLeave($event, t.folder.id)"
        @drop="onTargetDrop($event, t.folder.id)"
      >
        <span class="mosaic" :class="`n${t.mosaic.length}`">
          <MediaThumb v-for="a in t.mosaic" :key="a.id" :asset="a" class="mosaic-cell" />
          <Icon v-if="!t.mosaic.length" name="folder" :size="34" class="folder-icon" />
        </span>
        <span class="folder-name">{{ t.folder.name }}</span>
        <span class="folder-meta">{{ plural(t.count) }}</span>
      </button>
    </section>

    <section v-if="visual.length" class="grid">
      <MediaTile
        v-for="a in visual"
        :key="a.id"
        :asset="a"
        :class="{ dragging: draggingId === a.id }"
        @remove="remove(a)"
        @preview="previewId = a.id"
      />
    </section>

    <section v-if="sounds.length" class="sounds">
      <div
        v-for="a in sounds"
        :key="a.id"
        class="sound"
        :class="{ playing: preview.playingId.value === a.id, dragging: draggingId === a.id }"
        draggable="true"
        @dragstart="onSoundDragStart($event, a)"
      >
        <button
          class="play"
          :aria-label="preview.playingId.value === a.id ? t('stop') : t('listen')"
          @click="preview.toggle(a.id, a)"
        >
          <Icon :name="preview.playingId.value === a.id ? 'stop' : 'play'" :size="12" />
        </button>
        <span class="name grow">{{ a.name }}</span>
        <span v-if="findAssetUsages(quiz, a.id).length" class="used">{{ t('used') }}</span>
        <span class="meta mono">{{ formatTime(a.duration) }}</span>
        <button
          class="btn btn-ghost btn-sm btn-icon sound-look"
          :aria-label="t('preview')"
          :title="t('preview')"
          @click="previewId = a.id"
        >
          <Icon name="eye" :size="14" />
        </button>
        <button
          class="btn btn-ghost btn-sm btn-icon sound-remove"
          :aria-label="t('removeFromQuiz')"
          :title="t('removeFromQuiz')"
          @click="remove(a)"
        >
          <Icon name="trash" :size="14" />
        </button>
      </div>
    </section>

    <div class="tips faint">
      <p v-if="visual.length || sounds.length">{{ t('moveTip') }}</p>
    </div>

    <Transition name="dock">
      <div
        v-if="draggingId"
        class="dock"
        role="group"
        :aria-label="t('moveTo')"
        :style="{ left: `${dockX}px` }"
      >
        <span class="dock-label">{{ t('moveTo') }}</span>
        <div
          v-for="t in dockTargets"
          :key="t.key"
          class="dock-target"
          :class="{ drop: dropFolder === t.key }"
          @dragenter="onTargetDragOver($event, t.key)"
          @dragover="onTargetDragOver($event, t.key)"
          @dragleave="onTargetDragLeave($event, t.key)"
          @drop="onTargetDrop($event, t.key)"
        >
          <Icon :name="t.icon" :size="14" /> {{ t.label }}
        </div>
      </div>
    </Transition>

    <MediaPreview v-if="previewId" v-model:id="previewId" :items="shown" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1080px;
  min-height: 100%;
  margin: 0 auto;
  padding: 32px 40px 80px;
}

.head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
}

.crumb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px 0 4px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.crumb:hover,
.crumb.receptive,
.crumb.drop {
  background: var(--surface-2);
  color: var(--text);
}

.crumb.drop {
  box-shadow: inset 0 0 0 2px var(--accent);
}

.folder-title {
  width: auto;
  min-width: 4ch;
  max-width: 360px;
  margin: 0;
  font: 650 22px var(--display);
  field-sizing: content;
}

.count {
  color: var(--faint);
  font-weight: 600;
}

.filters {
  display: flex;
  gap: 2px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px 16px;
}

.folder {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.mosaic {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 3px;
  aspect-ratio: 16 / 9;
  margin-bottom: 6px;
  padding: 3px;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--surface-2);
  transition: box-shadow 0.12s;
}

.folder:hover .mosaic {
  box-shadow: 0 0 0 2px var(--surface-4);
}

.folder.receptive .mosaic {
  box-shadow: 0 0 0 2px var(--surface-4);
}

.folder.drop .mosaic {
  box-shadow: 0 0 0 2px var(--accent);
}

.mosaic-cell {
  width: 100%;
  height: 100%;
  border-radius: 8px;
}

.mosaic.n1 .mosaic-cell {
  grid-area: 1 / 1 / 3 / 3;
}

.mosaic.n2 .mosaic-cell {
  grid-row: 1 / 3;
}

.mosaic.n3 .mosaic-cell:first-child {
  grid-row: 1 / 3;
}

.mosaic.n0 {
  display: grid;
  place-items: center;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.folder-icon {
  color: var(--faint);
}

.folder-name {
  font-weight: 600;
}

.folder-meta {
  color: var(--muted);
  font-size: 12px;
}

.sounds {
  display: flex;
  flex-direction: column;
}

.sound {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 6px 0 10px;
  border-radius: var(--radius);
  cursor: grab;
  transition: opacity 0.12s;
}

.sound:hover {
  background: var(--surface-1);
}

.sound.dragging {
  opacity: 0.35;
}

.sound.playing .name {
  color: var(--accent);
}

.play {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-3);
  color: var(--text);
  cursor: pointer;
}

.sound.playing .play {
  background: var(--accent);
  color: var(--accent-ink);
}

.name {
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  color: var(--muted);
  font-size: 12px;
}

.used {
  color: var(--accent);
  font-size: 12px;
}

.sound-look,
.sound-remove {
  color: var(--muted);
}

.sound-remove:hover,
.head .danger {
  color: var(--live);
}

.tips {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: auto;
  font-size: 12px;
}

/* Verschijnt tijdens het slepen, onderin over de pagina heen (niets schuift op). */
.dock {
  position: fixed;
  bottom: 28px;
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: min(900px, calc(100vw - 48px));
  padding: 8px 8px 8px 16px;
  border-radius: var(--radius-xl);
  background: var(--surface-3);
  box-shadow:
    0 0 0 1px var(--line-strong),
    0 20px 50px rgba(3, 6, 14, 0.55);
  translate: -50% 0;
}

.dock-label {
  margin-right: 4px;
  color: var(--muted);
  font-size: 12px;
}

.dock-target {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--surface-4);
  font-weight: 600;
  transition:
    background 0.1s,
    color 0.1s;
}

.dock-target.drop {
  background: var(--accent);
  color: var(--accent-ink);
}

.dock-enter-active,
.dock-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.dock-enter-from,
.dock-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
