<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { effectName, lightLabel, quizUsesLight } from '@shared/light'
import type { MagicHomeProbe } from '@shared/magichome'
import { PLUGIN_OFF } from '@shared/plugins'
import { useSession } from '../../stores/session'

/**
 * In "Show starten": het adres van de controller van vanavond. Op elke locatie krijgt hij een
 * ander IP-adres; de app onthoudt het laatste. Testen vraagt alleen de toestand op.
 */
const api = window.pubquiz
const session = useSession()
const uses = computed(() => !!session.quiz && quizUsesLight(session.quiz))
const setting = computed(() => session.plugins.magichome ?? PLUGIN_OFF)
const host = computed(() =>
  typeof setting.value.config.host === 'string' ? setting.value.config.host : ''
)
const status = ref<MagicHomeProbe | null>(null)
const testing = ref(false)

async function test() {
  const tested = host.value
  status.value = null
  testing.value = !!tested
  if (!tested) return
  const result = (await api.pluginInvoke('magichome', 'probe', tested)) as MagicHomeProbe | null
  // Intussen een ander adres ingevuld: de test daarvan telt.
  if (tested !== host.value) return
  status.value = result
  testing.value = false
}

function setHost(input: HTMLInputElement) {
  const value = input.value.trim()
  if (value === host.value) return
  session.setPlugin('magichome', {
    ...setting.value,
    config: { ...setting.value.config, host: value }
  })
  void test()
}

const statusText = computed(() => {
  const s = status.value
  if (!s) return ''
  if (!s.ok) return s.error
  if (!s.state.on) return 'Verbonden. Het licht staat uit.'
  const now =
    s.state.effect !== null
      ? effectName(s.state.effect)
      : lightLabel({ type: 'color', color: s.state.color })
  return `Verbonden. Nu: ${now}.`
})

onMounted(() => {
  if (uses.value) void test()
})
</script>

<template>
  <div v-if="uses" class="group">
    <div class="group-head">
      <span class="label grow">Licht</span>
    </div>
    <div class="line">
      <span class="name">MagicHome</span>
      <input
        class="input grow"
        :value="host"
        placeholder="IP-adres van de controller"
        aria-label="IP-adres van de MagicHome-controller"
        spellcheck="false"
        @change="setHost($event.target as HTMLInputElement)"
        @keydown.enter="setHost($event.target as HTMLInputElement)"
      />
      <button class="btn btn-ghost btn-sm" :disabled="!host || testing" @click="test">
        {{ testing ? 'Testen…' : 'Test' }}
      </button>
    </div>
    <p v-if="!host" class="note">Zonder adres blijft het licht zoals het is.</p>
    <p v-else-if="status" class="note light-status" :class="status.ok ? 'ok' : 'warn'">
      {{ statusText }}
    </p>
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
  align-items: center;
  gap: 12px;
  min-height: 42px;
}

.name {
  flex: none;
  width: 110px;
  font-size: 14px;
}

.note {
  padding-left: 122px;
  color: var(--muted);
  font-size: 12px;
}

.note.ok {
  color: var(--ok);
}

.note.warn {
  color: var(--warn);
}
</style>
