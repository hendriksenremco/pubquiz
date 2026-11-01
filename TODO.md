# Wat er nog moet gebeuren

Sinds 1 november 2026 staan de taken als **issues** op GitHub, niet meer in dit bestand: https://github.com/hendriksenremco/pubquiz/issues

## Labels

**Wie**

- `claude`: Claude of de agent op de thuisserver doet dit.
- `remco`: alleen Remco kan dit (een beslissing, een account, een betaling of echte apparatuur).
- Allebei: ze doen het samen.
- `eerst-vragen`: Claude doet het, maar vraagt Remco eerst.

**Volgorde**

- `prio-1`, `prio-2`, `prio-3`: in die volgorde; binnen een prioriteit het oudste issue eerst.
- `later`: pas na de eerste release.

**Onderwerp:** `doorlopend`, `beslissing`, `release`, `kwaliteit`, `engels`, `site`, `beheer`, `juridisch`.

**Werkstroom**

- `vraag`: de agent wacht op een antwoord van Remco.
- `doen`: Remco wil dat dit gebouwd wordt; gaat voor de rest.
- `idee`: een voorstel uit het wekelijkse onderzoek. Pas met `doen` wordt het gebouwd.
- `agent`: een pull request van de agent.

## Zo werkt het

- Begin je aan een issue, zet er dan een opmerking bij. Een pull request die het afrondt, krijgt `Closes #<nummer>` in de beschrijving.
- Kom je iets nieuws tegen, maak er een issue van met de juiste labels. Geen geheimen: de repo is openbaar.
- Alleen voor Remco en wacht een taak op een beslissing? Zet het in het issue, niet hier.

## Niet beloofd en niet gebouwd

Noem dit niet als "binnenkort", tenzij Remco het zegt:

- Windows of Linux;
- een scorebord of tussenstand;
- teams die antwoorden met hun telefoon.
