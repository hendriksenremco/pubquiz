<script setup lang="ts">
import { PLUGIN_OFF, PLUGINS, type PluginId } from '@shared/plugins'
import Dialog from '../../components/Dialog.vue'
import { useSession } from '../../stores/session'

/** Instellingen van de app op deze Mac: welke plug-ins aan staan. */
const emit = defineEmits<{ close: [] }>()
const session = useSession()

function toggle(id: PluginId, enabled: boolean) {
  session.setPlugin(id, { ...(session.plugins[id] ?? PLUGIN_OFF), enabled })
}
</script>

<template>
  <Dialog title="Instellingen" @close="emit('close')">
    <div class="group">
      <span class="label">Plug-ins</span>
      <label v-for="p in PLUGINS" :key="p.id" class="plugin">
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
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-1);
  cursor: pointer;
}

.plugin input {
  margin-top: 2px;
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
