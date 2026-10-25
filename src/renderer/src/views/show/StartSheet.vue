<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mediaUrl } from '@shared/ipc'
import { sameDisplayName } from '@shared/airplay'
import { answerItems, findBrokenReferences, screenHasSound } from '@shared/resolve'
import type { HardwareMapping, ScreenTarget } from '@shared/types'
import Icon from '../../components/Icon.vue'
import Select, { type SelectOption } from '../../components/Select.vue'
import {
  listAudioOutputs,
  resolveSinkId,
  screenSoundOutput,
  type AudioOutput
} from '../../lib/audio-devices'
import { useSession } from '../../stores/session'

/**
 * Venster voor de show begint: welk scherm en welke speaker van vanavond bij welk scherm en
 * kanaal van de quiz hoort. De app onthoudt het, dus meestal is het alleen nog "Start show".
 */
const emit = defineEmits<{ close: [] }>()
const api = window.pubquiz
const session = useSession()
const quiz = computed(() => session.quiz!)
const outputs = ref<AudioOutput[]>([])
const missingMedia = ref<string[]>([])
const starting = ref(false)

async function refreshOutputs() {
  outputs.value = await listAudioOutputs()
}

async function checkMedia() {
  const results = await Promise.all(
    quiz.value.assets.map(async (a) => {
      const res = await fetch(mediaUrl(a.file), { method: 'HEAD' }).catch(() => null)
      return res?.ok ? null : a.name
    })
  )
  missingMedia.value = results.filter((n): n is string => n !== null)
}

function onKey(event: KeyboardEvent) {
  // Escape in een open keuzelijst sluit alleen die lijst.
  if (event.key === 'Escape' && !event.defaultPrevented) emit('close')
}

onMounted(() => {
  void refreshOutputs()
  void checkMedia()
  navigator.mediaDevices.addEventListener('devicechange', refreshOutputs)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  navigator.mediaDevices.removeEventListener('devicechange', refreshOutputs)
  document.removeEventListener('keydown', onKey)
})
watch(() => quiz.value.assets.length, checkMedia)

// ── Koppeling ────────────────────────────────────────────────────────────────

// AirPlay-schermen en -speakers in de buurt die macOS nog niet als display/uitgang aanbiedt.
const airplayScreens = computed(() =>
  session.airplay.filter(
    (a) => a.screen && !session.displays.some((d) => sameDisplayName(d.label, a.name))
  )
)
const airplaySpeakers = computed(() =>
  session.airplay.filter(
    (a) => a.audio && !outputs.value.some((o) => sameDisplayName(o.label, a.name))
  )
)

function screenValue(target: ScreenTarget | undefined): string {
  if (!target || target.kind === 'off') return 'off'
  if (target.kind === 'window') return 'window'
  const match =
    session.displays.find((d) => d.id === target.displayId) ??
    session.displays.find((d) => d.label === target.label) ??
    session.displays.find((d) => sameDisplayName(d.label, target.label))
  if (match) return `d:${match.id}`
  const airplay = airplayScreens.value.find((a) => sameDisplayName(a.name, target.label))
  return airplay ? `ap:${airplay.name}` : 'missing'
}

function screenOptions(slotId: string): SelectOption[] {
  const target = session.hardware.screens[slotId] as { label?: string } | undefined
  return [
    { value: 'off', label: 'Uit' },
    { value: 'window', label: 'Venster op deze laptop (om te testen)' },
    ...(screenValue(session.hardware.screens[slotId]) === 'missing'
      ? [{ value: 'missing', label: `${target?.label} (niet aangesloten)`, disabled: true }]
      : []),
    ...session.displays.map((d) => ({ value: `d:${d.id}`, label: displayName(d) })),
    ...airplayScreens.value.map((a) => ({
      value: `ap:${a.name}`,
      label: a.name,
      group: 'AirPlay in de buurt'
    }))
  ]
}

