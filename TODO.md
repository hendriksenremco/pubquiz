# TODO: QuizNote uitbrengen

Stand op 31 oktober 2026.

**Doel:** een gesigneerde QuizNote die iedereen kan downloaden via quiznote.app.

**Wie doet wat:**

- **[Remco]**: alleen Remco kan dit, want het gaat om een beslissing, een account, een betaling of echte apparatuur.
- **[Claude]**: een sessie kan dit zelf doen.

Is een punt af, vink het dan aan en zet erbij wanneer het klaar was. Kom je iets nieuws tegen, zet het erbij.

## 0. Doorlopend werk van de agent

Deze punten gaan vóór de rest. De agent op de thuisserver pakt ze op; zie `agent/`.

- [ ] **[Claude] Screenshots in elke pull request.** Een job in `.github/workflows/ci.yml`, op macOS:
  - draai de e2e-tests op `master` en op de branch van de pull request;
  - vergelijk de screenshots in `test-results/` per bestandsnaam, met ImageMagick (`compare`);
  - maak van elk veranderd scherm een plaatje met de verschillen in amber (`#ffa53d`) gemarkeerd, naast het oude scherm;
  - zet de plaatjes op een aparte branch `pr-screenshots` (map `pr-<nummer>/`) en zet ze in één commentaar op de pull request, dat bij elke push wordt bijgewerkt;
  - geen verschillen: dan zegt het commentaar dat.
- [ ] **[Claude] Plug-ins generieker maken.** Nu heeft elke plug-in eigen code in main, de renderer en de show.
  - Breng eerst in kaart wat MagicHome en Afstandsbediening gemeen hebben, en wat een volgende plug-in (Spotify, YouTube) nodig zou hebben.
  - Schrijf een voorstel in `PLUGINS.md`: één interface voor instellingen, quizgegevens (quiz ⊕ ronde ⊕ slide), knoppen in de show en status.
  - Open een issue met het label `vraag` met het voorstel en jouw advies. Bouw pas na het antwoord, in kleine stappen.
- [ ] **[Claude] De interface eenvoudiger.** De app is complex geworden.
  - Loop de schermen één voor één door: startscherm, editor, inspector, Quiz-instellingen, show voorbereiden, de show zelf.
  - Per scherm één pull request die het rustiger maakt: minder tegelijk in beeld, duidelijkere rangorde, dezelfde woorden overal. Volg de ontwerpregels in CLAUDE.md.
  - Hooguit één UI-pull request tegelijk open. Haal geen functies weg zonder het eerst te vragen.
- **Ideeën uit onderzoek.** Een wekelijkse taak onderzoekt concurrenten en zet voorstellen als issue met het label `idee`. Zet Remco er het label `doen` op, dan bouwt de agent het.

## 1. Beslissingen

De rest van de lijst hangt hiervan af.

- [ ] **[Remco] Prijs en licentie.** Wordt de app gratis, betaald, of eerst een gratis bèta?
  - Dit bepaalt of de app licenties of betalingen nodig heeft. Nu zit er niets van in.
  - Het bepaalt ook welke voorwaarden er op de site komen.
- [ ] **[Remco] Wie brengt de app uit:** Remco als privépersoon, of een (nieuwe) onderneming? De app staat los van Guts & Gusto.
  - Dit bepaalt met welk Apple-team de app gesigneerd wordt.
  - Het bepaalt ook welke naam in de app staat en welke gegevens op de site komen.
- [ ] **[Remco] Waar de download komt te staan.**
  - Advies: GitHub Releases, in een aparte openbare repo. De broncode-repo hoeft dan niet openbaar te worden.
  - Diezelfde plek kan de app later gebruiken om updates op te halen.
  - Nog niet bevestigd.
- [ ] **[Remco] Engels.** De app is alleen Nederlands, maar de eerste doelgroep is ook Engelstalig; de naam is daarop gekozen.
  - Kies: eerst een Nederlandse release, of pas uitbrengen met een Engelse versie. Zie hoofdstuk 5.
- [ ] **[Remco] De oude werknaam in bestandsnamen.** Quizzen heten `<naam>.pubquiz` en staan in `Documenten/Pubquizzen`. Dat ziet de gebruiker.
  - Vóór de eerste release is omzetten goedkoop, bijvoorbeeld naar `.quiznote` en `Documenten/QuizNote`.
  - Na de release moet de app beide namen blijven lezen.
  - Interne namen (`window.pubquiz`, `PUBQUIZ_*`) mogen blijven zoals ze zijn.
- [ ] **[Remco] Analytics in de app.** PostHog EU is al gekozen voor de site en de app.
  - Moet de app ook iets meten? En zo ja: wat, en vraag je eerst toestemming (opt-in)?
  - Daarna is een privacyverklaring nodig.
- [ ] **[Remco] Foutrapporten.** Wil je meldingen van crashes bij gebruikers, bijvoorbeeld met Sentry of PostHog? Zonder iets hoor je alleen van problemen als iemand mailt.
- [ ] **[Remco] Welke Macs.**
  - Alleen Apple Silicon, of ook Intel? Voor Intel is een universal build nodig, of twee dmg's.
  - Welke macOS-versie heb je minimaal nodig?

