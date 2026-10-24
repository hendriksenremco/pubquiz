<script setup lang="ts">
import { computed, ref } from 'vue'
import { createFragment } from '@shared/factory'
import { groupByFolder, naturalCompare } from '@shared/media-folders'
import { findAsset } from '@shared/resolve'
import type { Fragment, MediaAsset, Round } from '@shared/types'
import Icon from '../../components/Icon.vue'
import ImageChip from '../../components/ImageChip.vue'
import MediaPicker from '../../components/MediaPicker.vue'
import Popover from '../../components/Popover.vue'
import Select from '../../components/Select.vue'
import TimeInput from '../../components/TimeInput.vue'
import Waveform from '../../components/Waveform.vue'
import { formatTime } from '../../lib/format'
import { useMediaImport } from '../../lib/use-media-import'
import { usePreviewPlayer } from '../../lib/use-preview-player'
import { useWaveform } from '../../lib/waveform'
import { useSession } from '../../stores/session'

const props = defineProps<{ round: Round }>()
const session = useSession()
const quiz = computed(() => session.quiz!)
const { importFiles, pathsFromDrop } = useMediaImport()
const preview = usePreviewPlayer()
const dropping = ref(false)
const expanded = ref<string | null>(null)

/** Fragmenten gaan standaard naar het kanaal "Fragmenten", anders naar het laatste kanaal. */
const defaultChannel = computed(
  () =>
    quiz.value.channels.find((c) => /fragment/i.test(c.name))?.id ?? quiz.value.channels.at(-1)?.id
)

// ── Fragmentnummer in beeld ─────────────────────────────────────────────────
const numberScreensText = computed(() => {
  const names = quiz.value.screens
    .filter((s) => props.round.fragmentScreens.includes(s.id))
    .map((s) => s.name)
  return names.length ? names.join(', ') : 'nergens'
})

function setNumberScreen(screenId: string, on: boolean) {
  const rest = props.round.fragmentScreens.filter((id) => id !== screenId)
  // In de volgorde van de schermen, zodat de chip altijd hetzelfde leest.
  props.round.fragmentScreens = quiz.value.screens
    .map((s) => s.id)
    .filter((id) => (id === screenId ? on : rest.includes(id)))
}

function addAssets(assets: MediaAsset[]) {
  const channelId = defaultChannel.value
  if (!channelId) {
    session.notify({ level: 'warning', message: 'Voeg eerst een audiokanaal toe bij Quiz.' })
    return
  }
  for (const asset of assets.filter((a) => a.kind === 'audio')) {
    const n = props.round.fragments.length + 1
    props.round.fragments.push(createFragment(asset.id, channelId, n))
  }
}

async function addFromFiles(close?: () => void) {
  close?.()
  addAssets(await importFiles())
}

/** Media-mappen met geluid, om in één keer als fragmenten toe te voegen. */
const audioFolders = computed(() => groupByFolder(quiz.value, ['audio']).filter((g) => g.folder))

function addFolder(assets: MediaAsset[], close: () => void) {
  close()
  const used = new Set(props.round.fragments.map((f) => f.assetId))
  const sorted = [...assets].sort((a, b) => naturalCompare(a.name, b.name))
  addAssets(sorted.filter((a) => !used.has(a.id)))
}

async function onDrop(event: DragEvent) {
  dropping.value = false
  const paths = pathsFromDrop(event)
  if (paths.length) addAssets(await importFiles(paths))
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= props.round.fragments.length) return
  const [f] = props.round.fragments.splice(index, 1)
  props.round.fragments.splice(target, 0, f)
}

function remove(index: number) {
  const [f] = props.round.fragments.splice(index, 1)
  if (expanded.value === f?.id) expanded.value = null
}

function renumber(close: () => void) {
  props.round.fragments.forEach((f, i) => (f.label = `Fragment ${i + 1}`))
  close()
}

function assetOf(f: Fragment) {
  return findAsset(quiz.value, f.assetId)
}

