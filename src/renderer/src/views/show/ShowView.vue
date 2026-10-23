<script setup lang="ts">
import { useSession } from '../../stores/session'
import ShowLive from './ShowLive.vue'
import ShowPrepare from './ShowPrepare.vue'

const session = useSession()
</script>

<template>
  <ShowLive v-if="session.live" />
  <ShowPrepare v-else />
</template>
