<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import { formSections, type FormOptions } from '@shared/forms'
import type { AnswerItem } from '@shared/resolve'
import { assetUrl } from '../../lib/media'
import { useSession } from '../../stores/session'

/**
 * Formulier om af te drukken (main maakt er een pdf van): het antwoordformulier voor de teams,
 * of de antwoorden voor de quizmaster. Zwart op wit, A4.
 */
const props = defineProps<{ param: string }>()
const options = JSON.parse(props.param) as FormOptions
const session = useSession()

const sections = computed(() => (session.quiz ? formSections(session.quiz, options.roundIds) : []))
const sheet = options.doc === 'sheet'

// Main wacht hierop voordat hij afdrukt: quiz binnen, fonts en afbeeldingen geladen.
let markReady = () => {}
;(window as unknown as { __pubquizPrintReady: Promise<boolean> }).__pubquizPrintReady = new Promise(
  (resolve) => (markReady = () => resolve(true))
)

onMounted(async () => {
  await session.init()
  await nextTick()
  await document.fonts.ready
  await Promise.all(
    [...document.images].map((img) =>
      img.complete
        ? null
        : new Promise((resolve) => {
            img.onload = img.onerror = resolve
          })
    )
  )
  markReady()
})

const capital = (word: string) => word[0].toUpperCase() + word.slice(1)

/** Wat de quizmaster bij een antwoord ziet: de vraag, de afbeelding of de naam van het fragment. */
function what(item: AnswerItem): string {
  if (item.fragment) return item.fragment.label
  if (item.slide?.layout === 'question') return item.slide.body || item.slide.title || ''
  // Een nummerslide heeft als titel alleen het nummer; dat staat al vooraan.
  if (item.slide?.layout === 'number') return item.slide.body ?? ''
  return item.slide?.title ?? ''
}

const imageOf = (item: AnswerItem) =>
  item.slide?.layout === 'image' ? assetUrl(session.quiz, item.slide.imageAssetId) : null
</script>

<template>
  <div v-if="session.quiz" class="doc" :class="sheet ? 'sheet' : 'key'">
    <!-- Antwoordformulier: per ronde genummerde regels en een vak voor de punten. -->
    <template v-if="sheet">
      <div v-if="!options.pagePerRound" class="team">
        <span class="quiz-name">{{ session.quiz.title }}</span>
        <span class="team-field">Team <span class="write" /></span>
      </div>
      <section
        v-for="s in sections"
        :key="s.round.id"
        class="round"
        :class="{ 'own-page': options.pagePerRound }"
      >
        <div v-if="options.pagePerRound" class="team">
          <span class="quiz-name">{{ session.quiz.title }}</span>
          <span class="team-field">Team <span class="write" /></span>
        </div>
        <header class="round-head">
          <h2>{{ s.round.title }}</h2>
          <span class="score">
            <span class="score-box" />
            <span class="score-max">/ {{ s.items.length }}</span>
          </span>
        </header>
        <ol class="lines">
          <li v-for="item in s.items" :key="item.id">
            <span class="num">{{ item.number }}</span>
            <span v-if="s.mixed" class="noun">{{ capital(item.noun) }}</span>
            <span class="write" />
          </li>
        </ol>
      </section>
    </template>

    <!-- Antwoorden: om na te kijken, met de vraag of afbeelding erbij. -->
    <template v-else>
      <header class="key-head">
        <span class="quiz-name">{{ session.quiz.title }}</span>
        <h1>Antwoorden</h1>
      </header>
      <section v-for="s in sections" :key="s.round.id" class="round">
        <h2>{{ s.round.title }}</h2>
        <table>
          <tr v-for="item in s.items" :key="item.id">
            <td class="num">{{ item.number }}</td>
            <td class="what">
              <img v-if="imageOf(item)" :src="imageOf(item)!" alt="" />
              <span>{{ s.mixed ? `${capital(item.noun)}: ` : '' }}{{ what(item) }}</span>
            </td>
            <td class="answer" :class="{ missing: !item.answer }">{{ item.answer || '—' }}</td>
          </tr>
        </table>
      </section>
    </template>
  </div>
</template>

<style>
/* Afdrukken: wit papier in plaats van het donkere app-thema, en alles mag doorlopen. Zonder
   licht kleurenschema tekent Chromium de paginamarges in zijn donkere standaardkleur. */
html:has(body[data-route='print']) {
  color-scheme: light;
}

html:has(body[data-route='print']),
body[data-route='print'],
body[data-route='print'] #app {
  height: auto;
  overflow: visible;
  background: #fff;
  color: #141414;
}
</style>

<style scoped>
.doc {
  font-family: var(--font);
  font-size: 11pt;
  color: #141414;
}

.quiz-name {
  color: #6b6b6b;
  font-size: 9.5pt;
  font-weight: 500;
}

h1,
h2 {
  font-family: var(--display);
  font-weight: 750;
  letter-spacing: -0.015em;
  color: #141414;
}

/* ── Antwoordformulier ──────────────────────────────────────────────────── */

.team {
  display: flex;
  align-items: flex-end;
  gap: 8mm;
  margin-bottom: 9mm;
}

.team-field {
  display: flex;
  flex: 1;
  align-items: flex-end;
  gap: 3mm;
  font-size: 12pt;
  font-weight: 650;
}

.round {
  break-inside: avoid;
  margin-bottom: 11mm;
}

.round.own-page {
  break-after: page;
  margin-bottom: 0;
}

.round.own-page:last-child {
  break-after: auto;
}

.round-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6mm;
  margin-bottom: 4mm;
}

.round-head h2 {
  font-size: 20pt;
  line-height: 1.1;
}

.score {
  display: flex;
  flex-shrink: 0;
  align-items: flex-end;
  gap: 2mm;
  color: #6b6b6b;
  font-size: 11pt;
}

.score-box {
  width: 16mm;
  height: 11mm;
  border: 0.4mm solid #141414;
  border-radius: 2mm;
}

.lines {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lines li {
  display: flex;
  align-items: flex-end;
  gap: 4mm;
  height: 11.5mm;
}

.num {
  width: 7mm;
  font-family: var(--display);
  font-size: 13pt;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.noun {
  width: 18mm;
  color: #6b6b6b;
  font-size: 9.5pt;
}

.write {
  flex: 1;
  height: 0;
  margin-bottom: 1.2mm;
  border-bottom: 0.3mm solid #9a9a9a;
}

/* ── Antwoorden ─────────────────────────────────────────────────────────── */

.key-head {
  display: flex;
  flex-direction: column;
  gap: 1mm;
  margin-bottom: 8mm;
}

.key-head h1 {
  font-size: 24pt;
}

.key .round h2 {
  margin-bottom: 2.5mm;
  font-size: 15pt;
}

table {
  width: 100%;
  border-collapse: collapse;
}

td {
  padding: 2mm 0;
  border-bottom: 0.25mm solid #dcdcdc;
  vertical-align: top;
}

td.num {
  padding-right: 4mm;
}

td.what {
  width: 55%;
  padding-right: 6mm;
  color: #4a4a4a;
  font-size: 10pt;
}

td.what img {
  display: block;
  width: 28mm;
  height: 16mm;
  margin-bottom: 1mm;
  border-radius: 1mm;
  object-fit: cover;
}

td.answer {
  font-weight: 650;
}

td.answer.missing {
  color: #9a9a9a;
  font-weight: 400;
}
</style>
