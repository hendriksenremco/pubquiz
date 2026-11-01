<script setup lang="ts">
import { computed } from 'vue'
import { encode } from 'uqr'
import Icon from '../../components/Icon.vue'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { REMOTE_QR_MESSAGES } from './messages'

/**
 * De QR-code die een telefoon of tablet naar de afstandsbediening brengt, met het adres en wie er
 * verbonden is. "Nieuwe code" sluit alle telefoons met de oude code buiten. Main duwt een nieuw
 * adres (ander netwerk) en elk apparaat dat verbindt.
 */
const api = window.pubquiz
const session = useSession()
const t = REMOTE_QR_MESSAGES.in(locale)

const link = computed(() => session.statusOf('remote'))

function renew() {
  void api.pluginAct('remote', 'renew', undefined)
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
  if (n === 0) return t('noDevices')
  return n === 1 ? t('oneDevice') : t('devices', { count: n })
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
        :aria-label="t('qrLabel')"
      >
        <rect :width="qr.size" :height="qr.size" fill="#fff" />
        <path :d="modules" fill="#000" />
      </svg>
      <p class="muted tip">
        {{ t('scan') }}
      </p>
      <p class="url mono" :title="link.url">{{ link.url }}</p>
      <div class="foot">
        <span class="devices" :class="{ on: link.devices > 0 }">
          <span class="dot" />{{ devices }}
        </span>
        <button class="btn btn-ghost btn-sm" :title="t('newCodeTitle')" @click="renew">
          <Icon name="restart" :size="14" /> {{ t('newCode') }}
        </button>
      </div>
    </template>
    <p v-else-if="link" class="muted tip">
      {{ t('noNetwork') }}
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
