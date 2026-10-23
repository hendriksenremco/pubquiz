<script setup lang="ts">
import { computed } from 'vue'
import { groupByFolder } from '@shared/media-folders'
import type { MediaKind } from '@shared/types'
import { formatTime } from '../lib/format'
import { useMediaImport } from '../lib/use-media-import'
import { useSession } from '../stores/session'

const props = withDefaults(
  defineProps<{ kinds: MediaKind[]; placeholder?: string; size?: 'sm' | 'md' }>(),
  { placeholder: 'Kies media…', size: 'md' }
)
const model = defineModel<string | undefined>()

const IMPORT = '__import__'
const KIND_LABEL: Record<MediaKind, string> = {
  video: "Video's",
  audio: 'Audio',
  image: 'Afbeeldingen'
}

const session = useSession()
const { importFiles } = useMediaImport()

/** Per map een optgroup; bestanden zonder map onder de naam van hun soort. */
const groups = computed(() =>
  (session.quiz ? groupByFolder(session.quiz, props.kinds) : []).map((g) => ({
    key: g.folder?.id ?? 'root',
    label: g.folder?.name ?? props.kinds.map((k) => KIND_LABEL[k]).join(' en '),
    assets: g.assets
  }))
)

async function onChange(event: Event) {
  const select = event.target as HTMLSelectElement
  if (select.value !== IMPORT) {
    model.value = select.value || undefined
    return
  }
  select.value = model.value ?? ''
  const added = await importFiles()
  const match = added.find((a) => props.kinds.includes(a.kind))
  if (match) model.value = match.id
}
</script>

<template>
  <select
    class="select"
    :class="{ 'input-sm': size === 'sm' }"
    :value="model ?? ''"
    @change="onChange"
  >
    <option value="" disabled>{{ placeholder }}</option>
    <template v-for="group in groups" :key="group.key">
      <optgroup :label="group.label">
        <option v-for="a in group.assets" :key="a.id" :value="a.id">
          {{ a.name }}{{ a.duration ? ` · ${formatTime(a.duration)}` : '' }}
        </option>
      </optgroup>
    </template>
    <option :value="IMPORT">Importeer bestand…</option>
  </select>
</template>
