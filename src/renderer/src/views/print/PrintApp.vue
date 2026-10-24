<script setup lang="ts">
import { computed, nextTick, onMounted } from 'vue'
import {
  formSections,
  itemText,
  sheetPages,
  type FormOptions,
  type SheetBlock
} from '@shared/forms'
import type { AnswerItem } from '@shared/resolve'
import { assetUrl } from '../../lib/media'
import { useSession } from '../../stores/session'

/**
 * Om af te drukken (main maakt er een pdf van): het antwoordformulier voor de teams, het
 * nakijkformulier (dezelfde opmaak, met de antwoorden op de regels) en vragenkaarten.
 */
const props = defineProps<{ param: string }>()
const options = JSON.parse(props.param) as FormOptions
const session = useSession()

const sections = computed(() => (session.quiz ? formSections(session.quiz, options.roundIds) : []))
const pages = computed(() => sheetPages(sections.value))
const key = options.doc === 'key'

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

const imageOf = (item: AnswerItem) =>
  item.slide?.layout === 'image' ? assetUrl(session.quiz, item.slide.imageAssetId) : null

/** Vak op het blad: twee kolommen, twee rijen; een brede ronde vult de hele rij. */
function placement(block: SheetBlock) {
  return {
    gridRow: Math.floor(block.slot / 2) + 1,
    gridColumn: block.wide ? '1 / span 2' : (block.slot % 2) + 1,
    '--rows': block.wide ? Math.ceil(block.section.items.length / 2) : block.section.items.length
  }
}
</script>

<template>
  <div v-if="session.quiz" class="doc" :class="options.doc">
    <!-- Antwoord- en nakijkformulier: precies dezelfde indeling, zodat je ze naast elkaar legt.
         Een lang antwoord loopt door over meerdere regels; het antwoordformulier zet dezelfde tekst
         onzichtbaar in de regel, zodat die daar net zo hoog wordt. -->
    <template v-if="options.doc !== 'cards'">
      <div v-for="(page, p) in pages" :key="p" class="sheet-page">
        <header class="page-head">
          <span class="quiz-name">{{ session.quiz.title }}</span>
          <!-- Teamnaam één keer per blad; het nakijkformulier heeft op die plek zijn titel. -->
          <div class="team">
            <template v-if="key">Nakijkformulier</template>
            <template v-else>
              <span>Team</span>
              <span class="team-line" />
            </template>
          </div>
        </header>
        <div class="blocks">
          <section
            v-for="b in page"
            :key="b.section.round.id"
            class="block"
            :class="{ wide: b.wide }"
            :style="placement(b)"
          >
            <header class="block-head">
              <h2>{{ b.section.round.title }}</h2>
              <span class="score">
                <span class="score-box" />
                <span>/ {{ b.section.items.length }}</span>
              </span>
            </header>
            <ol class="lines">
              <li v-for="item in b.section.items" :key="item.id">
                <span class="entry">
                  <span class="num">{{ item.number }}</span>
                  <span v-if="b.section.mixed" class="noun">{{ capital(item.noun) }}</span>
                  <span class="write" :class="{ missing: !item.answer }">
                    <span :class="{ blank: !key }">{{ item.answer || '—' }}</span>
                  </span>
                </span>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </template>

    <!-- Vragenkaarten: per ronde een ansichtkaart om voor te lezen. Is hij vol, dan loopt de ronde
         door op een volgende kaart, met de titel er opnieuw boven (thead herhaalt per pagina). -->
    <template v-else>
      <section v-for="s in sections" :key="s.round.id" class="qcard">
        <table>
          <thead>
            <tr>
              <th colspan="3">
                <span class="qcard-head">
                  <span class="qcard-title">{{ s.round.title }}</span>
                  <span class="quiz-name">{{ session.quiz.title }}</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in s.items" :key="item.id">
              <td class="num">{{ item.number }}</td>
              <td class="question">
                <img v-if="imageOf(item)" :src="imageOf(item)!" alt="" />
                <span v-if="s.mixed" class="noun">{{ capital(item.noun) }} </span>
                <span v-if="itemText(item)">{{ itemText(item) }}</span>
                <span v-else class="missing">{{ capital(item.noun) }} {{ item.number }}</span>
              </td>
              <td class="qcard-answer" :class="{ missing: !item.answer }">
                {{ item.answer || '—' }}
              </td>
            </tr>
          </tbody>
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

h2 {
  font-family: var(--display);
  font-weight: 750;
  letter-spacing: -0.015em;
  color: #141414;
}

