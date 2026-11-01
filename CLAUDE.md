# QuizNote

QuizNote is een macOS-app om een pubquiz in elkaar te klikken en live te draaien. Eén laptop stuurt de hele avond aan:

- video-loops en slides op meerdere schermen;
- achtergrondmuziek en geluidsfragmenten op meerdere audio-uitgangen;
- formulieren om af te drukken.

De app is van Remco Hendriksen (remco@quiznote.app) en staat los van zijn bedrijf Guts & Gusto.

Wat er nog moet gebeuren, staat als **issues** op GitHub (`gh issue list`). Hoe de labels werken, staat in `TODO.md`.

## Stand op 31 oktober 2026

- **Versie:** 0.1.0, alleen voor macOS en alleen in het Nederlands.
- **Release:** 0.1.0 staat op GitHub Releases, gesigneerd en genotariseerd (`.github/workflows/release.yml`, bij een tag `v*`). Lokaal maakt `pnpm build:mac` een ongesigneerde dmg.
- **Site:** live op https://quiznote.app (Firebase Hosting), met een downloadknop naar de nieuwste release. De site heeft een eigen repo: `~/Documents/pubquiz-site`, met een eigen CLAUDE.md.
- **Laatst samengevoegd (30 oktober):** #12 en #13. Kijk met `gh pr list --state all` wat er sindsdien is gebeurd.
  - #12: Ronde opnieuw, dezelfde knoppen op de Mac en de telefoon, en het licht in de werkbalk van de show.
  - #13: vier vragenkaarten per A4, met snijlijnen.
- **README.md** is sinds 1 november 2026 Engels en voor ontwikkelaars: wat de app is, installeren, opbouw, bijdragen en releases. Houd hem bij als dat verandert.

## Werkafspraken

**Taal**

- Remco schrijft Nederlands. Antwoord in het Nederlands en houd het kort: alleen wat hij nu nodig heeft.
- Teksten in de app en commentaar in de code zijn Nederlands. Commitberichten zijn Engels.

**Git**

- Maak na elke afgeronde wijziging een eigen commit, nadat typecheck en tests slagen. Spaar geen werk op voor één grote commit.
- Werk op een feature-branch vanaf `master` en push zelf.
- Open aan het eind zelf een pull request naar `master`. Kijk eerst met `gh pr list --state all` of er al een is.
- Samenvoegen doe je zelf, zodra alle CI-checks groen zijn. Haalt de pull request functies weg of verandert hij iets groots aan de interface, laat hem dan voor Remco staan.
- Branches heten `master` en `develop`, nooit `main`.
- Staat er in de checkout ander werk, bijvoorbeeld van een andere sessie of de branch van een open pull request? Gebruik dan een git worktree in plaats van van branch te wisselen.

**Ontwerp**

- De interface is rustig, naar het minimalisme van Apple.
- Elk onderdeel krijgt een plek in deze rangorde: altijd in beeld, in de inspector rechts, of bij Quiz-instellingen.
- Rood is alleen voor live. Geen gloed en geen vervaagde achtergronden.
- Acties staan direct in beeld, als knop met icoon en tekst. Geen ⋯-menu's en geen knoppen die pas bij hover verschijnen. Een popover is alleen voor een keuze, niet om acties te verstoppen.
- **Mac en telefoon hebben dezelfde knoppen voor de show, met dezelfde namen.** Komt er een nieuwe knop voor de show, dan komt die op allebei.
- Logo en iconen zijn vlakke, sterke vormen die ook in één kleur werken. Gloed, verloop of schaduw mogen nooit de basis zijn.
- Bij ontwerpwerk wil Remco binnen ongeveer tien minuten iets zien: een paar schetsen of een screenshot. Gebruik lange workflows met veel agents alleen als hij erom vraagt.

**Functies en diensten**

- Optionele extra's worden een plug-in die standaard uit staat (zie Plug-ins).
- Raad bij diensten (hosting, mail, analytics) de beste oplossing aan, wel een die goedkoop begint. Een lage prijs is geen reden om een mindere oplossing aan te raden.
- Een productie-deploy van de site, of iets anders dat openbaar wordt, doet Remco zelf. Of hij geeft er eerst toestemming voor.

## Niet doen

