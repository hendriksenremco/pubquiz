<script setup lang="ts">
import { computed, ref } from 'vue'
import { formRounds, itemSummary, type FormDoc } from '@shared/forms'
import Dialog from '../../components/Dialog.vue'
import { useSession } from '../../stores/session'

/**
 * Pdf's om te printen: het antwoordformulier voor de teams, de antwoorden om na te kijken en
 * vragenkaarten (ansichtkaartformaat) voor de quizmaster.
 */
const emit = defineEmits<{ close: [] }>()
const api = window.pubquiz
const session = useSession()

const rounds = computed(() => formRounds(session.quiz!))
const chosen = ref(rounds.value.map((r) => r.id))
const pagePerRound = ref(true)
const busy = ref<FormDoc | null>(null)

const DOCS: { doc: FormDoc; title: string; hint: string }[] = [
  {
    doc: 'sheet',
    title: 'Antwoordformulier',
    hint: 'Voor de teams: genummerde regels per ronde, A4'
  },
  { doc: 'key', title: 'Antwoorden', hint: 'Om na te kijken: alle antwoorden op A4' },
  {
    doc: 'cards',
    title: 'Vragenkaarten',
    hint: 'Voor jou: per ronde de vragen met antwoord, op ansichtkaartformaat'
  }
]

async function save(doc: FormDoc) {
  if (busy.value || !chosen.value.length) return
  busy.value = doc
  session.flush()
  await api.exportForm({ doc, roundIds: [...chosen.value], pagePerRound: pagePerRound.value })
  busy.value = null
}
</script>

<template>
  <Dialog title="Formulieren en kaarten" @close="emit('close')">
    <p v-if="!rounds.length" class="muted">
      Deze quiz heeft nog geen vragen, afbeeldingen of fragmenten.
    </p>
    <template v-else>
      <div class="group-label">Rondes</div>
      <div class="rounds">
        <label v-for="r in rounds" :key="r.id" class="option">
          <input v-model="chosen" type="checkbox" :value="r.id" />
          <span>
            <span class="option-title">{{ r.title }}</span>
            <span class="option-hint">{{ itemSummary(r) }}</span>
          </span>
        </label>
      </div>

      <div class="group-label">Pdf</div>
      <div v-for="d in DOCS" :key="d.doc" class="doc">
        <div class="grow">
          <div class="option-title">{{ d.title }}</div>
          <div class="option-hint">{{ d.hint }}</div>
          <label v-if="d.doc === 'sheet'" class="sub-option">
            <input v-model="pagePerRound" type="checkbox" />
            Elke ronde op een eigen blad
          </label>
        </div>
        <button
          class="btn btn-sm"
          :class="{ 'btn-primary': d.doc === 'sheet' }"
          :disabled="!!busy || !chosen.length"
          :aria-label="`${d.title} opslaan`"
          @click="save(d.doc)"
        >
          {{ busy === d.doc ? 'Bezig…' : 'Opslaan' }}
        </button>
      </div>
      <p class="muted where">Je kiest waar hij komt; daarna opent hij, klaar om te printen.</p>
    </template>

    <template #actions>
      <button class="btn" @click="emit('close')">Klaar</button>
    </template>
  </Dialog>
</template>

<style scoped>
.group-label {
  margin-bottom: -6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.rounds {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
}

.option,
.doc {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
}

.option {
  cursor: pointer;
}

.option input {
  margin-top: 3px;
}

.doc {
  align-items: center;
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

.sub-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  cursor: pointer;
}

.where {
  font-size: 12px;
}
</style>
