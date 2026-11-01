<script setup lang="ts">
import { computed } from 'vue'
import {
  channelVolume,
  findAsset,
  resolveAudio,
  resolveScreen,
  screenHasSound,
  screenVolume
} from '@shared/resolve'
import Icon from '../../components/Icon.vue'
import { vFill } from '../../lib/fill'
import { percent } from '../../lib/format'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { MIXER_MESSAGES } from './live-messages'

const t = MIXER_MESSAGES.in(locale)
const api = window.pubquiz
const session = useSession()
const quiz = computed(() => session.quiz!)

const background = computed(() => resolveAudio(quiz.value, session.state).background)
const backgroundName = computed(() => findAsset(quiz.value, background.value?.assetId)?.name)
const backgroundStatus = computed(() => {
  const bg = background.value
  if (!bg) return { text: t('none'), cls: '' }
  if (!session.state.backgroundEnabled) return { text: t('off'), cls: 'pill-live' }
  if (!bg.playing) return { text: t('pausedByRound'), cls: 'pill-warn' }
  if (bg.ducked) return { text: t('ducked'), cls: 'pill-accent' }
  return { text: t('playing'), cls: 'pill-ok' }
})

function setVolume(id: string, event: Event) {
  api.command({ type: 'setVolume', id, volume: Number((event.target as HTMLInputElement).value) })
}

/** Schermen die ergens in de quiz een video met geluid spelen. */
const soundScreens = computed(() =>
  quiz.value.screens
    .filter(
      (slot) =>
        screenHasSound(quiz.value, slot.id) && session.hardware.screens[slot.id]?.kind !== 'off'
    )
    .map((slot) => {
      const sound = resolveScreen(quiz.value, session.state, slot.id).sound
      const target = session.hardware.screens[slot.id]
      const choice = session.hardware.screenSound[slot.id]
      return {
        slot,
        status: !sound ? t('silent') : sound.ducked ? t('ducked') : null,
        ducked: !!sound?.ducked,
        device:
          choice?.label ??
          (target?.kind === 'display'
            ? t('speakersOf', { name: target.label })
            : t('systemDefault'))
      }
    })
)
</script>

<template>
  <section class="mixer" :aria-label="t('sound')">
    <span class="label">{{ t('sound') }}</span>
    <div class="stack">
      <div class="bg">
        <div class="row">
          <span class="label grow">{{ t('background') }}</span>
          <span class="pill" :class="backgroundStatus.cls">{{ backgroundStatus.text }}</span>
        </div>
        <div v-if="backgroundName" class="bg-name">{{ backgroundName }}</div>
        <button
          v-if="quiz.background"
          class="btn btn-sm"
          @click="api.command({ type: 'toggleBackground' })"
        >
          {{ session.state.backgroundEnabled ? t('turnOff') : t('turnOn') }}
        </button>
      </div>

      <div
        v-for="c in quiz.channels"
        :key="c.id"
        class="channel"
        :title="session.hardware.audio[c.id]?.label ?? t('systemDefault')"
      >
        <div class="row">
          <span class="label grow">{{ c.name }}</span>
          <span class="mono muted pct">{{
            percent(channelVolume(quiz, session.state, c.id))
          }}</span>
        </div>
        <input
          v-fill
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="channelVolume(quiz, session.state, c.id)"
          @input="setVolume(c.id, $event)"
        />
      </div>

      <div
        v-for="s in soundScreens"
        :key="s.slot.id"
        class="channel screen-sound"
        :title="s.device"
      >
        <div class="row">
          <Icon name="monitor" :size="14" class="faint" />
          <span class="label grow">{{ s.slot.name }}</span>
          <span v-if="s.status" class="pill" :class="{ 'pill-accent': s.ducked }">{{
            s.status
          }}</span>
          <span class="mono muted pct">{{ percent(screenVolume(session.state, s.slot.id)) }}</span>
        </div>
        <input
          v-fill
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="screenVolume(session.state, s.slot.id)"
          :aria-label="t('videoSound', { name: s.slot.name })"
          @input="setVolume(s.slot.id, $event)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.mixer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bg {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bg-name {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bg .btn {
  align-self: flex-start;
}

.channel {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.channel input {
  width: 100%;
}

.pct {
  font-size: 12px;
}
</style>
