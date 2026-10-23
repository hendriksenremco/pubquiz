<script setup lang="ts">
import { computed } from 'vue'
import type { Quiz, Slide } from '@shared/types'
import { assetUrl } from '../lib/media'

/** `number`: nummer van een afbeelding in zijn ronde, linksboven in beeld. */
const props = withDefaults(defineProps<{ slide: Slide; quiz: Quiz; number?: number | null }>(), {
  number: null
})

const image = computed(() => assetUrl(props.quiz, props.slide.imageAssetId))
const backdrop = computed(() => {
  const b = props.slide.backdrop
  if (b === 'dim') return { background: 'rgba(0, 0, 0, 0.55)' }
  if (b === 'over-video') return {}
  return { background: b.color }
})
</script>

<template>
  <div
    class="slide"
    :class="[`layout-${slide.layout}`, { bare: slide.backdrop === 'over-video' }]"
    :style="backdrop"
  >
    <template v-if="slide.layout === 'number'">
      <div class="number">{{ slide.title }}</div>
      <div v-if="slide.body" class="sub">{{ slide.body }}</div>
    </template>
    <template v-else-if="slide.layout === 'image'">
      <img v-if="image" class="full-image" :src="image" alt="" />
      <div v-if="number" class="image-number">{{ number }}</div>
      <div v-if="slide.title" class="caption">{{ slide.title }}</div>
    </template>
    <template v-else-if="slide.layout === 'title'">
      <div class="title">{{ slide.title }}</div>
      <div v-if="slide.body" class="sub">{{ slide.body }}</div>
      <img v-if="image" class="image" :src="image" alt="" />
    </template>
    <template v-else>
      <div v-if="slide.title" class="eyebrow-big">{{ slide.title }}</div>
      <div class="question" :class="{ 'with-image': image }">
        <div v-if="slide.body" class="body">{{ slide.body }}</div>
        <img v-if="image" class="image" :src="image" alt="" />
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Maten in container-units (cqw/cqh): schaalt mee in previews én op elk display. */
.slide {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2.5cqh;
  padding: 7cqh 8cqw;
  color: #fff;
  text-align: center;
  font-family: var(--font);
  white-space: pre-line;
  overflow: hidden;
}

.bare {
  text-shadow:
    0 0.3cqh 2.5cqh rgba(0, 0, 0, 0.85),
    0 0 0.6cqh rgba(0, 0, 0, 0.9);
}

.title {
  font-family: var(--display);
  font-size: 11cqh;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.sub {
  font-size: 5cqh;
  font-weight: 500;
  opacity: 0.85;
}

.number {
  font-family: var(--display);
  font-size: 45cqh;
  font-weight: 850;
  line-height: 1;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.eyebrow-big {
  font-family: var(--display);
  font-size: 5.5cqh;
  font-weight: 700;
  color: var(--accent);
}

.layout-image {
  padding: 0;
}

.full-image {
  position: absolute;
  inset: 5cqh 6cqw;
  width: calc(100% - 12cqw);
  height: calc(100% - 10cqh);
  object-fit: contain;
}

.image-number {
  position: absolute;
  top: 4cqh;
  left: 3.5cqw;
  display: grid;
  place-items: center;
  min-width: 13cqh;
  height: 13cqh;
  padding: 0 2.5cqh;
  border-radius: 3cqh;
  background: rgba(0, 0, 0, 0.72);
  color: var(--accent);
  font-family: var(--display);
  font-size: 8cqh;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
}

.caption {
  position: absolute;
  left: 8cqw;
  right: 8cqw;
  bottom: 5cqh;
  font-size: 5cqh;
  font-weight: 650;
  text-shadow: 0 0.3cqh 2.5cqh rgba(0, 0, 0, 0.85);
}

.layout-question {
  justify-content: center;
}

.question {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5cqw;
  max-height: 70cqh;
}

.question.with-image .body {
  flex: 1;
  text-align: left;
}

.body {
  font-size: 7cqh;
  font-weight: 650;
  line-height: 1.2;
}

.image {
  max-width: 45cqw;
  max-height: 55cqh;
  object-fit: contain;
  border-radius: 1cqh;
}

.layout-title .image {
  max-height: 35cqh;
}
</style>
