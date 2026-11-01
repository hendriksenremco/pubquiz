import { computed, ref } from 'vue'
import type { Light } from '@shared/light'
import type { MagicHomeResult } from '@shared/magichome'
import { configOf, PLUGIN_OFF } from '@shared/plugins'
import { useSession } from '../../stores/session'

const api = window.pubquiz

/** Het adres van de controller, voor deze Mac; bij Instellingen en bij Show starten te wijzigen. */
export function useControllerHost() {
  const session = useSession()
  const setting = computed(() => session.plugins.magichome ?? PLUGIN_OFF)
  const host = computed(() => configOf(session.plugins, 'magichome').host)
  function setHost(value: string) {
    if (value === host.value) return
    session.setPlugin('magichome', {
      ...setting.value,
      config: { ...setting.value.config, host: value }
    })
  }
  return { host, setHost }
}

/**
 * Voorbeeld op de lamp: wat je kiest, laat de controller meteen zien. Standaard uit (de lamp kan
 * in een gedeelde ruimte hangen) en aan voor de rest van de sessie zodra je hem aanzet.
 */
export const previewOn = ref(false)

/** Laat een licht zien; null = klaar, de controller gaat terug naar hoe hij was. */
export async function preview(light: Light | null): Promise<MagicHomeResult> {
  const result = await api.pluginAct('magichome', 'preview', light ? { ...light } : null)
  return result ?? { ok: false, error: 'De plug-in staat uit' }
}
