import type { AudioEngineEvent } from '@shared/ipc'
import {
  answerItems,
  findAsset,
  findRound,
  resolveAudio,
  type ResolvedBackground,
  type ResolvedFragment
} from '@shared/resolve'
import type { HardwareMapping, MediaAsset, Quiz, ShowState } from '@shared/types'
import { resolveSinkId, type AudioOutput } from '../lib/audio-devices'
import { urlFor } from '../lib/media'

/** Achtergrondloops tot deze lengte worden gedecodeerd en sample-nauwkeurig (gapless) geloopt. */
const BUFFER_LOOP_MAX_S = 240
const DUCK_TIME_CONSTANT = 0.25
const BG_CROSSFADE_S = 1.5
const BG_PAUSE_FADE_S = 0.5
/** Is een fragment langer dan dit al bezig, dan is de engine herstart: speel verder vanaf daar. */
const RESUME_THRESHOLD_S = 3

type Report = (event: AudioEngineEvent) => void

/** Eén AudioContext per kanaal; via setSinkId naar het gekoppelde apparaat. */
class Output {
  readonly ctx = new AudioContext({ latencyHint: 'playback' })
  readonly bus = this.ctx.createGain()
  sinkId = ''

  constructor() {
    this.bus.connect(this.ctx.destination)
  }

  async setSink(id: string): Promise<boolean> {
    if (id === this.sinkId) return true
    try {
      await this.ctx.setSinkId(id)
      this.sinkId = id
      return true
    } catch {
      return false
    }
  }

  setVolume(volume: number): void {
    this.bus.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05)
  }

  close(): void {
    void this.ctx.close()
  }
}

interface LoopPlayer {
  readonly gain: GainNode
  play(): void
  pause(): void
  dispose(): void
}

/** Lange tracks: gestreamd via een media-element (decoderen kost ±21 MB per minuut). */
class ElementLoop implements LoopPlayer {
  readonly gain: GainNode
  private readonly el = new Audio()
  private readonly source: MediaElementAudioSourceNode

  constructor(out: Output, url: string) {
    this.el.crossOrigin = 'anonymous'
    this.el.loop = true
    this.el.preload = 'auto'
    this.el.src = url
    this.source = out.ctx.createMediaElementSource(this.el)
    this.gain = out.ctx.createGain()
    this.gain.gain.value = 0
    this.source.connect(this.gain).connect(out.bus)
  }

  play(): void {
    void this.el.play().catch(() => undefined)
  }

  pause(): void {
    this.el.pause()
  }

  dispose(): void {
    this.el.pause()
    this.el.removeAttribute('src')
    this.el.load()
    this.source.disconnect()
    this.gain.disconnect()
  }
}

/** Korte loops: AudioBufferSourceNode.loop is naadloos, in tegenstelling tot <audio loop>. */
class BufferLoop implements LoopPlayer {
  readonly gain: GainNode
  private source: AudioBufferSourceNode | null = null
  private startedAt = 0
  private offset = 0

  constructor(
    private readonly out: Output,
    private readonly buffer: AudioBuffer
  ) {
    this.gain = out.ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(out.bus)
  }

  play(): void {
    if (this.source) return
    const ctx = this.out.ctx
    const source = ctx.createBufferSource()
    source.buffer = this.buffer
    source.loop = true
    source.connect(this.gain)
    source.start(0, this.offset % this.buffer.duration)
    this.startedAt = ctx.currentTime - this.offset
    this.source = source
  }

  pause(): void {
    if (!this.source) return
    this.offset = (this.out.ctx.currentTime - this.startedAt) % this.buffer.duration
    this.source.stop()
    this.source.disconnect()
    this.source = null
  }

  dispose(): void {
    this.pause()
    this.gain.disconnect()
  }
}

interface Background {
  key: string
  player: LoopPlayer
  out: Output
  playing: boolean
  pauseTimer: ReturnType<typeof setTimeout> | null
}

interface PlayingFragment {
  key: string
  source: AudioBufferSourceNode
  envelope: GainNode
  out: Output
}

