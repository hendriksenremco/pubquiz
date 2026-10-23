import { spawn, type ChildProcess } from 'child_process'
import { isMac, parseBrowseLine, parseTxt, type AirPlayDevice } from '@shared/airplay'

const RESOLVE_TIMEOUT_MS = 3000

/**
 * Zoekt AirPlay-ontvangers via Bonjour met `dns-sd` (standaard op macOS).
 * Verbinden kan een app niet zelf; dat doet macOS (Beeldschermen of Geluid). Deze lijst helpt
 * de host kiezen en laat de app het scherm herkennen zodra macOS het aanbiedt.
 */
export class AirPlayBrowser {
  private browser: ChildProcess | null = null
  private devices = new Map<string, AirPlayDevice>()

  constructor(private readonly onChange: (devices: AirPlayDevice[]) => void) {}

  get list(): AirPlayDevice[] {
    return [...this.devices.values()].filter((d) => !isMac(d.model))
  }

  start(): void {
    // Voor tests: vaste lijst in plaats van het echte netwerk.
    const fake = process.env['PUBQUIZ_FAKE_AIRPLAY']
    if (fake) {
      for (const d of JSON.parse(fake) as AirPlayDevice[]) this.devices.set(d.name, d)
      this.onChange(this.list)
      return
    }
    if (this.browser || process.platform !== 'darwin') return

    const proc = spawn('dns-sd', ['-B', '_airplay._tcp', 'local.'])
    this.browser = proc
    let buffer = ''
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) this.handle(line)
    })
    proc.on('exit', () => {
      if (this.browser === proc) this.browser = null
    })
    proc.on('error', () => {
      if (this.browser === proc) this.browser = null
    })
  }

  stop(): void {
    this.browser?.kill()
    this.browser = null
  }

  private handle(line: string): void {
    const parsed = parseBrowseLine(line)
    if (!parsed) return
    if (parsed.event === 'remove') {
      if (this.devices.delete(parsed.name)) this.onChange(this.list)
      return
    }
    if (this.devices.has(parsed.name)) return
    void resolveDevice(parsed.name).then((device) => {
      this.devices.set(device.name, device)
      this.onChange(this.list)
    })
  }
}

/** Haalt het TXT-record op met `dns-sd -L` (model en mogelijkheden). */
function resolveDevice(name: string): Promise<AirPlayDevice> {
  return new Promise((resolve) => {
    const proc = spawn('dns-sd', ['-L', name, '_airplay._tcp', 'local.'])
    let output = ''
    const finish = () => {
      clearTimeout(timer)
      proc.kill()
      resolve(parseTxt(name, output))
    }
    const timer = setTimeout(finish, RESOLVE_TIMEOUT_MS)
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      output += chunk
      if (/features=/.test(output)) finish()
    })
    proc.on('error', finish)
  })
}
