<script setup lang="ts">
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { useLiveControls } from '../../lib/live-controls'
import PluginSlot from '../../plugins/PluginSlot.vue'

/** Werkbalk tijdens de show: noodknoppen, sneltoetsen, terug naar bewerken en stoppen. */
const emit = defineEmits<{ edit: [] }>()
const { allBlack, toggleBlackout, muted, toggleSound, stopShow, shortcuts } = useLiveControls()
</script>

<template>
  <div class="live-controls">
    <button
      class="btn"
      :class="{ alert: allBlack }"
      :title="allBlack ? 'Alle schermen tonen weer hun beeld' : 'Alle schermen op zwart'"
      @click="toggleBlackout()"
    >
      <Icon :name="allBlack ? 'monitor' : 'screen-off'" :size="15" />
      {{ allBlack ? 'Beeld terug' : 'Beeld op zwart' }}
      <span class="kbd">B</span>
    </button>
    <button
      class="btn"
      :class="{ alert: muted }"
      :title="muted ? 'Achtergrondmuziek weer aan' : 'Fragment stopt en achtergrondmuziek gaat uit'"
      @click="toggleSound"
    >
      <Icon :name="muted ? 'volume' : 'volume-off'" :size="15" />
      {{ muted ? 'Geluid aan' : 'Geluid uit' }}
      <span class="kbd">M</span>
    </button>

    <span class="sep" />

    <PluginSlot name="liveControls" />
    <Popover align="right" :width="320">
      <template #trigger="{ open, toggle }">
        <button class="btn btn-ghost" :class="{ active: open }" @click="toggle">Sneltoetsen</button>
      </template>
      <div class="shortcuts">
        <template v-for="[k, label] in shortcuts" :key="k">
          <span class="kbd">{{ k }}</span>
          <span>{{ label }}</span>
        </template>
      </div>
    </Popover>
    <button class="btn btn-ghost" @click="emit('edit')">
      <Icon name="pencil" :size="14" /> Bewerken
    </button>
    <button class="btn btn-ghost btn-danger" @click="stopShow">
      <Icon name="power" :size="14" /> Stop show
    </button>
  </div>
</template>

<style scoped>
.live-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.btn.alert,
.btn.alert:hover:not(:disabled) {
  background: var(--live-soft);
  color: var(--live);
}

.sep {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: var(--line-strong);
}

.shortcuts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 12px;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
}

.shortcuts .kbd {
  justify-self: start;
}
</style>
