<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { activeRound, answerItems, findAsset, resolveScreen } from '@shared/resolve'
import type { Quiz, ScreenContent, ShowState } from '@shared/types'
import { assetUrl } from '../lib/media'
import { useNow } from '../lib/use-now'
import { peaksOf, useWaveform } from '../lib/waveform'
import SlideView from './SlideView.vue'
import Waveform from './Waveform.vue'

const props = withDefaults(
  defineProps<{
    quiz: Quiz
    state: ShowState
    screenId: string
    /** Preview in de operator-UI: altijd stil, toont content ook tijdens blackout. */
    preview?: boolean
    /** Uitgang voor videogeluid (alleen in het echte screen-venster); null = stil. */
    sinkId?: string | null
  }>(),
  { preview: false, sinkId: null }
)

const FADE_MS = 600
const READY_TIMEOUT_MS = 2500

const counting = computed(() => {
  const ap = props.state.autoplay
  return ap.status === 'gap' || ap.status === 'paused'
})
const now = useNow(200, () => counting.value)
const resolved = computed(() => resolveScreen(props.quiz, props.state, props.screenId, now.value))

// ── Waveform bij het fragmentnummer ─────────────────────────────────────────

/** Het fragment dat speelt (handmatig, in de reeks of opnieuw in de antwoordenronde). */
const playing = computed(() => {
  const f = props.state.fragment
  const round = f && props.quiz.rounds.find((r) => r.id === f.roundId)
  const fragment = round?.fragments.find((x) => x.id === f!.fragmentId)
  return f && fragment ? { timing: f, fragment } : null
})
const { bars: waveBars } = useWaveform(() => {
  const f = playing.value?.fragment
  return { asset: f && findAsset(props.quiz, f.assetId), start: f?.start, end: f?.end }
}, 48)
const waveTiming = computed(() => {
  const t = playing.value?.timing
  return t?.duration ? { startedAt: t.startedAt, duration: t.duration } : null
})

// Toont dit scherm fragmentnummers in deze ronde, dan de waveforms alvast berekenen: zo staan
// ze er meteen als een fragment begint.
watch(
  () => activeRound(props.quiz, props.state)?.id,
  () => {
    const round = activeRound(props.quiz, props.state)
    if (!round?.fragmentScreens.includes(props.screenId)) return
    const fragments = [
      ...round.fragments,
      ...answerItems(props.quiz, round).flatMap((item) => (item.fragment ? [item.fragment] : []))
    ]
    for (const f of fragments) {
      const asset = findAsset(props.quiz, f.assetId)
      if (asset) void peaksOf(asset)
    }
  },
  { immediate: true }
)

const content = computed<ScreenContent>(() =>
  props.preview ? resolved.value.programContent : resolved.value.content
)
const contentKey = computed(() => {
  const c = content.value
  return c.type === 'black' ? 'black' : `${c.type}:${c.assetId}`
})

// Twee lagen: nieuwe content laadt in de onzichtbare laag en fadet pas in als het eerste
// frame klaar is, zodat er bij wisselen nooit een zwart frame te zien is.
interface Layer {
  key: string
  content: ScreenContent
  url: string | null
}
const layers = reactive<(Layer | null)[]>([null, null])
const active = ref(0)
const videos: (HTMLVideoElement | null)[] = [null, null]
const images: (HTMLImageElement | null)[] = [null, null]
let generation = 0

function setVideo(i: number, el: unknown) {
  videos[i] = el as HTMLVideoElement | null
}
function setImage(i: number, el: unknown) {
  images[i] = el as HTMLImageElement | null
}

function waitReady(i: number, layer: Layer): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, READY_TIMEOUT_MS)
    const done = () => {
      clearTimeout(timeout)
      resolve()
    }
    if (layer.content.type === 'video') {
      const video = videos[i]
      if (!video) return done()
      video.currentTime = 0
      video
        .play()
        .then(() => video.requestVideoFrameCallback(() => done()))
        .catch(done)
    } else if (layer.content.type === 'image') {
      const img = images[i]
      if (!img || img.complete) return done()
      img.onload = done
      img.onerror = done
    } else {
      done()
    }
  })
}

