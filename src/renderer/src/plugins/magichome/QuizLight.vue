<script setup lang="ts">
import { computed } from 'vue'
import { lightOf, setLight } from '@shared/light'
import { useSession } from '../../stores/session'
import LightPicker from './LightPicker.vue'

/** Bij Quiz-instellingen: het licht van rondes en slides zonder eigen licht, en tussen de rondes. */
const session = useSession()
const quiz = computed(() => session.quiz!)
</script>

<template>
  <section>
    <div class="section-head"><h3>Licht</h3></div>
    <div class="tile light">
      <span class="muted">Standaard</span>
      <LightPicker
        label="Standaard licht"
        inherit="Geen"
        inherit-text="Niet aansturen"
        :model-value="lightOf(quiz)"
        @update:model-value="setLight(quiz, $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.light {
  display: grid;
  grid-template-columns: 84px minmax(0, 320px);
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
}
</style>
