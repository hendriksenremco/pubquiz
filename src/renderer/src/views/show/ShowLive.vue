<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { ShowCommand } from '@shared/ipc'
import { activeRound } from '@shared/resolve'
import Icon from '../../components/Icon.vue'
import ScreenStage from '../../components/ScreenStage.vue'
import { useSession } from '../../stores/session'
import FragmentPad from './FragmentPad.vue'
import Mixer from './Mixer.vue'

const api = window.pubquiz
const session = useSession()
const quiz = computed(() => session.quiz!)
const state = computed(() => session.state)
const round = computed(() => activeRound(quiz.value, state.value))
const send = (command: ShowCommand) => api.command(command)

const nextRound = computed(() => {
  const ref = state.value.activeRoundId ?? state.value.lastRoundId
  const index = ref ? quiz.value.rounds.findIndex((r) => r.id === ref) : -1
  return quiz.value.rounds[index + 1] ?? null
})
const allBlack = computed(
  () =>
    quiz.value.screens.length > 0 &&
    quiz.value.screens.every((s) => state.value.blackout.includes(s.id))
)

/** Geluid uit = fragment stopt én achtergrond uit; weer aan zet de achtergrond terug. */
const muted = computed(() => !state.value.backgroundEnabled)
function toggleSound() {
  send(muted.value ? { type: 'toggleBackground' } : { type: 'stopAll' })
}

function toggleBlackout(screenId?: string) {
  const on = screenId ? !state.value.blackout.includes(screenId) : !allBlack.value
  send({ type: 'blackout', screenId, on })
}

async function stopShow() {
  if (confirm('Show stoppen? De schermen gaan uit en de muziek stopt.')) await api.stopShow()
}

function toggleAutoplay() {
  const ap = state.value.autoplay
  if (ap.status === 'idle') send({ type: 'autoplay', action: 'start' })
  else if (ap.status === 'paused' || (ap.status === 'playing' && ap.holdAfter))
    send({ type: 'autoplay', action: 'resume' })
  else send({ type: 'autoplay', action: 'pause' })
}

const KEYS: Record<string, () => void> = {
  ArrowRight: () => send({ type: 'nextSlide' }),
  PageDown: () => send({ type: 'nextSlide' }),
  ArrowLeft: () => send({ type: 'prevSlide' }),
  PageUp: () => send({ type: 'prevSlide' }),
  Enter: () => send({ type: 'nextRound' }),
  e: () => send({ type: 'endRound' }),
  ' ': () => send({ type: 'stopFragment' }),
  a: toggleAutoplay,
  s: () => send({ type: 'autoplay', action: 'skip' }),
  b: () => toggleBlackout(),
  m: toggleSound
}

function onKey(event: KeyboardEvent) {
  const el = event.target as HTMLElement
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && el.getAttribute('type') !== 'range')
    return

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (/^[1-9]$/.test(key)) {
    const fragment = round.value?.fragments[Number(key) - 1]
    if (fragment) send({ type: 'playFragment', fragmentId: fragment.id })
  } else if (KEYS[key]) {
    KEYS[key]()
  } else {
    return
  }
  event.preventDefault()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const SHORTCUTS: [string, string][] = [
  ['← →', 'Vorige/volgende slide'],
  ['Enter', 'Start volgende ronde'],
  ['E', 'Einde ronde'],
  ['1–9', 'Speel fragment'],
  ['Spatie', 'Stop fragment'],
  ['A', 'Reeks start/pauze'],
  ['S', 'Volgende in reeks'],
  ['B', 'Beeld op zwart / terug'],
  ['M', 'Geluid uit / aan']
]
</script>

