<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { recentMediaUrl, type RecentQuiz } from '@shared/ipc'
import Icon from '../../components/Icon.vue'
import PageHero from '../../components/PageHero.vue'
import Popover from '../../components/Popover.vue'
import QuizCover from '../../components/QuizCover.vue'
import { ambientFromUrl } from '../../lib/ambient'
import { relativeDate } from '../../lib/format'

type OpenMode = 'edit' | 'show'

const emit = defineEmits<{
  open: [path: string, mode: OpenMode]
  create: []
  createFrom: [path: string, title: string]
  ai: []
}>()
const api = window.pubquiz

const quizzes = ref<RecentQuiz[] | null>(null)
async function load() {
  quizzes.value = await api.recentQuizzes()
}
onMounted(load)
defineExpose({ reload: load })

/** De bovenste is de laatst geopende quiz die nog bestaat. */
const latest = computed(() => quizzes.value?.find((q) => q.exists) ?? null)
const others = computed(() => quizzes.value?.filter((q) => q !== latest.value) ?? [])
const templates = computed(() => quizzes.value?.filter((q) => q.exists) ?? [])

const ambient = ref<string | null>(null)
watch(latest, async (q) => {
  ambient.value = q?.cover
    ? await ambientFromUrl(q.cover.kind, recentMediaUrl(q.path, q.cover.file))
    : null
})

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function contents(q: RecentQuiz): string {
  return `${plural(q.rounds, 'ronde', 'rondes')} en ${plural(q.screens, 'scherm', 'schermen')}`
}

function edited(q: RecentQuiz): string {
  return q.modifiedAt ? `Bewerkt ${relativeDate(q.modifiedAt)}` : ''
}

function folderOf(path: string): string {
  return path
    .split('/')
    .slice(0, -1)
    .join('/')
    .replace(/^\/Users\/[^/]+/, '~')
}

function openCard(q: RecentQuiz) {
  if (q.exists) emit('open', q.path, 'edit')
}

async function forget(q: RecentQuiz) {
  await api.removeRecent(q.path)
  await load()
}

function createFrom(q: RecentQuiz, close?: () => void) {
  close?.()
  emit('createFrom', q.path, q.title)
}

function createEmpty(close: () => void) {
  close()
  emit('create')
}

function reveal(q: RecentQuiz) {
  void api.revealQuiz(q.path)
}
</script>

