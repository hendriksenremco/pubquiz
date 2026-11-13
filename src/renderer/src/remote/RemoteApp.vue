<script setup lang="ts">
import { computed, onMounted, provide, watchEffect } from 'vue'
import type { RemoteAnswer } from '@shared/remote'
import { stepNames as namesOf } from '@shared/resolve'
import Icon from '../components/Icon.vue'
import SlideView from '../components/SlideView.vue'
import { ASSET_URL } from '../lib/media'
import { PHONE_PLUGINS } from '../plugins/phone'
import { connect, imageUrl, link, locale, send, t, toast, view } from './connection'
import { ANSWER_NOUNS } from './messages'

/**
 * De afstandsbediening op een telefoon of tablet: de slide die in beeld staat, vorige en volgende
 * (zoals ← → op de Mac: slides, fragmenten of antwoorden), rondes, de slides, Stop antwoorden, de fragmentenreeks, aftellen, wisselen van de slides, beeld op zwart (ook per scherm), geluid en de lijst met alle rondes, en
 * daaronder de plug-ins met knoppen voor de telefoon (bv. het licht; zie plugins/phone.ts). Volgt de show op de Mac; buiten de show
 * staat alles stil. Dezelfde knoppen staan in de show op de Mac (ShowLive en de werkbalk).
 */
const live = computed(() => !!view.value?.live && link.value === 'open')
const round = computed(() => view.value?.round ?? null)
const step = computed(() => view.value?.step ?? null)
const screen = computed(() => view.value?.screen ?? null)
const sequence = computed(() => view.value?.sequence?.status ?? null)
const slides = computed(() => view.value?.slides ?? [])
const fragments = computed(() => view.value?.fragments ?? [])
const answers = computed(() => view.value?.answers ?? [])
const roundList = computed(() => view.value?.roundList ?? [])
const screenList = computed(() => view.value?.screenList ?? [])
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

