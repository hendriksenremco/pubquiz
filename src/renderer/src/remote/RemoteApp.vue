<script setup lang="ts">
import { computed, onMounted } from 'vue'
import Icon from '../components/Icon.vue'
import { connect, link, send, toast, view } from './connection'
import LightPanel from './LightPanel.vue'

/**
 * De afstandsbediening op een telefoon of tablet: rondes, slides, beeld op zwart en geluid, en
 * het licht als de plug-in MagicHome-licht aan staat. Volgt de show op de Mac; buiten de show
 * staat alles stil.
 */
const live = computed(() => !!view.value?.live && link.value === 'open')
const round = computed(() => view.value?.round ?? null)
const slide = computed(() => view.value?.slide ?? null)

const status = computed(() => {
  if (link.value === 'lost') return { text: 'Geen verbinding', tone: 'warn' }
  if (!view.value) return { text: 'Verbinden…', tone: 'idle' }
  return view.value.live ? { text: 'Live', tone: 'live' } : { text: 'Niet live', tone: 'idle' }
})

const eyebrow = computed(() => {
  const v = view.value
  if (!v?.live) return ''
  return round.value ? `Ronde ${round.value.number} van ${v.rounds}` : 'Tussen twee rondes'
})

const heading = computed(() => {
  const v = view.value
  if (!v) return 'Verbinden met de Mac…'
  if (!v.quiz) return 'Geen quiz open op de Mac'
  if (!v.live) return 'Start de show op de Mac'
  return round.value?.title ?? (v.nextRound ? `Hierna: ${v.nextRound}` : 'Dit was de laatste ronde')
})

const slideLabel = computed(() => {
  const s = slide.value
  if (!s) return round.value ? 'Geen slides in deze ronde' : 'Slides'
  return s.index === -1
    ? `Geen slide, ${s.count} in deze ronde`
    : `Slide ${s.index + 1} van ${s.count}`
})

onMounted(connect)
</script>

<template>
  <div v-if="link === 'denied'" class="denied">
    <h1>Scan de QR-code opnieuw</h1>
    <p class="muted">
      Deze link werkt niet meer. De QR-code staat op de Mac, onder Telefoon in de werkbalk van de
      show.
    </p>
  </div>

  <div v-else class="remote">
    <header class="top">
      <span class="quiz">{{ view?.quiz ?? 'QuizNote' }}</span>
      <span class="status" :class="status.tone"><span class="dot" />{{ status.text }}</span>
    </header>

    <p v-if="link === 'lost'" class="banner" role="status">
      Verbinding met de Mac kwijt. Opnieuw verbinden…
    </p>

    <main class="controls" :class="{ idle: !live }">
      <section class="now">
        <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
        <h1>{{ heading }}</h1>
      </section>

      <section class="card" aria-label="Slides">
        <div class="slide-info">
          <span class="eyebrow">{{ slideLabel }}</span>
          <p v-if="slide?.text" class="slide-text">{{ slide.text }}</p>
        </div>
        <div class="pair">
          <button
            class="key"
            :disabled="!live || !slide?.prev"
            aria-label="Vorige slide"
            @click="send({ type: 'slide', direction: 'prev' })"
          >
            <Icon name="left" :size="34" />
          </button>
          <button
            class="key primary"
            :disabled="!live || !slide?.next"
            aria-label="Volgende slide"
            @click="send({ type: 'slide', direction: 'next' })"
          >
            <Icon name="right" :size="34" />
          </button>
        </div>
      </section>

      <section class="pair" aria-label="Rondes">
        <button
          class="tile"
          :disabled="!live || !view?.prevRound"
          @click="send({ type: 'round', direction: 'prev' })"
        >
          <span class="tile-label"><Icon name="left" :size="16" />Vorige ronde</span>
          <span class="tile-sub">{{ view?.prevRound ?? '–' }}</span>
        </button>
        <button
          class="tile end"
          :disabled="!live || !view?.nextRound"
          @click="send({ type: 'round', direction: 'next' })"
        >
          <span class="tile-label">Volgende ronde<Icon name="right" :size="16" /></span>
          <span class="tile-sub">{{ view?.nextRound ?? '–' }}</span>
        </button>
      </section>

      <section class="pair">
        <button
          class="tile toggle"
          :class="{ alert: view?.blackout }"
          :disabled="!live || !view?.screens"
          @click="send({ type: 'blackout', on: !view?.blackout })"
        >
          <Icon :name="view?.blackout ? 'monitor' : 'screen-off'" :size="22" />
          <span class="tile-label">{{ view?.blackout ? 'Beeld terug' : 'Beeld op zwart' }}</span>
        </button>
        <button
          class="tile toggle"
          :class="{ alert: view?.muted }"
          :disabled="!live"
          @click="send({ type: 'mute', on: !view?.muted })"
        >
          <Icon :name="view?.muted ? 'volume' : 'volume-off'" :size="22" />
          <span class="tile-label">{{ view?.muted ? 'Geluid aan' : 'Geluid uit' }}</span>
        </button>
      </section>
    </main>

    <LightPanel
      v-if="view?.light"
      :light="view.light"
      :disabled="!live"
      @choose="send({ type: 'light', light: $event })"
    />

    <p v-if="toast" class="toast" role="alert">{{ toast }}</p>
  </div>
