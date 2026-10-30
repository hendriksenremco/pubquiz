<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { quizLights, type Light, type LightStatus } from '@shared/light'
import type { RemoteLight } from '@shared/remote'
import Popover from '../../components/Popover.vue'
import { useSession } from '../../stores/session'
import LightDot from './LightDot.vue'
import LightPanel from './LightPanel.vue'

/**
 * In de werkbalk van de show: het licht met de hand kiezen, zoals op de afstandsbediening. Het
 * bolletje toont wat er nu brandt.
 */
const api = window.pubquiz
const session = useSession()
/** Ook een keuze op de telefoon zien. */
const REFRESH_MS = 2000

const status = ref<LightStatus | null>(null)
const light = computed<RemoteLight | null>(() =>
  status.value && session.quiz ? { ...status.value, quiz: quizLights(session.quiz) } : null
)

async function load() {
  status.value = (await api.pluginInvoke('magichome', 'status')) as LightStatus | null
}

async function choose(choice: Light | null) {
  await api.pluginInvoke('magichome', 'choose', choice)
  await load()
}

// Een andere ronde of slide kan een ander licht kiezen.
watch(() => session.state, load)
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void load()
  timer = setInterval(() => void load(), REFRESH_MS)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
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
