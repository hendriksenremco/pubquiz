<script setup lang="ts">
/** Kop van een editorpagina, met een gloed in de kleuren van het getoonde beeld. */
defineProps<{ ambient: string | null }>()
</script>

<template>
  <header class="hero">
    <Transition name="glow">
      <div
        v-if="ambient"
        :key="ambient"
        class="glow"
        :style="{ backgroundImage: `url(${ambient})` }"
      />
    </Transition>
    <div class="content">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.hero {
  position: relative;
  padding: 40px 0 32px;
  isolation: isolate;
}

.glow {
  position: absolute;
  inset: -60px 0 -40px;
  z-index: -1;
  background-size: 100% 100%;
  filter: blur(80px) saturate(1.5);
  opacity: 0.38;
  mask-image: linear-gradient(to bottom, #000 30%, transparent);
  pointer-events: none;
}

.content {
  position: relative;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 40px;
}

.glow-enter-active,
.glow-leave-active {
  transition: opacity 0.8s ease;
}

.glow-enter-from,
.glow-leave-to {
  opacity: 0;
}
</style>
