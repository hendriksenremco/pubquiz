<script setup lang="ts">
import { computed } from 'vue'
import { quizUsesLight } from '@shared/light'
import { useSession } from '../../stores/session'
import ControllerAddress from './ControllerAddress.vue'

/**
 * In "Show starten": het adres van de controller van vanavond. Op elke locatie krijgt hij een
 * ander IP-adres; de app onthoudt het laatste.
 */
const session = useSession()
const uses = computed(() => !!session.quiz && quizUsesLight(session.quiz))
</script>

<template>
  <div v-if="uses" class="group">
    <div class="group-head">
      <span class="label grow">Licht</span>
    </div>
    <div class="line">
      <span class="name">MagicHome</span>
      <ControllerAddress class="grow" autotest />
    </div>
  </div>
</template>

<style scoped>
.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-head {
  display: flex;
  align-items: center;
  min-height: 28px;
  margin-bottom: 2px;
}

.line {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 0;
}

.name {
  flex: none;
  width: 110px;
  padding-top: 6px;
  font-size: 14px;
}
</style>
