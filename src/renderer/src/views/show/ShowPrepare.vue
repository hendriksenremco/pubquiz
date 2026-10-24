<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mediaUrl } from '@shared/ipc'
import { sameDisplayName } from '@shared/airplay'
import { answerItems, findBrokenReferences, screenHasSound } from '@shared/resolve'
import type { HardwareMapping, ScreenTarget } from '@shared/types'
import Select, { type SelectOption } from '../../components/Select.vue'
import StagePreview from '../../components/StagePreview.vue'
import {
  listAudioOutputs,
  resolveSinkId,
  screenSoundOutput,
  type AudioOutput
} from '../../lib/audio-devices'
import { useSession } from '../../stores/session'

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

onMounted(() => {
  void refreshOutputs()
  void checkMedia()
  navigator.mediaDevices.addEventListener('devicechange', refreshOutputs)
})
onBeforeUnmount(() => navigator.mediaDevices.removeEventListener('devicechange', refreshOutputs))
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
      list.push({ level: 'warning', text: `Scherm “${slot.name}”: display niet aangesloten` })
    if (value === 'off') list.push({ level: 'warning', text: `Scherm “${slot.name}” staat uit` })
    if (!hasSound(slot.id) || !outputs.value.length) continue
    const sound = soundValue(slot.id)
    if (sound === 'missing') {
      list.push({
        level: 'warning',
        text: `Scherm “${slot.name}”: geluidsuitgang niet gevonden (systeemstandaard wordt gebruikt)`
      })
    } else if (
      sound === 'auto' &&
      session.hardware.screens[slot.id]?.kind === 'display' &&
      !autoOutput(slot.id)
    ) {
      list.push({
        level: 'warning',
        text: `Scherm “${slot.name}”: geen speakers gevonden bij dit scherm. Het videogeluid gaat naar de systeemstandaard; kies hierboven een uitgang.`
      })
    }
  }
  for (const c of quiz.value.channels) {
    if (audioValue(c.id) === 'missing') {
      list.push({
        level: 'warning',
        text: `Kanaal “${c.name}”: uitgang niet gevonden (systeemstandaard wordt gebruikt)`
      })
    }
  }
  for (const r of quiz.value.rounds) {
    if (answerItems(quiz.value, r).length && !r.fragmentScreens.length) {
      list.push({
        level: 'warning',
        text: `Ronde “${r.title}”: kies bij Antwoorden op welk scherm ze in beeld komen`
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
  return `${d.label} · ${d.width}×${d.height}${d.internal ? ' (laptop)' : ''}`
}
</script>

<template>
  <div class="prepare scroll">
    <div class="inner">
      <div v-if="recovery" class="recovery card">
        <div class="grow">
          <h3>De vorige show is onverwacht gestopt</h3>
          <p class="muted">
            {{ recovery.roundTitle ? `Bezig met “${recovery.roundTitle}”` : 'Tussen twee rondes' }},
            om
            {{
              new Date(recovery.savedAt).toLocaleTimeString('nl-NL', {
                hour: '2-digit',
                minute: '2-digit'
              })
            }}.
          </p>
        </div>
        <button class="btn" @click="dismissRecovery">Negeer</button>
        <button class="btn btn-primary" @click="start(true)">Hervat show</button>
      </div>

      <header class="head">
        <div class="grow">
          <h2>Show voorbereiden</h2>
          <p class="muted">
            Koppel de schermen en speakers van vanavond. De app onthoudt dit voor de volgende keer.
          </p>
        </div>
        <button class="btn btn-live btn-lg" :disabled="starting" @click="start()">
          Start show
        </button>
      </header>

      <section class="card">
        <header class="card-head">
          <h3 class="grow">Schermen</h3>
          <button class="btn btn-sm" @click="api.identifyDisplays()">Identificeer displays</button>
        </header>
        <div class="card-body screens">
          <div v-for="slot in quiz.screens" :key="slot.id" class="screen">
            <StagePreview :screen="slot" />
            <div class="field">
              <label>{{ slot.name }} toont op</label>
              <Select
                class="screen-target"
                :aria-label="`${slot.name} toont op`"
                :model-value="screenValue(session.hardware.screens[slot.id])"
                :options="screenOptions(slot.id)"
                @update:model-value="setScreen(slot.id, $event!)"
              />
              <div v-if="pendingAirPlay(slot.id)" class="airplay-hint stacked">
                <p>
                  Nog niet verbonden. Kies in <strong>Beeldschermen</strong> bij
                  <strong>+</strong> voor {{ pendingAirPlay(slot.id) }} en gebruik hem als
                  <strong>uitgebreid beeldscherm</strong>. Hij verschijnt hier dan vanzelf.
                </p>
                <button class="btn btn-sm" @click="api.openAirPlaySettings('screen')">
                  Open Beeldschermen
                </button>
              </div>
            </div>
            <div v-if="hasSound(slot.id)" class="field">
              <label>Videogeluid via</label>
              <Select
                class="sound-target"
                :aria-label="`Videogeluid van ${slot.name} via`"
                :model-value="soundValue(slot.id)"
                :options="soundOptions(slot.id)"
                @update:model-value="setSound(slot.id, $event!)"
              />
            </div>
          </div>
          <div v-if="!quiz.screens.length" class="muted">Deze quiz heeft geen schermen.</div>
        </div>
      </section>

      <section class="card">
        <header class="card-head">
          <div class="grow">
            <h3>Audio-uitgangen</h3>
            <p class="muted small">
              Let op: macOS zet de systeemuitgang vaak op HDMI zodra je een beamer aansluit. Kies
              hier expliciet.
            </p>
          </div>
        </header>
        <div class="card-body stack">
          <div v-for="c in quiz.channels" :key="c.id" class="row channel">
            <span class="channel-name">{{ c.name }}</span>
            <Select
              class="grow"
              :aria-label="`Uitgang voor ${c.name}`"
              :model-value="audioValue(c.id)"
              :options="audioOptions(c.id)"
              @update:model-value="setAudio(c.id, $event!)"
            />
            <button class="btn" @click="api.testTone(c.id)">Testtoon</button>
          </div>
          <div v-if="airplaySpeakers.length" class="airplay-hint">
            <p>
              <strong>AirPlay in de buurt:</strong>
              {{ airplaySpeakers.map((a) => a.name).join(', ') }}. Kies er een in macOS bij
              <strong>Geluid › Uitvoer</strong>; als macOS hem doorgeeft, staat hij daarna in deze
              lijst. AirPlay loopt ±2 seconden achter: prima voor achtergrondmuziek, niet voor
              fragmenten.
            </p>
            <button class="btn btn-sm" @click="api.openAirPlaySettings('audio')">
              Open Geluid
            </button>
          </div>
        </div>
      </section>

      <section class="card">
        <header class="card-head">
          <h3 class="grow">Controle</h3>
          <span v-if="!problems.length" class="pill pill-ok"
            ><span class="dot" />Alles in orde</span
          >
          <span v-else class="pill pill-warn"
            >{{ problems.length }} aandachtspunt{{ problems.length > 1 ? 'en' : '' }}</span
          >
        </header>
        <div v-if="problems.length" class="card-body">
          <ul class="problems">
            <li v-for="p in problems" :key="p.text" :class="p.level">{{ p.text }}</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.prepare {
  height: 100%;
}

.inner {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 920px;
  margin: 0 auto;
  padding: 24px;
}

.head {
  display: flex;
  align-items: center;
  gap: 16px;
}

.head p {
  margin-top: 4px;
}

.recovery {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-color: var(--warn);
  background: var(--warn-soft);
}

.screens {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 18px;
}

.screen {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.channel-name {
  width: 120px;
  font-weight: 600;
}

.small {
  font-size: 12px;
}

.airplay-hint {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.airplay-hint p {
  flex: 1;
}

/* Smal (onder een scherm): knop onder de tekst. */
.airplay-hint.stacked {
  flex-direction: column;
}

.airplay-hint strong {
  color: var(--text);
  font-weight: 600;
}

.problems {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.problems .error {
  color: var(--live);
}

.problems .warning {
  color: var(--warn);
}
</style>
