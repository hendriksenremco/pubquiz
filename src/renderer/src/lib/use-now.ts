import { onScopeDispose, ref, watchEffect, type Ref } from 'vue'

/** Tikkende klok voor countdowns en voortgangsbalken; tikt alleen zolang `active` waar is. */
export function useNow(intervalMs: number, active: () => boolean = () => true): Ref<number> {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null
  const stop = () => {
    if (timer) clearInterval(timer)
    timer = null
  }
  watchEffect(() => {
    if (active() && !timer) {
      now.value = Date.now()
      timer = setInterval(() => (now.value = Date.now()), intervalMs)
    } else if (!active()) {
      stop()
    }
  })
  onScopeDispose(stop)
  return now
}
