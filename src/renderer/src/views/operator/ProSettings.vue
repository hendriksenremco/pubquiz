<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from '../../components/Icon.vue'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { PRO_MESSAGES } from './operator-messages'

/** QuizNote Pro bij Instellingen (issue #384): de stand, een code aanzetten of weghalen, kopen. */
const session = useSession()
const t = PRO_MESSAGES.in(locale)
const api = window.pubquiz

const key = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const date = (ms: number) =>
  new Date(ms).toLocaleDateString(locale === 'en' ? 'en-GB' : 'nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

const status = computed(() => {
  const p = session.pro
  const hint = p.keyHint ?? ''
  if (p.source === 'license')
    return p.until ? t('activeUntil', { hint, date: date(p.until) }) : t('active', { hint })
  if (p.source === 'early' && p.until) return t('early', { date: date(p.until) })
  return t('free')
})

const problem = computed(() => (session.pro.problem ? t(session.pro.problem) : null))
const hasKey = computed(() => session.pro.keyHint !== null)

async function activate() {
  busy.value = true
  error.value = await api.activateLicense(key.value)
  busy.value = false
  if (!error.value) key.value = ''
}

async function remove() {
  busy.value = true
  await api.deactivateLicense()
  busy.value = false
}
</script>

<template>
  <div class="pro">
    <p class="status">{{ status }}</p>
    <p v-if="problem" class="problem">{{ problem }}</p>
    <div v-if="session.pro.source !== 'license'" class="row">
      <label class="field grow">
        <span class="muted">{{ t('keyLabel') }}</span>
        <input
          v-model="key"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :placeholder="t('keyPlaceholder')"
          @keydown.enter="activate"
        />
      </label>
    </div>
    <p v-if="error" class="problem">{{ error }}</p>
    <div class="row">
      <button
        v-if="session.pro.source !== 'license'"
        class="btn btn-primary"
        :disabled="busy || !key.trim()"
        @click="activate"
      >
        <Icon name="check" :size="15" /> {{ t('activate') }}
      </button>
      <button v-if="session.pro.source !== 'license'" class="btn" @click="api.openProPage()">
        <Icon name="spark" :size="15" /> {{ t('buy') }}
      </button>
      <button v-if="hasKey" class="btn" :disabled="busy" @click="remove">
        <Icon name="x" :size="15" /> {{ t('remove') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pro {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-1);
}

.status {
  margin: 0;
  line-height: 1.45;
}

.problem {
  margin: 0;
  color: var(--warn);
  font-size: 12px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.field input {
  font: inherit;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