function length(f: Fragment): string {
  const end = f.end ?? assetOf(f)?.duration
  return end === undefined ? '' : formatTime(end - (f.start ?? 0))
}

function trimText(f: Fragment): string {
  if (f.start === undefined && f.end === undefined) return ''
  return `${formatTime(f.start ?? 0)}–${f.end !== undefined ? formatTime(f.end) : 'eind'}`
}

function play(f: Fragment) {
  preview.toggle(f.id, assetOf(f), f.start ?? 0, f.end)
}

// ── Waveform van het geopende fragment: het hele bestand, met het gekozen stuk ────────────
const open = computed(() => props.round.fragments.find((f) => f.id === expanded.value) ?? null)
const { bars: openBars, duration: openDuration } = useWaveform(
  () => ({ asset: open.value ? assetOf(open.value) : null }),
  160
)
const selection = computed((): [number, number] | null => {
  const f = open.value
  const d = openDuration.value
  return f && d ? [(f.start ?? 0) / d, Math.min(1, (f.end ?? d) / d)] : null
})
/** Bij luisteren loopt de lijn mee over het hele bestand. */
const listening = computed(() => {
  const f = open.value
  const d = openDuration.value
  return f && d && preview.playingId.value === f.id ? preview.position.value / d : null
})

/** Begin en eind uit de grepen, op een tiende seconde; helemaal aan de rand = geen grens. */
function select(f: Fragment, [a, b]: [number, number]) {
  const d = openDuration.value
  if (!d) return
  const tenth = (v: number) => Math.round(v * 10) / 10
  const start = tenth(a * d)
  const end = tenth(b * d)
  f.start = start > 0 ? start : undefined
  f.end = end < tenth(d) ? end : undefined
}

/** Leeg of ongeldig → fallback, zodat er nooit een lege string in de quiz belandt. */
function numberFrom(event: Event, fallback: number): number {
  const value = parseFloat((event.target as HTMLInputElement).value.replace(',', '.'))
  return Number.isFinite(value) && value >= 0 ? value : fallback
}
</script>

