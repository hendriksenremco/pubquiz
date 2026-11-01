<script setup lang="ts">
import { computed } from 'vue'
import type { Light } from '@shared/light'
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
    <LightPanel v-if="status" class="panel" :light="status" :disabled="false" @choose="choose" />
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
