<script setup lang="ts">
import { computed, ref } from 'vue'
import { answerScreens, hasAnswers } from '@shared/factory'
import { itemSummary } from '@shared/forms'
import { answerItems, loopIndices } from '@shared/resolve'
import type { Round, RoundBackground, ScreenContent } from '@shared/types'
import ContentChip from '../../components/ContentChip.vue'
import Icon from '../../components/Icon.vue'
import MediaPicker from '../../components/MediaPicker.vue'
import PluginSlot from '../../plugins/PluginSlot.vue'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'

/** Paneel rechts voor de ronde zelf: schermen, muziek, fragmenten, loop en antwoorden. */
const props = defineProps<{ round: Round }>()
const emit = defineEmits<{ duplicate: []; remove: [] }>()
const session = useSession()
const quiz = computed(() => session.quiz!)

/** Lijsten in de volgorde van de quiz houden, zodat ze overal hetzelfde lezen. */
function toggled(list: string[], order: string[], id: string, on: boolean): string[] {
  return order.filter((x) => (x === id ? on : list.includes(x)))
}

// ── Schermen ─────────────────────────────────────────────────────────────────
function setOverride(screenId: string, value: ScreenContent | undefined) {
  if (value) props.round.screens[screenId] = value
  else delete props.round.screens[screenId]
}

function setMuted(screenId: string, muted: boolean) {
  const rest = props.round.mutedScreens.filter((id) => id !== screenId)
  props.round.mutedScreens = muted ? [...rest, screenId] : rest
}

function setFragmentScreen(screenId: string, on: boolean) {
  const order = quiz.value.screens.map((s) => s.id)
  props.round.fragmentScreens = toggled(props.round.fragmentScreens, order, screenId, on)
}

// ── Achtergrondmuziek ────────────────────────────────────────────────────────
type BgMode = 'continue' | 'duck' | 'pause' | 'replace'
// "Andere muziek" wordt pas echt opgeslagen zodra er een bestand gekozen is.
const replacing = ref(typeof props.round.background === 'object')
const bgMode = computed<BgMode>(() => {
  const bg = props.round.background
  return replacing.value || typeof bg === 'object' ? 'replace' : bg
})
const BG_OPTIONS: { value: BgMode; label: string; hint: string }[] = [
  { value: 'continue', label: 'Gewoon', hint: 'Speelt door, alleen zachter tijdens een fragment' },
  { value: 'duck', label: 'Zachter', hint: 'De hele ronde op het lagere volume' },
  { value: 'pause', label: 'Pauze', hint: 'Stil, na de ronde speelt hij verder' },
  { value: 'replace', label: 'Andere', hint: 'Een eigen loop tijdens deze ronde' }
]
function chooseBackground(mode: BgMode) {
  replacing.value = mode === 'replace'
  if (mode !== 'replace') props.round.background = mode
}
const replaceAsset = computed({
  get: () =>
    typeof props.round.background === 'object' ? props.round.background.replaceAssetId : undefined,
  set: (id) => {
    if (id) props.round.background = { replaceAssetId: id } satisfies RoundBackground
  }
})