<template>
  <section
    class="fragments"
    :class="{ dropping }"
    @dragover.prevent="dropping = true"
    @dragleave.self="dropping = false"
    @drop.prevent.stop="onDrop"
  >
    <div class="section-head">
      <h3>Fragmenten</h3>
      <span class="count">{{ round.fragments.length || '' }}</span>
      <span class="grow" />

      <Popover v-if="round.fragments.length && quiz.screens.length" align="right" :width="270">
        <template #trigger="{ open, toggle }">
          <button
            type="button"
            class="chip number-chip"
            :class="{ open, dimmed: !round.fragmentScreens.length }"
            :title="`Fragmentnummer in beeld: ${numberScreensText}`"
            @click="toggle"
          >
            <Icon name="monitor" :size="14" />
            <span>Nummer in beeld</span>
            <span class="chip-key chip-value">{{ numberScreensText }}</span>
            <Icon name="chevron" :size="14" class="chev" />
          </button>
        </template>
        <div class="series">
          <p class="muted series-hint">
            Het nummer van het fragment dat speelt, ook als je het zelf start.
          </p>
          <label v-for="slot in quiz.screens" :key="slot.id" class="series-row">
            <input
              type="checkbox"
              :checked="round.fragmentScreens.includes(slot.id)"
              @change="setNumberScreen(slot.id, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ slot.name }}</span>
          </label>
        </div>
      </Popover>

      <Popover v-if="round.fragments.length" align="right" :width="270">
        <template #trigger="{ open, toggle }">
          <button class="btn btn-ghost btn-sm" :class="{ active: open }" @click="toggle">
            <Icon name="repeat" :size="14" /> Automatische reeks
          </button>
        </template>
        <template #default="{ close }">
          <div class="series">
            <label class="series-row">
              <span class="grow">Pauze tussen fragmenten</span>
              <input
                :value="round.autoplay.gapSeconds"
                type="number"
                min="0"
                step="1"
                class="input input-sm gap"
                @change="round.autoplay.gapSeconds = numberFrom($event, 0)"
              />
              <span class="muted">s</span>
            </label>
            <label class="series-row" title="Op de schermen van Nummer in beeld">
              <input v-model="round.autoplay.countdownOnScreen" type="checkbox" />
              <span>Aftellen tussen fragmenten in beeld</span>
            </label>
            <button class="menu-item" @click="renumber(close)">
              Namen hernummeren (Fragment 1, 2, …)
            </button>
          </div>
        </template>
      </Popover>
      <Popover align="right" :width="260">
        <template #trigger="{ toggle }">
          <button class="btn btn-sm" @click="toggle">
            <Icon name="plus" :size="14" /> Toevoegen
          </button>
        </template>
        <template #default="{ close }">
          <button class="menu-item" @click="addFromFiles(close)">
            <Icon name="upload" /> Bestanden of map…
          </button>
          <template v-if="audioFolders.length">
            <div class="menu-label">Uit Media</div>
            <button
              v-for="g in audioFolders"
              :key="g.folder!.id"
              class="menu-item"
              @click="addFolder(g.assets, close)"
            >
              <Icon name="folder" />
              <span class="grow">{{ g.folder!.name }}</span>
              <span class="muted">{{ g.assets.length }}</span>
            </button>
          </template>
        </template>
      </Popover>
    </div>

    <div v-if="round.fragments.length" class="tracks">
      <div
        v-for="(f, i) in round.fragments"
        :key="f.id"
        class="track"
        :class="{ open: expanded === f.id }"
      >
        <div class="track-row" @click="expanded = expanded === f.id ? null : f.id">
          <button
            class="track-num"
            :class="{ playing: preview.playingId.value === f.id }"
            :aria-label="preview.playingId.value === f.id ? 'Stop' : `Luister naar ${f.label}`"
            @click.stop="play(f)"
          >
            <span class="n mono">{{ i + 1 }}</span>
            <Icon :name="preview.playingId.value === f.id ? 'stop' : 'play'" :size="12" class="p" />
          </button>
          <span class="track-main">
            <span class="track-title">{{ f.label }}</span>
            <span class="track-sub">{{ f.answer || assetOf(f)?.name || 'Bestand ontbreekt' }}</span>
          </span>
          <span class="track-trim mono">{{ trimText(f) }}</span>
          <span class="track-dur mono">{{ length(f) }}</span>
          <Icon name="chevron" :size="14" class="track-chev" />
        </div>

        <div v-if="expanded === f.id" class="track-edit">
          <label class="field wide">
            <span class="label">Naam</span>
            <input v-model="f.label" class="input input-sm" />
          </label>
          <label class="field wide">
            <span class="label">Antwoord, voor de antwoordenronde</span>
            <input v-model="f.answer" class="input input-sm" placeholder="Artiest – titel" />
          </label>
          <div class="field wide">
            <span class="label">Afbeelding bij het antwoord</span>
            <ImageChip v-model="f.answerImageAssetId" label="Afbeelding" class="answer-image" />
          </div>
          <label class="field wide">
            <span class="label">Bestand</span>
            <MediaPicker v-model="f.assetId" :kinds="['audio']" size="sm" />
          </label>
          <label class="field wide">
            <span class="label">Kanaal</span>
            <Select
              v-model="f.channelId"
              size="sm"
              :options="quiz.channels.map((c) => ({ value: c.id, label: c.name }))"
            />
          </label>
          <div class="field full">
            <span class="label">Wat er speelt <span class="faint">sleep begin en eind</span></span>
            <Waveform
              class="edit-wave"
              :bars="openBars"
              :selection="selection"
              :progress="listening"
              :step="0.5 / (openDuration || 1)"
              :min-length="0.5 / (openDuration || 1)"
              @select="select(f, $event)"
            />
          </div>
          <label class="field">
            <span class="label">Start</span>
            <TimeInput v-model="f.start" placeholder="0:00" />
          </label>
          <label class="field">
            <span class="label">Eind</span>
            <TimeInput v-model="f.end" placeholder="tot het eind" />
          </label>
          <label class="field">
            <span class="label">Fade-in (s)</span>
            <input
              :value="f.fadeIn ?? 0"
              type="number"
              min="0"
              step="0.1"
              class="input input-sm"
              @change="f.fadeIn = numberFrom($event, 0)"
            />
          </label>
          <label class="field">
            <span class="label">Fade-out (s)</span>
            <input
              :value="f.fadeOut ?? 0"
              type="number"
              min="0"
              step="0.1"
              class="input input-sm"
              @change="f.fadeOut = numberFrom($event, 0)"
            />
          </label>
          <div class="edit-actions">
            <button class="btn btn-ghost btn-sm" :disabled="i === 0" @click="move(i, -1)">
              <Icon name="left" :size="14" class="up" /> Omhoog
            </button>
            <button
              class="btn btn-ghost btn-sm"
              :disabled="i === round.fragments.length - 1"
              @click="move(i, 1)"
            >
              <Icon name="right" :size="14" class="down" /> Omlaag
            </button>
            <span class="grow" />
            <button class="btn btn-ghost btn-sm btn-danger" @click="remove(i)">
              <Icon name="trash" :size="14" /> Verwijder
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="drop-row">
      Sleep geluidsfragmenten hierheen, of
      <button class="link" @click="addFromFiles()">kies bestanden of een map</button>.
    </div>
  </section>
