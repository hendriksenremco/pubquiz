<script setup lang="ts">
import { computed } from 'vue'
import { groupByFolder } from '@shared/media-folders'
import type { MediaKind } from '@shared/types'
import { formatTime } from '../lib/format'
import { useMediaImport } from '../lib/use-media-import'
import { useSession } from '../stores/session'
import Select, { type SelectOption } from './Select.vue'

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

/** Per map een kopje; onderaan importeren. */
const options = computed((): SelectOption[] => [
  ...groups.value.flatMap((g) =>
    g.assets.map((a) => ({
      value: a.id,
      label: `${a.name}${a.duration ? ` · ${formatTime(a.duration)}` : ''}`,
      group: g.label
    }))
  ),
  { value: IMPORT, label: 'Importeer bestand…' }
])

async function onChange(value: string | undefined) {
  if (value !== IMPORT) {
    model.value = value || undefined
    return
  }
  const added = await importFiles()
  const match = added.find((a) => props.kinds.includes(a.kind))
  if (match) model.value = match.id
}
</script>

<template>
  <Select
    :model-value="model ?? ''"
    :options="options"
    :placeholder="placeholder"
    :size="size"
    @update:model-value="onChange"
  />
</template>
