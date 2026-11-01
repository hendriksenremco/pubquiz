import { app } from 'electron'
import { isLocale, pickLocale, type Locale } from '@shared/i18n'

/**
 * De taal van de app: die van macOS, uit de talen die al af zijn (`ACTIVE_LOCALES`).
 * PUBQUIZ_LOCALE (`nl` of `en`) dwingt een taal af, ook een die nog niet af is: om een vertaling
 * te bekijken en voor tests.
 */
export function appLocale(): Locale {
  const forced = process.env['PUBQUIZ_LOCALE']
  if (isLocale(forced)) return forced
  return pickLocale(app.getPreferredSystemLanguages())
}