/** Zoals AnswersPad op de Mac: wat er van deze vraag in beeld staat, of dat hij gedaan is. */
function answerState(a: RemoteAnswer): string {
  const say = t.value
  switch (a.state) {
    case 'playing':
      return say('playing')
    case 'answer':
      return say('answerShown')
    case 'shown':
      return a.noun === 'fragment'
        ? say('numberShown')
        : say('nounShown', { noun: say(ANSWER_NOUNS[a.noun]) })
    case 'done':
      return say('finished')
    default:
      return '\u00a0'
  }
}

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
        <h1 class="hyphenate">{{ heading }}</h1>
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
            :locale="locale"
          />
          <span v-else class="empty">{{ t('noSlide') }}</span>
        </div>
        <!-- De knoppen meteen onder de preview (vaste hoogte): wat er onder komt, kan ze niet
             verschuiven terwijl je tikt. -->
        <div class="pair">
          <button
            class="key"
            :disabled="!live || !step?.prev"
            @click="send({ type: 'step', direction: 'prev' })"
          >
            <Icon name="left" :size="30" />
            {{ stepNames[0] }}
          </button>
          <button
            class="key primary"
            :disabled="!live || !step?.next"
            @click="send({ type: 'step', direction: 'next' })"
          >
            <Icon name="right" :size="30" />
            {{ stepNames[1] }}
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
          <span class="tile-sub">{{ view?.prevRound ?? '\u00a0' }}</span>
        </button>
        <button
          class="tile end"
          :disabled="!live || !view?.nextRound"
          @click="send({ type: 'round', direction: 'next' })"
        >
          <span class="tile-label">{{ t('nextRound') }}<Icon name="right" :size="16" /></span>
          <span class="tile-sub">{{ view?.nextRound ?? '\u00a0' }}</span>
        </button>
        <button
          class="tile"
          :disabled="!live || !view?.restartRound"
          @click="send({ type: 'restartRound' })"
        >
          <span class="tile-label"><Icon name="restart" :size="15" />{{ t('restartRound') }}</span>
          <span class="tile-sub">{{ view?.restartRound ?? '\u00a0' }}</span>
        </button>
        <button class="tile end" :disabled="!live || !round" @click="send({ type: 'endRound' })">
          <span class="tile-label">{{ t('endRound') }}<Icon name="end" :size="14" /></span>
          <span class="tile-sub">{{ round?.title ?? '\u00a0' }}</span>
        </button>
      </section>

      <!-- De notities bij de ronde, zoals onder de rondes op de Mac. -->
      <section v-if="view?.notes" class="notes" :aria-label="t('notes')">
        <span class="eyebrow">{{ t('notes') }}</span>
        <p>{{ view.notes }}</p>
      </section>

      <!-- Zoals Slides in de show op de Mac: Geen slide en elke slide van de ronde, met één tik in
           beeld. -->
      <section v-if="slides.length" class="pair" :aria-label="t('slides')">
        <span class="slides-title">{{ t('slides') }}</span>
        <button
          class="tile pick"
          :class="{ active: !slides.some((s) => s.on) }"
          :aria-pressed="!slides.some((s) => s.on)"
          :disabled="!live"
          @click="send({ type: 'slide', index: -1 })"
        >
          <span class="tile-label">{{ t('noSlideButton') }}</span>
        </button>
        <button
          v-for="(s, i) in slides"
          :key="s.id"
          class="tile pick"
          :class="{ active: s.on }"
          :aria-pressed="s.on"
          :disabled="!live"
          @click="send({ type: 'slide', index: i })"
        >
          <span class="tile-label"
            ><span class="frag-num">{{ i + 1 }}</span
            ><span class="frag-label">{{ s.label }}</span></span
          >
        </button>
      </section>

      <!-- Alleen in een antwoordenronde, zoals Antwoorden op de Mac: Stop antwoorden zodra er een
           stap in beeld staat, en per ronde de vragen, afbeeldingen en fragmenten om te kiezen. -->
      <section v-if="view?.answering || answers.length" class="pair" :aria-label="t('answers')">
        <button
          v-if="view?.answering"
          class="tile toggle"
          :disabled="!live"
          @click="send({ type: 'stopAnswers' })"
        >
          <Icon name="stop" :size="22" />
          <span class="tile-label">{{ t('stopAnswers') }}</span>
        </button>
        <template v-for="(a, i) in answers" :key="a.id">
          <span v-if="a.round !== answers[i - 1]?.round" class="group-title hyphenate">{{
            a.round
          }}</span>
          <!-- Tikken zet hem in beeld (een fragment speelt opnieuw), nog eens tikken toont of
               verbergt het antwoord. -->
          <button
            class="tile frag"
            :class="{ active: a.on, played: a.state === 'done' }"
            :aria-pressed="a.on"
            :disabled="!live"
            @click="send({ type: 'answer', id: a.id, revealed: a.on && !a.revealed })"
          >
            <span class="tile-label"
              ><span class="frag-num">{{ a.number }}</span
              ><span class="frag-noun">{{ t(ANSWER_NOUNS[a.noun]) }}</span></span
            >
            <span class="frag-answer" :class="{ missing: !a.answer }">{{
              a.answer || t('noAnswer')
            }}</span>
            <span class="tile-sub">{{ answerState(a) }}</span>
          </button>
        </template>
      </section>

      <!-- Alleen in een ronde met fragmenten: dezelfde knoppen als bij Fragmenten op de Mac. -->
      <section v-if="sequence" class="pair" :aria-label="t('fragments')">
        <template v-if="sequence === 'idle'">
          <button
            class="tile toggle"
            :disabled="!live"
            @click="send({ type: 'sequence', action: 'start' })"
          >
            <Icon name="play" :size="22" />
            <span class="tile-label">{{ t('playSequence') }}</span>
          </button>
        </template>
        <template v-else>
          <button
            class="tile toggle"
            :class="{ active: sequence === 'running' }"
            :disabled="!live"
            @click="send({ type: 'sequence', action: sequence === 'paused' ? 'resume' : 'pause' })"
          >
            <Icon :name="sequence === 'paused' ? 'play' : 'pause'" :size="22" />
            <span class="tile-label">{{ sequence === 'paused' ? t('resume') : t('pause') }}</span>
          </button>
          <button
            class="tile toggle"
            :disabled="!live"
            @click="send({ type: 'sequence', action: 'skip' })"
          >
            <Icon name="next" :size="22" />
            <span class="tile-label">{{ t('skip') }}</span>
          </button>
          <button
            class="tile toggle"
            :disabled="!live"
            @click="send({ type: 'sequence', action: 'stop' })"
          >
            <Icon name="stop" :size="22" />
            <span class="tile-label">{{ t('stopSequence') }}</span>
          </button>
        </template>
        <button class="tile toggle" :disabled="!live" @click="send({ type: 'resetPlayed' })">
          <Icon name="restart" :size="22" />
          <span class="tile-label">{{ t('reset') }}</span>
        </button>
        <!-- Eén fragment kiezen, zoals op de Mac: tikken speelt het, nog eens tikken stopt het. -->
        <button
          v-for="f in fragments"
          :key="f.id"
          class="tile frag"
          :class="{ active: f.playing, played: f.played, upcoming: f.upcoming }"
          :aria-pressed="f.playing"
          :disabled="!live"
          @click="send({ type: 'fragment', id: f.id, play: !f.playing })"
        >
          <span class="tile-label"
            ><span class="frag-num">{{ f.number }}</span
            ><span class="frag-label">{{ f.label }}</span></span
          >
          <span class="tile-sub">{{
            f.playing
              ? t('playing')
              : f.upcoming
                ? t('upNextFragment')
                : f.played
                  ? t('played')
                  : '\u00a0'
          }}</span>
        </button>
      </section>

      <section class="pair">
        <button
          class="tile toggle wide"
          :class="{ active: view?.timer }"
          :disabled="!live || (!round && !view?.timer)"
          @click="send({ type: 'timer', on: !view?.timer })"
        >
          <Icon :name="view?.timer ? 'stop' : 'timer'" :size="22" />
          <span class="tile-label">{{ view?.timer ? t('timerOff') : t('timerOn') }}</span>
        </button>
        <!-- Alleen in een ronde waarin de slides vanzelf wisselen, net als op de Mac (L). -->
        <button
          v-if="view?.loop"
          class="tile toggle wide"
          :disabled="!live"
          @click="send({ type: 'slideLoop', paused: !view.loop.paused })"
        >
          <Icon :name="view.loop.paused ? 'play' : 'pause'" :size="22" />
          <span class="tile-label">{{ view.loop.paused ? t('loopResume') : t('loopPause') }}</span>
        </button>
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

      <!-- Zoals onder elk scherm in de show op de Mac: alleen dit scherm op zwart, of terug. Alleen
           bij twee of meer schermen; bij één doet Beeld op zwart hierboven hetzelfde. -->
      <section v-if="screenList.length" class="pair" :aria-label="t('screens')">
        <span class="slides-title">{{ t('screens') }}</span>
        <button
          v-for="s in screenList"
          :key="s.id"
          class="tile pick"
          :class="{ alert: s.black }"
          :aria-pressed="s.black"
          :disabled="!live"
          @click="send({ type: 'blackout', screenId: s.id, on: !s.black })"
        >
          <span class="tile-label"
            ><Icon :name="s.black ? 'monitor' : 'screen-off'" :size="16" /><span
              class="frag-label"
              >{{ s.name }}</span
            ></span
          >
          <span class="tile-sub">{{ s.black ? t('blackoutOff') : t('blackoutOn') }}</span>
        </button>
      </section>

      <!-- Zoals de lijst links in de show op de Mac: elke ronde met één tik starten. -->
      <section v-if="roundList.length" class="pair" :aria-label="t('allRounds')">
        <span class="slides-title">{{ t('rounds') }}</span>
        <button
          v-for="r in roundList"
          :key="r.id"
          class="tile pick round-pick"
          :class="{ active: r.on }"
          :aria-pressed="r.on"
          :disabled="!live"
          @click="send({ type: 'startRound', id: r.id })"
        >
          <span class="tile-label"
            ><span class="frag-num">{{ r.number }}</span
            ><span class="round-title hyphenate">{{ r.title }}</span></span
          >
          <span class="tile-sub">{{ r.on ? t('now') : r.next ? t('upNextRound') : '\u00a0' }}</span>
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