</template>

<style>
/* Op de telefoon scrollt de pagina wel; de app zelf op de Mac niet. */
body[data-route='remote'] {
  overflow-y: auto;
  font-size: 15px;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: transparent;
}

body[data-route='remote'] #app {
  height: auto;
  min-height: 100%;
}

body[data-route='remote'] button {
  touch-action: manipulation;
}
</style>

<style scoped>
.remote,
.denied {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 560px;
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top) + 14px) calc(env(safe-area-inset-right) + 16px)
    calc(env(safe-area-inset-bottom) + 28px) calc(env(safe-area-inset-left) + 16px);
}

.denied {
  justify-content: center;
  min-height: 100vh;
  gap: 10px;
  text-align: center;
}

.denied h1 {
  font-size: 26px;
}

.top {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
}

.quiz {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 11px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
}

.status .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.status.live {
  background: var(--live-soft);
  color: var(--live);
}

.status.warn {
  background: var(--warn-soft);
  color: var(--warn);
}

.banner {
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  background: var(--warn-soft);
  color: var(--warn);
  font-weight: 600;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.now {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 2px 6px;
}

.eyebrow {
  font-size: 13px;
}

h1 {
  font-size: 28px;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: var(--radius-xl);
  background: var(--surface-1);
}

.slide-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 46px;
  padding: 0 2px;
}

.slide-text {
  display: -webkit-box;
  overflow: hidden;
  font-size: 17px;
  font-weight: 600;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

button {
  border: 0;
  font: inherit;
  color: var(--text);
  cursor: pointer;
  transition:
    transform 0.08s,
    background 0.12s;
}

button:active:not(:disabled) {
  transform: scale(0.97);
}

button:disabled {
  opacity: 0.35;
  cursor: default;
}

.key {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96px;
  border-radius: var(--radius-lg);
  background: var(--surface-3);
}

.key:active:not(:disabled) {
  background: var(--surface-4);
}

.key.primary {
  background: var(--accent);
  color: var(--accent-ink);
}

.key.primary:active:not(:disabled) {
  background: #ffb863;
}

.tile {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 3px;
  min-height: 68px;
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  background: var(--surface-2);
  text-align: left;
}

.tile.end {
  align-items: flex-end;
  text-align: right;
}

.tile:active:not(:disabled) {
  background: var(--surface-3);
}

.tile-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 650;
}

.tile-sub {
  max-width: 100%;
  overflow: hidden;
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.toggle {
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
}

.toggle.alert,
.toggle.alert:active:not(:disabled) {
  background: var(--live-soft);
  color: var(--live);
}

.toast {
  position: fixed;
  right: 16px;
  bottom: calc(env(safe-area-inset-bottom) + 16px);
  left: 16px;
  max-width: 528px;
  margin: 0 auto;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  background: var(--surface-4);
  box-shadow: 0 8px 30px rgba(3, 6, 14, 0.5);
  font-weight: 600;
}

/* Tablet: de bediening links, het licht rechts. */
@media (min-width: 760px) {
  .remote {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: start;
    gap: 18px 28px;
    max-width: 1100px;
    padding-top: calc(env(safe-area-inset-top) + 20px);
  }

  .top,
  .banner {
    grid-column: 1 / -1;
  }

  .remote > :deep(.light-panel) {
    grid-column: 2;
    grid-row: 2 / span 2;
  }

  .key {
    height: 128px;
  }

  h1 {
    font-size: 32px;
  }
}
</style>
