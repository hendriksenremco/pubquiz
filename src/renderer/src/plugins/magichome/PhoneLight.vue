<script setup lang="ts">
import type { PhoneProps } from '../phone'
import LightPanel from './LightPanel.vue'

/** Op de telefoon: het licht met de hand kiezen, zoals onder Licht in de werkbalk op de Mac. */
defineProps<PhoneProps<'magichome'>>()
</script>

<template>
  <LightPanel
    :light="status"
    :disabled="disabled"
    :locale="locale"
    @choose="act('choose', $event)"
  />
</template>
