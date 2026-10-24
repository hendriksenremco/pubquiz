<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { findAssetUsages } from '@shared/resolve'
import type { MediaAsset } from '@shared/types'
import { formatTime } from '../lib/format'
import { urlFor } from '../lib/media'
import { usePreviewPlayer } from '../lib/use-preview-player'
import { useSession } from '../stores/session'
import Icon from './Icon.vue'

/** Video of afbeelding in de mediabibliotheek; video's zijn hier af te spelen. */
const props = defineProps<{ asset: MediaAsset }>()
const emit = defineEmits<{ move: [folderId: string | null]; remove: [] }>()

const session = useSession()
const preview = usePreviewPlayer()
const video = ref<HTMLVideoElement | null>(null)
const playing = computed(() => preview.playingId.value === props.asset.id)
const used = computed(() => findAssetUsages(session.quiz!, props.asset.id).length > 0)
const folders = computed(() => session.quiz?.folders ?? [])

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

function move(event: Event) {
  emit('move', (event.target as HTMLSelectElement).value || null)
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
    <button
      class="remove"
      aria-label="Verwijder uit quiz"
      title="Verwijder uit quiz"
      @click="emit('remove')"
    >
      <Icon name="trash" :size="14" />
    </button>
    <figcaption>
      <span class="name">{{ asset.name }}</span>
      <span class="meta">
        {{
          asset.duration ? formatTime(asset.duration) : asset.kind === 'image' ? 'Afbeelding' : ''
        }}
        <span v-if="used" class="used">in gebruik</span>
      </span>
      <label v-if="folders.length" class="tile-folder" title="Map">
        <Icon name="folder" :size="12" />
        <select :value="asset.folderId ?? ''" aria-label="Map" @change="move">
          <option value="">Geen map</option>
          <option v-for="f in folders" :key="f.id" :value="f.id">{{ f.name }}</option>
        </select>
      </label>
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
}

.frame.playing .play,
.play:hover {
  background: var(--accent);
  color: var(--accent-ink);
}

.remove {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: rgba(15, 20, 32, 0.72);
  color: var(--muted);
  cursor: pointer;
}

.remove:hover {
  background: var(--live);
  color: #fff;
}

.tile-folder {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
}

.tile-folder select {
  min-width: 0;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.tile-folder:hover {
  color: var(--text);
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
