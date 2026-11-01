<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { slideNumber } from '@shared/resolve'
import type { Round, Slide } from '@shared/types'
import Icon from '../../components/Icon.vue'
import ScreenStage from '../../components/ScreenStage.vue'
import { useLiveControls } from '../../lib/live-controls'
import { locale } from '../../lib/locale'
import { useNow } from '../../lib/use-now'
import { useSession } from '../../stores/session'
import AnswersPad from './AnswersPad.vue'
import FragmentPad from './FragmentPad.vue'
import Mixer from './Mixer.vue'
import { LIVE_MESSAGES } from './live-messages'

/**
 * De show, zoals de presentatieweergave van Keynote: wat er nu op de schermen staat, groot;
 * rechts de bediening, met dezelfde knoppen als de afstandsbediening. De noodknoppen staan in de
 * werkbalk.
 */
const t = LIVE_MESSAGES.in(locale)
const session = useSession()
const quiz = computed(() => session.quiz!)
const state = computed(() => session.state)
const {
  send,
  round,
  prevRound,
  nextRound,
  restartable,
  hasAnswers,
  arrows,
  step,
  stepView,
  stepNames,
  toggleBlackout,
  toggleSound,
  toggleAutoplay,
  toggleLoop
} = useLiveControls()

// Slide-loop: de timer loopt in main; hier alleen tonen en pauzeren.
const now = useNow(250, () => state.value.loopUntil !== null)
const loopText = computed(() => {
  if (!round.value?.slideLoopSeconds) return null
  if (state.value.loopPaused) return t('loopPaused')
  const until = state.value.loopUntil
  if (until === null) return t('loopAfterTitle')
  return t('loopNext', { seconds: Math.max(1, Math.ceil((until - now.value) / 1000)) })
})

/** Korte tekst voor een slide in de lijst. */
function slideText(round: Round, slide: Slide): string {
  if (slide.layout === 'image') {
    const number = slideNumber(round, slide) ?? ''
    return slide.title
      ? t('imageSlideTitled', { number, title: slide.title })
      : t('imageSlide', { number })
  }
  return slide.title || slide.body || t('emptySlide')
}

const KEYS: Record<string, () => void> = {
  ArrowRight: () => step('next'),
  PageDown: () => step('next'),
  ArrowLeft: () => step('prev'),
  PageUp: () => step('prev'),
  Enter: () => send({ type: 'nextRound' }),
  r: () => send({ type: 'restartRound' }),
  e: () => send({ type: 'endRound' }),
  ' ': () => send({ type: 'stopFragment' }),
  a: toggleAutoplay,
  s: () => send({ type: 'autoplay', action: 'skip' }),
  b: () => toggleBlackout(),
  m: toggleSound,
  l: toggleLoop
}

