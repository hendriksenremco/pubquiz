<script setup lang="ts">
import { computed } from 'vue'
import { quizLights, type Light } from '@shared/light'
import type { RemoteLight } from '@shared/remote'
import Popover from '../../components/Popover.vue'
import { useSession } from '../../stores/session'
import LightDot from './LightDot.vue'
import LightPanel from './LightPanel.vue'

/**
 * In de werkbalk van de show: het licht met de hand kiezen, zoals op de afstandsbediening. Het
 * bolletje toont wat er nu brandt, ook als het op de telefoon gekozen is.
 */
const api = window.pubquiz
const session = useSession()

const status = computed(() => session.statusOf('magichome'))
const light = computed<RemoteLight | null>(() =>
  status.value && session.quiz ? { ...status.value, quiz: quizLights(session.quiz) } : null
)

async function choose(choice: Light | null) {
  await api.pluginAct('magichome', 'choose', choice ? { ...choice } : null)
}
</script>

<template>
  <Popover align="right" :width="380">
    <template #trigger="{ open, toggle }">
      <button
        class="btn btn-ghost"
        :class="{ active: open }"
        title="Het licht met de hand kiezen"
        @click="toggle"
      >
        <LightDot :light="status?.light" class="light-mark" /> Licht
      </button>
    </template>
    <LightPanel v-if="light" class="panel" :light="light" :disabled="false" @choose="choose" />
  </Popover>
</template>

<style scoped>
.light-mark {
  width: 13px;
  height: 13px;
}

.panel {
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}
</style>