function setScreen(slotId: string, value: string) {
  let target: ScreenTarget = { kind: 'off' }
  if (value === 'window') target = { kind: 'window' }
  if (value.startsWith('d:')) {
    const display = session.displays.find((d) => d.id === Number(value.slice(2)))
    if (display) target = { kind: 'display', displayId: display.id, label: display.label }
  }
  if (value.startsWith('ap:')) {
    // Verbinden doet macOS; zodra het scherm verschijnt, herkent de app het aan de naam.
    target = { kind: 'display', displayId: -1, label: value.slice(3) }
    void api.openAirPlaySettings('screen')
  }
  save({ ...session.hardware, screens: { ...session.hardware.screens, [slotId]: target } })
}

/** Naam van het AirPlay-scherm dat voor dit slot gekozen is maar nog niet verbonden is. */
function pendingAirPlay(slotId: string): string | null {
  const value = screenValue(session.hardware.screens[slotId])
  return value.startsWith('ap:') ? value.slice(3) : null
}

/** Uitgangen die (vermoedelijk) via AirPlay lopen, krijgen een waarschuwing over de vertraging. */
function outputLabel(label: string): string {
  return session.airplay.some((a) => sameDisplayName(a.name, label))
    ? `${label} (AirPlay, ±2 s vertraging)`
    : label
}

function audioValue(channelId: string): string {
  const sink = resolveSinkId(session.hardware.audio[channelId], outputs.value)
  if (sink === null) return 'missing'
  return sink === '' ? 'default' : sink
}

function audioOptions(channelId: string): SelectOption[] {
  if (!outputs.value.length)
    return [{ value: 'default', label: 'Uitgangen laden…', disabled: true }]
  return [
    ...(audioValue(channelId) === 'missing'
      ? [
          {
            value: 'missing',
            label: `${session.hardware.audio[channelId]?.label} (niet gevonden)`,
            disabled: true
          }
        ]
      : []),
    ...outputs.value.map((o) => ({ value: o.deviceId, label: outputLabel(o.label) }))
  ]
}

function setAudio(channelId: string, deviceId: string) {
  const output = outputs.value.find((o) => o.deviceId === deviceId)
  const target = { deviceId, label: output?.label ?? 'Systeemstandaard' }
  save({ ...session.hardware, audio: { ...session.hardware.audio, [channelId]: target } })
}

// Videogeluid: standaard naar de speakers van het scherm zelf, of naar een gekozen uitgang.
function hasSound(slotId: string): boolean {
  const target = session.hardware.screens[slotId]
  return screenHasSound(quiz.value, slotId) && !!target && target.kind !== 'off'
}

function soundValue(slotId: string): string {
  const choice = session.hardware.screenSound[slotId]
  if (!choice) return 'auto'
  const sink = resolveSinkId(choice, outputs.value)
  if (sink === null) return 'missing'
  return sink === '' ? 'default' : sink
}

/** Speakers die "automatisch" oplevert; null = het display heeft (herkenbaar) geen speakers. */
function autoOutput(slotId: string): AudioOutput | null {
  return screenSoundOutput(undefined, session.hardware.screens[slotId], outputs.value)
}

function autoLabel(slotId: string): string {
  if (session.hardware.screens[slotId]?.kind !== 'display') return 'Automatisch (systeemstandaard)'
  const output = autoOutput(slotId)
  return output
    ? `Speakers van het scherm (${output.label})`
    : 'Speakers van het scherm (niet gevonden)'
}

function soundOptions(slotId: string): SelectOption[] {
  return [
    { value: 'auto', label: autoLabel(slotId) },
    ...(soundValue(slotId) === 'missing'
      ? [
          {
            value: 'missing',
            label: `${session.hardware.screenSound[slotId]?.label} (niet gevonden)`,
            disabled: true
          }
        ]
      : []),
    ...outputs.value.map((o) => ({ value: o.deviceId, label: outputLabel(o.label) }))
  ]
}

