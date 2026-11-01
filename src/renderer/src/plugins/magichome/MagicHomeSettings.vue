<script setup lang="ts">
import { locale } from '../../lib/locale'
import ControllerAddress from './ControllerAddress.vue'
import { CONTROLLER_MESSAGES } from './messages'

/**
 * Bij Instellingen, onder de plug-in: het adres, zodat je ook buiten de show een voorbeeld ziet.
 * Met een kop, want na het invullen is de placeholder weg en zie je alleen nog een IP-adres.
 */
const t = CONTROLLER_MESSAGES.in(locale)
</script>

<template>
  <div class="field">
    <span class="label">{{ t('address') }}</span>
    <ControllerAddress autotest />
  </div>
</template>
