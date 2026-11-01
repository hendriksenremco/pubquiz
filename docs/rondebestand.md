# Rondebestand (`.quiznoteronde`)

Een rondebestand bevat een of meer rondes om in een quiz te importeren, bijvoorbeeld uit de bibliotheek op quiznote.app (issue #100). In de app: **Importeren…** onder de lijst met rondes in de editor. De rondes komen na de gekozen ronde.

De code staat in `src/shared/round-file.ts` (formaat en controle) en `src/main/round-file.ts` (de zip lezen en de media kopiëren).

## Opbouw

Een zip met:

```
ronde.json
media/        alleen als de rondes afbeeldingen of liedjes hebben
  rome.jpg
  take-on-me.mp3
```

- Deflate of zonder compressie. Geen zip64, geen versleuteling, hooguit 1 GB.
- Elk pad in de zip blijft binnen de zip: geen `..`, geen pad dat met `/` begint, geen `\`. Eén fout pad en het hele bestand wordt geweigerd.
- Bestanden in `media/` waar `ronde.json` niet naar verwijst, worden overgeslagen.

## `ronde.json`

Eén ronde:

```json
{
  "formatVersion": 1,
  "type": "questions",
  "title": "Aardrijkskunde",
  "intro": "Tien vragen over de wereld",
  "questions": [
    { "question": "Welke stad zie je hier?", "answer": "Rome", "image": "media/rome.jpg" },
    { "question": "Wat is de langste rivier ter wereld?", "answer": "De Nijl" }
  ]
}
```

Meer rondes:

```json
{
  "formatVersion": 1,
  "rounds": [
    {
      "type": "questions",
      "title": "Aardrijkskunde",
      "questions": [{ "question": "Hoofdstad van Italië?", "answer": "Rome" }]
    },
    {
      "type": "music",
      "title": "Jaren 80",
      "songs": [{ "audio": "media/take-on-me.mp3", "answer": "A-ha – Take on Me", "start": 12 }]
    }
  ]
}
```

- `formatVersion` is verplicht. Nu `1`. Een hoger nummer weigert de app, met de vraag om QuizNote bij te werken.
- Een ronde herken je aan `type`. Zonder `type` leest de app `rounds` als de lijst met rondes. (Een antwoordenronde heeft zelf ook `rounds`: de titels van de rondes die hij nakijkt.)
- Elke ronde volgt `RoundDraftSchema` uit `src/shared/draft.ts`, dezelfde vorm als bij de AI-koppeling. De soorten:
  - `questions`: `title`, `questions` met `question`, `answer`, en eventueel `readAloud`, `image`, `answerImage`;
  - `pictures`: `title`, `pictures` met `image`, `answer`, en eventueel `caption`, `answerImage`; eventueel `loopSeconds`;
  - `music`: `title`, `songs` met `audio`, `answer`, en eventueel `start` en `end` in seconden;
  - `break`: eventueel `title`;
  - `answers`: eventueel `title` en `rounds`.
  - Alle soorten kunnen `intro` (op de titelslide) en `notes` (alleen voor de quizmaster) hebben.
- Het enige verschil met de AI-koppeling: `image`, `answerImage` en `audio` zijn een pad in de zip dat met `media/` begint, geen pad op de Mac.
- Afbeeldingen: jpg, png, gif, webp. Geluid: mp3, m4a, aac, wav, aiff, flac, ogg.
- Schrijf de vragen in de taal van de ronde. De namen die de app zelf geeft (zoals "Vraag 1") volgen de taal van de Mac.

## Bij het importeren

- Er zijn drie manieren: **Importeren…** onder de lijst met rondes, het bestand op de editor slepen, of dubbelklikken in Finder. Is er dan geen quiz open, dan vraagt de app eerst in welke quiz. De rondes komen na de gekozen ronde.
- De app controleert eerst alles: het formaat (zod), de paden, of elk bestand bestaat en van de goede soort is, en of de rondes in de quiz passen (een muziekronde heeft een audiokanaal nodig). Bij een fout komt er een melding en verandert er niets.
- De media gaan naar `media/` van de quiz, onder een hash-naam, zoals altijd. Een bestand dat de quiz al heeft, komt er niet dubbel in.
- Elke ronde krijgt in Media een map met zijn titel.

## Nog niet

- De link `quiznote://ronde?url=…` vanaf de site.
- Een ronde exporteren als rondebestand. `writeZip` in `src/main/zip.ts` kan het al schrijven.
