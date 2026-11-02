<script setup lang="ts">
import { computed, inject } from 'vue'
import type { Locale } from '@shared/i18n'
import type { Standing } from '@shared/scores'
import { SCREEN_MESSAGES } from '@shared/show-messages'
import type { Quiz, Slide } from '@shared/types'
import { locale as appLocale } from '../lib/locale'
import { ASSET_URL, assetUrl } from '../lib/media'
import { slideBackdrop } from '../lib/slide-backdrop'

/**
 * `number`: nummer van een afbeelding in zijn ronde, linksboven in beeld.
 * `withBackdrop: false`: zonder dimmen of kleur; een scherm legt die zelf over de hele breedte.
 * `locale`: de telefoon geeft de taal van de Mac mee; elders die van het venster.
 * `standings`: een titelslide van de plug-in Tussenstand toont de stand onder de titel.
 */
const props = withDefaults(
  defineProps<{
    slide: Slide
    /** Voor de afbeelding; niet nodig waar ASSET_URL die levert. */
    quiz?: Quiz | null
    number?: number | null
    withBackdrop?: boolean
    locale?: Locale
    standings?: Standing[] | null
  }>(),
  { quiz: null, number: null, withBackdrop: true, locale: appLocale, standings: null }
)

const t = computed(() => SCREEN_MESSAGES.in(props.locale))

const imageUrl = inject(ASSET_URL, (id: string | undefined) => assetUrl(props.quiz, id))
const image = computed(() => imageUrl(props.slide.imageAssetId))
const backdrop = computed(() => (props.withBackdrop ? slideBackdrop(props.slide) : {}))

/** Tot tien teams onder elkaar, daarna in twee kolommen; de regels krimpen mee met het aantal. */
const MAX_ROWS = 10
const standingsGrid = computed(() => {
  const count = props.standings?.length ?? 0
  const rows = count > MAX_ROWS ? Math.ceil(count / 2) : count
  return {
    gridTemplateRows: `repeat(${Math.max(rows, 1)}, auto)`,
    gridTemplateColumns: count > MAX_ROWS ? '1fr 1fr' : '1fr',
    fontSize: `${Math.min(7, 62 / Math.max(rows, 1))}cqh`
  }
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
    <!-- Vraag die de quizmaster voorleest: in beeld alleen het nummer. -->
    <template v-else-if="slide.layout === 'question' && slide.numberOnly">
      <div class="eyebrow-big">{{ t('question') }}</div>
      <div class="number">{{ number ?? slide.title }}</div>
    </template>
    <template v-else-if="slide.layout === 'image'">
      <img v-if="image" class="full-image" :src="image" alt="" />
      <div v-if="number" class="image-number">{{ number }}</div>
      <div v-if="slide.title" class="caption">{{ slide.title }}</div>
    </template>
    <template v-else-if="slide.layout === 'title' && standings">
      <div class="eyebrow-big">{{ slide.title }}</div>
      <ol class="standings" :style="standingsGrid">
        <li v-for="s in standings" :key="s.team.id" class="standing">
          <span class="place">{{ s.place }}</span>
          <span class="team">{{ s.team.name }}</span>
          <span class="total">{{ s.total.toLocaleString(locale) }}</span>
        </li>
      </ol>
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

.standings {
  display: grid;
  grid-auto-flow: column;
  column-gap: 6cqw;
  width: 100%;
  max-width: 120cqh;
  margin: 0;
  padding: 0;
  list-style: none;
  white-space: nowrap;
}

.standings:has(> :nth-child(11)) {
  max-width: none;
}

.standing {
  display: flex;
  align-items: baseline;
  gap: 0.8em;
  padding: 0.18em 0;
  border-bottom: 0.08cqh solid rgba(255, 255, 255, 0.18);
  font-weight: 650;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.place {
  min-width: 1.4em;
  color: var(--accent);
  font-family: var(--display);
  font-weight: 800;
  text-align: right;
}

.team {
  flex: 1;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
}

.total {
  font-family: var(--display);
  font-weight: 800;
}

.layout-title .image {
  max-height: 35cqh;
}
</style>
