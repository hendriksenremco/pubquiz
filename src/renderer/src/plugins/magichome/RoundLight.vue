<script setup lang="ts">
import { lightOf, setLight } from '@shared/light'
import type { Round } from '@shared/types'
import { useSession } from '../../stores/session'
import LightPicker from './LightPicker.vue'

/** Bij de instellingen van een ronde: het licht tijdens de ronde, behalve bij slides met een eigen licht. */
defineProps<{ round: Round }>()
const session = useSession()
</script>

<template>
  <div class="inspector-group">
    <span class="label">Licht</span>
    <LightPicker
      label="Licht in deze ronde"
      inherit="Standaard"
      inherit-text="Standaard"
      :fallback="lightOf(session.quiz)"
      :model-value="lightOf(round)"
      @update:model-value="setLight(round, $event)"
    />
  </div>
</template>
