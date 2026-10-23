import { sameDisplayName } from '@shared/airplay'
import type { AudioTarget, ScreenTarget } from '@shared/types'

export interface AudioOutput {
  deviceId: string
  label: string
}

/** Altijd met "Systeemstandaard" vooraan, ook als Chromium (zonder media-permissie) geen namen geeft. */
export async function listAudioOutputs(): Promise<AudioOutput[]> {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'audiooutput'
  )
  const systemDefault = devices
    .find((d) => d.deviceId === 'default')
    ?.label.replace(/^Default - /, '')
  const named = devices
    .filter((d) => d.deviceId !== '' && d.deviceId !== 'default')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Uitgang ${i + 1}` }))
  return [
    {
      deviceId: 'default',
      label: systemDefault ? `Systeemstandaard (${systemDefault})` : 'Systeemstandaard'
    },
    ...named
  ]
}

/**
 * Vertaalt een opgeslagen uitgang naar een sinkId voor deze sessie.
 * deviceIds verschillen tussen dev en build, dus bij een gemiste id zoeken we op naam.
 * '' = systeemstandaard; null = uitgang niet gevonden.
 */
export function resolveSinkId(
  target: AudioTarget | undefined,
  outputs: AudioOutput[]
): string | null {
  if (!target || target.deviceId === 'default' || target.deviceId === '') return ''
  if (outputs.some((o) => o.deviceId === target.deviceId)) return target.deviceId
  return outputs.find((o) => o.label === target.label)?.deviceId ?? null
}

/**
 * Uitgang voor het videogeluid van een scherm. Zonder eigen keuze zijn dat de speakers van het
 * display zelf: macOS noemt een HDMI-/DisplayPort-uitgang naar het scherm, bv. "LG TV (HDMI)".
 * null = niet gevonden.
 */
export function screenSoundOutput(
  choice: AudioTarget | undefined,
  target: ScreenTarget | undefined,
  outputs: AudioOutput[]
): AudioOutput | null {
  if (choice) {
    const sinkId = resolveSinkId(choice, outputs)
    if (sinkId === null) return null
    return outputs.find((o) => o.deviceId === (sinkId || 'default')) ?? null
  }
  if (target?.kind !== 'display') return outputs.find((o) => o.deviceId === 'default') ?? null
  return (
    outputs.find((o) => o.deviceId !== 'default' && sameDisplayName(o.label, target.label)) ?? null
  )
}
