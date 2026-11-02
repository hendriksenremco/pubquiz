/**
 * De link vanaf de site (issue #99): `quiznote://ronde?url=https://quiznote.app/…`. Hij opent de
 * app en laat hem het rondebestand ophalen. Alleen bestanden van de site zelf; andere adressen
 * weigert de app, zodat een willekeurige webpagina geen rondes in een quiz kan zetten.
 */

export const ROUND_LINK_SCHEME = 'quiznote'
/** Waar rondebestanden vandaan mogen komen. */
export const ROUND_LINK_ORIGIN = 'https://quiznote.app'

/** Is dit een link van QuizNote (welke dan ook)? */
export function isRoundLink(url: string): boolean {
  return url.toLowerCase().startsWith(`${ROUND_LINK_SCHEME}:`)
}

/**
 * Het adres van het rondebestand uit een `quiznote://ronde?url=…`-link, of `null` als de link niet
 * klopt of het bestand niet van `origin` komt. Geen gebruikersnaam of wachtwoord in het adres.
 */
export function roundLinkSource(link: string, origin = ROUND_LINK_ORIGIN): string | null {
  const parsed = parseUrl(link)
  if (!parsed || parsed.protocol !== `${ROUND_LINK_SCHEME}:`) return null
  if (parsed.host !== 'ronde' || (parsed.pathname !== '' && parsed.pathname !== '/')) return null
  const source = parseUrl(parsed.searchParams.get('url') ?? '')
  return source && isAllowedSource(source, origin) ? source.href : null
}

/** Komt dit adres van `origin`? Ook voor elke doorverwijzing bij het ophalen. */
export function isAllowedSource(url: URL | string, origin = ROUND_LINK_ORIGIN): boolean {
  const parsed = typeof url === 'string' ? parseUrl(url) : url
  if (!parsed || parsed.username || parsed.password) return false
  return parsed.origin === parseUrl(origin)?.origin
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}
