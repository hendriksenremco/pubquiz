/**
 * Talen in de app (issue #53): een klein eigen woordenboek, zonder Electron of Vue, zodat main,
 * de vensters, de telefoon en de MCP-server hetzelfde gebruiken.
 *
 * Elk onderdeel heeft zijn eigen teksten, met `defineMessages`: het Nederlands is de bron, en elke
 * andere taal moet dezelfde sleutels hebben (anders faalt de typecheck). In een tekst staat een
 * waarde als `{naam}`.
 *
 * De app kiest de taal van macOS (`pickLocale`), maar alleen uit `ACTIVE_LOCALES`. Engels komt
 * daar pas bij als alles vertaald is; tot dan is de app overal Nederlands.
 */

export const LOCALES = ['nl', 'en'] as const
export type Locale = (typeof LOCALES)[number]

/** Talen die de app al kiest. Een half vertaalde app is erger dan een Nederlandse. */
export const ACTIVE_LOCALES: readonly Locale[] = ['nl']

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

/**
 * De taal uit de voorkeuren van macOS of de browser (bv. `['de-DE', 'nl-NL']`): de eerste die de
 * app kent. Kent hij er geen, dan Engels, en anders Nederlands.
 */
export function pickLocale(
  preferred: readonly string[],
  active: readonly Locale[] = ACTIVE_LOCALES
): Locale {
  for (const tag of preferred) {
    const language = tag.split(/[-_]/)[0].toLowerCase()
    if (isLocale(language) && active.includes(language)) return language
  }
  return active.includes('en') ? 'en' : 'nl'
}

export type Params = Record<string, string | number>

/** Vult `{naam}` in; een waarde die ontbreekt, blijft zichtbaar staan, zodat je hem opmerkt. */
export function format(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  )
}

/** De namen tussen `{}` in een tekst, voor de test dat elke vertaling dezelfde heeft. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

export type Translate<Key extends string> = (key: Key, params?: Params) => string

export interface MessageBook<Key extends string> {
  /** Alle teksten per taal; voor tests. */
  readonly messages: { readonly [L in Locale]: Readonly<Record<Key, string>> }
  /** De teksten in één taal. */
  in(locale: Locale): Translate<Key>
}

/**
 * De teksten van één onderdeel. `nl` is de bron; de andere talen moeten precies dezelfde
 * sleutels hebben.
 */
export function defineMessages<const NL extends Record<string, string>>(
  nl: NL,
  others: { [L in Exclude<Locale, 'nl'>]: { [K in keyof NL]: string } }
): MessageBook<keyof NL & string> {
  type Key = keyof NL & string
  const messages = { nl, ...others } as { [L in Locale]: Record<Key, string> }
  return {
    messages,
    in: (locale) => (key, params) => format(messages[locale][key] ?? messages.nl[key], params)
  }
}
