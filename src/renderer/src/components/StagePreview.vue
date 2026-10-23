<script setup lang="ts">
import { computed } from 'vue'
import { createShowState } from '@shared/factory'
import type { ScreenSlot } from '@shared/types'
import { useSession } from '../stores/session'
import ScreenStage from './ScreenStage.vue'

/** Editor-preview van één scherm: zoals het eruitziet tijdens een ronde (of de standaard). */
const props = withDefaults(
  defineProps<{
    screen: ScreenSlot
    roundId?: string | null
    slideIndex?: number
    caption?: boolean
  }>(),
  { roundId: null, slideIndex: -1, caption: true }
)
const session = useSession()

const state = computed(() => ({
  ...createShowState(),
  live: true,
  activeRoundId: props.roundId,
  slideIndex: props.slideIndex
}))
</script>

<template>
  <figure class="preview">
    <div class="frame">
      <ScreenStage
        v-if="session.quiz"
        :quiz="session.quiz"
        :state="state"
        :screen-id="screen.id"
        preview
      />
    </div>
    <figcaption v-if="caption">{{ screen.name }}</figcaption>
  </figure>
</template>

<style scoped>
.preview {
  margin: 0;
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.frame {
  aspect-ratio: 16 / 9;
  border-radius: inherit;
  overflow: hidden;
  background: #000;
}

figcaption {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
</style>
