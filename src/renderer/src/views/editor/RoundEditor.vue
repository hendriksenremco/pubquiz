<script setup lang="ts">
import { computed, ref } from 'vue'
import { findAsset } from '@shared/resolve'
import type { Round, RoundBackground, ScreenContent } from '@shared/types'
import ContentChip from '../../components/ContentChip.vue'
import Icon from '../../components/Icon.vue'
import MediaPicker from '../../components/MediaPicker.vue'
import PageHero from '../../components/PageHero.vue'
import Popover from '../../components/Popover.vue'
import StagePreview from '../../components/StagePreview.vue'
import { useAmbient } from '../../lib/ambient'
import { useSession } from '../../stores/session'
import FragmentsEditor from './FragmentsEditor.vue'
import SlidesEditor from './SlidesEditor.vue'

const props = defineProps<{ round: Round }>()
const session = useSession()
const quiz = computed(() => session.quiz!)
const selectedSlide = ref(props.round.slides.length > 0 ? 0 : -1)

// ── Hero: welk scherm staat in het "artwork" ────────────────────────────────
const previewId = ref(quiz.value.screens[0]?.id ?? null)
const previewSlot = computed(
  () => quiz.value.screens.find((s) => s.id === previewId.value) ?? quiz.value.screens[0] ?? null
)
const shownContent = computed<ScreenContent | null>(() =>
  previewSlot.value
    ? (props.round.screens[previewSlot.value.id] ?? previewSlot.value.default)
    : null
)
const ambient = useAmbient(() =>
  shownContent.value && shownContent.value.type !== 'black'
    ? findAsset(quiz.value, shownContent.value.assetId)
    : null
)

const position = computed(() => {
  const index = quiz.value.rounds.findIndex((r) => r.id === props.round.id)
  return `Ronde ${index + 1} van ${quiz.value.rounds.length}`
})

const summary = computed(() => {
  const parts: string[] = []
  const f = props.round.fragments.length
  const s = props.round.slides.length
  if (f) parts.push(`${f} ${f === 1 ? 'fragment' : 'fragmenten'}`)
  if (s) parts.push(`${s} ${s === 1 ? 'slide' : 'slides'}`)
  if (!parts.length) return 'Nog leeg'
  return parts.join(' en ')
})

function setOverride(screenId: string, value: ScreenContent | undefined) {
  if (value) props.round.screens[screenId] = value
  else delete props.round.screens[screenId]
}

function setMuted(screenId: string, muted: boolean) {
  const rest = props.round.mutedScreens.filter((id) => id !== screenId)
  props.round.mutedScreens = muted ? [...rest, screenId] : rest
}

// ── Achtergrondmuziek tijdens deze ronde ────────────────────────────────────
type BgMode = 'continue' | 'duck' | 'pause' | 'replace'
// "Andere muziek" wordt pas echt opgeslagen zodra er een bestand gekozen is.
const replacing = ref(typeof props.round.background === 'object')
const bgMode = computed<BgMode>(() => {
  const bg = props.round.background
  return replacing.value || typeof bg === 'object' ? 'replace' : bg
})
function chooseBackground(mode: BgMode, close: () => void) {
  replacing.value = mode === 'replace'
  if (mode !== 'replace') {
    props.round.background = mode
    close()
  }
}
const replaceAsset = computed({
  get: () =>
    typeof props.round.background === 'object' ? props.round.background.replaceAssetId : undefined,
  set: (id) => {
    if (id) props.round.background = { replaceAssetId: id } satisfies RoundBackground
  }
})

const BG_OPTIONS: { value: BgMode; label: string; short: string; hint: string }[] = [
  {
    value: 'continue',
    label: 'Doorspelen',
    short: 'speelt door',
    hint: 'Alleen zachter tijdens een fragment'
  },
  { value: 'duck', label: 'Zachter', short: 'zachter', hint: 'De hele ronde op het lagere volume' },
  {
    value: 'pause',
    label: 'Pauzeren',
    short: 'pauzeert',
    hint: 'Stil, na de ronde speelt hij verder'
  },
  {
    value: 'replace',
    label: 'Andere muziek',
    short: 'andere muziek',
    hint: 'Een eigen loop tijdens deze ronde'
  }
]
const bgText = computed(() => {
  if (!quiz.value.background) return 'geen'
  if (bgMode.value === 'replace') {
    const name = findAsset(quiz.value, replaceAsset.value)?.name.replace(/\.[^.]+$/, '')
    return name ?? 'kies muziek'
  }
  return BG_OPTIONS.find((o) => o.value === bgMode.value)?.short ?? ''
})
</script>

