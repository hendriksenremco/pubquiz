import type { Component } from 'vue'
import type { PluginId } from '@shared/plugins'
import MagicHomeSettings from './magichome/MagicHomeSettings.vue'
import LiveLight from './magichome/LiveLight.vue'
import QuizLight from './magichome/QuizLight.vue'
import RoundLight from './magichome/RoundLight.vue'
import SlideLight from './magichome/SlideLight.vue'
import StartLight from './magichome/StartLight.vue'
import RemoteButton from './remote/RemoteButton.vue'
import RemoteQr from './remote/RemoteQr.vue'
import ScoreTable from './scores/ScoreTable.vue'

/** Plekken in de app waar een plug-in iets kan tonen; zie PluginSlot.vue. */
export type PluginSlotName =
  | 'quizSettings'
  | 'roundSettings'
  | 'slideInspector'
  | 'startSheet'
  /** In de werkbalk van de show. */
  | 'liveControls'
  /** Bij Instellingen, onder de plug-in zelf, zolang hij aan staat. */
  | 'settings'

export interface RendererPlugin {
  id: PluginId
  slots: Partial<Record<PluginSlotName, Component>>
}

export const RENDERER_PLUGINS: RendererPlugin[] = [
  {
    id: 'magichome',
    slots: {
      quizSettings: QuizLight,
      roundSettings: RoundLight,
      slideInspector: SlideLight,
      startSheet: StartLight,
      liveControls: LiveLight,
      settings: MagicHomeSettings
    }
  },
  {
    id: 'remote',
    slots: { liveControls: RemoteButton, settings: RemoteQr }
  },
  {
    id: 'scores',
    slots: { quizSettings: ScoreTable }
  }
]
