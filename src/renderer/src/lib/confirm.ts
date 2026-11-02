import { shallowRef } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  /** Tekst op de knop die het doet, bv. "Verwijder". */
  confirm: string
  /** Niet terug te draaien: de focus staat op Annuleer. */
  danger?: boolean
  /** Over de show die live is (stoppen, afsluiten): rode knop. Rood is alleen voor live. */
  live?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

/** De vraag die nu openstaat; ConfirmHost toont hem. */
export const pendingConfirm = shallowRef<Pending | null>(null)

/** Vraagt om bevestiging in een venster in de stijl van de app (in plaats van window.confirm). */
export function ask(options: ConfirmOptions): Promise<boolean> {
  pendingConfirm.value?.resolve(false)
  return new Promise((resolve) => {
    pendingConfirm.value = { ...options, resolve }
  })
}