export class AudioEngine {
  private outputs = new Map<string, Output>()
  private devices: AudioOutput[] = []
  private reportedMissing = new Set<string>()
  private buffers = new Map<string, Promise<AudioBuffer>>()
  private readonly decoder = new OfflineAudioContext(2, 1, 48_000)

  private quiz: Quiz | null = null
  private live = false
  private wantedBackground: ResolvedBackground | null = null
  private wantedFragment: ResolvedFragment | null = null
  private background: Background | null = null
  private fragment: PlayingFragment | null = null
  private bgQueue: Promise<void> = Promise.resolve()
  private fragmentQueue: Promise<void> = Promise.resolve()

  constructor(private readonly report: Report) {}

  setDevices(devices: AudioOutput[]): void {
    this.devices = devices
    this.reportedMissing.clear()
  }

  /** Brengt de audio in lijn met quiz + show-state + koppeling. Idempotent. */
  update(quiz: Quiz | null, state: ShowState, hardware: HardwareMapping): void {
    this.quiz = quiz
    this.live = state.live
    if (!quiz) {
      this.wantedBackground = null
      this.wantedFragment = null
    } else {
      const audio = resolveAudio(quiz, state)
      this.syncOutputs(quiz, hardware, audio.channelVolumes)
      this.wantedBackground = audio.background
      this.wantedFragment = audio.fragment
      this.preload(quiz, state)
    }
    this.bgQueue = this.bgQueue.then(() => this.applyBackground()).catch(this.fail)
    this.fragmentQueue = this.fragmentQueue.then(() => this.applyFragment()).catch(this.fail)
  }

  /** Momentopname voor diagnose en e2e-tests. */
  debugSnapshot() {
    return {
      background: this.background && {
        key: this.background.key,
        playing: this.background.playing,
        gain: this.background.player.gain.gain.value
      },
      fragment: this.fragment?.key ?? null,
      outputs: [...this.outputs].map(([id, o]) => ({ id, sinkId: o.sinkId, state: o.ctx.state }))
    }
  }

  testTone(channelId: string): void {
    const out = this.outputs.get(channelId)
    if (!out) return
    void out.ctx.resume()
    const t = out.ctx.currentTime + 0.05
    const osc = out.ctx.createOscillator()
    const env = out.ctx.createGain()
    osc.frequency.value = 660
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(0.4, t + 0.02)
    env.gain.setValueAtTime(0.4, t + 0.5)
    env.gain.linearRampToValueAtTime(0, t + 0.6)
    osc.connect(env).connect(out.bus)
    osc.start(t)
    osc.stop(t + 0.65)
    osc.onended = () => env.disconnect()
  }

