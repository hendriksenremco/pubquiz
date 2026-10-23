import type { PubquizApi } from '../shared/ipc'

declare global {
  interface Window {
    pubquiz: PubquizApi
  }
}
