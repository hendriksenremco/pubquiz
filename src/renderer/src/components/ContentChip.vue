<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { findAsset } from '@shared/resolve'
import type { ScreenContent } from '@shared/types'
import { vFill } from '../lib/fill'
import { percent } from '../lib/format'
import { locale } from '../lib/locale'
import { useSession } from '../stores/session'
import AssetGrid from './AssetGrid.vue'
import Icon from './Icon.vue'
import MediaThumb from './MediaThumb.vue'
import { COMPONENT_MESSAGES } from './messages'
import Popover from './Popover.vue'

type Choice = 'default' | 'video' | 'image' | 'black'

/**
 * Chip "Beamer · music-loop" die openklapt tot een keuze met thumbnails.
 * Met allowDefault betekent undefined: de standaard van het scherm. Met `field` oogt hij als een
 * veld, voor het paneel rechts waar de naam van het scherm ernaast staat.
 */
const props = withDefaults(
  defineProps<{
    label: string
    allowDefault?: boolean
    fallback?: ScreenContent
    field?: boolean
  }>(),
  { allowDefault: false, fallback: undefined, field: false }
)
const model = defineModel<ScreenContent | undefined>()
/** Ronde-editor: de standaard tonen, maar zonder videogeluid. */
const muted = defineModel<boolean>('muted', { default: false })
const emit = defineEmits<{ opened: [] }>()

const session = useSession()
const t = COMPONENT_MESSAGES.in(locale)
const current = (): Choice => model.value?.type ?? (props.allowDefault ? 'default' : 'black')
const choice = ref<Choice>(current())
watch(model, () => {
  choice.value = current()
  // Met eigen content geldt het geluid van die content.
  if (model.value && muted.value) muted.value = false
})

const OPTIONS: { value: Choice; label: string }[] = [
  { value: 'default', label: t('standard') },
  { value: 'video', label: t('video') },
  { value: 'image', label: t('image') },
  { value: 'black', label: t('black') }
]
const options = computed(() => (props.allowDefault ? OPTIONS : OPTIONS.slice(1)))

/** Wat het scherm werkelijk toont, voor de thumbnail in de chip. */
const shown = computed(() => model.value ?? props.fallback ?? { type: 'black' as const })
const shownAsset = computed(() =>
  shown.value.type === 'black' ? null : findAsset(session.quiz!, shown.value.assetId)
)
const valueText = computed(() => {
  if (!model.value) return t('standard')
  if (model.value.type === 'black') return t('black')
  return shownAsset.value?.name.replace(/\.[^.]+$/, '') ?? t('missingFile')
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
  shownMuted.value ? t('withoutSound') : shownHasSound.value ? t('withSound') : ''
)
const title = computed(
  () =>
    t('labelValue', {
      label: props.label,
      value: model.value ? (shownAsset.value?.name ?? valueText.value) : t('standard')
    }) + soundNote.value
)
</script>

<template>
  <Popover :width="420" :block="field">
    <template #trigger="{ open, toggle }">
      <button
        v-if="field"
        type="button"
        class="picker"
        :class="{ open }"
        :aria-label="label"
        :title="title"
        @click="(toggle(), emit('opened'))"
      >
        <MediaThumb :asset="shownAsset" :black="shown.type === 'black'" class="chip-thumb" />
        <span class="value" :class="{ none: allowDefault && !model }">{{ valueText }}</span>
        <Icon
          v-if="shownHasSound"
          :name="shownMuted ? 'volume-off' : 'volume'"
          :size="14"
          class="chip-sound"
        />
        <Icon name="chevron" :size="14" class="chev" />
      </button>
      <button
        v-else
        type="button"
        class="chip"
        :class="{ open, dimmed: allowDefault && !model && !shownMuted }"
        :title="title"
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
      <p v-else-if="choice === 'default'" class="muted note">{{ t('showsQuizDefault') }}</p>

      <div v-if="choice === 'default' && defaultHasSound" class="sound">
        <label class="row">
          <input v-model="defaultSound" type="checkbox" />
          <span>{{ t('videoSound') }}</span>
        </label>
        <p class="muted hint">
          {{ muted ? t('mutedThisRound') : t('asQuiz') }}
        </p>
      </div>

      <div v-if="model?.type === 'video'" class="sound">
        <label class="row">
          <input v-model="soundOn" type="checkbox" />
          <span>{{ t('videoSound') }}</span>
        </label>
        <template v-if="soundOn">
          <label class="row volume">
            <input
              v-model.number="soundVolume"
              v-fill
              type="range"
              min="0"
              max="1"
              step="0.01"
              class="grow"
              :aria-label="t('videoVolume')"
            />
            <span class="mono pct">{{ percent(soundVolume) }}</span>
          </label>
          <p class="muted hint">
            {{ t('videoSoundHint') }}
          </p>
        </template>
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.chip-thumb {
  flex: none;
  width: 30px;
  height: 18px;
  border-radius: 4px;
}

.picker .chip-thumb {
  margin-left: -4px;
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
