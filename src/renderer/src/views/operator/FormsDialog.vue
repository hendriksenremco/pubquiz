<script setup lang="ts">
import { computed, ref } from 'vue'
import { formRounds, itemSummary, type FormOptions } from '@shared/forms'
import Dialog from '../../components/Dialog.vue'
import { useSession } from '../../stores/session'

/** Pdf's voor op tafel: het antwoordformulier voor de teams en de antwoorden om na te kijken. */
const emit = defineEmits<{ close: [] }>()
const api = window.pubquiz
const session = useSession()

const rounds = computed(() => formRounds(session.quiz!))
const chosen = ref(rounds.value.map((r) => r.id))
const pagePerRound = ref(true)
const busy = ref<FormOptions['doc'] | null>(null)

async function save(doc: FormOptions['doc']) {
  if (busy.value || !chosen.value.length) return
  busy.value = doc
  session.flush()
  await api.exportForm({ doc, roundIds: [...chosen.value], pagePerRound: pagePerRound.value })
  busy.value = null
}
</script>

<template>
  <Dialog title="Antwoordformulieren" @close="emit('close')">
    <p v-if="!rounds.length" class="muted">
      Deze quiz heeft nog geen vragen, afbeeldingen of fragmenten om in te vullen.
    </p>
    <template v-else>
      <p class="muted intro">
        Een pdf om te printen: per ronde genummerde regels voor de teams, of de antwoorden om na te
        kijken.
      </p>
      <div class="rounds">
        <label v-for="r in rounds" :key="r.id" class="option">
          <input v-model="chosen" type="checkbox" :value="r.id" />
          <span>
            <span class="option-title">{{ r.title }}</span>
            <span class="option-hint">{{ itemSummary(r) }}</span>
          </span>
        </label>
      </div>
      <label class="option">
        <input v-model="pagePerRound" type="checkbox" />
        <span>
          <span class="option-title">Elke ronde op een eigen blad</span>
          <span class="option-hint">Handig als je de formulieren per ronde ophaalt</span>
        </span>
      </label>
    </template>

    <template #actions>
      <button class="btn" @click="emit('close')">Sluiten</button>
      <button class="btn" :disabled="!!busy || !chosen.length" @click="save('key')">
        {{ busy === 'key' ? 'Bezig…' : 'Antwoorden' }}
      </button>
      <button class="btn btn-primary" :disabled="!!busy || !chosen.length" @click="save('sheet')">
        {{ busy === 'sheet' ? 'Bezig…' : 'Antwoordformulier' }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.intro {
  font-size: 13px;
  line-height: 1.5;
}

.rounds {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.option {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  cursor: pointer;
}

.option input {
  margin-top: 3px;
}

.option-title {
  display: block;
  font-weight: 650;
}

.option-hint {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
</style>