function onKey(event: KeyboardEvent) {
  const el = event.target as HTMLElement
  if (event.metaKey || event.ctrlKey || event.altKey) return
  // Staat er een venster open (bv. "Show stoppen?"), dan zijn de toetsen voor dat venster.
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
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
</script>

<template>
  <div class="live">
    <aside class="rounds scroll" :aria-label="t('rounds')">
      <button
        v-for="r in quiz.rounds"
        :key="r.id"
        class="round"
        :class="{ on: r.id === state.activeRoundId, next: r.id === nextRound?.id }"
        @click="send({ type: 'startRound', roundId: r.id })"
      >
        <span class="dot" aria-hidden="true" />
        <span class="grow">
          <span class="round-title">{{ r.title }}</span>
          <span v-if="r.id === state.activeRoundId" class="round-tag">{{ t('now') }}</span>
          <span v-else-if="r.id === nextRound?.id" class="round-tag">{{ t('upNext') }}</span>
        </span>
      </button>
    </aside>

    <main class="center scroll">
      <h2 class="now-title">{{ round?.title ?? t('betweenRounds') }}</h2>

      <section class="screens">
        <figure v-for="slot in quiz.screens" :key="slot.id" class="screen">
          <div class="frame" :class="{ black: state.blackout.includes(slot.id) }">
            <ScreenStage :quiz="quiz" :state="state" :screen-id="slot.id" preview />
          </div>
          <figcaption class="row">
            <span class="grow screen-name">{{ slot.name }}</span>
            <button
              class="btn btn-ghost btn-sm"
              :class="{ active: state.blackout.includes(slot.id) }"
              @click="toggleBlackout(slot.id)"
            >
              {{ t('black') }}
            </button>
          </figcaption>
        </figure>
      </section>

      <section v-if="round && round.slides.length" class="slides-section">
        <div class="section-row">
          <span class="label grow">{{ t('slides') }}</span>
          <template v-if="loopText">
            <span class="muted loop" data-volatile>{{ loopText }}</span>
            <button class="btn btn-ghost btn-sm" @click="toggleLoop">
              {{ state.loopPaused ? t('loopResume') : t('loopPause') }} <span class="kbd">L</span>
            </button>
          </template>
        </div>
        <div class="slides">
          <button
            class="slide"
            :class="{ on: state.slideIndex === -1 }"
            @click="send({ type: 'setSlide', index: -1 })"
          >
            <span class="slide-kind">–</span>
            <span>{{ t('noSlide') }}</span>
          </button>
          <button
            v-for="(s, i) in round.slides"
            :key="s.id"
            class="slide"
            :class="{ on: state.slideIndex === i }"
            @click="send({ type: 'setSlide', index: i })"
          >
            <span class="slide-kind">{{ i + 1 }}</span>
            <span class="slide-text">{{ slideText(round, s) }}</span>
          </button>
        </div>
      </section>

      <AnswersPad v-if="round && hasAnswers" :round="round" />
      <FragmentPad
        v-if="round && round.fragments.length"
        :round="round"
        :arrows="arrows === 'fragments'"
      />
    </main>

    <aside class="side scroll">
      <section class="control" :aria-label="t('controls')">
        <span class="label">{{ stepView?.label ?? t('betweenRounds') }}</span>
        <div class="pair">
          <button
            class="btn key"
            :disabled="!stepView?.prev"
            :aria-label="stepNames[0]"
            :title="`${stepNames[0]} (←)`"
            @click="step('prev')"
          >
            <Icon name="left" :size="26" />
          </button>
          <button
            class="btn btn-primary key"
            :disabled="!stepView?.next"
            :aria-label="stepNames[1]"
            :title="`${stepNames[1]} (→)`"
            @click="step('next')"
          >
            <Icon name="right" :size="26" />
          </button>
        </div>
        <div class="pair">
          <button class="btn tile" :disabled="!prevRound" @click="send({ type: 'prevRound' })">
            <span class="tile-label"><Icon name="left" :size="14" />{{ t('prevRound') }}</span>
            <span class="tile-sub">{{ prevRound?.title ?? '–' }}</span>
          </button>
          <button
            class="btn tile end"
            :disabled="!nextRound"
            :title="t('nextRoundHint')"
            @click="send({ type: 'nextRound' })"
          >
            <span class="tile-label">{{ t('nextRound') }}<Icon name="right" :size="14" /></span>
            <span class="tile-sub">{{ nextRound?.title ?? '–' }}</span>
          </button>
          <button
            class="btn tile"
            :disabled="!restartable"
            :title="t('restartRoundHint')"
            @click="send({ type: 'restartRound' })"
          >
            <span class="tile-label"
              ><Icon name="restart" :size="13" />{{ t('restartRound') }}</span
            >
            <span class="tile-sub">{{ restartable?.title ?? '–' }}</span>
          </button>
          <button
            class="btn tile end"
            :disabled="!round"
            :title="t('endRoundHint')"
            @click="send({ type: 'endRound' })"
          >
            <span class="tile-label">{{ t('endRound') }}<Icon name="end" :size="12" /></span>
            <span class="tile-sub">{{ round?.title ?? '–' }}</span>
          </button>
        </div>
      </section>

      <section v-if="round?.hostNotes" class="notes-section">
        <span class="label">{{ t('notes') }}</span>
        <p class="notes">{{ round.hostNotes }}</p>
      </section>

      <span class="grow" />
      <Mixer />
    </aside>
  </div>
</template>

<style scoped>
.live {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr) 330px;
  height: 100%;
}

.rounds {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 10px;
  background: var(--surface-1);
}

.round {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.round:hover {
  background: var(--surface-2);
  color: var(--text);
}

.round .dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: transparent;
}

.round.on {
  background: var(--accent-soft);
  color: var(--text);
}

.round.on .dot {
  background: var(--accent);
}

.round.next {
  color: var(--text);
}

.round-title {
  display: block;
  font-weight: 550;
}

.round.on .round-title {
  font-weight: 650;
}

.round-tag {
  display: block;
  font-size: 11px;
  color: var(--muted);
}

.center {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 20px 24px 32px;
}

.now-title {
  font-size: 22px;
}

.screens {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.screen {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 280px;
  max-width: 560px;
  margin: 0;
}

.frame {
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  overflow: hidden;
  background: #000;
}

.frame.black {
  opacity: 0.4;
}

.screen-name {
  font-weight: 600;
}

.section-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.loop {
  font-size: 12px;
}

.slides {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.slide {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  flex: 0 0 150px;
  height: 72px;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.slide:hover {
  background: var(--surface-3);
}

.slide.on {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.slide-kind {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.slide-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 20px 18px;
  background: var(--surface-1);
}

.control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.key {
  height: 64px;
  border-radius: var(--radius-lg);
}

.tile {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  height: auto;
  min-width: 0;
  min-height: 54px;
  padding: 8px 10px;
  border-radius: var(--radius-lg);
  text-align: left;
}

.tile.end {
  align-items: flex-end;
  text-align: right;
}

.tile-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  font-size: 13px;
  font-weight: 600;
}

.tile-sub {
  max-width: 100%;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.notes-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notes {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  user-select: text;
}
</style>
