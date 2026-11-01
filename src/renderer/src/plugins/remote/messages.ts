import { defineMessages } from '@shared/i18n'

/**
 * De teksten van de afstandsbediening op de Mac: de knop Telefoon in de werkbalk van de show en
 * de QR-code. "Telefoon" heet op de telefoon zelf ook zo (`remote/messages.ts`).
 */
export const REMOTE_QR_MESSAGES = defineMessages(
  {
    phone: 'Telefoon',
    phoneTitle: 'Bedien de show met een telefoon of tablet',
    qrLabel: 'QR-code voor de afstandsbediening',
    scan: 'Scan met de camera van een telefoon of tablet op hetzelfde wifi-netwerk.',
    noDevices: 'Nog niets verbonden',
    oneDevice: '1 apparaat verbonden',
    devices: '{count} apparaten verbonden',
    newCode: 'Nieuwe code',
    newCodeTitle: 'Telefoons met de oude code kunnen dan niets meer',
    noNetwork:
      'Geen netwerk gevonden. Verbind deze Mac met het wifi-netwerk waar je telefoon op zit.'
  },
  {
    en: {
      phone: 'Phone',
      phoneTitle: 'Control the show with a phone or tablet',
      qrLabel: 'QR code for the remote control',
      scan: 'Scan with the camera of a phone or tablet on the same Wi-Fi network.',
      noDevices: 'Nothing connected yet',
      oneDevice: '1 device connected',
      devices: '{count} devices connected',
      newCode: 'New code',
      newCodeTitle: 'Phones with the old code can no longer do anything',
      noNetwork: 'No network found. Connect this Mac to the Wi-Fi network your phone is on.'
    }
  }
)
