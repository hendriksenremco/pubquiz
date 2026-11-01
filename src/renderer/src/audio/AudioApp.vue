<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { listAudioOutputs } from '../lib/audio-devices'
import { useSession } from '../stores/session'
import { AudioEngine } from './engine'

// Verborgen venster zonder UI: speelt alle audio van de show.
const api = window.pubquiz
const session = useSession()
const engine = new AudioEngine((event) => api.audioEvent(event))
Object.assign(window, { __pubquizAudio: engine })

async function refreshDevices() {
  engine.setDevices(await listAudioOutputs())
  engine.update(session.quiz, session.state, session.hardware)
}

onMounted(async () => {
  await session.init()
  await refreshDevices()
  navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
  api.onAudioCommand((command) => {
    if (command.type === 'testTone') engine.testTone(command.channelId)
    if (command.type === 'timerEnd') engine.timerEnd(command.channelId)
  })
  watch(
    () => [session.quiz, session.state, session.hardware] as const,
    ([quiz, state, hardware]) => engine.update(quiz, state, hardware),
    { immediate: true }
  )
})
</script>

<template>
  <div />
</template>
