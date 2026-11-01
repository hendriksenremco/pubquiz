<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { findAssetUsages } from '@shared/resolve'
import type { MediaAsset } from '@shared/types'
import { formatTime } from '../lib/format'
import { locale } from '../lib/locale'
import { urlFor } from '../lib/media'
import { usePreviewPlayer } from '../lib/use-preview-player'
import { useSession } from '../stores/session'
import Icon from './Icon.vue'
import { COMPONENT_MESSAGES } from './messages'

/**
 * Video of afbeelding in de mediabibliotheek; video's zijn hier af te spelen, alles groot te
 * bekijken. Naar een map verplaatsen gaat door de tegel te slepen.
 */
const props = defineProps<{ asset: MediaAsset }>()
const emit = defineEmits<{ remove: []; preview: [] }>()

const session = useSession()
const t = COMPONENT_MESSAGES.in(locale)
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
    // Neemt intussen een ander voorbeeld het over, dan breekt pause() deze play() af. Alleen
    // stoppen als deze tegel nog speelt, anders stopt het nieuwe voorbeeld meteen ook.
    void el.play().catch(() => {
      if (playing.value) preview.stop()
    })
  } else {
    el.pause()
    el.currentTime = 1
  }
})

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('application/x-pubquiz-asset', props.asset.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
</script>

<template>
  <figure class="tile-item" draggable="true" :title="asset.name" @dragstart="onDragStart">
    <div class="frame" :class="{ playing }" @click="emit('preview')">
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
        :aria-label="playing ? t('stopPreview') : t('playPreview')"
        @click.stop="toggle"
      >
        <Icon :name="playing ? 'stop' : 'play'" :size="16" />
      </button>
      <button
        class="look"
        :aria-label="t('preview')"
        :title="t('preview')"
        @click.stop="emit('preview')"
      >
        <Icon name="eye" :size="16" />
      </button>
    </div>
    <button
      class="remove"
      :aria-label="t('removeFromQuiz')"
      :title="t('removeFromQuiz')"
      @click="emit('remove')"
    >
      <Icon name="trash" :size="14" />
    </button>
    <figcaption>
      <span class="name">{{ asset.name }}</span>
      <span class="meta">
        {{ asset.duration ? formatTime(asset.duration) : asset.kind === 'image' ? t('image') : '' }}
        <span v-if="used" class="used">{{ t('inUse') }}</span>
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
  transition: opacity 0.12s;
}

/* Wordt versleept: de plek blijft zichtbaar, de tegel zelf hangt aan de muis. */
.tile-item.dragging {
  opacity: 0.35;
}

.frame {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--surface-2);
}

.frame {
  cursor: zoom-in;
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

.play,
.look {
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

.look {
  left: auto;
  right: 10px;
}

.frame.playing .play,
.play:hover,
.look:hover {
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
