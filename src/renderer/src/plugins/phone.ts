import type { Component } from 'vue'
import type { Locale } from '@shared/i18n'
import type { ActionInput, PluginActionName, PluginId, PluginStatus } from '@shared/plugins'
import PhoneLight from './magichome/PhoneLight.vue'

/**
 * Wat een plug-in op de telefoon toont (plug-in Afstandsbediening), onder de knoppen van de show.
 * Alleen voor plug-ins met `remoteActions`: main weigert andere acties vanaf de telefoon. Een eigen
 * lijst, niet RENDERER_PLUGINS: zo laadt de telefoon niet alle onderdelen van de app.
 *
 * Het onderdeel krijgt `PhoneProps`: de status, of de show loopt, de taal en `act` voor een actie.
 * Op de Mac staan dezelfde knoppen in de werkbalk (`liveControls` in index.ts).
 */
export const PHONE_PLUGINS: { [Id in PluginId]?: Component } = {
  magichome: PhoneLight
}

export interface PhoneProps<Id extends PluginId> {
  status: PluginStatus<Id>
  /** Buiten de show, of zonder verbinding: de knoppen doen niets. */
  disabled: boolean
  /** De taal van de Mac (`RemoteView.locale`). */
  locale: Locale
  act: <Name extends PluginActionName<Id>>(name: Name, input: ActionInput<Id, Name>) => void
}
