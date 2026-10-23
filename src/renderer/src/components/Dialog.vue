<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

/** Eenvoudig modaal venster; sluit met Escape of door naast het venster te klikken. */
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @pointerdown.self="emit('close')">
      <div class="dialog" role="dialog" aria-modal="true" :aria-label="title">
        <h3 class="dialog-title">{{ title }}</h3>
        <slot />
        <div class="dialog-actions">
          <slot name="actions" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(6, 9, 16, 0.6);
  animation: fade 0.12s ease;
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(480px, 100%);
  padding: 22px 22px 18px;
  border-radius: var(--radius-xl);
  background: var(--surface-2);
  box-shadow:
    0 0 0 1px var(--line-strong),
    0 30px 80px rgba(3, 6, 14, 0.6);
}

.dialog-title {
  font-size: 19px;
  line-height: 1.25;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

@keyframes fade {
  from {
    opacity: 0;
  }
}
</style>