watch(
  contentKey,
  async (key) => {
    const current = layers[active.value]
    if (current?.key === key) return
    const token = ++generation
    const target = current ? 1 - active.value : active.value
    const c = content.value
    const layer: Layer = {
      key,
      content: c,
      url: c.type === 'black' ? null : assetUrl(props.quiz, c.assetId)
    }
    layers[target] = layer
    await nextTick()
    await waitReady(target, layer)
    if (token !== generation) return
    active.value = target
    setTimeout(() => {
      if (token !== generation) return
      const old = 1 - target
      videos[old]?.pause()
      layers[old] = null
    }, FADE_MS + 50)
  },
  { immediate: true }
)

// Videogeluid: alleen de zichtbare laag klinkt. Het volume schuift in stappen naar het doel, zodat
// wisselen en ducken vloeiend gaat (rAF loopt niet in een verborgen venster, een interval wel).
const SOUND_TICK_MS = 30
const SOUND_STEP = SOUND_TICK_MS / FADE_MS
/** Uitgang waar een video-element op staat, en elementen waarvoor dat nog wordt ingesteld. */
const routed = new WeakMap<HTMLVideoElement, string>()
const routing = new WeakSet<HTMLVideoElement>()
let soundTimer: ReturnType<typeof setInterval> | null = null

const soundGain = computed(() =>
  props.preview || props.sinkId === null ? 0 : (resolved.value.sound?.gain ?? 0)
)

function soundTarget(i: number): number {
  return i === active.value && layers[i]?.key === contentKey.value ? soundGain.value : 0
}

/** Eén stap richting het doelvolume; true als alle video's op hun doel zitten. */
function stepSound(): boolean {
  let settled = true
  videos.forEach((video, i) => {
    if (!video) return
    const target = soundTarget(i)
    // Pas geluid geven als de video op de goede uitgang zit.
    const sinkId = props.sinkId
    if (target > 0 && sinkId !== null && routed.get(video) !== sinkId) {
      settled = false
      if (routing.has(video)) return
      routing.add(video)
      video
        .setSinkId(sinkId)
        .catch(() => undefined)
        .finally(() => {
          routing.delete(video)
          routed.set(video, sinkId)
        })
      return
    }
    const current = video.muted ? 0 : video.volume
    const next =
      current < target
        ? Math.min(target, current + SOUND_STEP)
        : Math.max(target, current - SOUND_STEP)
    video.volume = next
    video.muted = next === 0
    if (next !== target) settled = false
  })
  return settled
}

function startSound() {
  if (soundTimer || props.preview) return
  soundTimer = setInterval(() => {
    if (stepSound() && soundTimer) {
      clearInterval(soundTimer)
      soundTimer = null
    }
  }, SOUND_TICK_MS)
}

watch([soundGain, () => props.sinkId, active, contentKey], startSound, { flush: 'post' })
onBeforeUnmount(() => {
  if (soundTimer) clearInterval(soundTimer)
})
</script>

