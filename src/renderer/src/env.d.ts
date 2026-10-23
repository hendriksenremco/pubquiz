/// <reference types="vite/client" />

// Web Audio-uitbreidingen die (nog) niet in lib.dom staan.
interface AudioContextOptions {
  sinkId?: string
}

interface AudioContext {
  readonly sinkId: string
  setSinkId(sinkId: string): Promise<void>
}
