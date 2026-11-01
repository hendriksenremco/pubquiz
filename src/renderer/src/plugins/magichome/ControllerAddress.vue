<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { effectName, lightLabel } from '@shared/light'
import type { MagicHomeProbe } from '@shared/magichome'
import Icon from '../../components/Icon.vue'
import { locale } from '../../lib/locale'
import { useControllerHost } from './controller'
import { CONTROLLER_MESSAGES } from './messages'

/**
 * Het IP-adres van de controller met een testknop. Testen vraagt alleen de toestand op, dus het
 * licht verandert niet. `autotest`: meteen testen, bv. bij Show starten.
 */
const props = defineProps<{ autotest?: boolean }>()
const api = window.pubquiz
const t = CONTROLLER_MESSAGES.in(locale)
const { host, setHost } = useControllerHost()
const status = ref<MagicHomeProbe | null>(null)
const testing = ref(false)

async function test() {
  const tested = host.value
  status.value = null
  testing.value = !!tested
  if (!tested) return
  const result = await api.pluginAct('magichome', 'probe', tested)
  // Intussen een ander adres ingevuld: de test daarvan telt.
  if (tested !== host.value) return
  status.value = result
  testing.value = false
}

function change(input: HTMLInputElement) {
  const value = input.value.trim()
  if (value === host.value) return
  setHost(value)
  void test()
}

const statusText = computed(() => {
  const s = status.value
  if (!s) return ''
  if (!s.ok) return s.error
  if (!s.state.on) return t('connectedOff')
  const now =
    s.state.effect !== null
      ? effectName(s.state.effect, locale)
      : lightLabel({ type: 'color', color: s.state.color }, locale)
  return t('connectedNow', { now })
})

onMounted(() => {
  if (props.autotest) void test()
})
</script>

<template>
  <div class="controller-address">
    <div class="address-row">
      <input
        class="input grow"
        :value="host"
        :placeholder="t('placeholder')"
        :aria-label="t('ariaLabel')"
        spellcheck="false"
        @change="change($event.target as HTMLInputElement)"
        @keydown.enter="change($event.target as HTMLInputElement)"
      />
      <button class="btn btn-ghost btn-sm" :disabled="!host || testing" @click="test">
        <Icon name="check" :size="14" /> {{ testing ? t('testing') : t('test') }}
      </button>
    </div>
    <p v-if="!host" class="status">{{ t('noAddress') }}</p>
    <p v-else-if="status" class="status light-status" :class="status.ok ? 'ok' : 'warn'">
      {{ statusText }}
    </p>
  </div>
</template>

<style scoped>
.controller-address {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.address-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status {
  color: var(--muted);
  font-size: 12px;
}

.status.ok {
  color: var(--ok);
}

.status.warn {
  color: var(--warn);
}
</style>
