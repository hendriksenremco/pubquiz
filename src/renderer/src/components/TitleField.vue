<script setup lang="ts">
import { oneLine } from '../lib/format'

// Stil titelveld dat meegroeit: een lange titel loopt door op de volgende regel in plaats van
// aan de rand te worden afgesneden. Het blijft één regel tekst: Enter en plakken maken geen
// nieuwe regel, want een titel komt ook op slides, in lijsten en in bestandsnamen.
const title = defineModel<string>({ required: true })

function onInput(event: Event): void {
  const field = event.target as HTMLTextAreaElement
  const text = oneLine(field.value)
  if (text !== field.value) field.value = text
  title.value = text
}
</script>

<template>
  <textarea
    :value="title"
    class="quiet title-field"
    rows="1"
    @input="onInput"
    @keydown.enter.prevent
  ></textarea>
</template>

<style scoped>
.title-field {
  display: block;
  overflow: hidden;
  overflow-wrap: anywhere;
  field-sizing: content;
}
</style>
