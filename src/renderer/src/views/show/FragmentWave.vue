<script setup lang="ts">
import { findAsset } from '@shared/resolve'
import type { Fragment } from '@shared/types'
import Waveform from '../../components/Waveform.vue'
import { useWaveform } from '../../lib/waveform'
import { useSession } from '../../stores/session'

/** Waveform van één fragment op zijn knop; loopt mee terwijl hij speelt. */
const props = defineProps<{
  fragment: Fragment
  playing: { startedAt: number; duration: number | null } | null
}>()
const session = useSession()
const { bars } = useWaveform(
  () => ({
    asset: findAsset(session.quiz!, props.fragment.assetId),
    start: props.fragment.start,
    end: props.fragment.end
  }),
  40
)
</script>

<template>
  <Waveform
    :bars="bars"
    :playing="
      playing?.duration ? { startedAt: playing.startedAt, duration: playing.duration } : null
    "
  />
</template>
