<script setup lang="ts">
import { computed } from 'vue'
import { lightOf, setLight } from '@shared/light'
import type { Round, Slide } from '@shared/types'
import { useSession } from '../../stores/session'
import { locale } from '../../lib/locale'
import LightPicker from './LightPicker.vue'
import { LIGHT_PLACE_MESSAGES } from './messages'

/** In de inspector van een slide: eigen licht zolang deze slide in beeld is. */
const props = defineProps<{ round: Round; slide: Slide }>()
const session = useSession()
const t = LIGHT_PLACE_MESSAGES.in(locale)
const fallback = computed(() => lightOf(props.round) ?? lightOf(session.quiz) ?? null)
</script>

<template>
  <div class="inspector-row">
    <span class="row-label">{{ t('light') }}</span>
    <LightPicker
      :label="t('slideLabel')"
      :inherit="t('slideInherit')"
      :inherit-text="t('slideInheritText')"
      :fallback="fallback"
      :model-value="lightOf(slide)"
      @update:model-value="setLight(slide, $event)"
    />
  </div>
</template>
