import { createServer, type AddressInfo, type Socket } from 'net'

const hex = (bytes: ArrayLike<number>) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ')
const withChecksum = (bytes: number[]) => [...bytes, bytes.reduce((s, b) => s + b, 0) & 0xff]

/** Lengte van elk bericht, naar zijn eerste byte. */
const LENGTHS: Record<number, number> = { 0x81: 4, 0x71: 4, 0x31: 9, 0x41: 9, 0x61: 6 }

export const QUERY = '81 8a 8b 96'

/**
 * Nep-controller op localhost die zich gedraagt als de echte (getest op 2026-10-29): hij verwerkt
 * berichten pas na een paar milliseconden, en sluit de afzender de verbinding meteen na het
 * sturen, dan vervalt wat nog niet verwerkt was. Hij beantwoordt de statusvraag met wat hij nu
 * toont; begint aan, in vast groen. Nooit de echte controller in tests.
 */
export async function fakeController() {
  // 81 a1 | aan | modus 00 61 (vaste kleur) | snelheid | r g b | ww | firmware | cw | fa
  const state = [0x81, 0xa1, 0x23, 0x00, 0x61, 0x64, 0x00, 0xff, 0x00, 0x00, 0x03, 0x00, 0xfa]
  /** Verwerkte opdrachten (zonder statusvragen), in volgorde. */
  const log: string[] = []
  const stats = { connections: 0 }
  const sockets = new Set<Socket>()

  function handle(m: number[], reply: (bytes: number[]) => void) {
    if (m[0] === 0x81) return reply(withChecksum(state))
    log.push(hex(m))
    if (m[0] === 0x71) {
      state[2] = m[1]
      reply(withChecksum([0x0f, 0x71, m[1]]))
    } else if (m[0] === 0x31 || m[0] === 0x41) {
      state.splice(3, 2, 0x00, m[0] === 0x31 ? 0x61 : 0x62)
      state.splice(6, 3, m[1], m[2], m[3])
    } else if (m[0] === 0x61) {
      state.splice(3, 3, m[1], m[2], m[3])
    }
  }

  const server = createServer((socket) => {
    stats.connections++
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    let pending: number[] = []
    let timer: ReturnType<typeof setTimeout> | null = null
    const process = () => {
      timer = null
      while (pending.length) {
        const length = LENGTHS[pending[0]]
        if (!length) {
          pending.shift()
          continue
        }
        if (pending.length < length) break
        handle(pending.splice(0, length), (bytes) => socket.write(Uint8Array.from(bytes)))
      }
    }
    socket.on('data', (chunk) => {
      pending.push(...chunk)
      timer ??= setTimeout(process, 20)
    })
    socket.on('end', () => {
      if (timer) clearTimeout(timer)
      pending = []
      socket.destroy()
    })
    socket.on('error', () => {})
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    host: `127.0.0.1:${port}`,
    log,
    stats,
    /** Wat de controller nu toont, als hex. */
    shows: () => hex(state.slice(2, 9)),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        // De app houdt zijn verbinding een tijdje open; die zou de server anders openhouden.
        for (const socket of sockets) socket.destroy()
      })
  }
}

export const command = {
  on: '71 23 0f a3',
  off: '71 24 0f a4',
  /** Kleur zonder opslaan. */
  color: (r: number, g: number, b: number) => hex(withChecksum([0x41, r, g, b, 0, 0, 0xf0, 0x0f])),
  effect: (id: number, speed: number) =>
    hex(withChecksum([0x61, (id + 99) >> 8, (id + 99) & 0xff, speed, 0x0f]))
}
