<script setup lang="ts">
import { computed } from 'vue'
import { groupByFolder } from '@shared/media-folders'
import type { MediaKind } from '@shared/types'
import { formatTime } from '../lib/format'
import { locale } from '../lib/locale'
import { useMediaImport } from '../lib/use-media-import'
import { useSession } from '../stores/session'
import { COMPONENT_MESSAGES } from './messages'
import Select, { type SelectOption } from './Select.vue'

const props = withDefaults(
  defineProps<{ kinds: MediaKind[]; placeholder?: string; size?: 'sm' | 'md' }>(),
  { placeholder: undefined, size: 'md' }
)
const model = defineModel<string | undefined>()

const t = COMPONENT_MESSAGES.in(locale)
const IMPORT = '__import__'
const KIND_LABEL: Record<MediaKind, string> = {
  video: t('kindVideos'),
  audio: t('kindAudio'),
  image: t('kindImages')
}

/** "Video's en Afbeeldingen": de soorten, de laatste twee met "en". */
function kindsLabel(kinds: MediaKind[]): string {
  const labels = kinds.map((k) => KIND_LABEL[k])
  const last = labels.pop() ?? ''
  return labels.length ? t('kindsJoin', { first: labels.join(', '), second: last }) : last
}

const session = useSession()
const { importFiles } = useMediaImport()

/** Per map een optgroup; bestanden zonder map onder de naam van hun soort. */
const groups = computed(() =>
  (session.quiz ? groupByFolder(session.quiz, props.kinds) : []).map((g) => ({
    key: g.folder?.id ?? 'root',
    label: g.folder?.name ?? kindsLabel(props.kinds),
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
  { value: IMPORT, label: t('importFile') }
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
    :placeholder="placeholder ?? t('chooseMedia')"
    :size="size"
    @update:model-value="onChange"
  />
</template>