- **Start nooit `pnpm dev` of `pnpm start` om iets te bekijken.** Remco heeft de app vaak zelf open, met `fixtures/demo.pubquiz`. Bekijk wijzigingen onzichtbaar, met de e2e-helpers en screenshots.
- **`fixtures/demo.pubquiz` is echt werk van Remco**, met zijn eigen video's en rondes.
  - Nooit overschrijven, opruimen of meecommitten.
  - `quiz.json` staat in git, maar hij bewerkt hem zelf. Gebruik er dus nooit `git checkout` of `git restore` op.
  - Tests werken op een kopie: `copyFixture()` in `e2e/helpers.ts`.
- **Verbind nooit met de echte AirPlay-schermen** op zijn netwerk, zoals BEAMER-KANTINE, BRUIN-CAFE, LEFTY-LOOSY en Het-Bruine-Cafe. AirPlay-tests gebruiken `PUBQUIZ_FAKE_AIRPLAY`.
- **De MagicHome-controller op kantoor** (`192.168.14.133`) zien collega's ook.
  - Zonder te vragen mag je alleen de statusvraag `81 8A 8B 96` sturen.
  - Tests gebruiken altijd de nep-controller in `e2e/fake-magichome.ts`.
- Gebruik "Keynote" niet in openbare teksten: het is een merk van Apple. Gebruik "Quizmeister" nergens meer.
- Draai prettier alleen op de bestanden die je wijzigt, niet op hele mappen. Een paar bestanden op master zijn niet opgemaakt, zoals `BackdropPicker.vue` en `FragmentInspector.vue`, en dat geeft ruis in je diff.

## Commando's

```sh
pnpm install
pnpm typecheck                                  # tsc (main) en vue-tsc (renderer)
pnpm test                                       # vitest; de tests staan naast de bron (*.test.ts)
env -u ELECTRON_RUN_AS_NODE pnpm test:e2e       # alles: fixtures, build en Playwright
# één e2e-test, zonder de fixtures opnieuw te maken:
env -u ELECTRON_RUN_AS_NODE npx electron-vite build && env -u ELECTRON_RUN_AS_NODE npx playwright test e2e/show.spec.ts
npx prettier --check <bestanden>
pnpm build:mac                                  # ongesigneerde dmg in dist/
pnpm install:mac                                # zet de app in /Applications; alleen als Remco erom vraagt
```

- De shell van de VS Code-extensie zet `ELECTRON_RUN_AS_NODE=1`, en dan start Electron als kale Node. Zet daarom altijd `env -u ELECTRON_RUN_AS_NODE` voor Electron, Playwright en electron-builder.
- Er is geen ESLint-configuratie; prettier bepaalt de stijl.
- e2e-tests draaien onzichtbaar en zonder geluid.
  - `launch()` in `e2e/helpers.ts` zet `PUBQUIZ_HEADLESS` en `PUBQUIZ_MUTE`, en geeft elke test een eigen `PUBQUIZ_USER_DATA` en `PUBQUIZ_LIBRARY`.
  - Vensters zie je alleen met `PUBQUIZ_HEADED=1`. Gebruik dat alleen als Remco erom vraagt.
  - Screenshots komen in `test-results/`. Playwright leegt die map bij elke run.
- `make-demo.mjs` schrijft `fixtures/demo.pubquiz/quiz.json` alleen als die nog niet bestaat, of met `--force`. Gebruik `--force` nooit.

## Opbouw

```
src/shared/    datamodel (zod), resolve, state machines (autoplay, answers), IPC-types; geen Electron
src/main/      Electron main: show-state, vensters, quizbestanden, instellingen, plug-ins, MCP-brug
src/preload/   getypeerde brug: window.pubquiz (PubquizApi in src/shared/ipc.ts)
src/renderer/  Vue 3 en Pinia; index.html voor de app, remote.html voor de telefoon
src/mcp/       MCP-server, wordt out/main/mcp.js
e2e/           Playwright-tests van de gebouwde app
scripts/       make-demo, make-tour (de rondleiding), install-app
fixtures/      demo.pubquiz (werk van Remco!) en rondleiding.pubquiz (gemaakt door pnpm tour)
```

**Quizbestanden**

- Een quiz is een map `<naam>.pubquiz` met `quiz.json` en `media/`. Nieuwe quizzen komen in `Documenten/Pubquizzen`.
- Het formaat staat in `src/shared/quiz-schema.ts`, met `SCHEMA_VERSION` in `version.ts`. Hoog je die op, schrijf dan een migratie in `migrate.ts`.