/* Een lange rondenaam breekt af met een streepje, zoals op de Mac: `.hyphenate` in base.css. */
h1 {
  font-size: 28px;
  line-height: 1.15;
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

.notes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 2px;
}

.notes p {
  font-size: 16px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: break-word;
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
  /* minmax(0, …): een lang antwoord kort zichzelf af in plaats van de kolom op te rekken. */
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
  height: 96px;
  padding: 0 8px;
  font-size: 14px;
  font-weight: 600;
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

.frag .tile-label,
.pick .tile-label {
  max-width: 100%;
  gap: 8px;
}

.frag-num {
  font-variant-numeric: tabular-nums;
}

.frag-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.frag.active,
.pick.active {
  background: var(--accent-soft);
  color: var(--accent);
}

.frag.played {
  opacity: 0.55;
}

/* Een rondenaam: hooguit twee regels, dan …, zoals in de lijst Rondes op de Mac. */
.round-pick .tile-label {
  align-items: flex-start;
}

.round-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Antwoorden: per ronde een kopje over de hele breedte, zoals op de Mac. */
.group-title,
.slides-title {
  grid-column: 1 / -1;
  margin-top: 4px;
  padding: 0 2px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}

.frag-noun {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
}

.frag-answer {
  max-width: 100%;
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.frag-answer.missing {
  color: var(--warn);
  font-weight: 500;
}

/* Wat Volgende gaat spelen, zoals op de Mac: een stippellijn in amber. */
.frag.upcoming {
  outline: 1px dashed var(--accent);
  outline-offset: -1px;
}

.tile.wide {
  grid-column: 1 / -1;
}

.toggle.active,
.toggle.active:active:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent);
}

.toggle.alert,
.toggle.alert:active:not(:disabled),
.pick.alert,
.pick.alert:active:not(:disabled) {
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
