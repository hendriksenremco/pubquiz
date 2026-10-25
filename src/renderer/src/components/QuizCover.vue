<script setup lang="ts">
import { computed } from 'vue'
import { recentMediaUrl, type RecentQuiz } from '@shared/ipc'
import Icon from './Icon.vue'

/** "Artwork" van een quiz: het standaardbeeld van het eerste scherm. */
const props = defineProps<{ quiz: RecentQuiz }>()
const url = computed(() =>
  props.quiz.cover ? recentMediaUrl(props.quiz.path, props.quiz.cover.file) : null
)
</script>

<template>
  <span class="cover" :class="{ empty: !url }">
    <video
      v-if="url && quiz.cover?.kind === 'video'"
      :src="`${url}#t=1`"
      muted
      preload="metadata"
    />
    <img v-else-if="url" :src="url" alt="" />
    <Icon v-else :name="quiz.exists ? 'monitor' : 'x'" :size="28" />
  </span>
</template>

<style scoped>
.cover {
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--surface-2);
  color: var(--faint);
}

.cover video,
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
