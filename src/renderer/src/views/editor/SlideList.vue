<script setup lang="ts">
import { computed, ref } from 'vue'
import { moveById, renumberSlides } from '@shared/order'
import { slideNumber } from '@shared/resolve'
import type { Round, Slide } from '@shared/types'
import SlideView from '../../components/SlideView.vue'
import { useStandings } from '../../plugins/scores/standings'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { SLIDE_MESSAGES } from './editor-messages'

/**
 * De slides van een ronde als lijst: links wat de zaal ziet, rechts de tekst om meteen te typen.
 * Vorm, afbeelding en achtergrond staan in het paneel rechts (SlideInspector).
 */
const props = defineProps<{ round: Round; selectedId: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()
const session = useSession()
const quiz = computed(() => session.quiz!)
const t = SLIDE_MESSAGES.in(locale)
const standingsOf = useStandings()

function kind(round: Round, s: Slide): string {
  if (standingsOf(quiz.value, s)) return t('kindStandings')
  if (s.layout === 'title') return t('kindTitle')
  if (s.layout === 'number') return t('kindNumber')
  return t('kindImage', { number: slideNumber(round, s) ?? '' })
}

// Op volgorde slepen aan de miniatuur, zodat tekst selecteren in de velden gewoon blijft werken.
// Bestanden slepen gaat hier niet over: die laten we door naar de ronde (importeren).
const dragging = ref<string | null>(null)
const dropAt = ref<{ id: string; after: boolean } | null>(null)

function onDragStart(event: DragEvent, id: string) {
  dragging.value = id
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragOver(event: DragEvent, id: string) {
  if (!dragging.value) return
  event.preventDefault()
  event.stopPropagation()
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropAt.value = { id, after: event.clientY > box.top + box.height / 2 }
}
function onDrop(event: DragEvent) {
  if (!dragging.value) return
  event.preventDefault()
  event.stopPropagation()
  if (dropAt.value) {
    moveById(props.round.slides, dragging.value, dropAt.value.id, dropAt.value.after)
    renumberSlides(props.round)
  }
  onDragEnd()
}
function onDragEnd() {
  dragging.value = null
  dropAt.value = null
}
const lineAt = (id: string, after: boolean) =>
  dropAt.value?.id === id && dropAt.value.after === after && dragging.value !== id
</script>

<template>
  <div class="slide-list">
    <div
      v-for="s in round.slides"
      :key="s.id"
      class="item"
      :class="{
        on: s.id === selectedId,
        lifted: s.id === dragging,
        'drop-before': lineAt(s.id, false),
        'drop-after': lineAt(s.id, true)
      }"
      @click="emit('select', s.id)"
      @focusin="emit('select', s.id)"
      @dragover="onDragOver($event, s.id)"
      @drop="onDrop"
    >
      <button
        type="button"
        class="thumb"
        :class="{ video: typeof s.backdrop !== 'object' }"
        :aria-label="t('choose', { name: s.title || kind(round, s) })"
        draggable="true"
        @dragstart="onDragStart($event, s.id)"
        @dragend="onDragEnd"
      >
        <SlideView
          :slide="s"
          :quiz="quiz"
          :number="slideNumber(round, s)"
          :standings="standingsOf(quiz, s)"
        />
      </button>

      <div class="text">
        <template v-if="s.layout === 'question'">
          <span class="kicker">
            <input
              v-model="s.title"
              class="quiet kicker-input"
              :aria-label="t('heading')"
              :placeholder="t('questionPlaceholder')"
            />
            <span v-if="s.numberOnly" class="note">{{ t('numberOnlyNote') }}</span>
          </span>
          <textarea
            v-model="s.body"
            class="quiet main"
            rows="1"
            :aria-label="t('question')"
            :placeholder="s.numberOnly ? t('questionTextPrivate') : t('questionText')"
          />
        </template>
        <template v-else>
          <span class="kicker">{{ kind(round, s) }}</span>
          <input
            v-model="s.title"
            class="quiet main"
            :class="{ strong: s.layout !== 'image' }"
            :aria-label="s.layout === 'image' ? t('caption') : t('title')"
            :placeholder="s.layout === 'image' ? t('captionPlaceholder') : t('title')"
          />
          <textarea
            v-if="s.layout !== 'image'"
            v-model="s.body"
            class="quiet sub"
            rows="1"
            :aria-label="t('subtitle')"
            :placeholder="t('subtitle')"
          />
        </template>
        <label v-if="s.layout !== 'title'" class="answer">
          <span>{{ t('answer') }}</span>
          <input
            v-model="s.answer"
            class="quiet"
            :aria-label="t('answer')"
            :placeholder="t('answerPlaceholder')"
          />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 10px;
  border-radius: var(--radius-lg);
  cursor: default;
}

.item.lifted {
  opacity: 0.4;
}

/* Waar de slide terechtkomt: een lijn in de ruimte tussen twee slides. */
.item.drop-before::before,
.item.drop-after::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  height: 2px;
  border-radius: 1px;
  background: var(--accent);
}
.item.drop-before::before {
  top: -3px;
}
.item.drop-after::after {
  bottom: -3px;
}

.item:hover {
  background: var(--surface-1);
}

.item.on {
  background: var(--surface-2);
}

.thumb {
  position: relative;
  flex: none;
  width: 168px;
  aspect-ratio: 16 / 9;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius);
  background: var(--surface-2);
  container-type: size;
  cursor: grab;
}

/* De miniatuur zelf is de greep; zonder dit sleept Chromium de afbeelding erin als bestand. */
.thumb > * {
  pointer-events: none;
}

/* Hint dat er video achter zit, zonder video's te decoderen. */
.thumb.video {
  background: var(--surface-3);
}

.item.on .thumb {
  box-shadow: 0 0 0 2px var(--accent);
}

.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 2px;
}

.kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
  color: var(--muted);
  font-size: 12px;
}

.kicker-input {
  width: auto;
  field-sizing: content;
  min-width: 4ch;
  color: var(--muted);
  font-size: 12px;
}

.note {
  color: var(--faint);
}

.main {
  font-size: 15px;
  line-height: 1.4;
}

.main.strong {
  font-weight: 600;
}

textarea.main,
textarea.sub {
  field-sizing: content;
}

.sub {
  color: var(--muted);
  line-height: 1.4;
}

.answer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: var(--muted);
}

.answer > span {
  flex: none;
}

.answer input {
  color: var(--text);
}
</style>
