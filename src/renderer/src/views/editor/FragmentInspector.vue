<script setup lang="ts">
import { computed } from 'vue'
import { findAsset } from '@shared/resolve'
import type { Fragment, Round } from '@shared/types'
import Icon from '../../components/Icon.vue'
import ImageChip from '../../components/ImageChip.vue'
import MediaPicker from '../../components/MediaPicker.vue'
import Select from '../../components/Select.vue'
import TimeInput from '../../components/TimeInput.vue'
import Waveform from '../../components/Waveform.vue'
import { usePreviewPlayer } from '../../lib/use-preview-player'
import { useWaveform } from '../../lib/waveform'
import { useSession } from '../../stores/session'
import { locale } from '../../lib/locale'
import { FRAGMENT_MESSAGES } from './editor-messages'

/** Paneel rechts voor het gekozen fragment: wat er speelt, het bestand en het geluid. */
const props = defineProps<{ round: Round; fragment: Fragment }>()
const emit = defineEmits<{ select: [id: string | null] }>()
const session = useSession()
const t = FRAGMENT_MESSAGES.in(locale)
const quiz = computed(() => session.quiz!)
const preview = usePreviewPlayer()
const index = computed(() => props.round.fragments.indexOf(props.fragment))
const asset = computed(() => findAsset(quiz.value, props.fragment.assetId))

// ── Waveform van het hele bestand, met het gekozen stuk tussen twee grepen ──────────────────
const { bars, duration } = useWaveform(() => ({ asset: asset.value }), 160)
const selection = computed((): [number, number] | null => {
  const f = props.fragment
  const d = duration.value
  return d ? [(f.start ?? 0) / d, Math.min(1, (f.end ?? d) / d)] : null
})
/** Bij luisteren loopt de lijn mee over het hele bestand. */
const listening = computed(() => {
  const d = duration.value
  return d && preview.playingId.value === props.fragment.id ? preview.position.value / d : null
})

/** Begin en eind uit de grepen, op een tiende seconde; helemaal aan de rand = geen grens. */
function select([a, b]: [number, number]) {
  const d = duration.value
  if (!d) return
  const tenth = (v: number) => Math.round(v * 10) / 10
  const start = tenth(a * d)
  const end = tenth(b * d)
  props.fragment.start = start > 0 ? start : undefined
  props.fragment.end = end < tenth(d) ? end : undefined
}

function listen() {
  const f = props.fragment
  preview.toggle(f.id, asset.value ?? null, f.start ?? 0, f.end)
}

/** Leeg of ongeldig → fallback, zodat er nooit een lege string in de quiz belandt. */
function numberFrom(event: Event, fallback: number): number {
  const value = parseFloat((event.target as HTMLInputElement).value.replace(',', '.'))
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function move(delta: number) {
  const to = index.value + delta
  if (to < 0 || to >= props.round.fragments.length) return
  props.round.fragments.splice(index.value, 1)
  props.round.fragments.splice(to, 0, props.fragment)
}

function remove() {
  const i = index.value
  props.round.fragments.splice(i, 1)
  const next = props.round.fragments[Math.min(i, props.round.fragments.length - 1)]
  emit('select', next?.id ?? null)
}
</script>

<template>
  <div class="fragment-inspector">
    <div class="inspector-group">
      <div class="wave-head">
        <span class="label grow">{{ t('playing') }}</span>
        <button class="btn btn-ghost btn-sm" :disabled="!asset" @click="listen">
          <Icon :name="preview.playingId.value === fragment.id ? 'stop' : 'play'" :size="12" />
          {{ preview.playingId.value === fragment.id ? t('stop') : t('listen') }}
        </button>
      </div>
      <MediaPicker v-model="fragment.assetId" :kinds="['audio']" size="sm" :aria-label="t('file')" />
      <Waveform
        class="edit-wave"
        :bars="bars"
        :selection="selection"
        :progress="listening"
        :step="0.5 / (duration || 1)"
        :min-length="0.5 / (duration || 1)"
        @select="select"
      />
      <div class="times">
        <label class="field">
          <span class="label">{{ t('start') }}</span>
          <TimeInput v-model="fragment.start" placeholder="0:00" :aria-label="t('start')" />
        </label>
        <label class="field">
          <span class="label">{{ t('end') }}</span>
          <TimeInput
            v-model="fragment.end"
            :placeholder="t('endPlaceholder')"
            :aria-label="t('end')"
          />
        </label>
      </div>
    </div>

    <div class="inspector-group">
      <div class="inspector-row">
        <span class="row-label">{{ t('onAnswer') }}</span>
        <ImageChip v-model="fragment.answerImageAssetId" :label="t('answerImage')" field />
      </div>
    </div>

    <div class="inspector-group">
      <span class="label">{{ t('sound') }}</span>
      <div v-if="quiz.channels.length > 1" class="inspector-row">
        <span class="row-label">{{ t('channel') }}</span>
        <Select
          v-model="fragment.channelId"
          size="sm"
          :aria-label="t('channel')"
          :options="quiz.channels.map((c) => ({ value: c.id, label: c.name }))"
        />
      </div>
      <div class="times">
        <label class="field">
          <span class="label">{{ t('fadeIn') }}</span>
          <span class="seconds">
            <input
              :value="fragment.fadeIn ?? 0"
              type="number"
              min="0"
              step="0.1"
              class="input input-sm"
              :aria-label="t('fadeInSeconds')"
              @change="fragment.fadeIn = numberFrom($event, 0)"
            />
            <span class="muted">{{ t('seconds') }}</span>
          </span>
        </label>
        <label class="field">
          <span class="label">{{ t('fadeOut') }}</span>
          <span class="seconds">
            <input
              :value="fragment.fadeOut ?? 0"
              type="number"
              min="0"
              step="0.1"
              class="input input-sm"
              :aria-label="t('fadeOutSeconds')"
              @change="fragment.fadeOut = numberFrom($event, 0)"
            />
            <span class="muted">{{ t('seconds') }}</span>
          </span>
        </label>
      </div>
    </div>

    <footer class="foot">
      <button class="btn btn-ghost btn-sm" :disabled="index === 0" @click="move(-1)">
        <Icon name="left" :size="14" class="turn" /> {{ t('moveUp') }}
      </button>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="index === round.fragments.length - 1"
        @click="move(1)"
      >
        <Icon name="right" :size="14" class="turn" /> {{ t('moveDown') }}
      </button>
      <span class="grow" />
      <button class="btn btn-ghost btn-sm" @click="remove">
        <Icon name="trash" :size="14" /> {{ t('remove') }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.fragment-inspector {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.wave-head {
  display: flex;
  align-items: center;
  margin-right: -8px;
}

.edit-wave {
  --wave: rgba(160, 180, 220, 0.45);
  height: 64px;
  margin-top: 4px;
  padding: 6px 0;
  border-radius: var(--radius);
  background: var(--surface-1);
}

.times {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 4px;
}

.seconds {
  display: flex;
  align-items: center;
  gap: 8px;
}

.seconds .input {
  flex: 1;
  min-width: 0;
}

.foot {
  display: flex;
  gap: 2px;
  margin: 0 -8px;
}

.turn {
  transform: rotate(90deg);
}
</style>
