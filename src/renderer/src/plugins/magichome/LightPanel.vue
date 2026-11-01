<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DEFAULT_SPEED,
  LIGHT_COLORS,
  lightColorName,
  lightLabel,
  sameLight,
  type Light,
  type LightStatus
} from '@shared/light'
import type { Locale } from '@shared/i18n'
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
import { LIGHT_MESSAGES } from '@shared/light-messages'
import Icon from '../../components/Icon.vue'
import LightDot from './LightDot.vue'
import { LIGHT_PANEL_MESSAGES } from './messages'

/**
 * Het licht met de hand kiezen: een licht uit de quiz, een kleur, uit of een effect. Het geldt
 * tot de show zelf een ander licht kiest; "Volg de show" gaat er meteen naar terug. Op de
 * telefoon en in de werkbalk van de show; `locale` is de taal van de Mac.
 */
const props = defineProps<{ light: LightStatus; disabled: boolean; locale: Locale }>()
const emit = defineEmits<{ choose: [light: Light | null] }>()

const t = computed(() => LIGHT_PANEL_MESSAGES.in(props.locale))
const off = computed(() => LIGHT_MESSAGES.in(props.locale)('off'))
const label = (light: Light) => lightLabel(light, props.locale)

const current = computed(() => props.light.light)
const is = (light: Light) => sameLight(light, current.value)
const color = (hex: string): Light => ({ type: 'color', color: hex })

const note = computed(() => {
  if (props.light.manual) return t.value('manual')
  return current.value ? t.value('following') : t.value('notDriven')
})

const openGroup = ref<EffectGroupId | null>(null)
const currentGroup = computed(() =>
  current.value?.type === 'effect' ? effectInfo(current.value.effect)?.group : null
)
function effect(id: number) {
  const speed = current.value?.type === 'effect' ? current.value.speed : DEFAULT_SPEED
  emit('choose', { type: 'effect', effect: id, speed })
}
</script>

<template>
  <section class="light-panel" :aria-label="t('light')">
    <div class="head">
      <h2>{{ t('light') }}</h2>
      <button v-if="light.manual" class="chip" :disabled="disabled" @click="emit('choose', null)">
        {{ t('followShow') }}
      </button>
    </div>

    <div class="current">
      <LightDot :light="current" class="current-dot" />
      <span class="grow">
        <span class="current-label">{{ current ? label(current) : t('notDrivenShort') }}</span>
        <span class="muted current-note">{{ note }}</span>
      </span>
    </div>

    <template v-if="light.quiz.length">
      <span class="eyebrow">{{ t('inThisQuiz') }}</span>
      <div class="chips">
        <button
          v-for="l in light.quiz"
          :key="JSON.stringify(l)"
          class="chip"
          :class="{ on: is(l) }"
          :disabled="disabled"
          @click="emit('choose', l)"
        >
          <LightDot :light="l" />{{ label(l) }}
        </button>
      </div>
    </template>

    <span class="eyebrow">{{ t('color') }}</span>
    <div class="swatches" role="group" :aria-label="t('color')">
      <button
        v-for="c in LIGHT_COLORS"
        :key="c.color"
        class="swatch"
        :class="{ on: is(color(c.color)) }"
        :style="{ background: c.color }"
        :aria-label="lightColorName(c, locale)"
        :disabled="disabled"
        @click="emit('choose', color(c.color))"
      />
      <button
        class="swatch off"
        :class="{ on: current?.type === 'off' }"
        :disabled="disabled"
        @click="emit('choose', { type: 'off' })"
      >
        {{ off }}
      </button>
    </div>

    <span class="eyebrow">{{ t('effect') }}</span>
    <div class="groups">
      <section v-for="g in EFFECT_GROUPS" :key="g.id">
        <button
          class="group-head"
          :aria-expanded="openGroup === g.id"
          @click="openGroup = openGroup === g.id ? null : g.id"
        >
          <Icon name="right" :size="14" class="chev" :class="{ turned: openGroup === g.id }" />
          <span class="grow">{{ groupName(g.id, locale) }}</span>
          <span v-if="currentGroup === g.id" class="here" />
          <span class="count">{{ g.effects.length }}</span>
        </button>

        <template v-if="openGroup === g.id">
          <div
            v-if="g.grid"
            class="grid"
            role="group"
            :aria-label="groupName(g.id, locale)"
            :style="{ '--columns': g.grid.colors.length }"
          >
            <span class="col-label">{{ gridLabel(g, locale) }}</span>
            <template v-for="row in gridRows(g)" :key="row.direction">
              <span class="direction">{{ directionName(row.direction, locale) }}</span>
              <button
                v-for="info in row.cells"
                :key="info.effect"
                class="cell"
                :class="{ on: current?.type === 'effect' && current.effect === info.effect }"
                :style="{ background: EFFECT_COLORS[info.color!].swatch }"
                :aria-label="effectLabel(info, locale)"
                :disabled="disabled"
                @click="effect(info.effect)"
              />
            </template>
          </div>
          <div v-else class="list" role="group" :aria-label="groupName(g.id, locale)">
            <button
              v-for="e in g.effects"
              :key="e.effect"
              class="item"
              :class="{ on: current?.type === 'effect' && current.effect === e.effect }"
              :disabled="disabled"
              @click="effect(e.effect)"
            >
              <span class="grow">{{ effectLabel(e, locale) }}</span>
              <Icon
                v-if="current?.type === 'effect' && current.effect === e.effect"
                name="check"
                :size="16"
              />
            </button>
          </div>
        </template>
      </section>
    </div>
  </section>
