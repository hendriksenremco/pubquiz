<script setup lang="ts">
defineProps<{ param: string }>()
</script>

<template>
  <div class="identify">
    <div class="eyebrow">Dit display is</div>
    <div class="label">{{ param }}</div>
  </div>
</template>

<style scoped>
.identify {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 3px solid var(--accent);
  border-radius: 20px;
  background: rgba(16, 18, 23, 0.92);
  text-align: center;
  padding: 24px;
}

.label {
  font-size: 30px;
  font-weight: 750;
  color: var(--text);
}
</style>
