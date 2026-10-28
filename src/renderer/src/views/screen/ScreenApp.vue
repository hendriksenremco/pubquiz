<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ScreenStage from '../../components/ScreenStage.vue'
import { listAudioOutputs, screenSoundOutput, type AudioOutput } from '../../lib/audio-devices'
import { useSession } from '../../stores/session'

const props = defineProps<{ param: string }>()
const session = useSession()
const outputs = ref<AudioOutput[] | null>(null)

/** Videogeluid gaat naar de speakers van dit scherm, of naar de uitgang die bij Show gekozen is. */
const sinkId = computed(() => {
  if (!outputs.value) return null
  const output = screenSoundOutput(
    session.hardware.screenSound[props.param],
    session.hardware.screens[props.param],
    outputs.value
  )
  return !output || output.deviceId === 'default' ? '' : output.deviceId
})

async function refreshOutputs() {
  outputs.value = await listAudioOutputs()
}

onMounted(async () => {
  await session.init()
  await refreshOutputs()
  navigator.mediaDevices.addEventListener('devicechange', refreshOutputs)
})
onBeforeUnmount(() => navigator.mediaDevices.removeEventListener('devicechange', refreshOutputs))
</script>

<template>
  <div class="screen">
    <div class="canvas">
      <ScreenStage
        v-if="session.quiz"
        :quiz="session.quiz"
        :state="session.state"
        :screen-id="param"
        :sink-id="sinkId"
      />
    </div>
  </div>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: #000;
  cursor: none;
}

/* Altijd 16:9, zoals de previews en het beeldmateriaal: op een breder of hoger scherm komen er
   zwarte randen bij, in plaats van dat de randen van het beeld wegvallen. */
.canvas {
  width: min(100vw, calc(100vh * 16 / 9));
  aspect-ratio: 16 / 9;
}
</style>
