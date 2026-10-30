<script setup lang="ts">
// Kleine lijn-iconen (24×24, stroke = currentColor), zodat de app geen icon-font nodig heeft.
const PATHS = {
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  images:
    'M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 21h12a2 2 0 0 0 2-2V9M3 14l4-4 4 4 2-2 4 4',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  play: 'M8 5.5v13l11-6.5z',
  stop: 'M7 7h10v10H7z',
  pause: 'M7.5 6h3v12h-3zM13.5 6h3v12h-3z',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  chevron: 'M6 9l6 6 6-6',
  x: 'M6 6l12 12M18 6L6 18',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  spark: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  text: 'M5 6h14M12 6v13M9 19h6',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
  check: 'M5 12l5 5 9-10',
  power: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  home: 'M3 11l9-7 9 7M5 9.5V20h5v-6h4v6h5V9.5',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  printer: 'M7 9V4h10v5M7 17H4V9h16v8h-3M7 14h10v6H7z',
  'screen-off': 'M3 5h18v11H3zM8 20h8M12 16v4M3 2l18 18',
  volume: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  'volume-off': 'M11 5L6 9H3v6h3l5 4zM16 9l5 6M21 9l-5 6',
  next: 'M5 5l10 7-10 7zM19 5v14',
  end: 'M6 6h12v12H6z',
  restart: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  'folder-plus':
    'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 11v5M9.5 13.5h5',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4'
} as const

export type IconName = keyof typeof PATHS
const FILLED: IconName[] = ['play', 'stop', 'pause']

withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 16 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="name === 'more' ? 3.2 : 1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <path :d="PATHS[name]" :fill="FILLED.includes(name) ? 'currentColor' : 'none'" />
  </svg>
</template>

<style scoped>
.icon {
  flex-shrink: 0;
  display: block;
}
</style>
