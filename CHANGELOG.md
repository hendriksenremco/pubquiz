# Wat er nieuw is in QuizNote

Bij elke release komt hier bovenaan een kop met het versienummer uit `package.json` en de datum.
Een unit-test (`src/main/about.test.ts`) controleert dat de bovenste kop bij die versie hoort.

## 0.2.0 (8 november 2026)

- QuizNote spreekt Engels: de app volgt de taal van je Mac (Nederlands of Engels), en de rondleiding is er in beide talen.
- Aftellen op de schermen: druk op T, of op de knop Aftellen op de Mac of je telefoon. De tijd stel je in per quiz of per ronde.
- Rondes importeren uit een rondebestand (`.quiznoteronde`): met Importeer ronde… in de editor, door het bestand op de editor te slepen of door erop te dubbelklikken in Finder.
- Nieuwe plug-in Tussenstand, standaard uit: teams en hun punten per ronde, de stand op een slide, en punten invullen tijdens de show.
- Nieuwe quizzen heten `.quiznote` en staan in Documenten/QuizNote. Quizzen van 0.1.0 (`.pubquiz`) openen gewoon.
- Anoniem meten, alleen als je dat goedvindt: de app vraagt het bij de eerste start, en je zet het aan of uit bij Instellingen. Nooit de inhoud van je quiz of je bestanden.
- Een rustigere interface: knoppen met een icoon en tekst, overal dezelfde woorden, rood alleen voor wat live is en meldingen in geel.
- Afstandsbediening: uitleg bij de QR-code over open wifi en over Nieuwe code.
- Opgelost: wat je wijzigt terwijl de quiz wordt opgeslagen, blijft bewaard; een nieuwe preview blijft spelen als hij een andere onderbreekt; ga je snel terug terwijl een nieuwe video nog laadt, dan komt die video niet alsnog op het scherm.

## 0.1.0 (31 oktober 2026)

De eerste versie, alleen voor macOS en in het Nederlands.

- Een quiz in elkaar klikken: rondes en slides, met een standaard per quiz die je per ronde of slide kunt aanpassen.
- Rondesoorten: gewoon, muziek, afbeeldingen, pauze en antwoorden.
- Slides in een andere volgorde slepen.
- Live draaien op meerdere schermen, ook via AirPlay. De inhoud blijft 16:9, de achtergrond vult het scherm.
- Achtergrondmuziek en geluidsfragmenten op meerdere audio-uitgangen.
- Ronde opnieuw (toets R).
- Afdrukken: antwoordformulieren en vier vragenkaarten per A4, met snijlijnen.
- Na een crash gaat de show verder waar hij was.
- Een rondleiding om de app te leren kennen.
- Een quiz laten maken door je AI (Claude Desktop) via de AI-koppeling.
- Plug-ins, standaard uit:
  - Licht: een kleur of effect per quiz, ronde of slide op een MagicHome-ledcontroller;
  - Afstandsbediening: de show bedienen vanaf je telefoon of tablet, met dezelfde knoppen als op de Mac.
