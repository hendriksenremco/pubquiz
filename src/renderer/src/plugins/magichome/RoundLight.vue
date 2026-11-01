<script setup lang="ts">
import { lightOf, setLight } from '@shared/light'
import type { Round } from '@shared/types'
import { useSession } from '../../stores/session'
import { locale } from '../../lib/locale'
import LightPicker from './LightPicker.vue'
import { LIGHT_PLACE_MESSAGES } from './messages'

/** Bij de instellingen van een ronde: het licht tijdens de ronde, behalve bij slides met een eigen licht. */
defineProps<{ round: Round }>()
const session = useSession()
const t = LIGHT_PLACE_MESSAGES.in(locale)
</script>

<template>
  <div class="inspector-group">
    <span class="label">{{ t('light') }}</span>
    <LightPicker
      :label="t('roundLabel')"
      :inherit="t('roundInherit')"
      :inherit-text="t('roundInheritText')"
      :fallback="lightOf(session.quiz)"
      :model-value="lightOf(round)"
      @update:model-value="setLight(round, $event)"
    />
  </div>
</template>
