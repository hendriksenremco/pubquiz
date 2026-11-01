import type { PluginId, PluginStatuses } from '@shared/plugins'

/** Zo vaak gaat de status van een plug-in hooguit naar de vensters en de telefoons. */
export const STATUS_INTERVAL_MS = 250

interface Entry {
  json: string
  value: unknown
  /** Wanneer de status het laatst wegging. */
  sentAt: number
  /** Er staat een nieuwere status klaar die nog niet weg is. */
  timer: ReturnType<typeof setTimeout> | null
}

/**
 * De laatste status van elke plug-in. Bewaart een status meteen (voor `get`), maar stuurt hem
 * alleen als hij echt anders is, en hooguit eens per STATUS_INTERVAL_MS: wat er tussendoor komt,
 * gaat daarna in één keer weg. Zo kan een plug-in vaak publiceren zonder de vensters, de telefoons
 * of de andere plug-ins te overspoelen.
 */
export class StatusBoard {
  private entries = new Map<PluginId, Entry>()

  constructor(
    /** Een nieuwe status; null = de plug-in staat uit. */
    private readonly send: (id: PluginId, status: unknown) => void,
    private readonly now: () => number = Date.now
  ) {}

  publish(id: PluginId, status: unknown): void {
    const json = JSON.stringify(status)
    const entry = this.entries.get(id)
    if (entry?.json === json) return
    const next: Entry = entry ?? { json, value: status, sentAt: -Infinity, timer: null }
    next.json = json
    next.value = status
    this.entries.set(id, next)
    if (next.timer) return
    const wait = next.sentAt + STATUS_INTERVAL_MS - this.now()
    if (wait <= 0) this.flush(id, next)
    else next.timer = setTimeout(() => this.flush(id, next), wait)
  }

  get(id: PluginId): unknown {
    return this.entries.get(id)?.value ?? null
  }

  all(): PluginStatuses {
    const all: Record<string, unknown> = {}
    for (const [id, entry] of this.entries) all[id] = entry.value
    return all as PluginStatuses
  }

  /** De plug-in staat uit: zijn status verdwijnt, ook wat nog klaarstond. */
  clear(id: PluginId): void {
    const entry = this.entries.get(id)
    if (!entry) return
    if (entry.timer) clearTimeout(entry.timer)
    this.entries.delete(id)
    this.send(id, null)
  }

  private flush(id: PluginId, entry: Entry): void {
    entry.timer = null
    entry.sentAt = this.now()
    this.send(id, entry.value)
  }
}
