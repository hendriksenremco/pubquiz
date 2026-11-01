<script setup lang="ts">
import { computed } from 'vue'
import { createChannel, createScreenSlot } from '@shared/factory'
import { findAsset } from '@shared/resolve'
import type { Background } from '@shared/types'
import ContentChip from '../../components/ContentChip.vue'
import Icon from '../../components/Icon.vue'
import MediaPicker from '../../components/MediaPicker.vue'
import Select from '../../components/Select.vue'
import StagePreview from '../../components/StagePreview.vue'
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
      <input
        id="quiz-title"
        v-model="quiz.title"
        class="quiet page-title"
        :aria-label="t('quizName')"
      />

      <section>
        <div class="section-head">
          <h3>{{ t('screens') }}</h3>
          <span class="count">{{ quiz.screens.length }}</span>
        </div>
        <div class="screens">
          <div v-for="slot in quiz.screens" :key="slot.id" class="screen tile">
            <StagePreview :screen="slot" :caption="false" class="screen-preview" />
            <div class="screen-foot">
              <input v-model="slot.name" class="quiet screen-name" :aria-label="t('screenName')" />
              <button
                class="btn btn-ghost btn-sm btn-icon remove-screen"
                :aria-label="t('removeScreen')"
                :title="t('removeScreen')"
                @click="removeScreen(slot.id)"
              >
                <Icon name="trash" :size="14" />
              </button>
            </div>
            <ContentChip v-model="slot.default" :label="t('shows')" />
          </div>
          <button class="add-tile" @click="addScreen">
            <Icon name="plus" :size="20" />
            {{ t('addScreen') }}
          </button>
        </div>
      </section>

      <section>
        <div class="section-head">
          <h3>{{ t('sound') }}</h3>
        </div>
        <div class="sound">
          <div class="tile bg">
            <button
              class="art"
              :class="{ playing: preview.playingId.value === 'background' }"
              :disabled="!bgAsset"
              :aria-label="preview.playingId.value === 'background' ? t('stop') : t('listen')"
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
              <span class="tile-title">{{ t('background') }}</span>
              <MediaPicker
                v-model="backgroundAsset"
                :kinds="['audio']"
                :placeholder="t('chooseMusic')"
                class="quiet-select"
              />
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
                    {{ t('remove') }}
                  </button>
                </div>
              </template>
            </div>
          </div>

          <div class="tile channels">
            <div class="tile-head">
              <span class="tile-title grow">{{ t('channels') }}</span>
              <button
                class="btn btn-ghost btn-sm btn-icon"
                :aria-label="t('addChannel')"
                :title="t('addChannel')"
                @click="addChannel"
              >
                <Icon name="plus" />
              </button>
            </div>
            <div v-for="c in quiz.channels" :key="c.id" class="channel">
              <input v-model="c.name" class="quiet channel-name" :aria-label="t('channelName')" />
              <input
                v-model.number="c.volume"
                v-fill
                type="range"
                min="0"
                max="1"
                step="0.01"
                class="grow"
              />
              <span class="mono val">{{ percent(c.volume) }}</span>
              <button
                class="btn btn-ghost btn-sm btn-icon del"
                :aria-label="t('removeChannel')"
                @click="removeChannel(c.id)"
              >
                <Icon name="x" :size="14" />
              </button>
            </div>
          </div>
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

.quiz-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.remove-screen {
  color: var(--muted);
}

.remove-screen:hover {
  color: var(--live);
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
  background: var(--surface-3);
  color: var(--text);
  cursor: pointer;
}

.art:hover:not(:disabled) {
  background: var(--surface-4);
}

.art:disabled {
  color: var(--muted);
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

.del {
  color: var(--muted);
}
</style>
