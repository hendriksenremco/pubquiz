# QuizNote

Desktop-app (macOS) om pubquizen in elkaar te klikken en live te draaien:

- **Schermen**: elk extern scherm toont de hele avond een video-loop of afbeelding. Een ronde kan dat tijdelijk vervangen; na de ronde valt alles vanzelf terug naar de standaard. Crossfade zonder zwart frame.
- **Slides**: titel-, vraag- en nummerslides als laag over de video, door te klikken met ← → of een presenter-clicker.
- **Achtergrondmuziek**: loopt de hele quiz door. Per ronde: doorspelen, zachter, pauzeren of andere muziek. Tijdens een fragment gaat hij automatisch zachter.
- **Geluidsfragmenten**: handmatig (knoppen/toetsen 1–9) of als automatische reeks met pauze, aftellen en fragmentnummer op het scherm.
- **Meerdere uitgangen**: elk audiokanaal (bv. “Zaal”, “Fragmenten”) gaat naar een eigen apparaat; elk scherm-slot naar een eigen display.
- **Videogeluid**: zet bij een video *Geluid van de video* aan; het geluid speelt via de speakers van het scherm zelf (HDMI/DisplayPort, automatisch herkend op naam) of via een uitgang die je bij Show kiest. Het zakt mee met de achtergrondmuziek zolang er een fragment speelt.

## Gebruik

De app start op het **overzicht**: je laatst geopende quiz staat groot bovenaan (direct naar *Bewerken* of *Naar show*), daaronder je andere recente quizzen en *Nieuwe quiz*. Met het huisje linksboven ga je vanuit een quiz terug naar het overzicht.

1. **Nieuwe quiz**: je kiest alleen een naam; de app maakt zelf de map `Documenten/Pubquizzen/<naam>.pubquiz` met `quiz.json` en `media/`. Geïmporteerde bestanden worden daarin gekopieerd, dus de map is in z’n geheel mee te nemen (of via *Exporteer als zip*). Met **Op basis van…** neem je schermen, kanalen, achtergrondmuziek en beeld over van een eerdere quiz, en desgewenst de rondes en fragmenten.
2. **Bewerken**: stel bij *Quiz-instellingen* de schermen, audiokanalen en achtergrondmuziek in. Voeg rondes toe (gewone ronde, muziekronde, pauze) en kies per ronde wat er afwijkt. Alles wordt automatisch opgeslagen; ⌘Z maakt ongedaan.
3. **Show**: koppel elk scherm aan een display (*Identificeer displays* laat zien welke welke is) en elk kanaal aan een audio-uitgang (*Testtoon*). De app onthoudt dit per naam voor de volgende keer. Daarna **Start show**.

Sneltoetsen tijdens de show: `←/→` slide · `Enter` volgende ronde · `E` einde ronde · `1–9` fragment · `Spatie` stop fragment · `A` reeks start/pauze · `S` volgende in reeks · `B` alles zwart · `M` achtergrond aan/uit.

Crasht de app tijdens een show, dan biedt hij bij de volgende start aan om te hervatten (zelfde ronde, gespeelde fragmenten, volumes).

### Een quiz maken met je AI

QuizNote heeft een MCP-server, zodat je je eigen AI-assistent kunt vragen: *“Maak een pubquiz in QuizNote met zes rondes over Italië.”* De quiz verschijnt dan in de app, met vragen, antwoorden en een antwoordenronde. Koppelen doe je één keer via **Nieuwe quiz → Met je AI…**: voor Claude Desktop met één knop, voor andere AI-apps staan de instellingen erbij om te kopiëren.

- De AI kan quizzen opzoeken (`list_quizzes`, `get_quiz`), maken (`create_quiz`, eventueel op basis van een eerdere quiz) en per ronde aanpassen (`add_rounds`, `replace_round`, `remove_round`).
- Liedjes en foto's moeten als bestanden op de Mac staan; de AI kan ze niet zelf maken of downloaden. Noem een map, dan gebruikt hij die.
- Tijdens een show past de AI de lopende quiz nooit aan, en een nieuwe quiz wacht dan op het dashboard.

**Tips**
- Video's voor loops: H.264/HEVC met `faststart` en zonder audiospoor loopen het soepelst.
- macOS zet de systeemuitgang vaak op HDMI zodra je een beamer aansluit: kies de uitgangen in de app expliciet.
- Wil je testen zonder beamer, kies dan bij een scherm “Venster op deze laptop”.

## Ontwikkelen

```sh
pnpm install
pnpm demo          # genereert fixtures/demo.pubquiz (testvideo's en -tonen via ffmpeg)
pnpm tour          # genereert fixtures/rondleiding.pubquiz: een quiz die alle functies laat zien en uitlegt
pnpm dev           # app met hot reload
pnpm test          # unit-tests (vitest)
pnpm test:e2e      # bouwt en test de echte app met Playwright: onzichtbaar, gedempt, eigen instellingenmap
                   # (PUBQUIZ_HEADED=1 pnpm test:e2e om de vensters wel te zien)
pnpm typecheck
pnpm build:mac     # ongesigneerde .dmg in dist/
pnpm install:mac   # bouwt de app en zet hem direct in /Applications (sluit de app eerst)
```

Start je vanuit een omgeving die `ELECTRON_RUN_AS_NODE=1` zet (sommige editor-extensies), haal die variabele dan eerst weg: `env -u ELECTRON_RUN_AS_NODE pnpm dev`.

**AI-koppeling (MCP).** `src/mcp/server.ts` wordt `out/main/mcp.js`: een MCP-server die een AI-app start met `ELECTRON_RUN_AS_NODE=1 <app-binary> …/out/main/mcp.js` (of gewone Node). Hij geeft elke opdracht via een Unix-socket (`<userData>/mcp.sock`, alleen voor de gebruiker) door aan de app, die hem in `src/main/agent.ts` uitvoert; draait de app niet, dan start de server hem. De vorm waarin een AI rondes aanlevert staat in `src/shared/draft.ts`. Voor tests: `QUIZNOTE_SOCKET` (andere socket), `QUIZNOTE_NO_LAUNCH` (app niet starten) en `QUIZNOTE_CLAUDE_CONFIG` (ander instellingenbestand van Claude Desktop).

### Opbouw

```
src/shared/    datamodel (zod), resolve (standaard ⊕ ronde-overrides), autoplay-state machine, IPC-types
src/main/      show-state (bron van waarheid), vensters per display, media-protocol met Range,
               quizbestanden, instellingen en herstel
src/preload/   getypeerde brug naar de renderer
src/renderer/  één Vue-app met vier rollen (hash-route): operator, screen, audio (verborgen), identify
```

- De live-toestand is altijd `resolve(quiz, showState)`: de standaard plus de afwijkingen van de actieve ronde. Main publiceert de show-state, elk venster rekent zelf uit wat het moet tonen of spelen.
- Audio draait in een verborgen venster, zodat herladen van de bediening de muziek niet onderbreekt. Per kanaal is er een eigen `AudioContext` die met `setSinkId` naar het gekoppelde apparaat speelt. Fragmenten worden vooraf gedecodeerd en starten direct.
- Schermen zijn frameloze vensters ter grootte van het display, zonder native fullscreen. Wordt een display losgekoppeld, dan verdwijnt het venster meteen, zodat het nooit over de bediening heen komt.

## Later

YouTube (als schermcontent, via de IFrame API) en Spotify (bediening van de Spotify-app via de Web API, Premium vereist) staan gepland als aparte fase. Beide spelen hun geluid af buiten de eigen audio-uitgangen van de app om.