</template>

<style scoped>
.light-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: var(--radius-xl);
  background: var(--surface-1);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
}

h2 {
  font-size: 20px;
}

.current {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 6px;
}

.current-dot {
  width: 30px;
  height: 30px;
}

.current-label {
  display: block;
  font-weight: 650;
}

.current-note {
  display: block;
  font-size: 13px;
}

.eyebrow {
  margin-top: 6px;
  font-size: 13px;
}

button {
  border: 0;
  font: inherit;
  color: var(--text);
  cursor: pointer;
}

button:disabled {
  opacity: 0.35;
  cursor: default;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px 0 10px;
  border-radius: 999px;
  background: var(--surface-3);
  font-weight: 600;
}

.head .chip {
  padding-left: 14px;
  background: var(--accent-soft);
  color: var(--accent);
}

.chip.on {
  box-shadow: inset 0 0 0 2px var(--accent);
}

.swatches {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 56px));
  gap: 10px;
}

.swatch {
  aspect-ratio: 1;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}

.swatch.off {
  background: #000;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
}

.swatch.on {
  box-shadow:
    0 0 0 3px var(--surface-1),
    0 0 0 5px var(--accent);
}

.groups {
  display: flex;
  flex-direction: column;
  margin: 0 -6px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 0 8px;
  border-radius: var(--radius);
  background: transparent;
  font-weight: 600;
  text-align: left;
}

.chev {
  color: var(--faint);
  transition: transform 0.12s;
}

.chev.turned {
  transform: rotate(90deg);
}

.here {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.count {
  color: var(--faint);
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: 96px repeat(var(--columns), minmax(0, 34px));
  align-items: center;
  gap: 6px;
  padding: 2px 8px 12px 30px;
}

.col-label {
  grid-column: 2 / -1;
  color: var(--faint);
  font-size: 12px;
}

.direction {
  color: var(--muted);
  font-size: 13px;
}

.cell {
  aspect-ratio: 1;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
}

.cell.on {
  box-shadow:
    0 0 0 2px var(--surface-1),
    0 0 0 4px var(--accent);
}

.list {
  display: flex;
  flex-direction: column;
  padding: 0 0 8px 22px;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 8px;
  border-radius: var(--radius);
  background: transparent;
  text-align: left;
}

.item.on {
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