</template>

<style scoped>
.fragments {
  border-radius: var(--radius-lg);
  transition: box-shadow 0.15s;
}

.fragments.dropping {
  box-shadow: 0 0 0 2px var(--accent);
}

.section-head .btn {
  align-self: center;
}

.menu-label {
  padding: 8px 10px 4px;
  color: var(--muted);
  font-size: 12px;
}

.series {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.series-hint {
  padding: 4px 10px 6px;
  font-size: 12px;
  line-height: 1.45;
}

.series-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
}

.gap {
  width: 56px;
}

.tracks {
  display: flex;
  flex-direction: column;
}

.track {
  border-radius: var(--radius);
}

.track.open {
  background: var(--surface-1);
}

.track-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 110px 52px 20px;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 12px 0 8px;
  border-radius: var(--radius);
  cursor: pointer;
}

.track-row:hover {
  background: var(--surface-1);
}

.track-num {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.track-num .p {
  display: none;
}

.track-row:hover .track-num .n,
.track-num.playing .n {
  display: none;
}

.track-row:hover .track-num .p,
.track-num.playing .p {
  display: block;
}

.track-num:hover,
.track-num.playing {
  background: var(--accent);
  color: var(--accent-ink);
}

.n {
  font-size: 14px;
  font-weight: 600;
}

.track-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.track-title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-num.playing ~ .track-main .track-title {
  color: var(--accent);
}

.track-sub {
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-trim {
  color: var(--faint);
  font-size: 12px;
  text-align: right;
}

.track-dur {
  color: var(--muted);
  text-align: right;
}

.track-chev {
  color: var(--faint);
  transition: transform 0.15s;
}

.track.open .track-chev {
  transform: rotate(180deg);
}

.track-edit {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 14px;
  padding: 6px 16px 14px 56px;
}

.track-edit .wide {
  grid-column: span 2;
}

.track-edit .full {
  grid-column: 1 / -1;
}

.edit-wave {
  --wave: rgba(160, 180, 220, 0.45);
  height: 56px;
  margin-top: 6px;
  padding: 6px 0;
  border-radius: var(--radius);
  background: var(--surface-1);
}

.edit-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 4px;
}

.up {
  transform: rotate(90deg);
}

.down {
  transform: rotate(90deg);
}

.drop-row {
  padding: 18px 16px;
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  color: var(--muted);
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
</style>
