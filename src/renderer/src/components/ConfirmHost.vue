<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { pendingConfirm } from '../lib/confirm'
import { locale } from '../lib/locale'
import Dialog from './Dialog.vue'
import { COMPONENT_MESSAGES } from './messages'

/** Toont de openstaande vraag van ask(); één keer in het operator-venster. */
const t = COMPONENT_MESSAGES.in(locale)
const cancel = ref<HTMLButtonElement | null>(null)
const confirm = ref<HTMLButtonElement | null>(null)

function answer(ok: boolean) {
  const pending = pendingConfirm.value
  pendingConfirm.value = null
  pending?.resolve(ok)
}

watch(pendingConfirm, async (pending) => {
  if (!pending) return
  await nextTick()
  ;(pending.danger ? cancel : confirm).value?.focus()
})
</script>

<template>
  <Dialog v-if="pendingConfirm" :title="pendingConfirm.title" @close="answer(false)">
    <p v-if="pendingConfirm.message" class="muted message">{{ pendingConfirm.message }}</p>
    <template #actions>
      <button ref="cancel" class="btn btn-ghost" @click="answer(false)">{{ t('cancel') }}</button>
      <button
        ref="confirm"
        class="btn"
        :class="pendingConfirm.danger ? 'btn-live' : 'btn-primary'"
        @click="answer(true)"
      >
        {{ pendingConfirm.confirm }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.message {
  margin-top: -4px;
  font-size: 14px;
  line-height: 1.5;
}
</style>