  /** Het aftellen (T) is voorbij: twee zachte, dalende tonen die uitklinken als een bel. */
  timerEnd(channelId: string): void {
    const out = this.outputs.get(channelId)
    if (!out) return
    void out.ctx.resume()
    const start = out.ctx.currentTime + 0.05
    for (const [i, frequency] of [880, 660].entries()) {
      const t = start + i * 0.28
      const osc = out.ctx.createOscillator()
      const env = out.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.22, t + 0.015)
      env.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
      osc.connect(env).connect(out.bus)
      osc.start(t)
      osc.stop(t + 1.25)
      osc.onended = () => env.disconnect()
    }
  }

  private fail = (err: unknown) => {
    this.report({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }

  private syncOutputs(quiz: Quiz, hardware: HardwareMapping, volumes: Record<string, number>) {
    for (const channel of quiz.channels) {
      let out = this.outputs.get(channel.id)
      if (!out) {
        out = new Output()
        this.outputs.set(channel.id, out)
      }
      out.setVolume(volumes[channel.id] ?? channel.volume)
      if (this.live) void out.ctx.resume()
      else if (!this.background && !this.fragment) void out.ctx.suspend()

      const target = hardware.audio[channel.id]
      const sinkId = resolveSinkId(target, this.devices)
      const missingKey = `${channel.id}:${target?.deviceId}`
      if (sinkId === null && this.devices.length > 0 && !this.reportedMissing.has(missingKey)) {
        this.reportedMissing.add(missingKey)
        this.report({
          type: 'error',
          message: `Uitgang "${target?.label}" voor kanaal "${channel.name}" niet gevonden; systeemstandaard gebruikt`
        })
      }
      void out.setSink(sinkId ?? '').then((ok) => {
        if (!ok)
          this.report({
            type: 'error',
            message: `Kan kanaal "${channel.name}" niet naar deze uitgang sturen`
          })
      })
    }
    for (const [id, out] of this.outputs) {
      if (quiz.channels.some((c) => c.id === id)) continue
      if (this.background?.out === out || this.fragment?.out === out) continue
      out.close()
      this.outputs.delete(id)
    }
  }

  // ── Achtergrond ─────────────────────────────────────────────────────────────

  private async applyBackground(): Promise<void> {
    const want = this.wantedBackground
    const key = want ? `${want.assetId}@${want.channelId}` : null

    if (this.background && this.background.key !== key) {
      this.fadeOutAndDispose(this.background)
      this.background = null
    }
    if (!want || !key) return

    if (!this.background) {
      const out = this.outputs.get(want.channelId)
      const asset = findAsset(this.quiz!, want.assetId)
      if (!out || !asset) return
      const player = await this.createLoop(out, asset)
      // Tijdens het laden kan de wens veranderd zijn; de volgende run in de queue pakt dat op.
      if (this.wantedBackground !== want) {
        player.dispose()
        return
      }
      this.background = { key, player, out, playing: false, pauseTimer: null }
    }
    this.setBackground(this.background, want)
  }

  private setBackground(bg: Background, want: ResolvedBackground): void {
    const { ctx } = bg.out
    const gain = bg.player.gain.gain
    const shouldPlay = want.playing
    if (shouldPlay) {
      if (bg.pauseTimer) clearTimeout(bg.pauseTimer)
      bg.pauseTimer = null
      if (!bg.playing) {
        bg.player.play()
        bg.playing = true
        gain.cancelScheduledValues(ctx.currentTime)
        gain.setValueAtTime(gain.value, ctx.currentTime)
        gain.linearRampToValueAtTime(want.gain, ctx.currentTime + BG_CROSSFADE_S)
        return
      }
      gain.cancelScheduledValues(ctx.currentTime)
      gain.setTargetAtTime(want.gain, ctx.currentTime, DUCK_TIME_CONSTANT)
      return
    }
    if (bg.playing && !bg.pauseTimer) {
      gain.cancelScheduledValues(ctx.currentTime)
      gain.setValueAtTime(gain.value, ctx.currentTime)
      gain.linearRampToValueAtTime(0, ctx.currentTime + BG_PAUSE_FADE_S)
      bg.pauseTimer = setTimeout(
        () => {
          bg.pauseTimer = null
          bg.player.pause()
          bg.playing = false
        },
        BG_PAUSE_FADE_S * 1000 + 50
      )
    }
  }

  private fadeOutAndDispose(bg: Background): void {
    if (bg.pauseTimer) clearTimeout(bg.pauseTimer)
    const { ctx } = bg.out
    const gain = bg.player.gain.gain
    gain.cancelScheduledValues(ctx.currentTime)
    gain.setValueAtTime(gain.value, ctx.currentTime)
    gain.linearRampToValueAtTime(0, ctx.currentTime + BG_CROSSFADE_S)
    setTimeout(() => bg.player.dispose(), BG_CROSSFADE_S * 1000 + 100)
  }

  private async createLoop(out: Output, asset: MediaAsset): Promise<LoopPlayer> {
    if (asset.duration !== undefined && asset.duration <= BUFFER_LOOP_MAX_S) {
      try {
        return new BufferLoop(out, await this.decode(asset))
      } catch {
        // Valt terug op streamen.
      }
    }
    return new ElementLoop(out, urlFor(asset))
  }

  // ── Fragmenten ──────────────────────────────────────────────────────────────

  private async applyFragment(): Promise<void> {
    const want = this.wantedFragment
    const key = want?.key ?? null
    if (this.fragment?.key === key) return
    if (this.fragment) {
      this.stopFragment(this.fragment)
      this.fragment = null
    }
    if (!want) return

    const out = this.outputs.get(want.fragment.channelId)
    if (!out) {
      this.report({
        type: 'error',
        key: want.key,
        message: `Geen kanaal voor ${want.fragment.label}`
      })
      return
    }
    let buffer: AudioBuffer
    try {
      buffer = await this.decode(want.asset)
    } catch (err) {
      this.report({
        type: 'error',
        key: want.key,
        message: `${want.fragment.label} kan niet worden afgespeeld (${(err as Error).message})`
      })
      return
    }
    if (this.wantedFragment?.key !== key) return

    const f = want.fragment
    const start = clamp(f.start ?? 0, 0, buffer.duration)
    const end = clamp(f.end ?? buffer.duration, start, buffer.duration)
    const duration = end - start
    const elapsed = (Date.now() - want.startedAt) / 1000
    if (elapsed > duration + 1) {
      this.report({ type: 'fragmentEnded', key: want.key })
      return
    }
    const skip = elapsed > RESUME_THRESHOLD_S ? elapsed : 0
    const length = duration - skip

    const { ctx } = out
    await ctx.resume()
    const t0 = ctx.currentTime + 0.02
    const envelope = ctx.createGain()
    const fadeIn = skip > 0 ? 0 : Math.min(f.fadeIn ?? 0, length / 2)
    const fadeOut = Math.min(f.fadeOut ?? 0, length / 2)
    envelope.gain.setValueAtTime(fadeIn > 0 ? 0 : 1, t0)
    if (fadeIn > 0) envelope.gain.linearRampToValueAtTime(1, t0 + fadeIn)
    if (fadeOut > 0) {
      envelope.gain.setValueAtTime(1, t0 + length - fadeOut)
      envelope.gain.linearRampToValueAtTime(0, t0 + length)
    }
    envelope.connect(out.bus)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(envelope)
    source.onended = () => {
      envelope.disconnect()
      if (this.fragment?.key !== want.key) return
      this.fragment = null
      this.report({ type: 'fragmentEnded', key: want.key })
    }
    source.start(t0, start + skip, length)
    this.fragment = { key: want.key, source, envelope, out }
    this.report({ type: 'fragmentStarted', key: want.key, duration })
  }

  private stopFragment(playing: PlayingFragment): void {
    const now = playing.out.ctx.currentTime
    playing.source.onended = null
    playing.envelope.gain.cancelScheduledValues(now)
    playing.envelope.gain.setTargetAtTime(0, now, 0.03)
    playing.source.stop(now + 0.15)
    setTimeout(() => playing.envelope.disconnect(), 300)
  }

  // ── Decoderen ───────────────────────────────────────────────────────────────

  private decode(asset: MediaAsset): Promise<AudioBuffer> {
    let pending = this.buffers.get(asset.id)
    if (!pending) {
      pending = fetch(urlFor(asset))
        .then((res) => {
          if (!res.ok) throw new Error(`bestand niet gevonden (${res.status})`)
          return res.arrayBuffer()
        })
        .then((data) => this.decoder.decodeAudioData(data))
      pending.catch(() => this.buffers.delete(asset.id))
      this.buffers.set(asset.id, pending)
    }
    return pending
  }

  /** Decodeert de fragmenten van de actieve en de volgende ronde vooraf, zodat ze direct starten. */
  private preload(quiz: Quiz, state: ShowState): void {
    const ref = state.activeRoundId ?? state.lastRoundId
    const index = ref ? quiz.rounds.findIndex((r) => r.id === ref) : -1
    const rounds = [findRound(quiz, state.activeRoundId), quiz.rounds[index + 1]]
    const wanted = new Set<string>()
    for (const round of rounds) {
      if (!round) continue
      for (const f of round.fragments) wanted.add(f.assetId)
      for (const item of answerItems(quiz, round))
        if (item.fragment) wanted.add(item.fragment.assetId)
    }
    for (const id of this.buffers.keys()) {
      if (!wanted.has(id) && id !== this.wantedBackground?.assetId) this.buffers.delete(id)
    }
    if (!state.live) return
    for (const id of wanted) {
      const asset = findAsset(quiz, id)
      if (asset) void this.decode(asset).catch(() => undefined)
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