<template>
  <div class="stage" :class="{ preview }">
    <div
      v-for="(layer, i) in layers"
      :key="i"
      class="layer"
      :class="{ on: active === i && layer }"
      :style="{ transitionDuration: `${FADE_MS}ms` }"
    >
      <template v-if="layer?.url">
        <video
          v-if="layer.content.type === 'video'"
          :ref="(el) => setVideo(i, el)"
          :src="layer.url"
          muted
          loop
          playsinline
          preload="auto"
          disablepictureinpicture
        />
        <img v-else :ref="(el) => setImage(i, el)" :src="layer.url" alt="" />
      </template>
    </div>

    <Transition name="fade">
      <SlideView
        v-if="resolved.slide"
        :key="resolved.slide.id"
        :slide="resolved.slide"
        :number="resolved.slideNumber"
        :quiz="quiz"
      />
    </Transition>

    <Transition name="fade">
      <!-- Het grote getal is altijd het fragmentnummer; de pauze telt klein eronder af. -->
      <!-- Nummer en aftellen wisselen in hetzelfde hoekvak; het antwoord fadet als eigen kaart in. -->
      <div
        v-if="resolved.overlay"
        :key="resolved.overlay.kind === 'answer' ? 'answer' : 'corner'"
        class="overlay"
        :class="[
          resolved.overlay.kind,
          resolved.overlay.kind === 'answer' ? resolved.overlay.placement : null
        ]"
      >
        <template v-if="resolved.overlay.kind === 'fragment'">
          <div v-if="resolved.overlay.context" class="ov-context">
            {{ resolved.overlay.context }}
          </div>
          <div class="ov-label">Fragment</div>
          <div class="ov-number">{{ resolved.overlay.number }}</div>
          <Waveform v-if="waveBars" class="ov-wave" :bars="waveBars" :playing="waveTiming" />
        </template>
        <!-- Antwoordenronde: het moment van de avond, dus groot en in het midden. -->
        <template v-else-if="resolved.overlay.kind === 'answer'">
          <div class="ov-context">{{ resolved.overlay.context }}</div>
          <div class="ov-answer">{{ resolved.overlay.answer }}</div>
        </template>
        <template v-else>
          <div class="ov-label">Volgende</div>
          <div class="ov-number">{{ resolved.overlay.nextNumber }}</div>
          <div class="ov-count">over {{ resolved.overlay.seconds }} s</div>
          <div class="ov-bar">
            <span :style="{ transform: `scaleX(${resolved.overlay.remaining})` }" />
          </div>
        </template>
      </div>
    </Transition>

    <div v-if="preview && resolved.blackout" class="blackout-badge">Zwart</div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  container-type: size;
}

.layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition-property: opacity;
  transition-timing-function: ease-in-out;
}

.layer.on {
  opacity: 1;
}

.layer video,
.layer img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.overlay {
  position: absolute;
  right: 4cqw;
  bottom: 5cqh;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 22cqh;
  padding: 2.5cqh 3.5cqh;
  border-radius: 3cqh;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-family: var(--font);
  backdrop-filter: blur(1cqh);
}

.ov-wave {
  --wave: rgba(255, 255, 255, 0.28);
  width: 30cqh;
  height: 6cqh;
  margin-top: 1.6cqh;
}

.ov-context {
  max-width: 40cqw;
  margin-bottom: 0.6cqh;
  overflow: hidden;
  font-size: 2.6cqh;
  font-weight: 600;
  opacity: 0.65;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overlay.answer {
  left: 8cqw;
  right: 8cqw;
  top: 50%;
  bottom: auto;
  padding: 5cqh 6cqw;
  text-align: center;
  transform: translateY(-50%);
}

.overlay.answer .ov-context {
  max-width: none;
  margin-bottom: 1.6cqh;
  font-size: 3.4cqh;
  color: var(--accent);
  opacity: 1;
  white-space: normal;
}

.ov-answer {
  font-family: var(--display);
  font-size: 9cqh;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

/* Onder een vraag of afbeelding: die blijft zichtbaar. */
.overlay.answer.bottom {
  top: auto;
  bottom: 5cqh;
  padding: 3cqh 5cqw;
  transform: none;
}

.overlay.answer.bottom .ov-context {
  margin-bottom: 1cqh;
  font-size: 2.8cqh;
}

.overlay.answer.bottom .ov-answer {
  font-size: 7cqh;
}

/* Het antwoord komt iets naar voren bij het onthullen. */
.overlay.answer.fade-enter-active {
  transition:
    opacity 0.4s ease,
    transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.overlay.answer.fade-enter-from {
  transform: translateY(-50%) scale(0.94);
}

.overlay.answer.bottom.fade-enter-from {
  transform: scale(0.94);
}

.ov-label {
  font-size: 3.4cqh;
  font-weight: 650;
  opacity: 0.8;
}

.overlay.countdown .ov-number {
  color: rgba(255, 255, 255, 0.85);
}

.ov-count {
  margin-top: 0.4cqh;
  font-size: 3cqh;
  font-weight: 600;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

.ov-bar {
  width: 100%;
  height: 0.7cqh;
  margin-top: 1.4cqh;
  overflow: hidden;
  border-radius: 1cqh;
  background: rgba(255, 255, 255, 0.15);
}

.ov-bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  transform-origin: left;
  transition: transform 0.2s linear;
}

.ov-number {
  font-family: var(--display);
  font-size: 16cqh;
  font-weight: 850;
  line-height: 1;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.blackout-badge {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.6);
  color: var(--live);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
