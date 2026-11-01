<script setup lang="ts">
import { computed } from 'vue'
import type { ShowCommand } from '@shared/ipc'
import { answerItems, findAsset, type AnswerItem } from '@shared/resolve'
import type { Round } from '@shared/types'
import MediaThumb from '../../components/MediaThumb.vue'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { ANSWER_NOUNS, ANSWERS_MESSAGES } from './live-messages'

/**
 * Antwoordenronde: per vraag of afbeelding eerst de slide, per fragment eerst het nummer (het
 * fragment speelt opnieuw), en daarna het antwoord.
 */
const props = defineProps<{ round: Round }>()
const t = ANSWERS_MESSAGES.in(locale)
const api = window.pubquiz
const session = useSession()
const send = (command: ShowCommand) => api.command(command)

const items = computed(() => answerItems(session.quiz!, props.round))
const answer = computed(() =>
  session.state.answer?.roundId === props.round.id ? session.state.answer : null
)

/** Per bronronde, met de index in de hele reeks (die gaat naar main). */
const groups = computed(() => {
  const list: { round: Round; items: (AnswerItem & { index: number })[] }[] = []
  items.value.forEach((item, index) => {
    const last = list.at(-1)
    if (last?.round.id === item.round.id) last.items.push({ ...item, index })
    else list.push({ round: item.round, items: [{ ...item, index }] })
  })
  return list
})

const atEnd = computed(
  () => !!answer.value?.revealed && answer.value.index >= items.value.length - 1
)
const nextLabel = computed(() => {
  const a = answer.value
  if (!a) return t('start')
  if (!a.revealed) return t('reveal')
  const next = items.value[a.index + 1]
  if (!next) return t('done')
  return t(ANSWER_NOUNS[next.noun].next)
})
const status = computed(() => {
  const a = answer.value
  const item = a ? items.value[a.index] : undefined
  if (!a || !item) return null
  const name = t(ANSWER_NOUNS[item.noun].item, { number: item.number })
  if (a.revealed) return t('statusAnswer', { item: name })
  return t(item.fragment ? 'statusNumber' : 'statusShown', { item: name })
})

const nounOf = (item: AnswerItem) => t(ANSWER_NOUNS[item.noun].noun)

type Item = AnswerItem & { index: number }

const done = (item: Item) =>
  answer.value?.index !== item.index && session.state.answered.includes(item.id)

function stateOf(item: Item): string | null {
  const a = answer.value
  if (item.fragment && session.state.fragment?.fragmentId === item.fragment.id) return t('playing')
  if (a?.index === item.index) {
    if (a.revealed) return t('answerShown')
    return item.fragment ? t('numberShown') : t('nounShown', { noun: nounOf(item) })
  }
  return done(item) ? t('finished') : null
}

function hint(item: Item): string {
  if (answer.value?.index === item.index) return t('hintToggle')
  return item.fragment ? t('hintFragment') : t('hintShow', { noun: nounOf(item) })
}

const imageOf = (item: Item) => findAsset(session.quiz!, item.slide?.imageAssetId)
</script>

<template>
  <section class="card answers">
    <header class="card-head">
      <h3 class="grow">{{ t('title') }}</h3>
      <span
        v-if="!round.fragmentScreens.length"
        class="pill pill-warn"
        :title="t('notShownHint')"
        >{{ t('notShown') }}</span
      >
      <span v-else-if="status" class="pill pill-accent">{{ status }}</span>
      <button
        class="btn btn-sm"
        :disabled="!answer"
        @click="send({ type: 'answers', action: 'prev' })"
      >
        {{ t('prev') }} <span class="kbd">←</span>
      </button>
      <button
        class="btn btn-primary btn-sm"
        :disabled="atEnd"
        @click="send({ type: 'answers', action: 'next' })"
      >
        {{ nextLabel }} <span class="kbd">→</span>
      </button>
      <button
        v-if="answer"
        class="btn btn-sm"
        :title="t('stopHint')"
        @click="send({ type: 'answers', action: 'stop' })"
      >
        {{ t('stop') }}
      </button>
    </header>

    <div class="card-body groups">
      <div v-for="g in groups" :key="g.round.id">
        <div class="group-title">{{ g.round.title }}</div>
        <div class="grid">
          <button
            v-for="item in g.items"
            :key="item.id"
            class="frag"
            :class="{
              on: answer?.index === item.index,
              revealed: answer?.index === item.index && answer.revealed,
              done: done(item)
            }"
            :title="hint(item)"
            @click="send({ type: 'answerAt', index: item.index })"
          >
            <span class="frag-top">
              <span class="frag-num mono">{{ item.number }}</span>
              <span class="frag-noun">{{ nounOf(item) }}</span>
              <MediaThumb v-if="imageOf(item)" :asset="imageOf(item)" class="frag-thumb" />
            </span>
            <span v-if="item.slide?.layout === 'question'" class="frag-question">
              {{ item.slide.body || item.slide.title }}
            </span>
            <span class="frag-answer" :class="{ missing: !item.answer }">
              {{ item.answer || t('noAnswer') }}
            </span>
            <span v-if="stateOf(item)" class="frag-state">{{ stateOf(item) }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.group-title {
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.frag {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 84px;
  padding: 10px 12px 12px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-lg);
  background: var(--panel-2);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.frag:hover {
  border-color: var(--muted);
}

.frag.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.frag.done {
  opacity: 0.55;
}

.frag-top {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
}

.frag-noun {
  color: var(--muted);
  font-size: 11px;
}

.frag-thumb {
  width: 44px;
  height: 26px;
  margin-left: auto;
  border-radius: 4px;
  align-self: center;
}

.frag-question {
  display: -webkit-box;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.frag-num {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
}

.frag.on .frag-top {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
}

.frag-noun {
  color: var(--muted);
  font-size: 11px;
}

.frag-thumb {
  width: 44px;
  height: 26px;
  margin-left: auto;
  border-radius: 4px;
  align-self: center;
}

.frag-question {
  display: -webkit-box;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.frag-num {
  color: var(--accent);
}

.frag-answer {
  font-weight: 600;
  line-height: 1.3;
}

.frag-answer.missing {
  color: var(--warn);
  font-weight: 500;
}

.frag-state {
  margin-top: auto;
  font-size: 11px;
  color: var(--muted);
}

.frag.revealed .frag-state {
  color: var(--accent);
}
</style>
