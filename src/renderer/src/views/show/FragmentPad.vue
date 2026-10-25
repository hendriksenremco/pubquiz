<script setup lang="ts">
import { computed } from 'vue'
import { adjacentFragment, autoplayCountdown } from '@shared/autoplay'
import type { AutoplayAction, ShowCommand } from '@shared/ipc'
import type { Round } from '@shared/types'
import { formatTime } from '../../lib/format'
import { useNow } from '../../lib/use-now'
import FragmentWave from './FragmentWave.vue'
import { useSession } from '../../stores/session'

/** `arrows`: ← → bladeren hier door de fragmenten. */
const props = defineProps<{ round: Round; arrows: boolean }>()
const api = window.pubquiz
const session = useSession()
const send = (command: ShowCommand) => api.command(command)

const playing = computed(() => session.state.fragment)
/** Het fragment dat → gaat spelen. */
const upcoming = computed(() => {
  if (!props.arrows) return null
  const ids = props.round.fragments.map((f) => f.id)
  const index = adjacentFragment(ids, session.state.lastFragmentId, 'next')
  return index === null ? null : ids[index]
})
const ap = computed(() => session.state.autoplay)
const now = useNow(100, () => playing.value !== null || ap.value.status === 'gap')

const remaining = computed(() => {
  const f = playing.value
  return f?.duration ? Math.max(0, f.duration - (now.value - f.startedAt) / 1000) : null
})

const status = computed(() => {
  const a = ap.value
  if (a.status === 'idle' || a.roundId !== props.round.id) return null
  if (a.status === 'playing')
    return `Reeks: fragment ${a.index + 1}${a.holdAfter ? ' (stopt hierna)' : ''}`
  if (a.status === 'gap')
    return `Reeks: fragment ${a.nextIndex + 1} over ${autoplayCountdown(a, now.value)} s`
  return `Reeks gepauzeerd, volgende: fragment ${a.nextIndex + 1}`
})

function autoplay(action: AutoplayAction) {
  send({ type: 'autoplay', action })
}

function click(id: string) {
  if (playing.value?.fragmentId === id) send({ type: 'stopFragment' })
  else send({ type: 'playFragment', fragmentId: id })
}
</script>

<template>
  <section class="card pad">
    <header class="card-head">
      <h3 class="grow">Fragmenten</h3>
      <span v-if="status" class="pill pill-accent">{{ status }}</span>
      <template v-if="ap.status === 'idle'">
        <button class="btn btn-primary btn-sm" @click="autoplay('start')">
          ▶ Speel reeks <span class="kbd">A</span>
        </button>
      </template>
      <template v-else>
        <button
          v-if="ap.status === 'paused' || (ap.status === 'playing' && ap.holdAfter)"
          class="btn btn-sm"
          @click="autoplay('resume')"
        >
          Hervat <span class="kbd">A</span>
        </button>
        <button v-else class="btn btn-sm" @click="autoplay('pause')">
          Pauze <span class="kbd">A</span>
        </button>
        <button class="btn btn-sm" @click="autoplay('skip')">
          Volgende <span class="kbd">S</span>
        </button>
        <button class="btn btn-sm btn-danger" @click="autoplay('stop')">Stop reeks</button>
      </template>
      <button
        class="btn btn-ghost btn-sm"
        title="Gespeeld-markeringen wissen"
        @click="send({ type: 'resetPlayed' })"
      >
        Reset
      </button>
    </header>

    <div class="card-body grid">
      <button
        v-for="(f, i) in round.fragments"
        :key="f.id"
        class="frag"
        :class="{
          on: playing?.fragmentId === f.id,
          played: session.state.played.includes(f.id) && playing?.fragmentId !== f.id,
          upcoming: upcoming === f.id
        }"
        @click="click(f.id)"
      >
        <span class="frag-num mono">{{ i + 1 }}</span>
        <span class="frag-label">{{ f.label }}</span>
        <span v-if="f.answer" class="frag-answer">{{ f.answer }}</span>
        <span v-if="playing?.fragmentId === f.id" class="frag-time mono">
          {{ remaining !== null ? `-${formatTime(remaining)}` : 'speelt…' }}
        </span>
        <span v-else-if="upcoming === f.id" class="frag-time frag-next">
          Volgende <span class="kbd">→</span>
        </span>
        <span v-else-if="session.state.played.includes(f.id)" class="frag-time">✓ gespeeld</span>
        <FragmentWave
          class="frag-wave"
          :fragment="f"
          :playing="playing?.fragmentId === f.id && playing.duration ? playing : null"
        />
      </button>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.frag {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-height: 92px;
  padding: 10px 12px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
}

.frag:hover {
  background: var(--surface-3);
}

.frag.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.frag.played {
  opacity: 0.55;
}

/* Wat → gaat spelen; ook als het al eens gespeeld is (na ←). */
.frag.upcoming {
  border-style: dashed;
  border-color: var(--accent);
  opacity: 1;
}

.frag-next {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent);
}

.frag-num {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
}

.frag.on .frag-num {
  color: var(--accent);
}

.frag-label {
  font-weight: 600;
}

.frag-answer {
  font-size: 11px;
  color: var(--muted);
}

.frag-time {
  margin-top: auto;
  font-size: 11px;
  color: var(--muted);
}

.frag-wave {
  --wave: rgba(160, 180, 220, 0.22);
  width: 100%;
  height: 22px;
  margin-top: 6px;
}

.frag.on .frag-wave {
  --wave: rgba(255, 165, 61, 0.3);
}
</style>