// ── Fragmenten ───────────────────────────────────────────────────────────────
/** Leeg of ongeldig → fallback, zodat er nooit een lege string in de quiz belandt. */
function numberFrom(event: Event, fallback: number): number {
  const value = parseFloat((event.target as HTMLInputElement).value.replace(',', '.'))
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function renumber() {
  props.round.fragments.forEach((f, i) => (f.label = `Fragment ${i + 1}`))
}

// ── Slides die vanzelf wisselen ──────────────────────────────────────────────
const DEFAULT_LOOP_SECONDS = 8
const loopable = computed(() => loopIndices(props.round).length > 1)

function setLoop(on: boolean) {
  props.round.slideLoopSeconds = on ? DEFAULT_LOOP_SECONDS : null
}

function setLoopSeconds(event: Event) {
  const value = Math.round(Number((event.target as HTMLInputElement).value))
  if (Number.isFinite(value) && value >= 1) props.round.slideLoopSeconds = value
}

// ── Antwoorden: vragen, afbeeldingen en fragmenten van andere rondes nog eens langs ──────────
const answerSources = computed(() =>
  quiz.value.rounds.filter((r) => r.id !== props.round.id && hasAnswers(r))
)
const chosenSources = computed(() =>
  answerSources.value.filter((r) => props.round.answersFor.includes(r.id))
)
const missingAnswers = computed(
  () => answerItems(quiz.value, props.round).filter((item) => !item.answer).length
)

/** Aan: deze ronde loopt de antwoorden langs; eerst van alle rondes, uit te vinken per ronde. */
const answersOn = ref(props.round.answersFor.length > 0)

function setAnswersOn(on: boolean) {
  answersOn.value = on
  if (!on) props.round.answersFor = []
  else if (!props.round.answersFor.length) {
    for (const r of answerSources.value) setAnswersFor(r.id, true)
  }
}

function setAnswersFor(roundId: string, on: boolean) {
  const order = quiz.value.rounds.map((r) => r.id)
  props.round.answersFor = toggled(props.round.answersFor, order, roundId, on)
  // Eerste keuze: in beeld waar de nummers van die ronde stonden.
  if (on && !props.round.fragmentScreens.length) {
    props.round.fragmentScreens = answerScreens(quiz.value, chosenSources.value)
  }
}
</script>

<template>
  <div class="round-settings">
    <div v-if="quiz.screens.length" class="inspector-group">
      <span class="label">Schermen in deze ronde</span>
      <div v-for="slot in quiz.screens" :key="slot.id" class="inspector-row">
        <span class="row-label">{{ slot.name }}</span>
        <ContentChip
          :label="slot.name"
          :model-value="round.screens[slot.id]"
          :muted="round.mutedScreens.includes(slot.id)"
          :fallback="slot.default"
          allow-default
          field
          @update:model-value="setOverride(slot.id, $event)"
          @update:muted="setMuted(slot.id, $event)"
        />
      </div>
    </div>

    <div class="inspector-group">
      <span class="label">Achtergrondmuziek</span>
      <p v-if="!quiz.background" class="muted small">
        Geen achtergrondmuziek. Die kies je bij Quiz-instellingen.
      </p>
      <template v-else>
        <div class="segmented" role="group" aria-label="Achtergrondmuziek">
          <button
            v-for="o in BG_OPTIONS"
            :key="o.value"
            type="button"
            :class="{ on: bgMode === o.value }"
            :aria-pressed="bgMode === o.value"
            :title="o.hint"
            @click="chooseBackground(o.value)"
          >
            {{ o.label }}
          </button>
        </div>
        <MediaPicker
          v-if="bgMode === 'replace'"
          v-model="replaceAsset"
          :kinds="['audio']"
          size="sm"
          placeholder="Kies muziek voor deze ronde…"
          aria-label="Muziek voor deze ronde"
        />
      </template>
    </div>

    <PluginSlot name="roundSettings" :round="round" />

    <div v-if="round.fragments.length" class="inspector-group">
      <span class="label">Fragmenten</span>
      <div v-if="quiz.screens.length" class="inspector-row">
        <span class="row-label">Nummer op</span>
        <div class="checks" role="group" aria-label="Fragmentnummer in beeld op">
          <label v-for="slot in quiz.screens" :key="slot.id">
            <input
              type="checkbox"
              :checked="round.fragmentScreens.includes(slot.id)"
              @change="setFragmentScreen(slot.id, ($event.target as HTMLInputElement).checked)"
            />
            {{ slot.name }}
          </label>
        </div>
      </div>
      <div class="inspector-row">
        <span class="row-label">In de reeks</span>
        <span class="inline">
          <input
            :value="round.autoplay.gapSeconds"
            type="number"
            min="0"
            step="1"
            class="input input-sm short"
            aria-label="Pauze tussen fragmenten in seconden"
            @change="round.autoplay.gapSeconds = numberFrom($event, 0)"
          />
          <span class="muted">s ertussen</span>
        </span>
      </div>
      <label class="check-line">
        <input v-model="round.autoplay.countdownOnScreen" type="checkbox" />
        Aftellen tussen fragmenten in beeld
      </label>
      <button class="btn btn-ghost btn-sm renumber" @click="renumber">
        Namen hernummeren: Fragment 1, 2, …
      </button>
    </div>

    <div v-if="loopable" class="inspector-group">
      <span class="label">Slides</span>
      <label class="check-line">
        <input
          type="checkbox"
          :checked="!!round.slideLoopSeconds"
          @change="setLoop(($event.target as HTMLInputElement).checked)"
        />
        Vanzelf wisselen
      </label>
      <div v-if="round.slideLoopSeconds" class="inspector-row">
        <span class="row-label">Elke</span>
        <span class="inline">
          <input
            :value="round.slideLoopSeconds"
            type="number"
            min="1"
            step="1"
            class="input input-sm short"
            aria-label="Seconden per slide"
            @change="setLoopSeconds"
          />
          <span class="muted">seconden</span>
        </span>
      </div>
    </div>

    <div v-if="answerSources.length" class="inspector-group answers">
      <span class="label">Antwoorden</span>
      <label class="check-line">
        <input
          type="checkbox"
          :checked="answersOn"
          @change="setAnswersOn(($event.target as HTMLInputElement).checked)"
        />
        Antwoorden van andere rondes langslopen
      </label>
      <label
        v-for="r in answersOn ? answerSources : []"
        :key="r.id"
        class="check-line check-row source"
      >
        <input
          type="checkbox"
          :checked="round.answersFor.includes(r.id)"
          @change="setAnswersFor(r.id, ($event.target as HTMLInputElement).checked)"
        />
        <span class="grow">
          {{ r.title }}
          <span class="hint">{{ itemSummary(r, locale) }}</span>
        </span>
      </label>
      <p v-if="answersOn && missingAnswers" class="warn small">
        Nog {{ missingAnswers }} zonder antwoord. Vul het in bij de vraag, de afbeelding of het
        fragment zelf.
      </p>
      <div v-if="chosenSources.length && quiz.screens.length" class="inspector-row">
        <span class="row-label">In beeld op</span>
        <div class="checks" role="group" aria-label="Antwoorden in beeld op">
          <label v-for="slot in quiz.screens" :key="slot.id">
            <input
              type="checkbox"
              :checked="round.fragmentScreens.includes(slot.id)"
              @change="setFragmentScreen(slot.id, ($event.target as HTMLInputElement).checked)"
            />
            {{ slot.name }}
          </label>
        </div>
      </div>
    </div>

    <footer class="foot">
      <button class="btn btn-ghost btn-sm" @click="emit('duplicate')">
        <Icon name="copy" :size="14" /> Dupliceer ronde
      </button>
      <span class="grow" />
      <button class="btn btn-ghost btn-sm btn-danger" @click="emit('remove')">
        <Icon name="trash" :size="14" /> Verwijder ronde
      </button>
    </footer>
  </div>
</template>

<style scoped>
.round-settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.small {
  font-size: 12px;
}

.warn {
  color: var(--warn);
  line-height: 1.45;
}

.inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.short {
  width: 64px;
}

.check-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  cursor: pointer;
}

.hint {
  display: block;
  color: var(--muted);
  font-size: 12px;
}

.source {
  align-items: flex-start;
  padding: 4px 0 4px 24px;
}

.source input {
  margin-top: 2px;
}

.renumber {
  align-self: flex-start;
  margin-left: -8px;
  color: var(--muted);
}

.foot {
  display: flex;
  gap: 2px;
  margin: 0 -8px;
}
</style>
