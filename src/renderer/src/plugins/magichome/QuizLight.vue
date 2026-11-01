<script setup lang="ts">
import { computed } from 'vue'
import { lightOf, setLight } from '@shared/light'
import { useSession } from '../../stores/session'
import { locale } from '../../lib/locale'
import LightPicker from './LightPicker.vue'
import { LIGHT_PLACE_MESSAGES } from './messages'

/** Bij Quiz-instellingen: het licht van rondes en slides zonder eigen licht, en tussen de rondes. */
const session = useSession()
const t = LIGHT_PLACE_MESSAGES.in(locale)
const quiz = computed(() => session.quiz!)
</script>

<template>
  <section>
    <div class="section-head">
      <h3>{{ t('light') }}</h3>
    </div>
    <div class="tile light">
      <span class="muted">{{ t('quizDefault') }}</span>
      <LightPicker
        :label="t('quizLabel')"
        :inherit="t('quizInherit')"
        :inherit-text="t('quizInheritText')"
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
