<script setup lang="ts">
import { computed, onMounted, provide, watchEffect } from 'vue'
import { stepNames as namesOf } from '@shared/resolve'
import Icon from '../components/Icon.vue'
import SlideView from '../components/SlideView.vue'
import { ASSET_URL } from '../lib/media'
import { PHONE_PLUGINS } from '../plugins/phone'
import { connect, imageUrl, link, locale, send, t, toast, view } from './connection'

/**
 * De afstandsbediening op een telefoon of tablet: de slide die in beeld staat, vorige en volgende
 * (zoals ← → op de Mac: slides, fragmenten of antwoorden), rondes, beeld op zwart en geluid, en
 * daaronder de plug-ins met knoppen voor de telefoon (bv. het licht; zie plugins/phone.ts). Volgt de show op de Mac; buiten de show
 * staat alles stil. Dezelfde knoppen staan in de show op de Mac (ShowLive en de werkbalk).
 */
const live = computed(() => !!view.value?.live && link.value === 'open')
const round = computed(() => view.value?.round ?? null)
const step = computed(() => view.value?.step ?? null)
const screen = computed(() => view.value?.screen ?? null)
provide(ASSET_URL, imageUrl)

const plugins = computed(() =>
  (view.value?.plugins ?? []).flatMap((p) => {
    const component = PHONE_PLUGINS[p.id]
    if (!component) return []
    const act = (action: string, input: unknown) =>
      send({ type: 'plugin', id: p.id, action, input })
    return [{ ...p, component, act }]
  })
)

const stepNames = computed(() =>
  step.value ? namesOf(step.value.target, locale.value) : [t.value('prev'), t.value('next')]
)

const status = computed(() => {
  const say = t.value
  if (link.value === 'lost') return { text: say('statusLost'), tone: 'warn' }
  if (!view.value) return { text: say('statusConnecting'), tone: 'idle' }
  return view.value.live
    ? { text: say('statusLive'), tone: 'live' }
    : { text: say('statusIdle'), tone: 'idle' }
})

const eyebrow = computed(() => {
  const v = view.value
  if (!v?.live) return ''
  return round.value
    ? t.value('roundOf', { number: round.value.number, total: v.rounds })
    : t.value('betweenRounds')
})

const heading = computed(() => {
  const v = view.value
  const say = t.value
  if (!v) return say('connecting')
  if (!v.quiz) return say('noQuiz')
  if (!v.live) return say('startShow')
  return (
    round.value?.title ?? (v.nextRound ? say('upNext', { title: v.nextRound }) : say('lastRound'))
  )
})

// Voor de voorleesfunctie en het afbreken van woorden.
watchEffect(() => (document.documentElement.lang = locale.value))

onMounted(connect)
</script>

<template>
  <div v-if="link === 'denied'" class="denied">
    <h1>{{ t('deniedTitle') }}</h1>
    <p class="muted">{{ t('deniedText') }}</p>
  </div>

  <div v-else class="remote">
    <header class="top">
      <span class="quiz">{{ view?.quiz ?? 'QuizNote' }}</span>
      <span class="status" :class="status.tone"><span class="dot" />{{ status.text }}</span>
    </header>

    <p v-if="link === 'lost'" class="banner" role="status">{{ t('lostBanner') }}</p>

    <main class="controls" :class="{ idle: !live }">
      <section class="now">
        <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
        <h1>{{ heading }}</h1>
      </section>

      <section class="card" :aria-label="t('onScreen')">
        <div class="step-head">
          <span class="eyebrow grow">{{ step?.label ?? t('onScreen') }}</span>
          <span v-if="step?.playing" class="playing"><span class="dot" />{{ t('playing') }}</span>
        </div>
        <div class="preview" :class="{ black: view?.blackout }" :aria-label="t('preview')">
          <SlideView
            v-if="screen"
            :key="screen.slide.id"
            :slide="screen.slide"
            :number="screen.number"
          />
          <span v-else class="empty">{{ t('noSlide') }}</span>
        </div>
        <!-- De knoppen meteen onder de preview (vaste hoogte): wat er onder komt, kan ze niet
             verschuiven terwijl je tikt. -->
        <div class="pair">
          <button
            class="key"
            :disabled="!live || !step?.prev"
            :aria-label="stepNames[0]"
            @click="send({ type: 'step', direction: 'prev' })"
          >
            <Icon name="left" :size="34" />
          </button>
          <button
            class="key primary"
            :disabled="!live || !step?.next"
            :aria-label="stepNames[1]"
            @click="send({ type: 'step', direction: 'next' })"
          >
            <Icon name="right" :size="34" />
          </button>
        </div>
        <p v-if="step?.text" class="step-text">{{ step.text }}</p>
        <p v-if="step?.answer" class="answer">
          <span class="answer-label">{{ t('answer') }}</span
          >{{ step.answer }}
        </p>
      </section>

      <section class="pair" :aria-label="t('rounds')">
        <button
          class="tile"
          :disabled="!live || !view?.prevRound"
          @click="send({ type: 'round', direction: 'prev' })"
        >
          <span class="tile-label"><Icon name="left" :size="16" />{{ t('prevRound') }}</span>
          <span class="tile-sub">{{ view?.prevRound ?? '–' }}</span>
        </button>
        <button
          class="tile end"
          :disabled="!live || !view?.nextRound"
          @click="send({ type: 'round', direction: 'next' })"
        >
          <span class="tile-label">{{ t('nextRound') }}<Icon name="right" :size="16" /></span>
          <span class="tile-sub">{{ view?.nextRound ?? '–' }}</span>
        </button>
        <button
          class="tile"
          :disabled="!live || !view?.restartRound"
          @click="send({ type: 'restartRound' })"
        >
          <span class="tile-label"><Icon name="restart" :size="15" />{{ t('restartRound') }}</span>
          <span class="tile-sub">{{ view?.restartRound ?? '–' }}</span>
        </button>
        <button class="tile end" :disabled="!live || !round" @click="send({ type: 'endRound' })">
          <span class="tile-label">{{ t('endRound') }}<Icon name="end" :size="14" /></span>
          <span class="tile-sub">{{ round?.title ?? '–' }}</span>
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
          <span class="tile-label">{{ view?.blackout ? t('blackoutOff') : t('blackoutOn') }}</span>
        </button>
        <button
          class="tile toggle"
          :class="{ alert: view?.muted }"
          :disabled="!live"
          @click="send({ type: 'mute', on: !view?.muted })"
        >
          <Icon :name="view?.muted ? 'volume' : 'volume-off'" :size="22" />
          <span class="tile-label">{{ view?.muted ? t('muteOff') : t('muteOn') }}</span>
        </button>
      </section>
    </main>

    <component
      :is="p.component"
      v-for="p in plugins"
      :key="p.id"
      class="plugin"
      :status="p.status"
      :disabled="!live"
      :locale="locale"
      :act="p.act"
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

.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  padding: 0 2px;
}

.playing {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-size: 13px;
  font-weight: 650;
}

.playing .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

/* Zoals de schermen op de Mac in de show: de slide op zwart, gedimd als het beeld op zwart staat. */
.preview {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius);
  background: #000;
  container-type: size;
}

.preview.black {
  opacity: 0.4;
}

.empty {
  color: var(--faint);
  font-size: 13px;
}

.step-text {
  padding: 0 2px;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.35;
  white-space: pre-line;
}

.answer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 17px;
  font-weight: 650;
}

.answer-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
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

  .remote > :deep(.plugin) {
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