.num {
  font-family: var(--display);
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.noun,
.missing {
  color: #8a8a8a;
}

/* ── Antwoord- en nakijkformulier (A4, tot vier vakken) ─────────────────── */

/* Hoogte van de bedrukbare A4 (297 mm min 2 × 16 mm marge), met wat speling. */
.sheet-page {
  display: flex;
  flex-direction: column;
  height: 262mm;
  break-after: page;
}

.sheet-page:last-child {
  break-after: auto;
}

.page-head {
  display: flex;
  flex-direction: column;
  gap: 2mm;
  margin-bottom: 5mm;
}

/* Teamregel, of op het nakijkformulier de titel: even hoog, zodat de vakken gelijk liggen. */
.team {
  display: flex;
  align-items: flex-end;
  gap: 3mm;
  height: 9mm;
  font-family: var(--display);
  font-size: 15pt;
  font-weight: 750;
}

.team-line {
  flex: 1;
  margin-bottom: 1mm;
  border-bottom: 0.35mm solid #141414;
}

.blocks {
  display: grid;
  flex: 1;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 6mm;
  min-height: 0;
}

/* Gestippelde rand: om langs te knippen als je per ronde ophaalt. */
.block {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 5mm 5mm 4mm;
  border: 0.3mm dashed #b3b3b3;
  border-radius: 3mm;
}

.block-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 3mm;
  margin-bottom: 2mm;
}

.block-head h2 {
  font-size: 14pt;
  line-height: 1.15;
}

.score {
  display: flex;
  flex-shrink: 0;
  align-items: flex-end;
  gap: 1.5mm;
  color: #6b6b6b;
  font-size: 10pt;
}

.score-box {
  width: 13mm;
  height: 9mm;
  border: 0.35mm solid #141414;
  border-radius: 1.6mm;
}

/* Regels verdelen de ruimte van het vak tot 10 mm per regel. Een lang antwoord maakt zijn regel
   hoger (min-content). Een brede ronde heeft twee kolommen regels. */
.lines {
  display: grid;
  flex: 1;
  grid-auto-flow: column;
  grid-template-rows: repeat(var(--rows), minmax(min-content, 10mm));
  align-content: start;
  column-gap: 8mm;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.block.wide .lines {
  grid-template-columns: 1fr 1fr;
}

/* De schrijfregel staat onderaan zijn rij; het nummer staat bij de eerste regel tekst. */
.lines li {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-width: 0;
}

.entry {
  display: flex;
  align-items: baseline;
  gap: 2.5mm;
}

.lines .num {
  flex: none;
  width: 6mm;
  font-size: 11pt;
  text-align: right;
}

.lines .noun {
  flex: none;
  font-size: 8.5pt;
}

.write {
  flex: 1;
  min-width: 0;
  padding: 1mm 1mm 0.6mm;
  border-bottom: 0.3mm solid #9a9a9a;
  font-size: 10pt;
  font-weight: 650;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

/* Antwoordformulier: dezelfde tekst voor de hoogte, maar niet getekend (dus ook niet in de pdf
   te vinden). Alleen de tekst is verborgen; de lijn van de regel blijft staan. */
.blank {
  visibility: hidden;
}

.write.missing {
  font-weight: 400;
}

/* ── Vragenkaarten (A6 liggend) ─────────────────────────────────────────── */

.qcard {
  break-after: page;
}

.qcard:last-child {
  break-after: auto;
}

.qcard table {
  width: 100%;
  border-collapse: collapse;
}

.qcard th {
  padding: 0 0 2mm;
  font-weight: inherit;
  text-align: left;
}

.qcard-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4mm;
  padding-bottom: 1.6mm;
  border-bottom: 0.4mm solid #141414;
}

.qcard-title {
  font-family: var(--display);
  font-size: 13pt;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.qcard tr {
  break-inside: avoid;
}

.qcard td {
  padding: 1.5mm 0;
  border-bottom: 0.2mm solid #e2e2e2;
  font-size: 10pt;
  line-height: 1.3;
  vertical-align: top;
}

.qcard td.num {
  width: 6mm;
  padding-right: 2mm;
  font-size: 10.5pt;
}

.qcard td.question {
  padding-right: 4mm;
}

.qcard td.question img {
  display: block;
  width: 22mm;
  height: 13mm;
  margin-bottom: 0.8mm;
  border-radius: 1mm;
  object-fit: cover;
}

.qcard-answer {
  width: 34%;
  color: #4a4a4a;
  font-size: 9pt !important;
  font-weight: 650;
}

.qcard-answer.missing {
  font-weight: 400;
}
</style>
