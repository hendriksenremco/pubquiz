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
import { useSession } from '../../stores/session'

const api = window.pubquiz
const session = useSession()
const quiz = computed(() => session.quiz!)

const background = computed(() => resolveAudio(quiz.value, session.state).background)
const backgroundName = computed(() => findAsset(quiz.value, background.value?.assetId)?.name)
const backgroundStatus = computed(() => {
  const bg = background.value
  if (!bg) return { text: 'Geen', cls: '' }
  if (!session.state.backgroundEnabled) return { text: 'Uit', cls: 'pill-live' }
  if (!bg.playing) return { text: 'Gepauzeerd (ronde)', cls: 'pill-warn' }
  if (bg.ducked) return { text: 'Zachter', cls: 'pill-accent' }
  return { text: 'Speelt', cls: 'pill-ok' }
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
        status: !sound ? 'Stil' : sound.ducked ? 'Zachter' : null,
        device:
          choice?.label ??
          (target?.kind === 'display' ? `Speakers van ${target.label}` : 'Systeemstandaard')
      }
    })
)
</script>

<template>
  <section class="card">
    <header class="card-head"><h3>Audio</h3></header>
    <div class="card-body stack">
      <div class="bg">
        <div class="row">
          <span class="label grow">Achtergrond</span>
          <span class="pill" :class="backgroundStatus.cls">{{ backgroundStatus.text }}</span>
        </div>
        <div v-if="backgroundName" class="bg-name">{{ backgroundName }}</div>
        <button
          v-if="quiz.background"
          class="btn btn-sm"
          @click="api.command({ type: 'toggleBackground' })"
        >
          {{ session.state.backgroundEnabled ? 'Zet uit' : 'Zet aan' }}
        </button>
      </div>

      <div v-for="c in quiz.channels" :key="c.id" class="channel">
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
        <div class="device faint">
          {{ session.hardware.audio[c.id]?.label ?? 'Systeemstandaard' }}
        </div>
      </div>

      <div v-for="s in soundScreens" :key="s.slot.id" class="channel screen-sound">
        <div class="row">
          <Icon name="monitor" :size="14" class="faint" />
          <span class="label grow">{{ s.slot.name }}</span>
          <span v-if="s.status" class="pill" :class="{ 'pill-accent': s.status === 'Zachter' }">{{
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
          :aria-label="`Videogeluid ${s.slot.name}`"
          @input="setVolume(s.slot.id, $event)"
        />
        <div class="device faint">{{ s.device }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bg {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
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

.device {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
