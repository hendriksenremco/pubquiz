<script setup lang="ts">
import { computed } from 'vue'
import { useSession } from '../stores/session'
import { RENDERER_PLUGINS, type PluginSlotName } from '.'

/**
 * Wat plug-ins die aan staan op deze plek tonen. Andere attributen (bv. de ronde of slide) gaan
 * door naar hun onderdeel.
 */
defineOptions({ inheritAttrs: false })
const props = defineProps<{ name: PluginSlotName }>()
const session = useSession()
const parts = computed(() =>
  RENDERER_PLUGINS.flatMap((plugin) => {
    const component = plugin.slots[props.name]
    return component && session.pluginOn(plugin.id) ? [{ id: plugin.id, component }] : []
  })
)
</script>

<template>
  <component :is="part.component" v-for="part in parts" :key="part.id" v-bind="$attrs" />
</template>
