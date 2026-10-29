<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

/**
 * Klapt open onder de trigger en sluit bij klikken ernaast of Escape.
 * Het paneel wordt naar <body> geteleporteerd en vast gepositioneerd, zodat het nooit wordt
 * afgesneden door een ouder met overflow of overlapt door een andere stapel-laag; het blijft
 * binnen het venster (schuift opzij, of klapt omhoog als er onder geen plek is).
 */
const props = withDefaults(
  defineProps<{ align?: 'left' | 'right'; width?: number; block?: boolean }>(),
  { align: 'left', width: undefined, block: false }
)
const emit = defineEmits<{ toggle: [open: boolean] }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const position = ref({ top: 0, left: 0 })

const MARGIN = 8
const GAP = 6

function place() {
  const trigger = root.value?.getBoundingClientRect()
  const el = panel.value
  if (!trigger || !el) return
  const { offsetWidth: width, offsetHeight: height } = el
  const preferred = props.align === 'right' ? trigger.right - width : trigger.left
  const left = Math.min(Math.max(preferred, MARGIN), window.innerWidth - width - MARGIN)
  const below = trigger.bottom + GAP
  const above = trigger.top - GAP - height
  const fitsBelow = below + height <= window.innerHeight - MARGIN
  position.value = { left, top: fitsBelow || above < MARGIN ? below : above }
}

function onDocumentPointer(event: PointerEvent) {
  const target = event.target as Node
  if (root.value?.contains(target) || panel.value?.contains(target)) return
  open.value = false
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

// Groeit de inhoud (bv. een keuze die meer opties toont), dan opnieuw plaatsen: anders kan het
// paneel onder het venster uitlopen.
const resize = new ResizeObserver(() => place())

watch(open, async (isOpen) => {
  emit('toggle', isOpen)
  if (isOpen) {
    document.addEventListener('pointerdown', onDocumentPointer, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    await nextTick()
    place()
    if (panel.value) resize.observe(panel.value)
  } else {
    resize.disconnect()
    document.removeEventListener('pointerdown', onDocumentPointer, true)
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('scroll', place, true)
    window.removeEventListener('resize', place)
  }
})
onBeforeUnmount(() => (open.value = false))

const close = () => (open.value = false)
const toggle = () => (open.value = !open.value)
defineExpose({ close })
</script>

<template>
  <div ref="root" class="popover" :class="{ block: props.block }">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="popover-panel"
        :style="{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: props.width ? `${props.width}px` : undefined
        }"
      >
        <slot :close="close" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.popover {
  position: relative;
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
}

/* Als de trigger een hele tegel is (bv. in een grid). */
.popover.block {
  display: flex;
  flex-direction: column;
}

.popover-panel {
  max-height: calc(100vh - 16px);
  overflow: auto;
}

/* Alleen infaden: een uitfadende Transition in een Teleport kan blijven hangen als de
   pagina eronder wegvalt terwijl hij nog sluit. */
.popover-panel {
  animation: pop-in 0.12s ease;
}

@keyframes pop-in {
  from {
    opacity: 0;
  }
}
</style>