**Standaard ⊕ ronde ⊕ slide**

- Wat er live op een scherm staat of klinkt, wordt altijd uitgerekend uit de quiz en de show-state, in `src/shared/resolve.ts`.
- Een ronde bewaart alleen wat afwijkt van de standaard. Na "Einde ronde" valt alles vanzelf terug.
- Nieuwe instellingen volgen dit model. Het licht doet dat ook: slide ⊕ ronde ⊕ quiz.

**Show-state**

- `ShowController` in `src/main/show.ts` is de bron van waarheid. Hij verwerkt elke `ShowCommand` uit `src/shared/ipc.ts`.
- Main stuurt de state naar alle vensters, en elk venster rekent zelf uit wat het toont of speelt.
- Na een crash zet de app de velden in `RESTORABLE` terug, uit `recovery.json`.

**Vensters**

- Alle vensters laden dezelfde renderer; de hash bepaalt de rol (`src/renderer/src/main.ts`):
  - `operator`: de app zelf;
  - `screen`: één frameloos venster per display;
  - `audio`: verborgen; elk kanaal heeft een eigen `AudioContext` met `setSinkId`;
  - `identify`;
  - `print`: maakt de pdf's.
- Media laden via het protocol `pq-media://`, dat Range-requests ondersteunt (`src/main/media-protocol.ts`).

**Instellingen per Mac**

- Ze staan in `<userData>/settings.json`: hoe schermen en uitgangen op naam gekoppeld zijn, de plug-ins en de recente quizzen.
- `adoptSettings` neemt instellingen over uit de oude mappen `Quizmeister` en `Pubquiz`.

**Bediening tijdens de show**

- `src/renderer/src/lib/live-controls.ts` deelt de bediening tussen de werkbalk, de sneltoetsen en `ShowLive.vue`.
- `stepTarget` bepaalt waar ← → doorheen gaan: de antwoorden, de fragmenten of de slides.

**Rondesoorten**

- Het zijn presets in `createRound` in `src/shared/factory.ts`: normal, music, pictures, break en answers.
- Er is geen veld voor de soort. Een antwoordenronde is een ronde met `answersFor`.

## Plug-ins

Plug-ins zijn optionele extra's. Je zet ze per Mac aan of uit bij Instellingen (⌘, of de knop rechtsboven op het startscherm). Standaard staan ze uit.

**Waar ze staan**

- `src/shared/plugins.ts`: de lijst met plug-ins.
- `src/main/plugins.ts`: het deel in main. `FACTORIES` maakt elke plug-in, met een `PluginHost`.
- `src/renderer/src/plugins/index.ts`: koppelt componenten aan `PluginSlot`-plekken in de app.
- Quizgegevens van een plug-in staan onder `plugins.<id>` op de quiz, een ronde of een slide. Ze blijven staan als de plug-in uit gaat.

**MagicHome-licht** (`magichome`)

- Kies een kleur of effect per quiz, ronde of slide, voor een MagicHome-ledcontroller.
- Lees eerst `MAGICHOME.md`. De belangrijkste lessen van de echte controller:
  - houd één verbinding open;
  - gebruik commando `41`, niet `31`;
  - maak niet te veel verbindingen achter elkaar, anders hangt de controller tot je de stroom eraf haalt.

**Afstandsbediening** (`remote`)

- Main serveert een webpagina op het lokale netwerk (`src/main/remote.ts`). Dat gebeurt op poort 7849, of op een vrije poort als die bezet is.
- De QR-code bevat het adres met een geheime sleutel (`?key=`).
- De pagina staat in `src/renderer/remote.html` en `src/renderer/src/remote/`.
- De telefoon krijgt alleen een `RemoteView` uit `src/shared/remote.ts`, via server-sent events. Hij stuurt `RemoteAction`s terug.
- Tests gebruiken `PUBQUIZ_REMOTE_HOST=127.0.0.1` en `PUBQUIZ_REMOTE_PORT=0`.

Nieuwe optionele koppelingen, zoals Spotify of YouTube, volgen hetzelfde patroon.

## AI-koppeling (MCP)

