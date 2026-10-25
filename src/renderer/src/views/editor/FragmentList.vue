<script setup lang="ts">
import { computed, ref } from 'vue'
import { findAsset } from '@shared/resolve'
import type { Fragment, Round } from '@shared/types'
import Icon from '../../components/Icon.vue'
import { formatTime } from '../../lib/format'
import { usePreviewPlayer } from '../../lib/use-preview-player'
import { useSession } from '../../stores/session'
import FragmentWave from '../show/FragmentWave.vue'

/**
 * De fragmenten van een ronde: luisteren, naam en antwoord meteen te typen, en de vorm van wat
 * er speelt. Bestand, begin en eind staan in het paneel rechts (FragmentInspector).
 */
defineProps<{ round: Round; selectedId: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()
const session = useSession()
const quiz = computed(() => session.quiz!)
const preview = usePreviewPlayer()
/** Wanneer het voorbeeld begon, zodat de waveform meeloopt. */
const startedAt = ref(0)

function assetOf(f: Fragment) {
  return findAsset(quiz.value, f.assetId)
}

function seconds(f: Fragment): number | null {
  const end = f.end ?? assetOf(f)?.duration
  return end === undefined ? null : end - (f.start ?? 0)
}

function play(f: Fragment) {
  startedAt.value = Date.now()
  preview.toggle(f.id, assetOf(f) ?? null, f.start ?? 0, f.end)
}

function timing(f: Fragment) {
  const duration = seconds(f)
  return preview.playingId.value === f.id && duration
    ? { startedAt: startedAt.value, duration }
    : null
}
</script>

<template>
  <div class="fragment-list">
    <div
      v-for="f in round.fragments"
      :key="f.id"
      class="item track"
      :class="{ on: f.id === selectedId }"
      @click="emit('select', f.id)"
      @focusin="emit('select', f.id)"
    >
      <button
        type="button"
        class="play"
        :class="{ playing: preview.playingId.value === f.id }"
        :aria-label="preview.playingId.value === f.id ? 'Stop' : `Luister naar ${f.label}`"
        @click.stop="play(f)"
      >
        <Icon :name="preview.playingId.value === f.id ? 'stop' : 'play'" :size="12" />
      </button>
      <div class="text">
        <input v-model="f.label" class="quiet title" aria-label="Naam" placeholder="Naam" />
        <input
          v-model="f.answer"
          class="quiet sub"
          aria-label="Antwoord"
          placeholder="Antwoord, voor de antwoordenronde"
        />
        <span v-if="!assetOf(f)" class="missing">Bestand ontbreekt</span>
      </div>
      <FragmentWave class="wave" :fragment="f" :playing="timing(f)" />
      <span class="dur mono">{{ seconds(f) === null ? '' : formatTime(seconds(f)!) }}</span>
    </div>
  </div>
</template>

<style scoped>
.fragment-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 60px;
  padding: 6px 12px 6px 10px;
  border-radius: var(--radius-lg);
}

.item:hover {
  background: var(--surface-1);
}

.item.on {
  background: var(--surface-2);
}

.play {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-3);
  color: var(--text);
  cursor: pointer;
}

.play:hover {
  background: var(--surface-4);
}

.play.playing {
  background: var(--accent);
  color: var(--accent-ink);
}

.text {
  flex: 0 1 260px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 14px;
  font-weight: 600;
}

.sub {
  color: var(--muted);
}

.missing {
  color: var(--warn);
  font-size: 12px;
}

.wave {
  flex: 1;
  min-width: 80px;
  height: 26px;
}

.item.on .wave {
  --wave: rgba(160, 180, 220, 0.5);
}

.dur {
  flex: none;
  width: 40px;
  color: var(--muted);
  text-align: right;
}
</style>