## 2. Signeren en notariseren

**Nu:** in `electron-builder.yml` staan `identity: null` en `notarize: false`. macOS blokkeert de app daardoor bij de eerste start. De gebruiker moet dan naar Systeeminstellingen › Privacy en beveiliging en daar op "Open toch" klikken.

- [ ] **[Remco] Certificaat en notarisatie-sleutel.**
  - Maak een "Developer ID Application"-certificaat in het juiste Apple-team en zet het in de sleutelhanger. Op 25 oktober stond er geen op deze Mac.
  - Maak voor het notariseren een App Store Connect API-sleutel of een app-specifiek wachtwoord aan.
- [ ] **[Claude] electron-builder instellen.**
  - Zet `identity` en `hardenedRuntime: true`, en vul `notarize` in.
  - De gegevens komen uit omgevingsvariabelen, nooit uit de repo.
  - Loop `build/entitlements.mac.plist` na. Nu staan daarin `allow-jit`, `allow-unsigned-executable-memory` en `allow-dyld-environment-variables`.
- [ ] **[Claude] Lokaal netwerk.** Voeg `extendInfo` toe aan `electron-builder.yml`:
  - `NSLocalNetworkUsageDescription`, want de app praat met de MagicHome-controller, serveert de afstandsbediening en zoekt AirPlay-apparaten met `dns-sd`;
  - waarschijnlijk ook `NSBonjourServices` met `_airplay._tcp`.

  Test daarna op een gesigneerde build op macOS 15 of nieuwer:
  - Vraagt macOS om toegang tot het lokale netwerk, en werkt alles na "Sta toe"?
  - Komt de firewallvraag als je de afstandsbediening aanzet, en werkt die daarna?

- [ ] **[Claude] AI-koppeling in de gesigneerde app.**
  - Werkt `ELECTRON_RUN_AS_NODE=1 <app-binary> …/mcp.js` met hardened runtime, en met `mcp.js` in `app.asar`?
  - Koppel Claude Desktop en laat de AI een quiz maken.
  - De Electron-fuse `RunAsNode` moet aan blijven.
- [ ] **[Claude] Controleren.**
  - Draai `codesign --verify --deep --strict` en `spctl -a -vv` op de app.
  - Open de dmg op een andere Mac, of onder een schone gebruiker.

## 3. Updates en releases

- [ ] **[Claude] Automatische updates** met `electron-updater` en GitHub Releases.
  - Dit vraagt een gesigneerde app, en een `zip`-target naast de dmg.
  - Installeer nooit tijdens een show: pas na "Stop show" of bij het afsluiten.
- [ ] **[Claude] Versies.** Een changelog bij elke release, en een venster "Over QuizNote" met het versienummer.
- [ ] **[Claude] Release-script.** Een script of een GitHub Actions-workflow op een macOS-runner die bouwt, signeert, notariseert en de release aanmaakt.
  - Geheimen gaan in de repository-secrets.
  - `pnpm build:mac` maakt ook de rondleiding (`tour:build`), die met de app wordt meegeleverd.

## 4. Kwaliteit vóór de eerste release

- [ ] **[Claude] Alle e2e-tests groen.** Twee tests in `e2e/home.spec.ts` falen ook op master: één altijd, de andere soms. Repareer ze.
- [ ] **[Remco en Claude] Een volledige proefavond met echte apparatuur:**
  - een beamer en een tv;
  - twee audio-uitgangen en een presenter-clicker;
  - een muziekronde en een antwoordenronde, met "Ronde opnieuw";
  - de show hervatten nadat de app geforceerd is afgesloten.
- [ ] **[Remco] Echte apparatuur voor wat alleen met nep-apparaten getest is:**
  - een AirPlay-scherm (Apple TV);
  - videogeluid via de speakers van een tv (HDMI);
  - de afstandsbediening op een echte iPhone, iPad en Android-telefoon.

  Claude mag niet met de echte AirPlay-apparaten op het netwerk van Remco verbinden.

- [ ] **[Remco] MagicHome op een andere locatie.** Test met een ander wifi-netwerk, dus een ander IP-adres. Test ook op wifi met client-isolatie: daar faalt de verbinding zonder melding.
- [ ] **[Claude] De afstandsbediening in dev-modus.** Probeer de proxy naar Vite één keer met de hand. Nu is die alleen met unit-tests getest.
- [ ] **[Claude] Veiligheid van de afstandsbediening nalopen.**
  - Het verkeer op het lokale netwerk gaat zonder https, en de sleutel staat in de URL.
  - Wie de QR-code ziet of het netwerk afluistert, kan dus de show bedienen. Is dat aanvaardbaar op een café-wifi?
  - In elk geval moeten "Nieuwe code" en de plug-in uitzetten makkelijk te vinden zijn.
