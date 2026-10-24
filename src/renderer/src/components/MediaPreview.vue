<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { findAssetUsages } from '@shared/resolve'
import type { MediaAsset } from '@shared/types'
import { useAmbient } from '../lib/ambient'
import { formatTime } from '../lib/format'
import { urlFor } from '../lib/media'
import { usePreviewPlayer } from '../lib/use-preview-player'
import { useSession } from '../stores/session'
import Icon from './Icon.vue'

/**
 * Groot voorbeeld van een bestand uit Media, zoals Quick Look: video en geluid spelen met geluid
 * en een tijdbalk. Bladeren met ← →, sluiten met Escape of door naast het beeld te klikken.
 */
const props = defineProps<{ items: MediaAsset[] }>()
const id = defineModel<string | null>('id', { required: true })

const session = useSession()
const player = usePreviewPlayer()
const root = ref<HTMLElement | null>(null)
const media = ref<HTMLMediaElement | null>(null)
const size = ref<[number, number] | null>(null)

const index = computed(() => props.items.findIndex((a) => a.id === id.value))
const asset = computed(() => props.items[index.value] ?? null)
const ambient = useAmbient(() => asset.value)
const usages = computed(() => (asset.value ? findAssetUsages(session.quiz!, asset.value.id) : []))
const folder = computed(() => session.quiz?.folders.find((f) => f.id === asset.value?.folderId))

const KIND = { video: 'Video', image: 'Afbeelding', audio: 'Geluid' } as const

// Eigen id bij de voorluisterspeler: andere voorbeelden stoppen, maar de tegel van dit bestand
// gaat niet zelf ook spelen.
const claimId = computed(() => `preview:${id.value}`)

watch(
  () => asset.value?.id,
  (current) => {
    size.value = null
    if (!current) return close()
    if (asset.value!.kind === 'image') player.stop()
    else player.claim(claimId.value)
  },
  { immediate: true }
)

// Begint ergens anders een voorbeeld (bv. een fragment in een andere pagina), dan hier stil.
watch(player.playingId, (playing) => {
  if (playing !== claimId.value) media.value?.pause()
})

function close() {
  id.value = null
}

function step(delta: number) {
  const n = props.items.length
  if (n < 2) return
  id.value = props.items[(index.value + delta + n) % n].id
}

function onVideoMeta(event: Event) {
  const el = event.target as HTMLVideoElement
  if (el.videoWidth) size.value = [el.videoWidth, el.videoHeight]
}

function onImageLoad(event: Event) {
  const el = event.target as HTMLImageElement
  size.value = [el.naturalWidth, el.naturalHeight]
}

function togglePlay() {
  const el = media.value
  if (!el) return
  if (el.paused) {
    player.claim(claimId.value)
    void el.play()
  } else el.pause()
}

function onKey(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (event.key === 'Escape') close()
  else if (event.key === 'ArrowLeft') step(-1)
  else if (event.key === 'ArrowRight') step(1)
  else if (event.key === ' ') togglePlay()
  else return
  // Ook de standaardactie van de tijdbalk (5 s spoelen) of een knop met focus niet uitvoeren.
  event.preventDefault()
}

