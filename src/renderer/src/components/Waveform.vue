<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * Vorm van een geluid als balkjes. Het gespeelde deel kleurt mee: `progress` (0–1) voor een vaste
 * stand, of `playing` om vanaf de start vloeiend mee te lopen (een CSS-animatie, dus zonder
 * per beeld te rekenen). Met `selection` (0–1) kies je een stuk met twee grepen, ook met ← →.
 * Kleuren via --wave (balkjes), --wave-played en --wave-out (buiten het gekozen stuk).
 */
const props = withDefaults(
  defineProps<{
    bars: number[] | null
    progress?: number | null
    playing?: { startedAt: number; duration: number } | null
    selection?: [number, number] | null
    /** Stap van de grepen met ← → (deel van het geheel). */
    step?: number
    /** Kleinste lengte van het gekozen stuk (deel van het geheel). */
    minLength?: number
  }>(),
  { progress: null, playing: null, selection: null, step: 0.01, minLength: 0.01 }
)
const emit = defineEmits<{ select: [range: [number, number]] }>()

const root = ref<HTMLElement | null>(null)
const GAP = 1
const width = computed(() => (props.bars?.length ?? 0) * 3)
const rects = computed(() =>
  (props.bars ?? []).map((v, i) => {
    const h = Math.max(6, v * 100)
    return { x: i * 3, y: (100 - h) / 2, h }
  })
)

/** Waar het lopen begint: zo ver is het fragment al, voor als het venster later opent. */
const animation = computed(() => {
  const p = props.playing
  if (!p || !(p.duration > 0)) return null
  const elapsed = Math.max(0, (Date.now() - p.startedAt) / 1000)
  return { animationDuration: `${p.duration}s`, animationDelay: `${-elapsed}s` }
})

function drag(which: 0 | 1, event: PointerEvent) {
  const handle = event.currentTarget as HTMLElement
  const box = root.value!.getBoundingClientRect()
  handle.setPointerCapture(event.pointerId)
  const move = (e: PointerEvent) =>
    set(which, Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)))
  const up = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', up)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', up)
}

function nudge(which: 0 | 1, event: KeyboardEvent) {
  const delta =
    event.key === 'ArrowLeft' || event.key === 'ArrowDown'
      ? -props.step
      : event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? props.step
        : 0
  if (!delta || !props.selection) return
  event.preventDefault()
  event.stopPropagation()
  set(which, props.selection[which] + delta)
}

function set(which: 0 | 1, at: number) {
  const [a, b] = props.selection!
  emit(
    'select',
    which === 0
      ? [Math.max(0, Math.min(at, b - props.minLength)), b]
      : [a, Math.min(1, Math.max(at, a + props.minLength))]
  )
}

const percent = (v: number) => `${(v * 100).toFixed(3)}%`
</script>

<template>
  <div ref="root" class="wave" :class="{ empty: !bars }">
    <svg v-if="bars" :viewBox="`0 0 ${width} 100`" preserveAspectRatio="none" aria-hidden="true">
      <g class="base">
        <rect v-for="(r, i) in rects" :key="i" :x="r.x" :y="r.y" :width="3 - GAP" :height="r.h" />
      </g>
      <g
        v-if="playing || progress !== null"
        :key="playing?.startedAt"
        class="played"
        :class="{ running: animation }"
        :style="animation ?? { '--p': percent(1 - (progress ?? 0)) }"
      >
        <rect v-for="(r, i) in rects" :key="i" :x="r.x" :y="r.y" :width="3 - GAP" :height="r.h" />
      </g>
    </svg>

    <template v-if="selection">
      <div class="out" :style="{ left: 0, width: percent(selection[0]) }" />
      <div class="out" :style="{ left: percent(selection[1]), right: 0 }" />
      <button
        v-for="which in [0, 1] as const"
        :key="which"
        type="button"
        class="handle"
        :style="{ left: percent(selection[which]) }"
        role="slider"
        :aria-label="which === 0 ? 'Begin' : 'Eind'"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(selection[which] * 100)"
        @pointerdown.prevent="drag(which, $event)"
        @keydown="nudge(which, $event)"
      />
    </template>
  </div>
</template>

<style scoped>
.wave {
  --wave: rgba(160, 180, 220, 0.35);
  --wave-played: var(--accent);
  --wave-out: rgba(15, 20, 32, 0.6);
  position: relative;
  height: 100%;
}

svg {
  display: block;
  width: 100%;
  height: 100%;
}

.base {
  fill: var(--wave);
}

.played {
  fill: var(--wave-played);
  clip-path: inset(0 var(--p, 100%) 0 0);
}

.played.running {
  animation-name: play;
  animation-timing-function: linear;
  animation-fill-mode: both;
}

@keyframes play {
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}

.out {
  position: absolute;
  top: 0;
  bottom: 0;
  background: var(--wave-out);
  pointer-events: none;
}

.handle {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 10px;
  margin-left: -5px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
}

.handle::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 2px;
  border-radius: 1px;
  background: var(--accent);
  content: '';
}

.handle::after {
  position: absolute;
  top: -2px;
  left: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  content: '';
}

.handle:focus-visible {
  outline: none;
}

.handle:focus-visible::after {
  box-shadow: 0 0 0 3px rgba(255, 165, 61, 0.4);
}
</style>