<template>
  <div class="live">
    <header class="bar">
      <div class="status">
        <span class="pill pill-live"><span class="dot" />Live</span>
        <button
          class="btn btn-ghost btn-sm"
          title="Beëindig de show: schermen sluiten en de muziek stopt"
          @click="stopShow"
        >
          <Icon name="power" :size="14" /> Stop show
        </button>
      </div>

      <div class="now grow">
        <span class="eyebrow">Nu</span>
        <span class="now-title">{{ round?.title ?? 'Tussen rondes (standaard)' }}</span>
      </div>

      <!-- Rondeverloop: wat je de hele avond gebruikt. -->
      <div class="group" role="group" aria-label="Ronde">
        <button
          class="btn"
          :disabled="!round"
          title="Schermen en muziek terug naar de standaard"
          @click="send({ type: 'endRound' })"
        >
          <Icon name="end" :size="14" /> Einde ronde <span class="kbd">E</span>
        </button>
        <button
          class="btn btn-primary next"
          :disabled="!nextRound"
          :title="nextRound ? `Start ${nextRound.title}` : undefined"
          @click="send({ type: 'nextRound' })"
        >
          <Icon name="next" :size="14" />
          <span class="next-label">{{ nextRound ? `Start ${nextRound.title}` : 'Laatste ronde' }}</span>
          <span class="kbd">⏎</span>
        </button>
      </div>

      <!-- Noodknoppen: beeld en geluid, allebei terug te draaien. -->
      <div class="group" role="group" aria-label="Beeld en geluid">
        <button
          class="btn"
          :class="{ alert: allBlack }"
          :title="allBlack ? 'Alle schermen tonen weer hun beeld' : 'Alle schermen op zwart'"
          @click="toggleBlackout()"
        >
          <Icon :name="allBlack ? 'monitor' : 'screen-off'" :size="15" />
          {{ allBlack ? 'Beeld terug' : 'Beeld op zwart' }}
          <span class="kbd">B</span>
        </button>
        <button
          class="btn"
          :class="{ alert: muted }"
          :title="
            muted ? 'Achtergrondmuziek weer aan' : 'Fragment stopt en achtergrondmuziek gaat uit'
          "
          @click="toggleSound"
        >
          <Icon :name="muted ? 'volume' : 'volume-off'" :size="15" />
          {{ muted ? 'Geluid aan' : 'Geluid uit' }}
          <span class="kbd">M</span>
        </button>
      </div>
    </header>

    <div class="cols">
      <aside class="rounds scroll">
        <div class="eyebrow">Rondes</div>
        <button
          v-for="(r, i) in quiz.rounds"
          :key="r.id"
          class="round"
          :class="{ on: r.id === state.activeRoundId, next: r.id === nextRound?.id }"
          @click="send({ type: 'startRound', roundId: r.id })"
        >
          <span class="mono num">{{ i + 1 }}</span>
          <span class="grow">
            <span class="round-title">{{ r.title }}</span>
            <span class="round-sub">
              {{ r.fragments.length ? `${r.fragments.length} fragmenten` : '' }}
              {{ Object.keys(r.screens).length ? '· eigen scherm' : '' }}
            </span>
          </span>
          <span v-if="r.id === state.activeRoundId" class="pill pill-live">nu</span>
          <span v-else-if="r.id === nextRound?.id" class="pill">volgende</span>
        </button>
      </aside>

      <main class="center scroll">
        <section class="screens">
          <div v-for="slot in quiz.screens" :key="slot.id" class="screen">
            <div class="frame" :class="{ black: state.blackout.includes(slot.id) }">
              <ScreenStage :quiz="quiz" :state="state" :screen-id="slot.id" preview />
            </div>
            <div class="row">
              <span class="grow screen-name">{{ slot.name }}</span>
              <button
                class="btn btn-sm"
                :class="{ active: state.blackout.includes(slot.id) }"
                @click="toggleBlackout(slot.id)"
              >
                Zwart
              </button>
            </div>
          </div>
        </section>

        <section v-if="round && round.slides.length" class="card">
          <header class="card-head">
            <h3 class="grow">Slides</h3>
            <button class="btn btn-sm btn-icon" @click="send({ type: 'prevSlide' })">←</button>
            <button class="btn btn-sm btn-icon" @click="send({ type: 'nextSlide' })">→</button>
          </header>
          <div class="card-body slides">
            <button
              class="slide"
              :class="{ on: state.slideIndex === -1 }"
              @click="send({ type: 'setSlide', index: -1 })"
            >
              <span class="slide-kind">—</span>
              <span>Geen slide</span>
            </button>
            <button
              v-for="(s, i) in round.slides"
              :key="s.id"
              class="slide"
              :class="{ on: state.slideIndex === i }"
              @click="send({ type: 'setSlide', index: i })"
            >
              <span class="slide-kind">{{ i + 1 }}</span>
              <span class="slide-text">{{ s.title || s.body || '(leeg)' }}</span>
            </button>
          </div>
        </section>

        <FragmentPad v-if="round && round.fragments.length" :round="round" />

        <div v-if="!round" class="between">
          <p>
            Alle schermen tonen hun standaard. Start de volgende ronde met
            <span class="kbd">⏎</span>.
          </p>
        </div>
      </main>

      <aside class="side scroll">
        <Mixer />
        <section v-if="round?.hostNotes" class="card">
          <header class="card-head"><h3>Notities</h3></header>
          <div class="card-body notes">{{ round.hostNotes }}</div>
        </section>
        <section class="card">
          <header class="card-head"><h3>Sneltoetsen</h3></header>
          <div class="card-body shortcuts">
            <template v-for="[k, label] in SHORTCUTS" :key="k">
              <span class="kbd">{{ k }}</span>
              <span class="muted">{{ label }}</span>
            </template>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.live {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}