- `src/mcp/server.ts` wordt `out/main/mcp.js`.
  - Een AI-app start de server met `ELECTRON_RUN_AS_NODE=1 <app-binary> …/mcp.js`.
  - De server praat via een Unix-socket (`<userData>/mcp.sock`) met de app; de app voert de opdrachten uit in `src/main/agent.ts`.
  - Draait de app niet, dan start de server hem.
- De vorm waarin een AI rondes aanlevert, staat in `src/shared/draft.ts`.
- Claude Desktop koppel je met één knop: Nieuwe quiz → Met je AI….
- Voor tests zijn er `QUIZNOTE_SOCKET`, `QUIZNOTE_NO_LAUNCH` en `QUIZNOTE_CLAUDE_CONFIG`.
- De MCP-server werkt alleen als `ELECTRON_RUN_AS_NODE` werkt. Zet bij het signeren de Electron-fuse `RunAsNode` dus niet uit, tenzij je ook de manier verandert waarop de server start.

## Naam en huisstijl

- **Naam:** QuizNote, met een hoofdletter N, sinds 25 oktober 2026. De `appId` is `app.quiznote`.
- **Vorige naam:** Quizmeister. Die viel af omdat quizmeister.nl een Nederlands pubquizbedrijf is.
- **Oude werknaam:** "Pubquiz". Die staat nog in de code:
  - de repo en `name` in `package.json`;
  - de extensie `.pubquiz` en de map `Documenten/Pubquizzen`;
  - `window.pubquiz` en `PubquizApi`;
  - de omgevingsvariabelen `PUBQUIZ_*`.

  Of dat vóór de release verandert, is een open vraag (issue #43). "pubquiz" blijft gewoon het woord voor een quiz.

- **Huisstijl:** nachtblauw met één amber accent (`#ffa53d`), koppen in Bricolage Grotesque. De tokens staan in `src/renderer/src/styles/base.css`.
- **Logo en icoon:** het icoon is de Q uit het woordmerk, in amber op nachtblauw. De bestanden worden gemaakt in de site-repo met `brand/quiznote/bron/maak.py`. De app-iconen staan in `build/` en `resources/`.

## Wat met echte apparaten getest is

- **Met echte apparatuur:** de MagicHome-controller (model A1, firmware 3) op kantoor.
- **Alleen met nep-apparaten:**
  - AirPlay-schermen;
  - videogeluid via de speakers van een tv (HDMI);
  - de afstandsbediening op een echte telefoon of tablet. In de e2e-test is de "telefoon" een verborgen Electron-venster.
- Ga er niet van uit dat deze onderdelen in een café werken voordat Remco ze daar heeft geprobeerd.

## Agent en CI

- **CI:** elke pull request naar `master` draait op macOS in GitHub Actions (`.github/workflows/ci.yml`): typecheck, unit-tests, e2e-tests en een ongesigneerde dmg.
- **Screenshots** (zodra de jobs in `ci.yml` staan): de CI draait de e2e-tests ook op `master` en vergelijkt de screenshots (`scripts/screenshot-diff.sh`). De verschillen, in amber, komen als één commentaar op de pull request; de plaatjes staan op de branch `pr-screenshots`. Kleine verschillen tellen niet; bijstellen met `FUZZ` en `MIN_PIXELS`.
- **Agent:** op de thuisserver werkt doorlopend een Claude-sessie zelf aan de issues met het label `claude`: is een run klaar, dan begint de volgende. Hoe en wat staat in `agent/`. Zijn pull requests hebben het label `agent`, zijn vragen aan Remco zijn issues met het label `vraag`.

## Meer

- `TODO.md`: hoe de issues en hun labels werken.
- `MAGICHOME.md`: de controller, het protocol en wat we over het netwerk hebben geleerd.
- `PLUGINS.md`: plan om plug-ins generieker te maken (goedgekeurd op 1 november 2026, issue #31).
- `README.md`: in het Engels, voor ontwikkelaars. De screenshots staan in `docs/`.
- `~/Documents/pubquiz-site`: de site. Nuxt 4, branches `master` en `develop`. Pushen naar `develop` mag; een push naar `master` zet de site live (zie de CLAUDE.md van de site).
- Het geheugen van Claude voor dit project, op de Mac van Remco: `~/.claude/projects/-Users-remcohendriksen-Documents-pubquiz/memory/`.
