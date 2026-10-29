<script setup lang="ts">
import { computed } from 'vue'
import {
  DEFAULT_SPEED,
  LIGHT_COLORS,
  LIGHT_EFFECTS,
  effectDescription,
  lightLabel,
  type Light
} from '@shared/light'
import { EFFECT_MAX, EFFECT_MIN } from '@shared/magichome'
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { vFill } from '../../lib/fill'
import LightDot from './LightDot.vue'

/**
 * Veld dat openklapt tot een keuze voor het licht: een kleur, een effect, uit, of niets eigens
 * (undefined). Wat "niets eigens" betekent, hangt van de plek af: zoals de ronde, de standaard, of
 * het licht niet aansturen. `fallback`: wat er dan brandt, voor het bolletje in het veld.
 */
const props = withDefaults(
  defineProps<{
    label: string
    /** Knop voor undefined, bv. "Ronde". */
    inherit: string
    /** Tekst in het veld bij undefined, bv. "Zoals de ronde". */
    inheritText: string
    fallback?: Light | null
  }>(),
  { fallback: null }
)
const model = defineModel<Light | undefined>()

type Choice = 'inherit' | Light['type']
const choice = computed<Choice>(() => model.value?.type ?? 'inherit')
const options = computed<{ value: Choice; label: string }[]>(() => [
  { value: 'inherit', label: props.inherit },
  { value: 'color', label: 'Kleur' },
  { value: 'effect', label: 'Effect' },
  { value: 'off', label: 'Uit' }
])

function choose(value: Choice) {
  if (value === choice.value) return
  if (value === 'inherit') model.value = undefined
  else if (value === 'off') model.value = { type: 'off' }
  else if (value === 'color') model.value = { type: 'color', color: LIGHT_COLORS[0].color }
  else model.value = { type: 'effect', effect: LIGHT_EFFECTS[0].effect, speed: DEFAULT_SPEED }
}

const color = computed(() => (model.value?.type === 'color' ? model.value.color : null))

/** Eigen kleurcode, bv. "#ff8000" of "ff8000"; iets anders laat de kleur staan. */
function setColor(input: HTMLInputElement) {
  const hex = input.value.trim().replace(/^#?/, '#').toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(hex)) model.value = { type: 'color', color: hex }
  input.value = color.value ?? ''
}

const effect = computed(() => (model.value?.type === 'effect' ? model.value : null))

function setEffect(id: number) {
  model.value = { type: 'effect', effect: id, speed: effect.value?.speed ?? DEFAULT_SPEED }
}

function setEffectNumber(input: HTMLInputElement) {
  const id = Math.round(Number(input.value))
  if (Number.isFinite(id) && id >= EFFECT_MIN && id <= EFFECT_MAX) setEffect(id)
  input.value = String(effect.value?.effect ?? '')
}

function setSpeed(input: HTMLInputElement) {
  if (effect.value) model.value = { ...effect.value, speed: Number(input.value) }
}

const shown = computed(() => model.value ?? props.fallback)
const valueText = computed(() => (model.value ? lightLabel(model.value) : props.inheritText))
const title = computed(() =>
  model.value || !props.fallback
    ? `${props.label}: ${valueText.value}`
    : `${props.label}: ${props.inheritText} (${lightLabel(props.fallback)})`
)
</script>

<template>
  <Popover :width="300" block>
    <template #trigger="{ open, toggle }">
      <button
        type="button"
        class="picker"
        :class="{ open }"
        :aria-label="label"
        :title="title"
        @click="toggle"
      >
        <LightDot :light="shown" :dim="!model" />
        <span class="value" :class="{ none: !model }">{{ valueText }}</span>
        <Icon name="chevron" :size="14" class="chev" />
      </button>
    </template>

    <div class="body">
      <div class="segmented" role="group" :aria-label="label">
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          :class="{ on: choice === o.value }"
          :aria-pressed="choice === o.value"
          @click="choose(o.value)"
        >
          {{ o.label }}
        </button>
      </div>

      <template v-if="color">
        <div class="swatches" role="group" aria-label="Kleur">
          <button
            v-for="c in LIGHT_COLORS"
            :key="c.color"
            type="button"
            class="swatch"
            :class="{ on: color === c.color }"
            :style="{ background: c.color }"
            :aria-label="c.name"
            :title="c.name"
            :aria-pressed="color === c.color"
            @click="model = { type: 'color', color: c.color }"
          />
        </div>
        <div class="own">
          <input
            type="color"
            class="well"
            :value="color"
            aria-label="Eigen kleur"
            @change="setColor($event.target as HTMLInputElement)"
          />
          <input
            class="input input-sm mono hex"
            :value="color"
            aria-label="Eigen kleurcode"
            maxlength="7"
            spellcheck="false"
            @change="setColor($event.target as HTMLInputElement)"
            @keydown.enter="setColor($event.target as HTMLInputElement)"
          />
        </div>
      </template>

      <template v-else-if="effect">
        <div class="effects" role="listbox" aria-label="Effect">
          <button
            v-for="e in LIGHT_EFFECTS"
            :key="e.effect"
            type="button"
            role="option"
            class="menu-item"
            :class="{ on: effect.effect === e.effect }"
            :aria-selected="effect.effect === e.effect"
            @click="setEffect(e.effect)"
          >
            <span class="grow">{{ e.name }}</span>
            <Icon v-if="effect.effect === e.effect" name="check" :size="14" />
          </button>
        </div>
        <label class="row">
          <span class="muted">Nummer</span>
          <input
            :value="effect.effect"
            type="number"
            :min="EFFECT_MIN"
            :max="EFFECT_MAX"
            step="1"
            class="input input-sm short"
            aria-label="Effectnummer"
            @change="setEffectNumber($event.target as HTMLInputElement)"
          />
          <span class="muted small">van {{ EFFECT_MAX }}</span>
        </label>
        <p class="muted small description">{{ effectDescription(effect.effect) }}</p>
        <label class="row">
          <span class="muted">Snelheid</span>
          <input
            v-fill
            :value="effect.speed"
            type="range"
            min="1"
            max="100"
            step="1"
            class="grow"
            aria-label="Snelheid"
            @change="setSpeed($event.target as HTMLInputElement)"
          />
        </label>
      </template>
    </div>
  </Popover>
</template>

<style scoped>
.body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.swatch {
  aspect-ratio: 1;
  border: 0;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  cursor: pointer;
}

.swatch.on {
  box-shadow:
    0 0 0 2px var(--surface-3),
    0 0 0 4px var(--accent);
}

.own {
  display: flex;
  gap: 6px;
}

.well {
  flex: none;
  width: 40px;
  height: 30px;
  padding: 2px;
  border: 0;
  border-radius: var(--radius);
  background: var(--surface-2);
  cursor: pointer;
}

.hex {
  flex: 1;
  background: var(--surface-2);
  text-transform: lowercase;
}

.effects {
  display: flex;
  flex-direction: column;
  margin: 0 -4px;
}

.effects .menu-item {
  padding-block: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 30px;
}

.row > .muted:first-child {
  width: 64px;
}

.short {
  width: 64px;
}

.small {
  font-size: 12px;
}

.description {
  margin-top: -6px;
  padding-left: 74px;
  line-height: 1.4;
}
</style>
