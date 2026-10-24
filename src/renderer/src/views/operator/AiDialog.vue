<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { AiSetup } from '@shared/ipc'
import Dialog from '../../components/Dialog.vue'
import Icon from '../../components/Icon.vue'

/** Een quiz laten maken door je eigen AI-assistent: Quizmeister als MCP-server koppelen. */
const emit = defineEmits<{ close: [] }>()
const api = window.pubquiz

const setup = ref<AiSetup | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const copied = ref(false)

const snippet = computed(() =>
  setup.value ? JSON.stringify({ mcpServers: { quizmeister: setup.value.server } }, null, 2) : ''
)

onMounted(async () => {
  setup.value = await api.aiSetup()
})

async function connect() {
  busy.value = true
  error.value = await api.connectClaude()
  setup.value = await api.aiSetup()
  busy.value = false
}

function copy() {
  api.copyText(snippet.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <Dialog title="Een quiz maken met je AI" @close="emit('close')">
    <p class="muted">Vraag je AI-assistent bijvoorbeeld:</p>
    <p class="example">Maak een pubquiz in Quizmeister met zes rondes over Italië.</p>
    <p class="muted">
      De quiz verschijnt dan hier, met vragen, antwoorden en een antwoordenronde. Muziek en foto's
      maakt een AI niet zelf: noem een map met je liedjes of foto's, of voeg ze daarna toe.
    </p>

    <template v-if="setup">
      <section class="step">
        <h4>Claude Desktop</h4>
        <p v-if="setup.claudeConnected" class="ok">
          <Icon name="check" :size="14" /> Gekoppeld. Start Claude Desktop opnieuw als hij open
          stond.
        </p>
        <template v-else-if="setup.claudeInstalled">
          <p class="muted small">Eén keer koppelen, daarna kun je het Claude gewoon vragen.</p>
          <button class="btn btn-primary connect" :disabled="busy" @click="connect">
            <Icon name="spark" :size="14" /> Koppel aan Claude Desktop
          </button>
        </template>
        <p v-else class="muted small">Claude Desktop staat niet op deze Mac.</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </section>

      <section class="step">
        <h4>Andere AI-apps</h4>
        <p class="muted small">Voeg Quizmeister toe als MCP-server met deze instellingen:</p>
        <pre class="snippet">{{ snippet }}</pre>
        <button class="btn btn-sm copy" @click="copy">
          <Icon :name="copied ? 'check' : 'copy'" :size="13" />
          {{ copied ? 'Gekopieerd' : 'Kopieer' }}
        </button>
      </section>
    </template>

    <template #actions>
      <button class="btn" @click="emit('close')">Klaar</button>
    </template>
  </Dialog>
</template>

<style scoped>
.example {
  margin-top: -6px;
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  font-family: var(--display);
  font-size: 15px;
  font-weight: 600;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.step h4 {
  font-size: 14px;
}

.small {
  font-size: 12px;
}

.connect {
  margin-top: 2px;
}

.ok {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ok);
  font-size: 13px;
}

.error {
  color: var(--live);
  font-size: 12px;
}

.snippet {
  width: 100%;
  max-height: 150px;
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  border-radius: var(--radius);
  background: var(--surface-1);
  color: var(--muted);
  font:
    11px/1.45 ui-monospace,
    'SF Mono',
    Menlo,
    monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