<template>
  <div class="round-page">
    <PageHero :ambient="ambient">
      <div class="hero-grid">
        <div class="artwork">
          <StagePreview
            v-if="previewSlot"
            :screen="previewSlot"
            :round-id="round.id"
            :slide-index="selectedSlide"
            :caption="false"
          />
          <span v-if="previewSlot && quiz.screens.length > 1" class="artwork-label">{{
            previewSlot.name
          }}</span>
        </div>

        <div class="hero-text">
          <span class="position">{{ position }}</span>
          <input
            id="round-title"
            v-model="round.title"
            class="quiet hero-title"
            aria-label="Titel van de ronde"
          />
          <p class="muted summary">{{ summary }}</p>

          <div class="chips">
            <ContentChip
              v-for="slot in quiz.screens"
              :key="slot.id"
              :label="slot.name"
              :model-value="round.screens[slot.id]"
              :muted="round.mutedScreens.includes(slot.id)"
              :fallback="slot.default"
              allow-default
              @update:model-value="setOverride(slot.id, $event)"
              @update:muted="setMuted(slot.id, $event)"
              @opened="previewId = slot.id"
            />

            <Popover :width="300">
              <template #trigger="{ open, toggle }">
                <button
                  type="button"
                  class="chip"
                  :class="{ open }"
                  :title="`Achtergrond: ${bgText}`"
                  @click="toggle"
                >
                  <span class="chip-icon"><Icon name="music" :size="13" /></span>
                  <span>Achtergrond</span>
                  <span class="chip-key chip-value">{{ bgText }}</span>
                  <Icon name="chevron" :size="14" class="chev" />
                </button>
              </template>
              <template #default="{ close }">
                <p v-if="!quiz.background" class="muted no-bg">
                  Er is nog geen achtergrondmuziek. Die kies je bij Quiz.
                </p>
                <template v-else>
                  <button
                    v-for="o in BG_OPTIONS"
                    :key="o.value"
                    class="menu-item"
                    :class="{ on: bgMode === o.value }"
                    @click="chooseBackground(o.value, close)"
                  >
                    <span class="grow">
                      {{ o.label }}
                      <span class="menu-hint">{{ o.hint }}</span>
                    </span>
                    <Icon v-if="bgMode === o.value" name="check" />
                  </button>
                  <MediaPicker
                    v-if="bgMode === 'replace'"
                    v-model="replaceAsset"
                    :kinds="['audio']"
                    placeholder="Kies muziek voor deze ronde…"
                    class="replace-picker"
                  />
                </template>
              </template>
            </Popover>
          </div>
        </div>
      </div>
    </PageHero>

    <div class="body">
      <SlidesEditor v-model:selected="selectedSlide" :round="round" />
      <FragmentsEditor :round="round" />

      <section>
        <div class="section-head"><h3>Notities</h3></div>
        <textarea
          v-model="round.hostNotes"
          class="quiet notes"
          rows="3"
          placeholder="Antwoorden of aankondigingen. Alleen jij ziet dit, tijdens de ronde."
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.hero-grid {
  display: grid;
  grid-template-columns: minmax(240px, 360px) minmax(0, 1fr);
  gap: 32px;
  align-items: end;
}

.artwork {
  position: relative;
  border-radius: var(--radius-lg);
  box-shadow:
    0 24px 60px rgba(3, 6, 14, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.04);
}

.artwork :deep(.preview) {
  border-radius: var(--radius-lg);
}

.artwork-label {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(15, 20, 32, 0.7);
  font-size: 11px;
  font-weight: 600;
}

.hero-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-bottom: 4px;
}

.position {
  color: var(--muted);
  font-size: 13px;
  font-weight: 550;
}

.hero-title {
  margin-top: 4px;
  font: 750 44px/1.08 var(--display);
  letter-spacing: -0.03em;
}

.summary {
  margin-top: 6px;
  font-size: 14px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.chip-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 18px;
  border-radius: 4px;
  background: var(--surface-4);
  color: var(--accent);
}

.no-bg {
  padding: 6px 8px;
  font-size: 12px;
}

.replace-picker {
  margin-top: 6px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 44px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 12px 40px 80px;
}

.notes {
  display: block;
  padding: 8px 10px;
  margin: 0;
  background: var(--surface-1);
  border-radius: var(--radius);
  line-height: 1.5;
}
</style>
