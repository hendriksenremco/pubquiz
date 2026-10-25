<script setup lang="ts">
import { computed } from 'vue'
import { slideNumber } from '@shared/resolve'
import type { Round, Slide } from '@shared/types'
import SlideView from '../../components/SlideView.vue'
import { useSession } from '../../stores/session'

/**
 * De slides van een ronde als lijst: links wat de zaal ziet, rechts de tekst om meteen te typen.
 * Vorm, afbeelding en achtergrond staan in het paneel rechts (SlideInspector).
 */
defineProps<{ round: Round; selectedId: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()
const session = useSession()
const quiz = computed(() => session.quiz!)

function kind(round: Round, s: Slide): string {
  if (s.layout === 'title') return 'Titel'
  if (s.layout === 'number') return 'Nummer'
  return `Afbeelding ${slideNumber(round, s)}`
}
</script>

<template>
  <div class="slide-list">
    <div
      v-for="s in round.slides"
      :key="s.id"
      class="item"
      :class="{ on: s.id === selectedId }"
      @click="emit('select', s.id)"
      @focusin="emit('select', s.id)"
    >
      <button
        type="button"
        class="thumb"
        :class="{ video: typeof s.backdrop !== 'object' }"
        :aria-label="`Kies ${s.title || kind(round, s)}`"
      >
        <SlideView :slide="s" :quiz="quiz" :number="slideNumber(round, s)" />
      </button>

      <div class="text">
        <template v-if="s.layout === 'question'">
          <span class="kicker">
            <input v-model="s.title" class="quiet kicker-input" aria-label="Kop" placeholder="Vraag" />
            <span v-if="s.numberOnly" class="note">alleen het nummer in beeld</span>
          </span>
          <textarea
            v-model="s.body"
            class="quiet main"
            rows="1"
            aria-label="Vraag"
            :placeholder="s.numberOnly ? 'Vraagtekst, alleen voor jou en de pdf' : 'Vraagtekst'"
          />
        </template>
        <template v-else>
          <span class="kicker">{{ kind(round, s) }}</span>
          <input
            v-model="s.title"
            class="quiet main"
            :class="{ strong: s.layout !== 'image' }"
            :aria-label="s.layout === 'image' ? 'Bijschrift' : 'Titel'"
            :placeholder="s.layout === 'image' ? 'Bijschrift (mag leeg)' : 'Titel'"
          />
          <textarea
            v-if="s.layout !== 'image'"
            v-model="s.body"
            class="quiet sub"
            rows="1"
            aria-label="Ondertitel"
            placeholder="Ondertitel"
          />
        </template>
        <label v-if="s.layout !== 'title'" class="answer">
          <span>Antwoord</span>
          <input
            v-model="s.answer"
            class="quiet"
            aria-label="Antwoord"
            placeholder="Voor de antwoordenronde"
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
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 10px;
  border-radius: var(--radius-lg);
  cursor: default;
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
  cursor: pointer;
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
