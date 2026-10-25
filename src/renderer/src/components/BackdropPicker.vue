<script setup lang="ts">
import type { Slide } from '@shared/types'
import Icon from './Icon.vue'
import Popover from './Popover.vue'

/** Waar een slide op staat: over de video, gedimd, of een effen kleur. */
const props = defineProps<{ slide: Slide }>()

const BACKDROPS = [
  { value: 'dim', label: 'Video, gedimd' },
  { value: 'over-video', label: 'Over de video' },
  { value: 'color', label: 'Effen kleur' }
] as const
type BackdropKind = (typeof BACKDROPS)[number]['value']

/** Donkere kleuren waar witte tekst goed op leesbaar is; daarnaast kan een eigen kleurcode. */
const SWATCHES = [
  '#000000',
  '#0f1420',
  '#1d2433',
  '#16304f',
  '#123b2e',
  '#3a2410',
  '#5c1a2b',
  '#3b2350'
]

function kind(): BackdropKind {
  return typeof props.slide.backdrop === 'object' ? 'color' : props.slide.backdrop
}

function setKind(value: BackdropKind) {
  props.slide.backdrop = value === 'color' ? { color: '#1d2433' } : value
}

/** Eigen kleurcode, bv. "#1d2433" of "1d2433"; iets anders laat de kleur staan. */
function setColor(input: HTMLInputElement) {
  const hex = input.value.trim().replace(/^#?/, '#').toLowerCase()
  if (typeof props.slide.backdrop === 'object' && /^#[0-9a-f]{6}$/.test(hex))
    props.slide.backdrop = { color: hex }
  input.value = typeof props.slide.backdrop === 'object' ? props.slide.backdrop.color : ''
}
</script>

<template>
  <Popover :width="240" block>
    <template #trigger="{ open, toggle }">
      <button type="button" class="picker" :class="{ open }" aria-label="Achtergrond" @click="toggle">
        <span
          v-if="typeof slide.backdrop === 'object'"
          class="swatch-dot"
          :style="{ background: slide.backdrop.color }"
        />
        <span class="value">{{ BACKDROPS.find((b) => b.value === kind())?.label }}</span>
        <Icon name="chevron" :size="13" class="chev" />
      </button>
    </template>
    <button
      v-for="b in BACKDROPS"
      :key="b.value"
      class="menu-item"
      :class="{ on: kind() === b.value }"
      @click="setKind(b.value)"
    >
      <span class="grow">{{ b.label }}</span>
      <Icon v-if="kind() === b.value" name="check" />
    </button>
    <div v-if="typeof slide.backdrop === 'object'" class="colors">
      <div class="swatches" role="group" aria-label="Kleur">
        <button
          v-for="c in SWATCHES"
          :key="c"
          type="button"
          class="swatch"
          :class="{ on: slide.backdrop.color.toLowerCase() === c }"
          :style="{ background: c }"
          :aria-label="`Kleur ${c}`"
          :aria-pressed="slide.backdrop.color.toLowerCase() === c"
          @click="slide.backdrop = { color: c }"
        />
      </div>
      <input
        class="input input-sm mono hex"
        :value="slide.backdrop.color"
        aria-label="Eigen kleurcode"
        maxlength="7"
        spellcheck="false"
        @change="setColor($event.target as HTMLInputElement)"
        @keydown.enter="setColor($event.target as HTMLInputElement)"
      />
    </div>
  </Popover>
</template>

<style scoped>
.swatch-dot {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.colors {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px 6px;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.swatch {
  aspect-ratio: 1;
  border: 0;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  cursor: pointer;
}

.swatch.on {
  box-shadow:
    0 0 0 2px var(--surface-3),
    0 0 0 4px var(--accent);
}

.hex {
  background: var(--surface-2);
  text-transform: lowercase;
}
</style>
