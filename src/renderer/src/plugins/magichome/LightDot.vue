<script setup lang="ts">
import type { Light } from '@shared/light'

/** Bolletje met het licht: de kleur, drie kleuren voor een effect, zwart voor uit, leeg voor niets. */
defineProps<{ light: Light | null | undefined; dim?: boolean }>()
</script>

<template>
  <span
    class="light-dot"
    :class="[light?.type ?? 'none', { dim }]"
    :style="light?.type === 'color' ? { background: light.color } : undefined"
    aria-hidden="true"
  />
</template>

<style scoped>
.light-dot {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.light-dot.effect {
  background: conic-gradient(#ff0040 0 120deg, #00e070 120deg 240deg, #2060ff 240deg);
}

.light-dot.off {
  background: #000;
}

.light-dot.none {
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
}

.light-dot.dim {
  opacity: 0.45;
}
</style>
