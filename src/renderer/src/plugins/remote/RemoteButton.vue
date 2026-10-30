<script setup lang="ts">
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import RemoteQr from './RemoteQr.vue'

/** In de werkbalk van de show: de QR-code voor de afstandsbediening. */
</script>

<template>
  <Popover align="right" :width="248">
    <template #trigger="{ open, toggle }">
      <button
        class="btn btn-ghost"
        :class="{ active: open }"
        title="Bedien de show met een telefoon of tablet"
        @click="toggle"
      >
        <Icon name="phone" :size="15" /> Telefoon
      </button>
    </template>
    <RemoteQr class="panel" />
  </Popover>
</template>

<style scoped>
.panel {
  padding: 8px;
}
</style>
