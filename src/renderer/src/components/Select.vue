<script setup lang="ts">
import { computed, nextTick, ref, useAttrs } from 'vue'
import { locale } from '../lib/locale'
import Icon from './Icon.vue'
import { COMPONENT_MESSAGES } from './messages'
import Popover from './Popover.vue'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  /** Kopje boven een reeks opties, bv. "AirPlay in de buurt". */
  group?: string
}

/**
 * Keuzelijst in de stijl van de app, in plaats van <select> (dat een menu van macOS opent).
 * Toetsen: ↑ ↓ of Enter opent, ↑ ↓ kiest, Enter of spatie neemt over, Escape sluit.
 * `class` gaat naar de buitenkant (voor de opmaak), de rest (aria-label, …) naar de knop.
 */
defineOptions({ inheritAttrs: false })
const props = withDefaults(
  defineProps<{ options: SelectOption[]; placeholder?: string; size?: 'md' | 'sm' }>(),
  { placeholder: () => COMPONENT_MESSAGES.in(locale)('choose'), size: 'md' }
)
const model = defineModel<string>()
const attrs = useAttrs()
const buttonAttrs = computed(() => {
  const { class: _, ...rest } = attrs
  return rest
})

const popover = ref<InstanceType<typeof Popover> | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)
const width = ref<number>()

const selected = computed(() => props.options.find((o) => o.value === model.value) ?? null)
/** Een kopje telkens als de groep verandert. */
const rows = computed(() =>
  props.options.map((option, i) => ({
    option,
    heading: option.group && option.group !== props.options[i - 1]?.group ? option.group : null
  }))
)

const items = () => [
  ...(list.value?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? [])
]

async function openList(toggle: () => void) {
  width.value = trigger.value?.offsetWidth
  toggle()
  await nextTick()
  const all = items()
  ;(all.find((el) => el.getAttribute('aria-selected') === 'true') ?? all[0])?.focus()
}

function choose(option: SelectOption) {
  if (option.disabled) return
  model.value = option.value
  popover.value?.close()
  trigger.value?.focus()
}

function onTriggerKey(event: KeyboardEvent, open: boolean, toggle: () => void) {
  if (open || !['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return
  event.preventDefault()
  void openList(toggle)
}

function onListKey(event: KeyboardEvent) {
  const all = items()
  const at = all.indexOf(document.activeElement as HTMLButtonElement)
  const go = (i: number) => all[Math.max(0, Math.min(all.length - 1, i))]?.focus()
  if (event.key === 'ArrowDown') go(at + 1)
  else if (event.key === 'ArrowUp') go(at - 1)
  else if (event.key === 'Home') go(0)
  else if (event.key === 'End') go(all.length - 1)
  else if (event.key === 'Escape' || event.key === 'Tab') {
    popover.value?.close()
    trigger.value?.focus()
    if (event.key === 'Tab') return
  } else return
  event.preventDefault()
}
</script>

<template>
  <Popover ref="popover" :width="width" block :class="attrs.class">
    <template #trigger="{ open, toggle }">
      <button
        ref="trigger"
        type="button"
        class="select trigger"
        :class="{ 'input-sm': size === 'sm', open }"
        role="combobox"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :data-value="model ?? ''"
        v-bind="buttonAttrs"
        @click="open ? toggle() : openList(toggle)"
        @keydown="onTriggerKey($event, open, toggle)"
      >
        <span class="value" :class="{ placeholder: !selected }">
          {{ selected?.label ?? placeholder }}
        </span>
        <Icon name="chevron" :size="14" class="chevron" />
      </button>
    </template>

    <div ref="list" class="list" role="listbox" @keydown="onListKey">
      <template v-for="row in rows" :key="row.option.value">
        <div v-if="row.heading" class="heading">{{ row.heading }}</div>
        <button
          type="button"
          role="option"
          class="menu-item option"
          :class="{ on: row.option.value === model }"
          :aria-selected="row.option.value === model"
          :disabled="row.option.disabled"
          @click="choose(row.option)"
        >
          <span class="grow label">{{ row.option.label }}</span>
          <Icon v-if="row.option.value === model" name="check" :size="14" />
        </button>
      </template>
    </div>
  </Popover>
</template>

<style scoped>
.trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  cursor: pointer;
}

.trigger:hover,
.trigger.open {
  background: var(--surface-4);
}

.value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.placeholder {
  color: var(--muted);
}

.chevron {
  color: var(--muted);
  transition: transform 0.12s;
}

.trigger.open .chevron {
  transform: rotate(180deg);
}

.list {
  max-height: 320px;
  overflow: auto;
}

.heading {
  padding: 10px 10px 4px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.option:focus-visible {
  background: var(--surface-4);
  outline: none;
}

.option:disabled {
  color: var(--faint);
  cursor: default;
}

.option:disabled:hover {
  background: transparent;
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
