<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  DEFAULT_EFFECT,
  DEFAULT_SPEED,
  LIGHT_COLORS,
  lightColorName,
  lightLabel,
  type Light
} from '@shared/light'
import {
  directionName,
  EFFECT_COLORS,
  EFFECT_GROUPS,
  effectInfo,
  effectLabel,
  gridLabel,
  gridRows,
  groupName,
  type EffectGroupId
} from '@shared/light-effects'
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { vFill } from '../../lib/fill'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { preview, previewOn, useControllerHost } from './controller'
import LightDot from './LightDot.vue'
import { LIGHT_PICKER_MESSAGES } from './messages'

/**
 * Veld dat openklapt tot een keuze voor het licht: een kleur, een effect, uit, of niets eigens
 * (undefined). Wat "niets eigens" betekent, hangt van de plek af: zoals de ronde, de standaard, of
 * het licht niet aansturen. `fallback`: wat er dan brandt, voor het bolletje in het veld.
 * Met "Voorbeeld op de lamp" laat de controller zien wat je kiest zolang het paneel open is.
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
const session = useSession()
const t = LIGHT_PICKER_MESSAGES.in(locale)

type Choice = 'inherit' | Light['type']
const choice = computed<Choice>(() => model.value?.type ?? 'inherit')
const options = computed<{ value: Choice; label: string }[]>(() => [
  { value: 'inherit', label: props.inherit },
  { value: 'color', label: t('color') },
  { value: 'effect', label: t('effect') },
  { value: 'off', label: t('off') }
])

function choose(value: Choice) {
  if (value === choice.value) return
  if (value === 'inherit') model.value = undefined
  else if (value === 'off') model.value = { type: 'off' }
  else if (value === 'color') model.value = { type: 'color', color: LIGHT_COLORS[0].color }
  else model.value = { type: 'effect', effect: DEFAULT_EFFECT, speed: DEFAULT_SPEED }
}

// ── Kleur ────────────────────────────────────────────────────────────────────
const color = computed(() => (model.value?.type === 'color' ? model.value.color : null))

/** Eigen kleurcode, bv. "#ff8000" of "ff8000"; iets anders laat de kleur staan. */
function setColor(input: HTMLInputElement) {
  const hex = input.value.trim().replace(/^#?/, '#').toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(hex)) model.value = { type: 'color', color: hex }
  input.value = color.value ?? ''
}

// ── Effect: alle 300, in groepen; de groep van het gekozen effect staat open ─────────────
const effect = computed(() => (model.value?.type === 'effect' ? model.value : null))
const openGroup = ref<EffectGroupId | null>(null)
watch(
  () => effect.value?.effect,
  (id) => {
    if (id !== undefined && openGroup.value === null)
      openGroup.value = effectInfo(id)?.group ?? null
  },
  { immediate: true }
)

function toggleGroup(id: EffectGroupId) {
  openGroup.value = openGroup.value === id ? null : id
}

function setEffect(id: number) {
  model.value = { type: 'effect', effect: id, speed: effect.value?.speed ?? DEFAULT_SPEED }
}

function setSpeed(input: HTMLInputElement) {
  if (effect.value) model.value = { ...effect.value, speed: Number(input.value) }
}

// ── Veld ─────────────────────────────────────────────────────────────────────
const shown = computed(() => model.value ?? props.fallback)
const valueText = computed(() =>
  model.value ? lightLabel(model.value, locale) : props.inheritText
)
const title = computed(() =>
  model.value || !props.fallback
    ? t('title', { label: props.label, value: valueText.value })
    : t('titleInherited', {
        label: props.label,
        value: props.inheritText,
        fallback: lightLabel(props.fallback, locale)
      })
)

// ── Voorbeeld op de lamp ─────────────────────────────────────────────────────
const { host } = useControllerHost()
const isOpen = ref(false)
const previewNote = computed(() => {
  if (session.live) return t('liveFollowsShow')
  if (!host.value) return t('noAddress')
  return previewError.value
})
const canPreview = computed(() => !session.live && !!host.value)
const previewing = computed(() => previewOn.value && isOpen.value && canPreview.value)
const previewError = ref('')
let showing = false

// Het veld krijgt bij elke wijziging een nieuw object; vergelijken op inhoud.
watch([previewing, () => JSON.stringify(shown.value ?? null)], async () => {
  if (previewing.value) {
    showing = true
    const result = await preview(shown.value ?? null)
    previewError.value = result.ok ? '' : result.error
  } else if (showing) {
    showing = false
    previewError.value = ''
    void preview(null)
  }
})
onBeforeUnmount(() => {
  if (showing) void preview(null)
})
</script>

<template>
  <Popover :width="360" block @toggle="isOpen = $event">
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
        <div class="swatches" role="group" :aria-label="t('color')">
          <button
            v-for="c in LIGHT_COLORS"
            :key="c.color"
            type="button"
            class="swatch"
            :class="{ on: color === c.color }"
            :style="{ background: c.color }"
            :aria-label="lightColorName(c, locale)"
            :title="lightColorName(c, locale)"
            :aria-pressed="color === c.color"
            @click="model = { type: 'color', color: c.color }"
          />
        </div>
        <div class="own">
          <input
            type="color"
            class="well"
            :value="color"
            :aria-label="t('customColor')"
            @change="setColor($event.target as HTMLInputElement)"
          />
          <input
            class="input input-sm mono hex"
            :value="color"
            :aria-label="t('customColorCode')"
            maxlength="7"
            spellcheck="false"
            @change="setColor($event.target as HTMLInputElement)"
            @keydown.enter="setColor($event.target as HTMLInputElement)"
          />
        </div>
      </template>

      <template v-else-if="effect">
        <div class="groups">
          <section v-for="g in EFFECT_GROUPS" :key="g.id" class="effect-group">
            <button
              type="button"
              class="group-head"
              :aria-expanded="openGroup === g.id"
              @click="toggleGroup(g.id)"
            >
              <Icon name="right" :size="13" class="chev" :class="{ turned: openGroup === g.id }" />
              <span class="grow">{{ groupName(g.id, locale) }}</span>
              <span v-if="effectInfo(effect.effect)?.group === g.id" class="here" />
              <span class="count">{{ g.effects.length }}</span>
            </button>

            <template v-if="openGroup === g.id">
              <div v-if="g.grid" class="grid" role="group" :aria-label="groupName(g.id, locale)">
                <span class="col-label">{{ gridLabel(g, locale) }}</span>
                <div v-for="row in gridRows(g)" :key="row.direction" class="grid-row">
                  <span class="direction">{{ directionName(row.direction, locale) }}</span>
                  <button
                    v-for="info in row.cells"
                    :key="info.effect"
                    type="button"
                    class="cell"
                    :class="{ on: effect.effect === info.effect }"
                    :style="{ background: EFFECT_COLORS[info.color!].swatch }"
                    :aria-label="effectLabel(info, locale)"
                    :title="effectLabel(info, locale)"
                    :aria-pressed="effect.effect === info.effect"
                    @click="setEffect(info.effect)"
                  />
                </div>
              </div>
              <div v-else class="list" role="listbox" :aria-label="groupName(g.id, locale)">
                <button
                  v-for="e in g.effects"
                  :key="e.effect"
                  type="button"
                  role="option"
                  class="menu-item"
                  :class="{ on: effect.effect === e.effect }"
                  :aria-selected="effect.effect === e.effect"
                  @click="setEffect(e.effect)"
                >
                  <span class="grow">{{ effectLabel(e, locale) }}</span>
                  <Icon v-if="effect.effect === e.effect" name="check" :size="14" />
                </button>
              </div>
            </template>
          </section>
        </div>
        <label class="row">
          <span class="muted">{{ t('speed') }}</span>
          <input
            v-fill
            :value="effect.speed"
            type="range"
            min="1"
            max="100"
            step="1"
            class="grow"
            :aria-label="t('speed')"
            @change="setSpeed($event.target as HTMLInputElement)"
          />
        </label>
      </template>

      <div class="preview">
        <label class="row check">
          <input v-model="previewOn" type="checkbox" :disabled="!canPreview" />
          {{ t('previewOnLamp') }}
        </label>
        <p v-if="previewNote" class="muted small note">{{ previewNote }}</p>
      </div>
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

.swatch,
.cell {
  border: 0;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  cursor: pointer;
}

.swatch {
  aspect-ratio: 1;
}

.swatch.on,
.cell.on {
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

.groups {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  margin: 0 -4px;
  overflow-y: auto;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.group-head:hover {
  background: var(--surface-4);
}

.group-head .chev {
  color: var(--faint);
  transition: transform 0.12s;
}

.group-head .chev.turned {
  transform: rotate(90deg);
}

.here {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.count {
  color: var(--faint);
  font-size: 12px;
  font-weight: 500;
}

.list {
  display: flex;
  flex-direction: column;
  padding: 0 0 6px 21px;
}

.list .menu-item {
  padding-block: 6px;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 2px 8px 10px 29px;
}

.col-label {
  padding-left: 125px;
  color: var(--faint);
  font-size: 11px;
}

.grid-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.direction {
  flex: none;
  width: 120px;
  color: var(--muted);
  font-size: 12px;
}

.cell {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 5px;
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

.preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.check {
  cursor: pointer;
}

.small {
  font-size: 12px;
}

.note {
  line-height: 1.4;
}
</style>
