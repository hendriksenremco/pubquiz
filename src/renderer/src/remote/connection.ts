import { ref, shallowRef } from 'vue'
import type { RemoteAction, RemoteResult, RemoteView } from '@shared/remote'

/** `denied`: de sleutel klopt niet (meer), bv. na "Nieuwe code" op de Mac. */
export type LinkState = 'connecting' | 'open' | 'lost' | 'denied'

const RETRY_MS = 2000
const TOAST_MS = 4000

/** De sleutel uit de QR-code; hij blijft in de URL, zodat een bladwijzer ook werkt. */
const key = new URLSearchParams(location.search).get('key') ?? ''
const withKey = (path: string) => `${path}?key=${encodeURIComponent(key)}`

export const view = shallowRef<RemoteView | null>(null)
export const link = ref<LinkState>(key ? 'connecting' : 'denied')
export const toast = ref('')

let source: EventSource | null = null
let retry: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

/** Volgt de show via server-sent events; valt de verbinding weg, dan opnieuw. */
export function connect(): void {
  if (!key || source) return
  if (retry) clearTimeout(retry)
  retry = null
  const events = new EventSource(withKey('/api/events'))
  source = events
  events.onmessage = (event) => {
    view.value = JSON.parse(event.data)
    link.value = 'open'
  }
  events.onerror = () => {
    if (link.value === 'open') link.value = 'lost'
    // Verbinding weg: de browser probeert het zelf opnieuw. Gesloten: de Mac weigerde, of de
    // browser gaf het op; even vragen waarom.
    if (events.readyState === EventSource.CLOSED) void diagnose()
  }
}

async function diagnose(): Promise<void> {
  source?.close()
  source = null
  const status = await fetch(withKey('/api/check'), { cache: 'no-store' }).then(
    (res) => res.status,
    () => 0
  )
  if (status === 401) {
    link.value = 'denied'
    return
  }
  link.value = 'lost'
  retry = setTimeout(connect, RETRY_MS)
}

// Telefoon weer aan: niet wachten op de volgende poging.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !source && link.value === 'lost') connect()
})

export async function send(action: RemoteAction): Promise<void> {
  navigator.vibrate?.(8)
  let result: RemoteResult
  try {
    const res = await fetch(withKey('/api/action'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action)
    })
    if (res.status === 401) link.value = 'denied'
    result = await res.json()
  } catch {
    result = { ok: false, error: 'De Mac is niet bereikbaar' }
  }
  if (!result.ok) showToast(result.error)
}

function showToast(message: string): void {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), TOAST_MS)
}
