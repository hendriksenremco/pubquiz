<script setup lang="ts">
import { computed } from 'vue'
import { createChannel, createScreenSlot } from '@shared/factory'
import { DEFAULT_TIMER_SECONDS, findAsset } from '@shared/resolve'
import type { Background } from '@shared/types'
import ContentChip from '../../components/ContentChip.vue'
import Icon from '../../components/Icon.vue'
import MediaPicker from '../../components/MediaPicker.vue'
import Select from '../../components/Select.vue'
import StagePreview from '../../components/StagePreview.vue'
import TitleField from '../../components/TitleField.vue'
import PluginSlot from '../../plugins/PluginSlot.vue'
import { vFill } from '../../lib/fill'
import { ask } from '../../lib/confirm'
import { percent } from '../../lib/format'
import { locale } from '../../lib/locale'
import { usePreviewPlayer } from '../../lib/use-preview-player'
import { useSession } from '../../stores/session'
import { SETUP_MESSAGES } from './editor-messages'

const emit = defineEmits<{ createFromCurrent: [] }>()
const api = window.pubquiz
const session = useSession()
const t = SETUP_MESSAGES.in(locale)
const quiz = computed(() => session.quiz!)

/** Aftellen met T: hele seconden, minstens 1; leeg = de standaard. */
function setTimer(event: Event) {
  const raw = (event.target as HTMLInputElement).value.trim()
  const value = Math.round(Number(raw))
  if (raw === '') delete quiz.value.timerSeconds
  else if (Number.isFinite(value) && value >= 1) quiz.value.timerSeconds = Math.min(value, 3600)
}

function exportZip() {
  session.flush()
  void api.exportZip()
}
const preview = usePreviewPlayer()

function addScreen() {
  quiz.value.screens.push(
    createScreenSlot(t('newScreen', { number: quiz.value.screens.length + 1 }))
  )
}

async function removeScreen(id: string) {
  const slot = quiz.value.screens.find((s) => s.id === id)
  if (!slot) return
  const ok = await ask({
    title: t('removeScreenTitle', { name: slot.name }),
    message: t('removeScreenMessage'),
    confirm: t('remove'),
    icon: 'trash',
    danger: true
  })
  if (!ok) return
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
  quiz.value.channels.push(
    createChannel(t('newChannel', { number: quiz.value.channels.length + 1 }))
  )
}

function removeChannel(id: string) {
  let used = quiz.value.background?.channelId === id ? 1 : 0
  for (const r of quiz.value.rounds) used += r.fragments.filter((f) => f.channelId === id).length
  if (used > 0) {
    session.notify({
      level: 'warning',
      message: t('channelInUse', { count: used })
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
      session.notify({ level: 'warning', message: t('noChannel') })
      return
    }
    quiz.value.background = { assetId, channelId, volume: 0.7, duckTo: 0.25 } satisfies Background
  }
})
const bgAsset = computed(() => findAsset(quiz.value, quiz.value.background?.assetId))
</script>

