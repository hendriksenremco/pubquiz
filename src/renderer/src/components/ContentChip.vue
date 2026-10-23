<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { findAsset } from '@shared/resolve'
import type { ScreenContent } from '@shared/types'
import { percent } from '../lib/format'
import { useSession } from '../stores/session'
import AssetGrid from './AssetGrid.vue'
import Icon from './Icon.vue'
import MediaThumb from './MediaThumb.vue'
import Popover from './Popover.vue'

type Choice = 'default' | 'video' | 'image' | 'black'

/**
 * Chip "Beamer · music-loop" die openklapt tot een keuze met thumbnails.
 * Met allowDefault betekent undefined: de standaard van het scherm.
 */
const props = withDefaults(
  defineProps<{ label: string; allowDefault?: boolean; fallback?: ScreenContent }>(),
  { allowDefault: false, fallback: undefined }
)
const model = defineModel<ScreenContent | undefined>()
/** Ronde-editor: de standaard tonen, maar zonder videogeluid. */
const muted = defineModel<boolean>('muted', { default: false })
const emit = defineEmits<{ opened: [] }>()

const session = useSession()
const current = (): Choice => model.value?.type ?? (props.allowDefault ? 'default' : 'black')
const choice = ref<Choice>(current())
watch(model, () => {
  choice.value = current()
  // Met eigen content geldt het geluid van die content.
  if (model.value && muted.value) muted.value = false
})

const OPTIONS: { value: Choice; label: string }[] = [
  { value: 'default', label: 'Standaard' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Afbeelding' },
  { value: 'black', label: 'Zwart' }
]
const options = computed(() => (props.allowDefault ? OPTIONS : OPTIONS.slice(1)))

/** Wat het scherm werkelijk toont, voor de thumbnail in de chip. */
const shown = computed(() => model.value ?? props.fallback ?? { type: 'black' as const })
const shownAsset = computed(() =>
  shown.value.type === 'black' ? null : findAsset(session.quiz!, shown.value.assetId)
)
const valueText = computed(() => {
  if (!model.value) return 'Standaard'
  if (model.value.type === 'black') return 'Zwart'
  return shownAsset.value?.name.replace(/\.[^.]+$/, '') ?? 'Ontbrekend bestand'
})

function choose(value: Choice) {
  choice.value = value
  if (value === 'default') model.value = undefined
  else if (value === 'black') model.value = { type: 'black' }
}

const assetId = computed({
  get: () =>
    model.value && model.value.type === choice.value && model.value.type !== 'black'
      ? model.value.assetId
      : undefined,
  set: (id) => {
    if (!id) return
    if (choice.value === 'video') {
      const volume = model.value?.type === 'video' ? model.value.volume : undefined
      model.value = { type: 'video', assetId: id, ...(volume !== undefined ? { volume } : {}) }
    } else if (choice.value === 'image') {
      model.value = { type: 'image', assetId: id }
    }
  }
})

// Videogeluid gaat naar de speakers van het scherm; zonder volume is de video stil.
const DEFAULT_VOLUME = 0.8
const soundOn = computed({
  get: () => model.value?.type === 'video' && model.value.volume !== undefined,
  set: (on: boolean) => {
    if (model.value?.type !== 'video') return
    const { volume: _, ...video } = model.value
    model.value = on ? { ...video, volume: DEFAULT_VOLUME } : video
  }
})
const soundVolume = computed({
  get: () => (model.value?.type === 'video' ? (model.value.volume ?? 0) : 0),
  set: (volume: number) => {
    if (model.value?.type === 'video') model.value = { ...model.value, volume }
  }
})
const shownHasSound = computed(
  () => shown.value.type === 'video' && shown.value.volume !== undefined
)
const shownMuted = computed(() => shownHasSound.value && !model.value && muted.value)

/** Standaard gekozen en die speelt een video met geluid: per ronde uit te zetten. */
const defaultHasSound = computed(() => props.allowDefault && !model.value && shownHasSound.value)
const defaultSound = computed({
  get: () => !muted.value,
  set: (on: boolean) => (muted.value = !on)
})
const soundNote = computed(() =>
  shownMuted.value ? ', zonder geluid' : shownHasSound.value ? ', met geluid' : ''
)
</script>

<template>
  <Popover :width="420">
    <template #trigger="{ open, toggle }">
      <button
        type="button"
        class="chip"
        :class="{ open, dimmed: allowDefault && !model && !shownMuted }"
        :title="`${label}: ${model ? (shownAsset?.name ?? valueText) : 'Standaard'}${soundNote}`"
        @click="(toggle(), emit('opened'))"
      >
        <MediaThumb :asset="shownAsset" :black="shown.type === 'black'" class="chip-thumb" />
        <span>{{ label }}</span>
        <span class="chip-key chip-value">{{ valueText }}</span>
        <Icon
          v-if="shownHasSound"
          :name="shownMuted ? 'volume-off' : 'volume'"
          :size="14"
          class="chip-sound"
        />
        <Icon name="chevron" :size="14" class="chev" />
      </button>
    </template>

    <div class="body">
      <div class="segments">
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          class="seg"
          :class="{ on: choice === o.value }"
          @click="choose(o.value)"
        >
          {{ o.label }}
        </button>
      </div>

      <AssetGrid v-if="choice === 'video' || choice === 'image'" v-model="assetId" :kind="choice" />
      <p v-else-if="choice === 'default'" class="muted note">Toont wat bij de quiz is ingesteld.</p>

      <div v-if="choice === 'default' && defaultHasSound" class="sound">
        <label class="row">
          <input v-model="defaultSound" type="checkbox" />
          <span>Geluid van de video</span>
        </label>
        <p class="muted hint">
          {{ muted ? 'Stil tijdens deze ronde, daarna klinkt hij weer.' : 'Zoals bij de quiz.' }}
        </p>
      </div>

      <div v-if="model?.type === 'video'" class="sound">
        <label class="row">
          <input v-model="soundOn" type="checkbox" />
          <span>Geluid van de video</span>
        </label>
        <template v-if="soundOn">
          <label class="row volume">
            <input
              v-model.number="soundVolume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              class="grow"
              aria-label="Volume van de video"
            />
            <span class="mono pct">{{ percent(soundVolume) }}</span>
          </label>
          <p class="muted hint">
            Via de speakers van het scherm. Een andere uitgang kies je bij Show.
          </p>
        </template>
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.chip-thumb {
  width: 30px;
  height: 18px;
  border-radius: 4px;
}

.chip.dimmed .chip-key {
  color: var(--faint);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.segments {
  display: flex;
  padding: 3px;
  border-radius: var(--radius);
  background: var(--surface-2);
}

.seg {
  flex: 1;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.seg.on {
  background: var(--surface-4);
  color: var(--text);
}

.note {
  padding: 4px 4px 2px;
  font-size: 12px;
}

.chip-sound {
  color: var(--accent);
}

.sound {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  font-size: 13px;
}

.sound .volume {
  padding-left: 24px;
}

.pct {
  width: 36px;
  color: var(--muted);
  font-size: 12px;
  text-align: right;
}

.hint {
  padding-left: 24px;
  font-size: 12px;
}
</style>
