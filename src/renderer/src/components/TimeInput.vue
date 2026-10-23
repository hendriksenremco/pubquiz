<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatTime, parseTime } from '../lib/format'

const props = defineProps<{ placeholder?: string }>()
const model = defineModel<number | undefined>()

const text = ref('')
const show = () => (text.value = model.value === undefined ? '' : formatTime(model.value, 1))
watch(model, show, { immediate: true })

function commit() {
  const parsed = parseTime(text.value)
  if (text.value.trim() === '') model.value = undefined
  else if (parsed !== undefined) model.value = Math.round(parsed * 10) / 10
  show()
}
</script>

<template>
  <input
    v-model="text"
    class="input input-sm mono"
    :placeholder="props.placeholder"
    @blur="commit"
    @keydown.enter="($event.target as HTMLInputElement).blur()"
  />
</template>
