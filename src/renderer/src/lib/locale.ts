import { localeFromQuery, type Locale } from '@shared/i18n'

/**
 * De taal van dit venster. Main zet hem als `?locale=` in het adres (`loadRoute` in
 * src/main/windows.ts).
 */
export const locale: Locale = localeFromQuery(location.search, navigator.languages)
