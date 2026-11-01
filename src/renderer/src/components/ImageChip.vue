<script setup lang="ts">
import { computed } from 'vue'
import { findAsset } from '@shared/resolve'
import { locale } from '../lib/locale'
import { useSession } from '../stores/session'
import AssetGrid from './AssetGrid.vue'
import Icon from './Icon.vue'
import MediaThumb from './MediaThumb.vue'
import { COMPONENT_MESSAGES } from './messages'
import Popover from './Popover.vue'

/**
 * Kleine chip "Afbeelding · naam" die openklapt tot de afbeeldingen uit Media. Met `field` oogt hij
 * als een veld (voor het paneel rechts, waar het label ernaast staat).
 */
withDefaults(defineProps<{ label: string; field?: boolean }>(), { field: false })
const model = defineModel<string | undefined>()
const session = useSession()
const t = COMPONENT_MESSAGES.in(locale)
const image = computed(() => findAsset(session.quiz!, model.value))

function clear(close: () => void) {
  model.value = undefined
  close()
}
</script>

<template>
  <Popover :width="380" :block="field">
    <template #trigger="{ open, toggle }">
      <button
        v-if="field"
        type="button"
        class="picker"
        :class="{ open }"
        :aria-label="label"
        :title="image?.name"
        @click="toggle"
      >
        <MediaThumb v-if="image" :asset="image" class="field-thumb" />
        <span class="value" :class="{ none: !image }">{{
          image ? image.name.replace(/\.[^.]+$/, '') : t('none')
        }}</span>
        <Icon name="chevron" :size="13" class="chev" />
      </button>
      <button
        v-else
        type="button"
        class="chip small"
        :class="{ open }"
        :title="image ? t('labelValue', { label, value: image.name }) : undefined"
        @click="toggle"
      >
        <MediaThumb v-if="image" :asset="image" class="opt-thumb" />
        <span class="chip-key">{{ label }}</span>
        <span class="chip-value">{{
          image ? image.name.replace(/\.[^.]+$/, '') : t('noneLower')
        }}</span>
        <Icon name="chevron" :size="13" class="chev" />
      </button>
    </template>
    <template #default="{ close }">
      <AssetGrid v-model="model" kind="image" @picked="close" />
      <button v-if="model" class="menu-item clear" @click="clear(close)">
        <Icon name="x" /> Geen afbeelding
      </button>
    </template>
  </Popover>
</template>

<style scoped>
.chip.small {
  height: 26px;
  padding: 0 9px;
  gap: 6px;
  font-size: 12px;
}

/* MediaThumb is ook een .thumb; flex: none houdt hem op chipformaat. */
.opt-thumb {
  flex: none;
  width: 26px;
  height: 16px;
  margin-left: -4px;
}

.field-thumb {
  flex: none;
  width: 30px;
  height: 18px;
  margin-left: -4px;
  border-radius: 4px;
}

.clear {
  margin-top: 6px;
}
</style>