let returnFocus: HTMLElement | null = null
onMounted(async () => {
  returnFocus = document.activeElement as HTMLElement | null
  document.addEventListener('keydown', onKey)
  await nextTick()
  root.value?.focus()
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  if (player.playingId.value?.startsWith('preview:')) player.stop()
  returnFocus?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="asset" class="backdrop" @pointerdown.self="close">
      <div
        ref="root"
        class="preview"
        role="dialog"
        aria-modal="true"
        :aria-label="`Voorbeeld: ${asset.name}`"
        tabindex="-1"
      >
        <div class="stage" :class="asset.kind">
          <Transition name="glow">
            <div
              v-if="ambient"
              :key="ambient"
              class="glow"
              :style="{ backgroundImage: `url(${ambient})` }"
            />
          </Transition>
          <video
            v-if="asset.kind === 'video'"
            :key="asset.id"
            ref="media"
            :src="urlFor(asset)"
            controls
            autoplay
            loop
            playsinline
            disablepictureinpicture
            controlslist="nodownload noplaybackrate noremoteplayback"
            @loadedmetadata="onVideoMeta"
          />
          <img
            v-else-if="asset.kind === 'image'"
            :key="asset.id"
            :src="urlFor(asset)"
            alt=""
            @load="onImageLoad"
          />
          <div v-else class="sound">
            <span class="sound-icon"><Icon name="music" :size="44" /></span>
            <audio
              :key="asset.id"
              ref="media"
              :src="urlFor(asset)"
              controls
              autoplay
              controlslist="nodownload noplaybackrate"
            />
          </div>
        </div>

        <footer class="info">
          <div class="about">
            <h3 class="name" :title="asset.name">{{ asset.name }}</h3>
            <p class="meta">
              <span>{{ KIND[asset.kind] }}</span>
              <span v-if="asset.duration" class="mono">{{ formatTime(asset.duration) }}</span>
              <span v-if="size" class="mono">{{ size[0] }} × {{ size[1] }}</span>
              <span v-if="folder" class="folder">
                <Icon name="folder" :size="12" /> {{ folder.name }}
              </span>
            </p>
            <ul v-if="usages.length" class="usages" aria-label="In gebruik">
              <li v-for="u in usages" :key="u">{{ u }}</li>
            </ul>
            <p v-else class="unused faint">Nog nergens in gebruik</p>
          </div>

          <div v-if="items.length > 1" class="nav">
            <button class="btn btn-ghost btn-icon" aria-label="Vorige" @click="step(-1)">
              <Icon name="left" />
            </button>
            <span class="count mono">{{ index + 1 }} van {{ items.length }}</span>
            <button class="btn btn-ghost btn-icon" aria-label="Volgende" @click="step(1)">
              <Icon name="right" />
            </button>
          </div>
          <button class="btn" @click="close">Sluiten <span class="kbd">esc</span></button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 32px;
  background: rgba(6, 9, 16, 0.8);
  backdrop-filter: blur(16px);
  animation: fade 0.14s ease;
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 18px;
  /* 16:9, zo groot als het venster toelaat; de onderbalk krijgt de rest. */
  width: min(1200px, 100%, (100vh - 64px - 150px) * 16 / 9);
  outline: none;
}

.stage {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-lg);
  background: #000;
  isolation: isolate;
}

.glow {
  position: absolute;
  inset: -40px;
  z-index: -1;
  background-size: 100% 100%;
  filter: blur(70px) saturate(1.3);
  opacity: 0.32;
  pointer-events: none;
}

/* Los van de inhoud: een staande of 4:3-foto mag het vak niet hoger maken, anders schuift de
   informatie eronder uit beeld. */
.stage video,
.stage img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
  background: #000;
}

.stage.audio {
  background: var(--surface-2);
}

.sound {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  width: min(480px, 80%);
}

.sound-icon {
  display: grid;
  place-items: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--surface-3);
  color: var(--accent);
}

.sound audio {
  width: 100%;
}

.info {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.about {
  flex: 1;
  min-width: 0;
}

.name {
  overflow: hidden;
  font: 650 19px/1.3 var(--display);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-top: 2px;
  color: var(--muted);
}

.folder {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.usages {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.usages li {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--accent);
  font-size: 12px;
}

.unused {
  margin-top: 10px;
  font-size: 12px;
}

.nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.count {
  min-width: 64px;
  color: var(--muted);
  text-align: center;
}

.glow-enter-active,
.glow-leave-active {
  transition: opacity 0.5s ease;
}

.glow-enter-from,
.glow-leave-to {
  opacity: 0;
}

@keyframes fade {
  from {
    opacity: 0;
  }
}
</style>
