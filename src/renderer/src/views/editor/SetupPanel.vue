<script setup lang="ts">
import { computed } from 'vue'
import { createChannel, createScreenSlot } from '@shared/factory'
import { findAsset } from '@shared/resolve'
import type { Background } from '@shared/types'
import ContentChip from '../../components/ContentChip.vue'
import Icon from '../../components/Icon.vue'
import MediaPicker from '../../components/MediaPicker.vue'
import PageHero from '../../components/PageHero.vue'
import Popover from '../../components/Popover.vue'
import StagePreview from '../../components/StagePreview.vue'
import { useAmbient } from '../../lib/ambient'
import { percent } from '../../lib/format'
import { usePreviewPlayer } from '../../lib/use-preview-player'
import { useSession } from '../../stores/session'

const session = useSession()
const quiz = computed(() => session.quiz!)
const preview = usePreviewPlayer()

const ambient = useAmbient(() => {
  const content = quiz.value.screens[0]?.default
  return content && content.type !== 'black' ? findAsset(quiz.value, content.assetId) : null
})

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}
const summary = computed(() => {
  const q = quiz.value
  return `${plural(q.screens.length, 'scherm', 'schermen')}, ${plural(q.channels.length, 'audiokanaal', 'audiokanalen')} en ${plural(q.rounds.length, 'ronde', 'rondes')}`
})

function addScreen() {
  quiz.value.screens.push(createScreenSlot(`Scherm ${quiz.value.screens.length + 1}`))
}

function removeScreen(id: string, close: () => void) {
  close()
  const slot = quiz.value.screens.find((s) => s.id === id)
  if (
    !slot ||
    !confirm(`Scherm "${slot.name}" verwijderen? Ronde-instellingen voor dit scherm vervallen.`)
  )
    return
  quiz.value.screens = quiz.value.screens.filter((s) => s.id !== id)
  for (const round of quiz.value.rounds) {
    delete round.screens[id]
    round.mutedScreens = round.mutedScreens.filter((t) => t !== id)
    round.fragmentScreens = round.fragmentScreens.filter((t) => t !== id)
    for (const slide of round.slides) {
      if (slide.targetScreens === 'all') continue
      slide.targetScreens = slide.targetScreens.filter((t) => t !== id)
      if (slide.targetScreens.length === 0) slide.targetScreens = 'all'
    }
  }
}

function addChannel() {
  quiz.value.channels.push(createChannel(`Kanaal ${quiz.value.channels.length + 1}`))
}

function removeChannel(id: string) {
  let used = quiz.value.background?.channelId === id ? 1 : 0
  for (const r of quiz.value.rounds) used += r.fragments.filter((f) => f.channelId === id).length
  if (used > 0) {
    session.notify({
      level: 'warning',
      message: `Dit kanaal wordt nog ${used}× gebruikt. Zet de achtergrond en fragmenten eerst op een ander kanaal.`
    })
    return
  }
  quiz.value.channels = quiz.value.channels.filter((c) => c.id !== id)
}

const backgroundAsset = computed({
  get: () => quiz.value.background?.assetId,
  set: (assetId) => {
    if (!assetId) return
    if (quiz.value.background) {
      quiz.value.background.assetId = assetId
      return
    }
    const channelId = quiz.value.channels[0]?.id
    if (!channelId) {
      session.notify({ level: 'warning', message: 'Voeg eerst een audiokanaal toe.' })
      return
    }
    quiz.value.background = { assetId, channelId, volume: 0.7, duckTo: 0.25 } satisfies Background
  }
})
const bgAsset = computed(() => findAsset(quiz.value, quiz.value.background?.assetId))
</script>

