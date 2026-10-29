<script setup lang="ts">
import { PLUGIN_OFF, PLUGINS, type PluginId } from '@shared/plugins'
import Dialog from '../../components/Dialog.vue'
import { RENDERER_PLUGINS } from '../../plugins'
import { useSession } from '../../stores/session'

/** Instellingen van de app op deze Mac: welke plug-ins aan staan, met hun eigen instellingen. */
const emit = defineEmits<{ close: [] }>()
const session = useSession()

const settingsOf = (id: PluginId) => RENDERER_PLUGINS.find((p) => p.id === id)?.slots.settings

function toggle(id: PluginId, enabled: boolean) {
  session.setPlugin(id, { ...(session.plugins[id] ?? PLUGIN_OFF), enabled })
}
</script>

<template>
  <Dialog title="Instellingen" @close="emit('close')">
    <div class="group">
      <span class="label">Plug-ins</span>
      <div v-for="p in PLUGINS" :key="p.id" class="plugin">
        <label class="plugin-head">
          <input
            type="checkbox"
            :checked="session.pluginOn(p.id)"
            @change="toggle(p.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="grow">
            <span class="name">{{ p.name }}</span>
            <span class="muted description">{{ p.description }}</span>
          </span>
        </label>
        <component
          :is="settingsOf(p.id)"
          v-if="session.pluginOn(p.id) && settingsOf(p.id)"
          class="plugin-settings"
        />
      </div>
    </div>
    <template #actions>
      <button class="btn btn-primary" @click="emit('close')">Klaar</button>
    </template>
  </Dialog>
</template>

<style scoped>
.group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plugin {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-1);
}

.plugin-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.plugin-head input {
  margin-top: 2px;
}

.plugin-settings {
  padding-left: 26px;
}

.name {
  display: block;
  font-weight: 600;
}

.description {
  display: block;
  font-size: 12px;
  line-height: 1.45;
}
</style>
