<script setup lang="ts">
import { useSession } from '../stores/session'

const session = useSession()
</script>

<template>
  <TransitionGroup tag="div" name="notice" class="notices">
    <div v-for="n in session.notices" :key="n.id" class="notice" :class="n.level">
      <span class="msg">{{ n.message }}</span>
      <button
        class="btn btn-ghost btn-sm btn-icon"
        aria-label="Sluiten"
        @click="session.dismiss(n.id)"
      >
        ×
      </button>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.notices {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 380px;
  pointer-events: none;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 8px 10px 14px;
  border: 1px solid var(--line-strong);
  border-left: 3px solid var(--info);
  border-radius: var(--radius);
  background: var(--panel-2);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
  user-select: text;
}

.notice.warning {
  border-left-color: var(--warn);
}

.notice.error {
  border-left-color: var(--live);
}

.msg {
  flex: 1;
  padding-top: 2px;
}

.notice-enter-active,
.notice-leave-active {
  transition: all 0.2s ease;
}

.notice-enter-from,
.notice-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
