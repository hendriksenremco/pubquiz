<script setup lang="ts">
import Icon from '../../components/Icon.vue'
import Popover from '../../components/Popover.vue'
import { useLiveControls } from '../../lib/live-controls'
import { locale } from '../../lib/locale'
import PluginSlot from '../../plugins/PluginSlot.vue'
import { LIVE_MESSAGES } from './live-messages'

/** Werkbalk tijdens de show: noodknoppen, sneltoetsen, terug naar bewerken en stoppen. */
const emit = defineEmits<{ edit: [] }>()
const t = LIVE_MESSAGES.in(locale)
const {
  round,
  timing,
  timerLength,
  toggleTimer,
  allBlack,
  toggleBlackout,
  muted,
  toggleSound,
  stopShow,
  shortcuts
} = useLiveControls()
</script>

<template>
  <div class="live-controls">
    <button
      class="btn"
      :class="{ active: timing }"
      :disabled="!round && !timing"
      :title="timing ? t('timerOffHint') : t('timerOnHint', { seconds: timerLength })"
      @click="toggleTimer"
    >
      <Icon :name="timing ? 'stop' : 'timer'" :size="15" />
      {{ timing ? t('timerOff') : t('timerOn') }}
      <span class="kbd">T</span>
    </button>
    <button
      class="btn"
      :class="{ alert: allBlack }"
      :title="allBlack ? t('blackoutOffHint') : t('blackoutOnHint')"
      @click="toggleBlackout()"
    >
      <Icon :name="allBlack ? 'monitor' : 'screen-off'" :size="15" />
      {{ allBlack ? t('blackoutOff') : t('blackoutOn') }}
      <span class="kbd">B</span>
    </button>
    <button
      class="btn"
      :class="{ alert: muted }"
      :title="muted ? t('muteOffHint') : t('muteOnHint')"
      @click="toggleSound"
    >
      <Icon :name="muted ? 'volume' : 'volume-off'" :size="15" />
      {{ muted ? t('muteOff') : t('muteOn') }}
      <span class="kbd">M</span>
    </button>

    <span class="sep" />

    <PluginSlot name="liveControls" />
    <Popover align="right" :width="320">
      <template #trigger="{ open, toggle }">
        <button class="btn btn-ghost" :class="{ active: open }" @click="toggle">
          <Icon name="keyboard" :size="14" /> {{ t('shortcuts') }}
        </button>
      </template>
      <div class="shortcuts">
        <template v-for="[k, label] in shortcuts" :key="k">
          <span class="kbd">{{ k }}</span>
          <span>{{ label }}</span>
        </template>
      </div>
    </Popover>
    <button class="btn btn-ghost" @click="emit('edit')">
      <Icon name="pencil" :size="14" /> {{ t('edit') }}
    </button>
    <button class="btn btn-ghost btn-danger" @click="stopShow">
      <Icon name="power" :size="14" /> {{ t('stopShow') }}
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
