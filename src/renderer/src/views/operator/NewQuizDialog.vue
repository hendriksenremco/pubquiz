<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import Dialog from '../../components/Dialog.vue'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { NEW_QUIZ_MESSAGES } from './operator-messages'

/**
 * Nieuwe quiz: alleen een naam. De app maakt zelf de map aan in de bibliotheek.
 * Met `source` wordt het "op basis van" die quiz, met keuze wat er meegaat.
 */
const props = defineProps<{ source: { path: string; title: string } | null }>()
const emit = defineEmits<{ close: [] }>()
const api = window.pubquiz
const session = useSession()
const t = NEW_QUIZ_MESSAGES.in(locale)

const name = ref(props.source ? t('copyName', { title: props.source.title }) : '')
const rounds = ref(true)
const fragments = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)
const input = ref<HTMLInputElement | null>(null)

const title = computed(() =>
  props.source ? t('titleFrom', { title: props.source.title }) : t('title')
)
const where = computed(() => session.libraryDir.replace(/^\/Users\/[^/]+/, '~'))

onMounted(async () => {
  await nextTick()
  input.value?.focus()
  input.value?.select()
})

async function create() {
  if (busy.value) return
  busy.value = true
  error.value = await api.createQuiz(
    name.value,
    props.source
      ? {
          source: props.source.path,
          options: { rounds: rounds.value, fragments: rounds.value && fragments.value }
        }
      : undefined
  )
  busy.value = false
  if (!error.value) emit('close')
}
</script>

<template>
  <Dialog :title="title" @close="emit('close')">
    <form class="form" @submit.prevent="create">
      <label class="field">
        <span class="label">{{ t('name') }}</span>
        <input
          ref="input"
          v-model="name"
          class="input name"
          :placeholder="t('namePlaceholder')"
          @input="error = null"
        />
      </label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-else class="where faint" data-volatile>{{ t('savedIn', { folder: where }) }}</p>

      <template v-if="source">
        <p class="muted intro">{{ t('alwaysCopied') }}</p>
        <label class="option">
          <input v-model="rounds" type="checkbox" />
          <span>
            <span class="option-title">{{ t('rounds') }}</span>
            <span class="option-hint">{{ t('roundsHint') }}</span>
          </span>
        </label>
        <label class="option" :class="{ disabled: !rounds }">
          <input v-model="fragments" type="checkbox" :disabled="!rounds" />
          <span>
            <span class="option-title">{{ t('fragments') }}</span>
            <span class="option-hint">{{ t('fragmentsHint') }}</span>
          </span>
        </label>
      </template>
    </form>

    <template #actions>
      <button class="btn btn-ghost" @click="emit('close')">{{ t('cancel') }}</button>
      <button class="btn btn-primary" :disabled="busy || !name.trim()" @click="create">
        {{ t('create') }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.name {
  height: 38px;
  font-size: 15px;
}

.where,
.error {
  margin-top: -6px;
  font-size: 12px;
}

.error {
  color: var(--live);
}

.intro {
  margin-top: 4px;
  font-size: 13px;
}

.option {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  cursor: pointer;
}

.option input {
  margin-top: 3px;
}

.option.disabled {
  opacity: 0.45;
  cursor: default;
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
