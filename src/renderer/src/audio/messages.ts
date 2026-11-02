import { defineMessages } from '@shared/i18n'

/** Wat de audio-engine meldt; main zet er "Audio:" voor (`audioError` in src/main/messages.ts). */
export const AUDIO_MESSAGES = defineMessages(
  {
    outputMissing:
      'Uitgang "{output}" voor kanaal "{channel}" niet gevonden; systeemstandaard gebruikt',
    cannotRoute: 'Kan kanaal "{channel}" niet naar deze uitgang sturen',
    noChannel: 'Geen kanaal voor {fragment}',
    cannotPlay: '{fragment} kan niet worden afgespeeld ({error})',
    fileMissing: 'bestand niet gevonden ({status})'
  },
  {
    en: {
      outputMissing:
        'Output "{output}" for channel "{channel}" not found; using the system default',
      cannotRoute: 'Cannot send channel "{channel}" to this output',
      noChannel: 'No channel for {fragment}',
      cannotPlay: '{fragment} cannot be played ({error})',
      fileMissing: 'file not found ({status})'
    }
  }
)
