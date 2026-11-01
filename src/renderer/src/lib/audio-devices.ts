import { sameDisplayName } from '@shared/airplay'
import { defineMessages, type Locale } from '@shared/i18n'
import type { AudioTarget, ScreenTarget } from '@shared/types'

/** Namen van uitgangen die Chromium zelf niet geeft. */
export const AUDIO_DEVICE_MESSAGES = defineMessages(
  {
    systemDefault: 'Systeemstandaard',
    systemDefaultNamed: 'Systeemstandaard ({name})',
    output: 'Uitgang {number}'
  },
  {
    en: {
      systemDefault: 'System default',
      systemDefaultNamed: 'System default ({name})',
      output: 'Output {number}'
    }
  }
)

export interface AudioOutput {
  deviceId: string
  label: string
}

/**
 * Altijd met "Systeemstandaard" vooraan, ook als Chromium (zonder media-permissie) geen namen geeft.
 * De taal is alleen voor de namen in beeld; een uitgang zonder naam heet "Uitgang 1".
 */
export async function listAudioOutputs(locale: Locale = 'nl'): Promise<AudioOutput[]> {
  const t = AUDIO_DEVICE_MESSAGES.in(locale)
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === 'audiooutput'
  )
  const systemDefault = devices
    .find((d) => d.deviceId === 'default')
    ?.label.replace(/^Default - /, '')
  const named = devices
    .filter((d) => d.deviceId !== '' && d.deviceId !== 'default')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || t('output', { number: i + 1 }) }))
  return [
    {
      deviceId: 'default',
      label: systemDefault ? t('systemDefaultNamed', { name: systemDefault }) : t('systemDefault')
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
