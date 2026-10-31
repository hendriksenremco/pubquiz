import type { AboutPanelOptionsOptions } from 'electron'

/**
 * Het venster "Over QuizNote" (de standaard van macOS, via `role: 'about'` in het menu).
 * `version` blijft leeg: anders zet macOS het buildnummer er nog eens tussen haakjes achter.
 */
export function aboutPanelOptions(name: string, version: string): AboutPanelOptionsOptions {
  return {
    applicationName: name,
    applicationVersion: version,
    version: '',
    credits: 'Pubquizen in elkaar klikken en live draaien.\nquiznote.app'
  }
}
