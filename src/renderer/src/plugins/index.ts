import type { Component } from 'vue'
import type { PluginId } from '@shared/plugins'
import MagicHomeSettings from './magichome/MagicHomeSettings.vue'
import QuizLight from './magichome/QuizLight.vue'
import RoundLight from './magichome/RoundLight.vue'
import SlideLight from './magichome/SlideLight.vue'
import StartLight from './magichome/StartLight.vue'

/** Plekken in de app waar een plug-in iets kan tonen; zie PluginSlot.vue. */
export type PluginSlotName =
  | 'quizSettings'
  | 'roundSettings'
  | 'slideInspector'
  | 'startSheet'
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
      settings: MagicHomeSettings
    }
  }
]
