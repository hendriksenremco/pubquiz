<script setup lang="ts">
import Dialog from '../../components/Dialog.vue'
import Icon from '../../components/Icon.vue'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { ANALYTICS_MESSAGES } from './operator-messages'

/**
 * De vraag bij de eerste start: mag QuizNote anoniem meten? Wegklikken is geen antwoord: er wordt
 * dan niets gemeten en de vraag komt de volgende start terug.
 */
const emit = defineEmits<{ close: [] }>()
const session = useSession()
const t = ANALYTICS_MESSAGES.in(locale)

function answer(consent: boolean) {
  session.setAnalytics(consent)
  emit('close')
}
</script>

<template>
  <Dialog :title="t('title')" @close="emit('close')">
    <p class="text">{{ t('explain') }}</p>
    <p class="text muted">{{ t('later') }}</p>
    <template #actions>
      <button class="btn btn-ghost" @click="answer(false)">
        <Icon name="x" :size="15" /> {{ t('no') }}
      </button>
      <button class="btn btn-primary" @click="answer(true)">
        <Icon name="check" :size="15" /> {{ t('yes') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.text {
  font-size: 13px;
  line-height: 1.5;
}
</style>
