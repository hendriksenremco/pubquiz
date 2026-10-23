<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { findAssetUsages } from '@shared/resolve'
import type { MediaAsset } from '@shared/types'
import { formatTime } from '../lib/format'
import { urlFor } from '../lib/media'
import { usePreviewPlayer } from '../lib/use-preview-player'
import { useSession } from '../stores/session'
import Icon from './Icon.vue'
import Popover from './Popover.vue'

/** Video of afbeelding in de mediabibliotheek; video's zijn hier af te spelen. */
const props = defineProps<{ asset: MediaAsset }>()
const emit = defineEmits<{ move: [folderId: string | null]; remove: [] }>()

const session = useSession()
const preview = usePreviewPlayer()
const video = ref<HTMLVideoElement | null>(null)
const playing = computed(() => preview.playingId.value === props.asset.id)
const used = computed(() => findAssetUsages(session.quiz!, props.asset.id).length > 0)

function toggle() {
  if (playing.value) return preview.stop()
  preview.claim(props.asset.id)
}

watch(playing, (on) => {
  const el = video.value
  if (!el) return
  if (on) {
    el.currentTime = 0
    void el.play().catch(() => preview.stop())
  } else {
    el.pause()
    el.currentTime = 1
  }
})

function move(folderId: string | null, close: () => void) {
  close()
  emit('move', folderId)
}

function remove(close: () => void) {
  close()
  emit('remove')
}

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('application/x-pubquiz-asset', props.asset.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <figure class="tile-item" draggable="true" :title="asset.name" @dragstart="onDragStart">
    <div class="frame" :class="{ playing }">
      <video
        v-if="asset.kind === 'video'"
        ref="video"
        :src="`${urlFor(asset)}#t=1`"
        preload="metadata"
        loop
        playsinline
        @ended="preview.stop()"
      />
      <img v-else :src="urlFor(asset)" alt="" />

      <button
        v-if="asset.kind === 'video'"
        class="play"
        :aria-label="playing ? 'Stop voorbeeld' : 'Speel voorbeeld'"
        @click="toggle"
      >
        <Icon :name="playing ? 'stop' : 'play'" :size="16" />
      </button>
    </div>
    <div class="menu">
      <Popover align="right" :width="200">
        <template #trigger="{ toggle: open }">
          <button class="menu-btn" aria-label="Meer" @click="open">
            <Icon name="more" :size="16" />
          </button>
        </template>
        <template #default="{ close }">
          <div class="menu-label">Verplaats naar</div>
          <button v-if="asset.folderId" class="menu-item" @click="move(null, close)">
            <Icon name="images" /> Media (geen map)
          </button>
          <button
            v-for="f in session.quiz?.folders.filter((x) => x.id !== asset.folderId)"
            :key="f.id"
            class="menu-item"
            @click="move(f.id, close)"
          >
            <Icon name="folder" /> {{ f.name }}
          </button>
          <button class="menu-item danger" @click="remove(close)">
            <Icon name="trash" /> Verwijder uit quiz
          </button>
        </template>
      </Popover>
    </div>
    <figcaption>
      <span class="name">{{ asset.name }}</span>
      <span class="meta">
        {{
          asset.duration ? formatTime(asset.duration) : asset.kind === 'image' ? 'Afbeelding' : ''
        }}
        <span v-if="used" class="used">in gebruik</span>
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.tile-item {
  position: relative;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.frame {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--surface-2);
}

.frame.playing {
  box-shadow: 0 0 0 2px var(--accent);
}

.frame video,
.frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.play {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: rgba(15, 20, 32, 0.78);
  color: var(--text);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}

.frame:hover .play,
.frame.playing .play,
.play:focus-visible {
  opacity: 1;
}

.frame.playing .play,
.play:hover {
  background: var(--accent);
  color: var(--accent-ink);
}

.menu {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
}

.tile-item:hover .menu,
.menu:focus-within {
  opacity: 1;
}

.menu-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: rgba(15, 20, 32, 0.78);
  color: var(--text);
  cursor: pointer;
}

.menu-label {
  padding: 4px 10px 6px;
  color: var(--muted);
  font-size: 12px;
}

.menu-item.danger {
  margin-top: 4px;
  color: var(--live);
}

figcaption {
  display: flex;
  flex-direction: column;
}

.name {
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}

.used {
  color: var(--accent);
}
</style>
