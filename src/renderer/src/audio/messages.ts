import { defineMessages } from '@shared/i18n'

/**
 * Wat de audio-engine meldt; main toont het zo als melding.
 * Zelfde vorm als de andere meldingen over iets wat ontbreekt: `{waar}: {wat} {toestand}`.
 */
export const AUDIO_MESSAGES = defineMessages(
  {
    outputMissing:
      '{channel}: uitgang “{output}” niet gevonden, het geluid gaat naar de systeemstandaard',
    cannotRoute: '{channel}: kan niet naar deze uitgang',
    noChannel: '{fragment}: kanaal ontbreekt',
    cannotPlay: '{fragment}: kan niet spelen ({error})',
    fileMissing: '{fragment}: bestand ontbreekt',
    failed: 'Geluid: {error}'
  },
  {
    en: {
      outputMissing: '{channel}: output “{output}” not found, the sound goes to the system default',
      cannotRoute: '{channel}: cannot use this output',
      noChannel: '{fragment}: channel missing',
      cannotPlay: '{fragment}: cannot play ({error})',
      fileMissing: '{fragment}: file missing',
      failed: 'Sound: {error}'
    }
  }
)
