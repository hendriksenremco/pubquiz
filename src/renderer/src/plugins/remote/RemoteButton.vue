<script setup lang="ts">
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { locale } from '../../lib/locale'
import { REMOTE_QR_MESSAGES } from './messages'
import RemoteQr from './RemoteQr.vue'

/** In de werkbalk van de show: de QR-code voor de afstandsbediening. */
const t = REMOTE_QR_MESSAGES.in(locale)
</script>

<template>
  <Popover align="right" :width="248">
    <template #trigger="{ open, toggle }">
      <button
        class="btn btn-ghost"
        :class="{ active: open }"
        :title="t('phoneTitle')"
        @click="toggle"
      >
        <Icon name="phone" :size="15" /> {{ t('phone') }}
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