<template>
  <div class="setup">
    <PageHero :ambient="ambient">
      <input
        id="quiz-title"
        v-model="quiz.title"
        class="quiet hero-title"
        aria-label="Naam van de quiz"
      />
      <p class="muted summary">{{ summary }}</p>
    </PageHero>

    <div class="body">
      <section>
        <div class="section-head">
          <h3>Schermen</h3>
          <span class="count">{{ quiz.screens.length }}</span>
        </div>
        <div class="screens">
          <div v-for="slot in quiz.screens" :key="slot.id" class="screen tile">
            <StagePreview :screen="slot" :caption="false" class="screen-preview" />
            <div class="screen-foot">
              <input
                v-model="slot.name"
                class="quiet screen-name"
                aria-label="Naam van het scherm"
              />
              <Popover align="right" :width="170">
                <template #trigger="{ toggle }">
                  <button class="btn btn-ghost btn-sm btn-icon" aria-label="Meer" @click="toggle">
                    <Icon name="more" />
                  </button>
                </template>
                <template #default="{ close }">
                  <button class="menu-item danger" @click="removeScreen(slot.id, close)">
                    <Icon name="trash" /> Verwijder scherm
                  </button>
                </template>
              </Popover>
            </div>
            <ContentChip v-model="slot.default" label="Toont" />
          </div>
          <button class="add-tile" @click="addScreen">
            <Icon name="plus" :size="20" />
            Scherm toevoegen
          </button>
        </div>
      </section>

      <section>
        <div class="section-head"><h3>Geluid</h3></div>
        <div class="sound">
          <div class="tile bg">
            <button
              class="art"
              :class="{ playing: preview.playingId.value === 'background' }"
              :disabled="!bgAsset"
              :aria-label="preview.playingId.value === 'background' ? 'Stop' : 'Luister'"
              @click="preview.toggle('background', bgAsset)"
            >
              <Icon
                :name="
                  preview.playingId.value === 'background' ? 'stop' : bgAsset ? 'play' : 'music'
                "
                :size="22"
              />
            </button>
            <div class="bg-main">
              <span class="tile-title">Achtergrondmuziek</span>
              <MediaPicker
                v-model="backgroundAsset"
                :kinds="['audio']"
                placeholder="Kies muziek…"
                class="quiet-select"
              />
              <template v-if="quiz.background">
                <label class="slider">
                  <span>Volume</span>
                  <input
                    v-model.number="quiz.background.volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                  />
                  <span class="mono val">{{ percent(quiz.background.volume) }}</span>
                </label>
                <label class="slider" title="Zo zacht wordt de muziek tijdens een fragment">
                  <span>Bij fragment</span>
                  <input
                    v-model.number="quiz.background.duckTo"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                  />
                  <span class="mono val">{{ percent(quiz.background.duckTo) }}</span>
                </label>
                <div class="bg-foot">
                  <span class="muted">Via</span>
                  <select
                    v-model="quiz.background.channelId"
                    class="select input-sm channel-select"
                  >
                    <option v-for="c in quiz.channels" :key="c.id" :value="c.id">
                      {{ c.name }}
                    </option>
                  </select>
                  <span class="grow" />
                  <button class="btn btn-ghost btn-sm" @click="quiz.background = null">
                    Verwijder
                  </button>
                </div>
              </template>
            </div>
          </div>

          <div class="tile channels">
            <div class="tile-head">
              <span class="tile-title grow">Audiokanalen</span>
              <button
                class="btn btn-ghost btn-sm btn-icon"
                aria-label="Kanaal toevoegen"
                title="Kanaal toevoegen"
                @click="addChannel"
              >
                <Icon name="plus" />
              </button>
            </div>
            <div v-for="c in quiz.channels" :key="c.id" class="channel">
              <input v-model="c.name" class="quiet channel-name" aria-label="Naam van het kanaal" />
              <input
                v-model.number="c.volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="grow"
              />
              <span class="mono val">{{ percent(c.volume) }}</span>
              <button
                class="btn btn-ghost btn-sm btn-icon del"
                aria-label="Verwijder kanaal"
                @click="removeChannel(c.id)"
              >
                <Icon name="x" :size="14" />
              </button>
            </div>
            <p class="muted foot">Welke speaker bij welk kanaal hoort, kies je bij Show.</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hero-title {
  font: 700 40px/1.1 var(--display);
  letter-spacing: -0.025em;
}

.summary {
  margin-top: 6px;
  font-size: 14px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 40px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 8px 40px 80px;
}

.screens {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.screen {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 10px 12px;
}

.screen-preview {
  border-radius: 10px;
}

.screen-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 6px;
}

.screen-name {
  font: 650 15px var(--display);
}

.screen :deep(.popover) > .chip {
  align-self: flex-start;
}

.add-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 200px;
  border: 0;
  border-radius: var(--radius-lg);
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
  color: var(--muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.add-tile:hover {
  background: var(--surface-1);
  color: var(--text);
}

.sound {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 16px;
}

.tile-title {
  font: 650 15px var(--display);
}

.bg {
  display: flex;
  gap: 18px;
  padding: 16px;
}

.art {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 112px;
  height: 112px;
  border: 0;
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 210, 140, 0.55), transparent 55%),
    linear-gradient(145deg, #ffa53d, #c2410c 70%, #5b1a07);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 14px 30px rgba(255, 120, 30, 0.18);
}

.art:disabled {
  background: var(--surface-3);
  color: var(--muted);
  box-shadow: none;
  cursor: default;
}

.art.playing {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.bg-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.quiet-select {
  background: var(--surface-3);
}

.slider {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
}

.val {
  color: var(--muted);
  font-size: 12px;
  text-align: right;
}

.bg-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.channel-select {
  width: auto;
}

.channels {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
}

.tile-head {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.channel {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
}

.channel-name {
  width: 120px;
  flex: none;
  font-weight: 600;
}

.channel .del {
  opacity: 0;
}

.channel:hover .del {
  opacity: 1;
}

.foot {
  margin-top: auto;
  padding-top: 10px;
  font-size: 12px;
}

.menu-item.danger {
  color: var(--live);
}
</style>