.now {
  display: flex;
  flex-direction: column;
  margin-left: 6px;
  min-width: 0;
}

.now-title {
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status .btn {
  color: var(--muted);
}

.status .btn:hover {
  color: var(--text);
}

/* Knoppen die bij elkaar horen in één vlak; tussen groepen ruimte. */
.group {
  display: flex;
  gap: 3px;
  margin-left: 12px;
  padding: 3px;
  border-radius: 12px;
  background: var(--surface-2);
}

.group .btn {
  height: 34px;
  background: transparent;
}

.group .btn:hover:not(:disabled) {
  background: var(--surface-3);
}

.group .btn-primary,
.group .btn-primary:hover:not(:disabled) {
  background: var(--accent);
}

.group .btn.alert,
.group .btn.alert:hover:not(:disabled) {
  background: var(--live-soft);
  color: var(--live);
}

.next {
  max-width: 320px;
}

.next-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.cols {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 280px;
}

.rounds {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-right: 1px solid var(--line);
  background: var(--panel);
}

.round {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.round:hover {
  background: var(--panel-2);
}

.round.on {
  border-color: var(--live);
  background: var(--live-soft);
}

.round.next {
  border-color: var(--line-strong);
}

.num {
  width: 18px;
  text-align: right;
  color: var(--faint);
}

.round-title {
  display: block;
  font-weight: 600;
}

.round-sub {
  display: block;
  font-size: 11px;
  color: var(--muted);
}

.center {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.screens {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.screen {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.frame {
  aspect-ratio: 16 / 9;
  border: 2px solid var(--live);
  border-radius: var(--radius);
  overflow: hidden;
  background: #000;
}

.frame.black {
  border-color: var(--line-strong);
}

.screen-name {
  font-weight: 600;
}

.slides {
  display: flex;
  gap: 8px;
  overflow-x: auto;
}

.slide {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  flex: 0 0 150px;
  height: 72px;
  padding: 8px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  background: var(--panel-2);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.slide.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.slide-kind {
  font: 700 12px var(--mono);
  color: var(--muted);
}

.slide-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.between {
  padding: 24px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-lg);
  color: var(--muted);
  text-align: center;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  border-left: 1px solid var(--line);
}

.notes {
  white-space: pre-wrap;
  user-select: text;
}

.shortcuts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 10px;
  align-items: center;
  font-size: 12px;
}

.shortcuts .kbd {
  justify-self: start;
}
</style>