<template>
  <div v-if="quizzes" class="home scroll">
    <PageHero :ambient="ambient">
      <div v-if="latest" class="hero-grid">
        <QuizCover :quiz="latest" class="hero-cover" />
        <div class="hero-text">
          <span class="kicker">{{ latest.tour ? 'Begin hier' : 'Laatst geopend' }}</span>
          <h1 class="hero-title">{{ latest.title }}</h1>
          <p class="muted hero-meta">
            {{ contents(latest)
            }}<template v-if="latest.modifiedAt">. {{ edited(latest) }}</template>
          </p>
          <div class="actions">
            <button class="btn btn-primary btn-lg" @click="emit('open', latest.path, 'edit')">
              <Icon name="pencil" /> Bewerken
            </button>
            <button class="btn btn-lg" @click="emit('open', latest.path, 'show')">
              <Icon name="play" :size="14" /> Naar show
            </button>
          </div>
        </div>
      </div>

      <div v-else class="first">
        <h1 class="hero-title">Maak je eerste pubquiz</h1>
        <p class="muted hero-meta">
          Video-loops op de schermen, achtergrondmuziek en geluidsfragmenten, per ronde in te
          stellen.
        </p>
        <div class="actions">
          <button class="btn btn-primary btn-lg" @click="emit('create')">
            <Icon name="plus" /> Nieuwe quiz
          </button>
          <button class="btn btn-lg" @click="emit('ai')"><Icon name="spark" /> Met je AI…</button>
          <button class="btn btn-lg" @click="api.openQuiz()">
            <Icon name="folder" /> Open quiz…
          </button>
          <button class="btn btn-ghost btn-lg" @click="api.importZip()">
            <Icon name="upload" /> Importeer zip…
          </button>
        </div>
      </div>
    </PageHero>

    <section v-if="latest" class="body">
      <div class="section-head">
        <h3>Quizzen</h3>
        <span class="count">{{ quizzes.length }}</span>
        <span class="grow" />
        <button class="btn btn-ghost btn-sm" @click="api.openQuiz()">
          <Icon name="folder" :size="14" /> Open…
        </button>
        <button class="btn btn-ghost btn-sm" @click="api.importZip()">
          <Icon name="upload" :size="14" /> Importeer zip…
        </button>
      </div>

      <div class="grid">
        <Popover :width="280" block>
          <template #trigger="{ toggle }">
            <button class="new-tile" @click="toggle">
              <span class="new-art"><Icon name="plus" :size="26" /></span>
              <span class="card-title">Nieuwe quiz</span>
              <span class="card-meta">Leeg, of op basis van een eerdere quiz</span>
            </button>
          </template>
          <template #default="{ close }">
            <button class="menu-item" @click="createEmpty(close)">
              <Icon name="plus" /> Lege quiz
            </button>
            <button class="menu-item" @click="(close(), emit('ai'))">
              <Icon name="spark" /> Met je AI…
            </button>
            <div class="menu-label">Op basis van</div>
            <button
              v-for="q in templates"
              :key="q.path"
              class="menu-item template"
              @click="createFrom(q, close)"
            >
              <QuizCover :quiz="q" class="mini-cover" />
              <span class="grow template-title">{{ q.title }}</span>
            </button>
          </template>
        </Popover>

        <div
          v-for="q in others"
          :key="q.path"
          class="card"
          :class="{ missing: !q.exists }"
          :role="q.exists ? 'button' : undefined"
          :tabindex="q.exists ? 0 : undefined"
          :title="q.path"
          @click="openCard(q)"
          @keydown.enter="openCard(q)"
        >
          <QuizCover :quiz="q" />
          <span class="card-title">{{ q.title }}</span>
          <span v-if="q.exists" class="card-meta">{{ contents(q) }}</span>
          <span v-if="q.exists" class="card-meta faint">{{ edited(q) }}</span>
          <span v-else class="card-meta">Niet gevonden in {{ folderOf(q.path) }}</span>

          <div class="card-actions" @click.stop @keydown.stop>
            <button v-if="q.exists" class="card-action" @click="createFrom(q)">
              <Icon name="copy" :size="13" /> Op basis van
            </button>
            <button v-if="q.exists" class="card-action" @click="reveal(q)">
              <Icon name="folder" :size="13" /> Finder
            </button>
            <button class="card-action" title="Verwijder uit deze lijst" @click="forget(q)">
              <Icon name="x" :size="13" /> Uit lijst
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
}

.hero-grid {
  display: grid;
  grid-template-columns: minmax(260px, 420px) minmax(0, 1fr);
  gap: 36px;
  align-items: center;
}

.hero-cover {
  box-shadow:
    0 24px 60px rgba(3, 6, 14, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.04);
}

.hero-text,
.first {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.first {
  max-width: 640px;
  padding: 40px 0 24px;
}

.kicker {
  color: var(--muted);
  font-size: 13px;
  font-weight: 550;
}

.hero-title {
  margin-top: 4px;
  font: 750 46px/1.06 var(--display);
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.hero-meta {
  margin-top: 10px;
  font-size: 14px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
}

.body {
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px 40px 80px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 24px 18px;
}

.card,
.new-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.card :deep(.cover),
.new-art {
  margin-bottom: 8px;
  transition: box-shadow 0.12s;
}

.card:hover :deep(.cover),
.card:focus-visible :deep(.cover),
.new-tile:hover .new-art {
  box-shadow: 0 0 0 2px var(--surface-4);
}

.card:focus-visible {
  outline: none;
}

.card.missing {
  cursor: default;
}

.card.missing :deep(.cover) {
  opacity: 0.45;
}

.new-art {
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
  color: var(--accent);
}

.new-tile:hover .new-art {
  background: var(--surface-1);
}

.card-title {
  font: 650 15px var(--display);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin: 6px 0 0 -8px;
}

.card-action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  font-weight: 550;
  cursor: pointer;
}

.card-action:hover {
  background: var(--surface-2);
  color: var(--text);
}

.menu-label {
  padding: 8px 10px 4px;
  color: var(--muted);
  font-size: 12px;
}

.mini-cover {
  width: 44px;
  flex: none;
  border-radius: 5px;
}

.template-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
