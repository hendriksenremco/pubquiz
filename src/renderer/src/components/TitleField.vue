<script setup lang="ts">
import { ref } from 'vue'
import { oneLine } from '../lib/format'

// Stil titelveld dat meegroeit: een lange titel loopt door op de volgende regel in plaats van
// aan de rand te worden afgesneden. Het blijft één regel tekst: Enter en plakken maken geen
// nieuwe regel, want een titel komt ook op slides, in lijsten en in bestandsnamen.
// Een lang woord breekt af met een streepje, op een lettergreep in de taal van de app
// (`lang` op <html>); alleen als dat niet kan, breekt het ergens anders.
const title = defineModel<string>({ required: true })
const field = ref<HTMLTextAreaElement | null>(null)

/** Zet de cursor in het veld met de hele titel geselecteerd, om meteen te kunnen overtypen. */
function selectAll(): void {
  field.value?.focus()
  field.value?.select()
}
defineExpose({ selectAll })

function onInput(event: Event): void {
  const input = event.target as HTMLTextAreaElement
  const text = oneLine(input.value)
  if (text !== input.value) input.value = text
  title.value = text
}
</script>

<template>
  <textarea
    ref="field"
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
  hyphens: auto;
  /* Alleen lange woorden: korte woorden schuiven heel naar de volgende regel. */
  hyphenate-limit-chars: 10 4 4;
  field-sizing: content;
}
</style>
