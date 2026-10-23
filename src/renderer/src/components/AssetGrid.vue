<script setup lang="ts">
import { computed } from 'vue'
import { groupByFolder } from '@shared/media-folders'
import type { MediaKind } from '@shared/types'
import { useMediaImport } from '../lib/use-media-import'
import { useSession } from '../stores/session'
import Icon from './Icon.vue'
import MediaThumb from './MediaThumb.vue'

/** Kies een video of afbeelding op beeld, met een tegel om iets nieuws te importeren. */
const props = defineProps<{ kind: Extract<MediaKind, 'video' | 'image'> }>()
const model = defineModel<string | undefined>()
const emit = defineEmits<{ picked: [assetId: string] }>()

const session = useSession()
const { importFiles } = useMediaImport()
const groups = computed(() => (session.quiz ? groupByFolder(session.quiz, [props.kind]) : []))
const showHeaders = computed(() => groups.value.some((g) => g.folder))

function pick(id: string) {
  model.value = id
  emit('picked', id)
}

async function importNew() {
  const match = (await importFiles()).find((a) => a.kind === props.kind)
  if (match) pick(match.id)
}
</script>

<template>
  <div class="grid">
    <template v-for="g in groups" :key="g.folder?.id ?? 'root'">
      <div v-if="showHeaders" class="group">
        <Icon :name="g.folder ? 'folder' : 'images'" :size="13" />
        {{ g.folder?.name ?? 'Media' }}
      </div>
      <button
        v-for="a in g.assets"
        :key="a.id"
        type="button"
        class="cell"
        :class="{ on: model === a.id }"
        :title="a.name"
        @click="pick(a.id)"
      >
        <MediaThumb :asset="a" class="cell-thumb" />
        <span class="cell-name">{{ a.name }}</span>
      </button>
    </template>
    <button type="button" class="cell add" @click="importNew">
      <span class="cell-thumb add-thumb"><Icon name="upload" /></span>
      <span class="cell-name">Importeer…</span>
    </button>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.group {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 4px 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 4px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.cell:hover {
  background: var(--surface-4);
}

.cell-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.cell.on .cell-thumb {
  box-shadow: 0 0 0 2px var(--accent);
}

.cell-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.add {
  color: var(--muted);
}

.add-thumb {
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
}
</style>
