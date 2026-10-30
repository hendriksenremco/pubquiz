<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { encode } from 'uqr'
import type { RemoteLink } from '@shared/remote'

/**
 * De QR-code die een telefoon of tablet naar de afstandsbediening brengt, met het adres en wie er
 * verbonden is. "Nieuwe code" sluit alle telefoons met de oude code buiten.
 */
const api = window.pubquiz
/** Wie er verbonden is, en een ander netwerk (andere locatie), zien zonder het paneel te sluiten. */
const REFRESH_MS = 2000

const link = ref<RemoteLink | null>(null)
const loaded = ref(false)

async function load(action: 'link' | 'renew' = 'link') {
  link.value = (await api.pluginInvoke('remote', action)) as RemoteLink | null
  loaded.value = true
}

const qr = computed(() =>
  link.value?.url ? encode(link.value.url, { ecc: 'M', border: 2 }) : null
)
/** Eén pad met een vierkantje per donkere module. */
const modules = computed(() =>
  (qr.value?.data ?? [])
    .flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])))
    .join('')
)

const devices = computed(() => {
  const n = link.value?.devices ?? 0
  if (n === 0) return 'Nog niets verbonden'
  return n === 1 ? '1 apparaat verbonden' : `${n} apparaten verbonden`
})

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void load()
  timer = setInterval(() => void load(), REFRESH_MS)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="remote-qr">
    <template v-if="qr && link?.url">
      <svg
        class="code"
        :viewBox="`0 0 ${qr.size} ${qr.size}`"
        shape-rendering="crispEdges"
        role="img"
        aria-label="QR-code voor de afstandsbediening"
      >
        <rect :width="qr.size" :height="qr.size" fill="#fff" />
        <path :d="modules" fill="#000" />
      </svg>
      <p class="muted tip">
        Scan met de camera van een telefoon of tablet op hetzelfde wifi-netwerk.
      </p>
      <p class="url mono" :title="link.url">{{ link.url }}</p>
      <div class="foot">
        <span class="devices" :class="{ on: link.devices > 0 }">
          <span class="dot" />{{ devices }}
        </span>
        <button
          class="btn btn-ghost btn-sm"
          title="Telefoons met de oude code kunnen dan niets meer"
          @click="load('renew')"
        >
          Nieuwe code
        </button>
      </div>
    </template>
    <p v-else-if="loaded" class="muted tip">
      Geen netwerk gevonden. Verbind deze Mac met het wifi-netwerk waar je telefoon op zit.
    </p>
  </div>
</template>

<style scoped>
.remote-qr {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.code {
  display: block;
  width: 200px;
  height: 200px;
  border-radius: var(--radius);
}

.tip {
  font-size: 12px;
  line-height: 1.45;
}

.url {
  overflow: hidden;
  color: var(--faint);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
  user-select: text;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.devices {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
}

.devices .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--faint);
}

.devices.on {
  color: var(--text);
}

.devices.on .dot {
  background: var(--ok);
}
</style>