- [ ] **[Claude] README.md bijwerken met wat er nu in de app zit:**
  - antwoordenrondes en afbeeldingenrondes;
  - afdrukken en videogeluid;
  - de plug-ins Licht en Afstandsbediening;
  - Ronde opnieuw (toets R).

## 5. Engelse app

Alleen als Remco daarvoor kiest; zie hoofdstuk 1.

- [ ] **[Claude] De teksten vertalen.**
  - Haal de teksten uit de componenten, met vue-i18n of een klein eigen woordenboek, in het Nederlands en het Engels. De app kiest de taal van macOS.
  - Vergeet deze teksten niet:
    - de pdf's (formulieren en vragenkaarten);
    - de rondleiding;
    - de beschrijvingen van de MCP-tools;
    - de pagina op de telefoon.

## 6. Site (`~/Documents/pubquiz-site`)

- [ ] **[Remco] Pushen.** De lokale `develop` loopt voor op GitHub: op 31 oktober 12 commits, met onder meer de merkbestanden, de naam QuizNote, Firebase en de opruimronde. Push alleen als Remco het zegt.
- [ ] **[Claude] Downloadknop.**
  - Vul `downloadUrl` in `nuxt.config.ts` in (of `NUXT_PUBLIC_DOWNLOAD_URL`) zodra de dmg ergens staat.
  - Is het veld leeg, dan toont de site een melding in plaats van de knop.
- [ ] **[Claude] De uitleg over "Open toch" bij de download weghalen** zodra de app genotariseerd is.
- [ ] **[Claude, eerst vragen] Teksten op de site bijwerken.**
  - De CLAUDE.md van de site zet "bediening vanaf de telefoon" onder "Niet beloven", maar die zit nu in de app (plug-in Afstandsbediening). Het licht (MagicHome) ook.
  - Vraag Remco of ze op de site mogen. Allebei zijn ze nog niet met echte telefoons getest, en het licht nog niet op andere locaties.
- [ ] **[Claude] Contact op de site.** Een duidelijke manier om contact op te nemen, in beeld (niet weggestopt), in het Nederlands en het Engels.
  - Begin eenvoudig: een mailadres (remco@quiznote.app; support@ bestaat niet) in de footer en bij de download, en een korte "Vragen of ideeën?"-regel.
  - Een formulier alleen als het zonder eigen server en zonder cookies kan; anders eerst vragen.
- [x] **[Claude] Privacyverklaring op de site** (31 oktober 2026): `/privacy` en `/en/privacy`, gelinkt in de footer.
- [ ] **[Claude] Screenshots vernieuwen.** De bediening tijdens de show is in PR #12 veranderd, en de site gebruikt `tour-*.png` uit de e2e-tests.
- [ ] **[Remco] Teksten voor de download:** een privacyverklaring en contactgegevens (support@quiznote.app), en de voorwaarden of licentie. Nodig zodra er een download of analytics is.
- [ ] **[Claude] PostHog EU op de site**, als Remco dat bevestigt. Stel het in zonder cookies, zodat er geen cookiebanner nodig is.
- [ ] **[Remco] quiznote.nl doorsturen naar quiznote.app.** quiznote.nl staat nog op de parkeerpagina van TransIP (A-record 37.97.254.27).
- **Deployen:** dat doet Remco met `pnpm deploy:site`, of hij geeft eerst toestemming.

## 7. Mail en domein

- [ ] **[Remco] DMARC strenger zetten, vanaf 8 november 2026.**
  - Stuur eerst een testmail en controleer dat SPF, DKIM en DMARC alle drie op PASS staan.
  - Zet daarna DMARC van quiznote.app van `p=none` naar `p=quarantine`.
  - Controleren kan met `dig +short TXT _dmarc.quiznote.app`.
  - De herinnering staat ook in `~/Documents/pubquiz-site/HERINNERINGEN.md`. Haal hem op beide plekken weg als het gedaan is.
- [ ] **[Remco] Nagaan of "Mail verzenden als"** voor hallo@ en support@quiznote.app werkt in Gmail.

## 8. Merk en juridisch

- [ ] **[Remco] Merkonderzoek voor QuizNote** vóór de lancering, voor zover bekend nog niet gedaan.
  - Zoek in EUIPO/TMview, BOIP, UKIPO en USPTO, in de klassen 9 en 42.
  - Laat het merk eventueel inschrijven via een merkengemachtigde.
- [ ] **[Remco] Geen "Keynote"** in openbare teksten, ook niet in de slogan: het is een merk van Apple.

## Later, na de eerste release

Dit blokkeert de eerste release niet.

- **YouTube en Spotify, als plug-ins.**
  - YouTube-geluid gaat niet via de eigen audio-uitgangen, en de speler vraagt een localhost-origin (anders Error 153).
  - Spotify vraagt Premium en speelt via de Spotify-app.
- **Een quizbestand importeren**, voor AI's zonder lokale MCP zoals ChatGPT.
- **Niet beloofd en niet gebouwd:**
  - Windows of Linux;
  - een scorebord of tussenstand;
  - teams die antwoorden met hun telefoon.
