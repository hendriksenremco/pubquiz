import type { Session } from 'electron'

const ALLOWED = new Set(['media', 'speaker-selection'])

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * Electron geeft de origin door als URL-string, mét afsluitende slash
 * (`http://localhost:5173/`), dus normaliseren voor we vergelijken.
 */
export function isOwnOrigin(requestingOrigin: string, devServerUrl?: string): boolean {
  if (requestingOrigin.startsWith('file://')) return true
  const devOrigin = devServerUrl ? originOf(devServerUrl) : null
  return devOrigin !== null && originOf(requestingOrigin) === devOrigin
}

/**
 * Zonder handlers keurt Electron alles goed. Wij staan alleen toe wat de app nodig heeft:
 * `media` (labels van audio-uitgangen via enumerateDevices) en `speaker-selection` (setSinkId),
 * en alleen voor onze eigen pagina's.
 */
export function configurePermissions(session: Session, devServerUrl?: string): void {
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    return ALLOWED.has(permission) && isOwnOrigin(requestingOrigin, devServerUrl)
  })

  // Wij vragen nooit actief om camera/microfoon e.d.
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
}
