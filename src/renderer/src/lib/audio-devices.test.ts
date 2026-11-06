import { describe, expect, it } from 'vitest'
import { screenSoundOutput, screenSoundRoute, type AudioOutput } from './audio-devices'

const outputs: AudioOutput[] = [
  { deviceId: 'default', label: 'Systeemstandaard (MacBook Pro-luidsprekers)' },
  { deviceId: 'mbp', label: 'MacBook Pro-luidsprekers (Built-in)' },
  { deviceId: 'lg', label: 'LG TV SSCR2 (HDMI)' },
  { deviceId: 'usb', label: 'USB Audio CODEC (USB)' }
]
const lgTv = { kind: 'display', displayId: 3, label: 'LG TV SSCR2' } as const

describe('screenSoundOutput', () => {
  it('kiest automatisch de speakers van het display', () => {
    expect(screenSoundOutput(undefined, lgTv, outputs)?.deviceId).toBe('lg')
  })

  it('geeft null als het display geen speakers heeft', () => {
    const dell = { kind: 'display', displayId: 4, label: 'DELL U2719D' } as const
    expect(screenSoundOutput(undefined, dell, outputs)).toBeNull()
  })

  it('gebruikt de systeemstandaard voor een venster op de laptop', () => {
    expect(screenSoundOutput(undefined, { kind: 'window' }, outputs)?.deviceId).toBe('default')
  })

  it('volgt een eigen keuze, ook op naam als de id veranderd is', () => {
    expect(screenSoundOutput({ deviceId: 'usb', label: 'x' }, lgTv, outputs)?.deviceId).toBe('usb')
    expect(
      screenSoundOutput({ deviceId: 'oud', label: 'USB Audio CODEC (USB)' }, lgTv, outputs)
        ?.deviceId
    ).toBe('usb')
    expect(screenSoundOutput({ deviceId: 'default', label: '' }, lgTv, outputs)?.deviceId).toBe(
      'default'
    )
    expect(screenSoundOutput({ deviceId: 'weg', label: 'Weg' }, lgTv, outputs)).toBeNull()
  })
})

describe('screenSoundRoute', () => {
  it('noemt de speakers van het display als die er zijn', () => {
    expect(screenSoundRoute(undefined, lgTv, outputs)).toEqual({
      kind: 'screen',
      name: 'LG TV SSCR2'
    })
  })

  it('zegt systeemstandaard als het display geen speakers heeft', () => {
    const dell = { kind: 'display', displayId: 4, label: 'DELL U2720Q' } as const
    expect(screenSoundRoute(undefined, dell, outputs)).toEqual({ kind: 'default' })
  })

  it('noemt een gekozen uitgang, en de systeemstandaard als die weg is', () => {
    expect(screenSoundRoute({ deviceId: 'usb', label: 'x' }, lgTv, outputs)).toEqual({
      kind: 'output',
      label: 'USB Audio CODEC (USB)'
    })
    expect(screenSoundRoute({ deviceId: 'weg', label: 'Weg' }, lgTv, outputs)).toEqual({
      kind: 'default'
    })
    expect(screenSoundRoute({ deviceId: 'default', label: '' }, lgTv, outputs)).toEqual({
      kind: 'default'
    })
  })
})
