<script setup lang="ts">
import type { MediaAsset } from '@shared/types'
import { urlFor } from '../lib/media'
import Icon from './Icon.vue'

/** Vierkantje of 16:9-tegeltje met een frame uit de video, de afbeelding, of een muziek-icoon. */
defineProps<{ asset: MediaAsset | null; black?: boolean }>()
</script>

<template>
  <span class="thumb" :class="{ black }">
    <video v-if="asset?.kind === 'video'" :src="`${urlFor(asset)}#t=1`" muted preload="metadata" />
    <img v-else-if="asset?.kind === 'image'" :src="urlFor(asset)" alt="" />
    <Icon v-else-if="asset?.kind === 'audio'" name="music" :size="14" />
  </span>
</template>

<style scoped>
.thumb {
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 5px;
  background: var(--surface-4);
  color: var(--muted);
}

.thumb.black {
  background: #000;
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.thumb video,
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
