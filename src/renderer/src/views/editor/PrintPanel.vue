<script setup lang="ts">
import { computed, ref } from 'vue'
import { formRounds, itemSummary, type FormDoc } from '@shared/forms'
import Icon from '../../components/Icon.vue'
import { useSession } from '../../stores/session'

/**
 * Pdf's om te printen: het antwoordformulier voor de teams, de antwoorden om na te kijken en
 * vragenkaarten (ansichtkaartformaat) voor de quizmaster.
 */
const api = window.pubquiz
const session = useSession()

const rounds = computed(() => formRounds(session.quiz!))
const chosen = ref(rounds.value.map((r) => r.id))
const busy = ref<FormDoc | null>(null)

const DOCS: { doc: FormDoc; title: string; hint: string }[] = [
  {
    doc: 'sheet',
    title: 'Antwoordformulier',
    hint: 'Voor de teams: tot vier rondes per A4, elk in een eigen vak om los te knippen'
  },
  {
    doc: 'key',
    title: 'Nakijkformulier',
    hint: 'Precies dezelfde opmaak met de antwoorden erop: leg hem naast een ingevuld formulier'
  },
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
  await api.exportForm({ doc, roundIds: [...chosen.value] })
  busy.value = null
}
</script>

<template>
  <div class="print">
    <header class="head">
      <h2>Afdrukken</h2>
      <p class="muted">
        Pdf's om te printen. Je kiest waar ze komen; daarna openen ze, klaar om te printen.
      </p>
    </header>

    <p v-if="!rounds.length" class="tile empty muted">
      Deze quiz heeft nog geen vragen, afbeeldingen of fragmenten. Voeg ze toe in een ronde; dan kun
      je hier de formulieren maken.
    </p>

    <div v-else class="cols">
      <section>
        <div class="section-head">
          <h3>Rondes</h3>
          <span class="count">{{ chosen.length }} van {{ rounds.length }}</span>
        </div>
        <div class="list">
          <label v-for="r in rounds" :key="r.id" class="tile option">
            <input v-model="chosen" type="checkbox" :value="r.id" />
            <span>
              <span class="option-title">{{ r.title }}</span>
              <span class="option-hint">{{ itemSummary(r) }}</span>
            </span>
          </label>
        </div>
      </section>

      <section>
        <div class="section-head"><h3>Pdf</h3></div>
        <div class="list">
          <div v-for="d in DOCS" :key="d.doc" class="tile doc">
            <div class="grow">
              <div class="option-title">{{ d.title }}</div>
              <div class="option-hint">{{ d.hint }}</div>
            </div>
            <button
              class="btn"
              :class="{ 'btn-primary': d.doc === 'sheet' }"
              :disabled="!!busy || !chosen.length"
              :aria-label="`${d.title} opslaan`"
              @click="save(d.doc)"
            >
              <Icon name="upload" :size="14" />
              {{ busy === d.doc ? 'Bezig…' : 'Opslaan' }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.print {
  max-width: 1080px;
  margin: 0 auto;
  padding: 36px 40px 80px;
}

.head {
  margin-bottom: 28px;
}

.head h2 {
  font: 700 32px/1.1 var(--display);
  letter-spacing: -0.02em;
}

.head p {
  margin-top: 6px;
  font-size: 14px;
}

.empty {
  padding: 20px;
}

.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 28px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option,
.doc {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
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
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
}
</style>