function setSound(slotId: string, deviceId: string) {
  const { [slotId]: _, ...rest } = session.hardware.screenSound
  const output = outputs.value.find((o) => o.deviceId === deviceId)
  const screenSound =
    deviceId === 'auto'
      ? rest
      : { ...rest, [slotId]: { deviceId, label: output?.label ?? 'Systeemstandaard' } }
  save({ ...session.hardware, screenSound })
}

function save(mapping: HardwareMapping) {
  session.hardware = mapping
  void api.setHardware(JSON.parse(JSON.stringify(mapping)))
}

// ── Controle ─────────────────────────────────────────────────────────────────

const problems = computed(() => {
  const list: { level: 'error' | 'warning'; text: string }[] = []
  for (const p of findBrokenReferences(quiz.value)) list.push({ level: 'error', text: p })
  for (const name of missingMedia.value)
    list.push({ level: 'error', text: `Bestand ontbreekt: ${name}` })
  for (const slot of quiz.value.screens) {
    const value = screenValue(session.hardware.screens[slot.id])
    if (value === 'missing')
      list.push({ level: 'warning', text: `${slot.name}: display niet aangesloten` })
    if (value === 'off') list.push({ level: 'warning', text: `${slot.name} staat uit` })
    if (!hasSound(slot.id) || !outputs.value.length) continue
    const sound = soundValue(slot.id)
    if (sound === 'missing') {
      list.push({
        level: 'warning',
        text: `${slot.name}: geluidsuitgang niet gevonden, het videogeluid gaat naar de systeemstandaard`
      })
    } else if (
      sound === 'auto' &&
      session.hardware.screens[slot.id]?.kind === 'display' &&
      !autoOutput(slot.id)
    ) {
      list.push({
        level: 'warning',
        text: `${slot.name}: geen speakers bij dit scherm, het videogeluid gaat naar de systeemstandaard`
      })
    }
  }
  for (const c of quiz.value.channels) {
    if (audioValue(c.id) === 'missing') {
      list.push({
        level: 'warning',
        text: `${c.name}: uitgang niet gevonden, de systeemstandaard wordt gebruikt`
      })
    }
  }
  for (const r of quiz.value.rounds) {
    if (answerItems(quiz.value, r).length && !r.fragmentScreens.length) {
      list.push({
        level: 'warning',
        text: `${r.title}: kies bij Antwoorden op welk scherm ze in beeld komen`
      })
    }
  }
  if (quiz.value.rounds.length === 0)
    list.push({ level: 'warning', text: 'De quiz heeft nog geen rondes' })
  return list
})

const recovery = computed(() =>
  session.recovery && session.recovery.quizDir === session.quizDir ? session.recovery : null
)

async function start(resume = false) {
  starting.value = true
  session.flush()
  await api.startShow(resume)
  starting.value = false
}

function dismissRecovery() {
  api.dismissRecovery()
  session.recovery = null
}

function displayName(d: {
  label: string
  width: number
  height: number
  internal: boolean
  primary: boolean
}) {
  return `${d.label}, ${d.width}×${d.height}${d.internal ? ' (laptop)' : ''}`
}

