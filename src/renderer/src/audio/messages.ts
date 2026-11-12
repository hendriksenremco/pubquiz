import { defineMessages } from '@shared/i18n'

/** Wat de audio-engine meldt; main zet er "Audio:" voor (`audioError` in src/main/messages.ts). */
export const AUDIO_MESSAGES = defineMessages(
  {
    outputMissing:
      '{channel}: uitgang “{output}” niet gevonden, het geluid gaat naar de systeemstandaard',
    cannotRoute: 'Kan kanaal “{channel}” niet naar deze uitgang sturen',
    noChannel: 'Geen kanaal voor {fragment}',
    cannotPlay: '{fragment} kan niet worden afgespeeld ({error})',
    fileMissing: 'bestand ontbreekt ({status})'
  },
  {
    en: {
      outputMissing: '{channel}: output “{output}” not found, the sound goes to the system default',
      cannotRoute: 'Cannot send channel “{channel}” to this output',
      noChannel: 'No channel for {fragment}',
      cannotPlay: '{fragment} cannot be played ({error})',
      fileMissing: 'file missing ({status})'
    }
  }
)