<template>
  <div class="setup">
    <div class="body">
      <TitleField
        id="quiz-title"
        v-model="quiz.title"
        class="page-title"
        :aria-label="t('quizName')"
      />

      <section>
        <!-- Voeg scherm toe rechts in de kop, zoals Open quiz… op het startscherm: een gewone knop,
             geen lege kaart naast de schermen. -->
        <div class="section-head">
          <h3>{{ t('screens') }}</h3>
          <span class="grow" />
          <button class="btn btn-ghost btn-sm" @click="addScreen">
            <Icon name="plus" :size="14" /> {{ t('addScreen') }}
          </button>
        </div>
        <div class="screens">
          <div v-for="slot in quiz.screens" :key="slot.id" class="screen tile">
            <StagePreview :screen="slot" :caption="false" class="screen-preview" />
            <div class="screen-foot">
              <input
                v-model="slot.name"
                class="quiet screen-name"
                :title="slot.name"
                :aria-label="t('screenName')"
              />
              <button class="btn btn-ghost btn-sm remove-screen" @click="removeScreen(slot.id)">
                <Icon name="trash" :size="14" /> {{ t('removeScreen') }}
              </button>
            </div>
            <ContentChip v-model="slot.default" :label="t('shows')" />
          </div>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h3>{{ t('sound') }}</h3>
        </div>
        <div class="sound">
          <div class="tile bg">
            <div class="bg-main">
              <span class="tile-title">{{ t('background') }}</span>
              <div class="bg-pick">
                <button
                  v-if="bgAsset"
                  type="button"
                  class="btn btn-sm listen"
                  :class="{ 'btn-primary': preview.playingId.value === 'background' }"
                  @click="preview.toggle('background', bgAsset)"
                >
                  <Icon
                    :name="preview.playingId.value === 'background' ? 'stop' : 'play'"
                    :size="12"
                  />
                  {{ preview.playingId.value === 'background' ? t('stop') : t('listen') }}
                </button>
                <MediaPicker
                  v-model="backgroundAsset"
                  :kinds="['audio']"
                  :placeholder="t('chooseMusic')"
                  class="quiet-select"
                />
              </div>
              <template v-if="quiz.background">
                <label class="slider">
                  <span>{{ t('volume') }}</span>
                  <input
                    v-model.number="quiz.background.volume"
                    v-fill
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                  />
                  <span class="mono val">{{ percent(quiz.background.volume) }}</span>
                </label>
                <label class="slider" :title="t('duckHint')">
                  <span>{{ t('duck') }}</span>
                  <input
                    v-model.number="quiz.background.duckTo"
                    v-fill
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                  />
                  <span class="mono val">{{ percent(quiz.background.duckTo) }}</span>
                </label>
                <div class="bg-foot">
                  <span class="muted">{{ t('via') }}</span>
                  <Select
                    v-model="quiz.background.channelId"
                    size="sm"
                    class="channel-select"
                    :aria-label="t('backgroundChannel')"
                    :options="quiz.channels.map((c) => ({ value: c.id, label: c.name }))"
                  />
                  <span class="grow" />
                  <button class="btn btn-ghost btn-sm" @click="quiz.background = null">
                    <Icon name="trash" :size="14" /> {{ t('removeBackground') }}
                  </button>
                </div>
              </template>
            </div>
          </div>

          <div class="tile channels">
            <!-- Voeg kanaal toe rechts in de kop, zoals Voeg scherm toe bij Schermen. -->
            <div class="tile-head">
              <span class="tile-title">{{ t('channels') }}</span>
              <span class="grow" />
              <button class="btn btn-ghost btn-sm add-channel" @click="addChannel">
                <Icon name="plus" :size="14" /> {{ t('addChannel') }}
              </button>
            </div>
            <div v-for="c in quiz.channels" :key="c.id" class="channel">
              <input
                v-model="c.name"
                class="quiet channel-name"
                :title="c.name"
                :aria-label="t('channelName')"
              />
              <button class="btn btn-ghost btn-sm del" @click="removeChannel(c.id)">
                <Icon name="trash" :size="14" /> {{ t('removeChannel') }}
              </button>
              <div class="channel-level">
                <input
                  v-model.number="c.volume"
                  v-fill
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  class="channel-volume"
                />
                <span class="mono val">{{ percent(c.volume) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h3>{{ t('show') }}</h3>
        </div>
        <div class="tile show-tile">
          <span class="tile-title">{{ t('timer') }}</span>
          <span class="timer-row">
            <input
              :value="quiz.timerSeconds ?? DEFAULT_TIMER_SECONDS"
              type="number"
              min="1"
              max="3600"
              step="1"
              class="input input-sm timer-input"
              :aria-label="t('timerLabel')"
              @change="setTimer"
            />
            <span class="muted">{{ t('seconds') }}</span>
          </span>
          <span class="muted hint">{{ t('timerHint') }}</span>
        </div>
      </section>

      <PluginSlot name="quizSettings" />

      <section>
        <div class="section-head">
          <h3>{{ t('file') }}</h3>
        </div>
        <div class="quiz-actions">
          <button class="btn" @click="emit('createFromCurrent')">
            <Icon name="copy" :size="14" /> {{ t('createFromCurrent') }}
          </button>
          <button class="btn" @click="exportZip">
            <Icon name="upload" :size="14" /> {{ t('exportZip') }}
          </button>
          <button class="btn" @click="api.revealQuiz()">
            <Icon name="folder" :size="14" /> {{ t('reveal') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page-title {
  margin-bottom: -12px;
  font: 700 30px/1.15 var(--display);
  letter-spacing: -0.02em;
}

.show-tile {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 520px;
  padding: 16px 18px;
}

.timer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timer-input {
  width: 72px;
}

.hint {
  font-size: 12px;
}

.quiz-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.remove-screen {
  flex: none;
  color: var(--muted);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 40px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 40px 80px;
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
  min-width: 0;
  font: 650 15px var(--display);
}

.screen :deep(.popover) > .chip {
  align-self: flex-start;
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
  padding: 16px;
}

.bg-pick {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bg-pick .quiet-select {
  flex: 1;
  min-width: 0;
}

/* Even breed bij Luister en Stop, zoals in de lijst met fragmenten. */
.listen {
  flex: none;
  min-width: 76px;
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
  gap: 10px;
  padding: 16px;
}

.tile-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -4px 0 6px;
}

/* Naam en knop op de eerste regel, de schuifregelaar eronder: naast de knop is hij te kort. */
.channel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
}

.channel-name {
  font-weight: 600;
}

/* Het percentage direct naast de schuifregelaar, zoals bij Achtergrondmuziek. */
.channel-level {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  align-items: center;
  gap: 10px;
}

.channel-volume {
  width: 100%;
  min-width: 0;
}

.del {
  color: var(--muted);
}
</style>