const savedAt = computed(() =>
  recovery.value
    ? new Date(recovery.value.savedAt).toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''
)
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @pointerdown.self="emit('close')">
      <section class="sheet" role="dialog" aria-modal="true" aria-label="Show starten">
        <h2>Show starten</h2>

        <div v-if="recovery" class="recovery">
          <p class="grow">
            De vorige show stopte onverwacht{{
              recovery.roundTitle ? `, bij ${recovery.roundTitle}` : ''
            }}, om {{ savedAt }}.
          </p>
          <button class="btn btn-sm" @click="dismissRecovery">Negeer</button>
          <button class="btn btn-sm btn-primary" @click="start(true)">Hervat show</button>
        </div>

        <div class="group">
          <div class="group-head">
            <span class="label grow">Schermen</span>
            <button class="btn btn-ghost btn-sm" @click="api.identifyDisplays()">
              Toon namen op de displays
            </button>
          </div>
          <template v-for="slot in quiz.screens" :key="slot.id">
            <div class="line screen">
              <span class="name">{{ slot.name }}</span>
              <Select
                class="grow screen-target"
                :aria-label="`${slot.name} toont op`"
                :model-value="screenValue(session.hardware.screens[slot.id])"
                :options="screenOptions(slot.id)"
                @update:model-value="setScreen(slot.id, $event!)"
              />
            </div>
            <div v-if="pendingAirPlay(slot.id)" class="note airplay-hint">
              <span class="grow">
                Kies {{ pendingAirPlay(slot.id) }} in macOS als uitgebreid beeldscherm.
              </span>
              <button class="btn btn-ghost btn-sm" @click="api.openAirPlaySettings('screen')">
                Open Beeldschermen
              </button>
            </div>
            <div v-if="hasSound(slot.id)" class="line sub">
              <span class="name muted">Videogeluid</span>
              <Select
                class="grow sound-target"
                :aria-label="`Videogeluid van ${slot.name} via`"
                :model-value="soundValue(slot.id)"
                :options="soundOptions(slot.id)"
                @update:model-value="setSound(slot.id, $event!)"
              />
            </div>
          </template>
          <p v-if="!quiz.screens.length" class="muted">Deze quiz heeft geen schermen.</p>
        </div>

        <div class="group">
          <div class="group-head">
            <span class="label grow">Geluid</span>
          </div>
          <div v-for="c in quiz.channels" :key="c.id" class="line channel">
            <span class="name">{{ c.name }}</span>
            <Select
              class="grow"
              :aria-label="`Uitgang voor ${c.name}`"
              :model-value="audioValue(c.id)"
              :options="audioOptions(c.id)"
              @update:model-value="setAudio(c.id, $event!)"
            />
            <button class="btn btn-ghost btn-sm" @click="api.testTone(c.id)">Testtoon</button>
          </div>
          <div v-if="airplaySpeakers.length" class="note airplay-hint">
            <span class="grow">
              AirPlay-speaker ({{ airplaySpeakers.map((a) => a.name).join(', ') }})? Kies hem eerst
              in macOS.
            </span>
            <button class="btn btn-ghost btn-sm" @click="api.openAirPlaySettings('audio')">
              Open Geluid
            </button>
          </div>
        </div>

        <ul v-if="problems.length" class="problems">
          <li v-for="p in problems" :key="p.text" :class="p.level">{{ p.text }}</li>
        </ul>

        <footer class="foot">
          <span v-if="!problems.length" class="ok grow">
            <Icon name="check" :size="16" /> Alles in orde
          </span>
          <span v-else class="grow" />
          <button class="btn" @click="emit('close')">Annuleer</button>
          <button class="btn btn-primary" :disabled="starting" @click="start()">
            <Icon name="play" :size="13" /> Start show
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 46px 0 0;
  z-index: 80;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: rgba(6, 9, 16, 0.6);
  animation: fade 0.12s ease;
}

.sheet {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(620px, calc(100% - 48px));
  max-height: calc(100% - 24px);
  overflow-y: auto;
  padding: 24px 24px 20px;
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
  background: var(--surface-2);
  box-shadow: 0 30px 80px rgba(3, 6, 14, 0.6);
  animation: drop 0.18s ease;
}

h2 {
  font-size: 20px;
}

.recovery {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--warn-soft);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-head {
  display: flex;
  align-items: center;
  min-height: 28px;
  margin-bottom: 2px;
}

.line {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
}

.name {
  flex: none;
  width: 110px;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub .name {
  padding-left: 12px;
  font-size: 13px;
}

.note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 122px;
  color: var(--muted);
  font-size: 12px;
}

.problems {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 10px 12px 10px 28px;
  border-radius: var(--radius);
  background: var(--surface-1);
  font-size: 12px;
}

.problems .error {
  color: var(--live);
}

.problems .warning {
  color: var(--warn);
}

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.ok {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}

.ok .icon {
  color: var(--ok);
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

@keyframes drop {
  from {
    transform: translateY(-12px);
    opacity: 0;
  }
}
</style>
