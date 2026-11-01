# Plug-ins generieker maken: voorstel

Stand op 1 november 2026. Goedgekeurd (issue #31), met keuze B voor de knoppen. Stap 1 en 2 zijn gebouwd; de rest volgt in eigen pull requests.

## Hoe het nu zit

Er zijn twee plug-ins: **MagicHome-licht** (`magichome`) en **Afstandsbediening** (`remote`).

**Wat al generiek is**

- `src/shared/plugins.ts`: de lijst, aan/uit per Mac, en `config` per plug-in in `settings.json`.
- `src/main/plugins.ts`: `MainPlugin` (`configure`, `update`, `invoke`, `changed`, `stop`) en `PluginHost` (`notify`, `saveConfig`, `command`, `mediaFile`, `invoke`, `changed`). Main start en stopt plug-ins vanzelf.
- `src/renderer/src/plugins/`: `PluginSlot` met zes plekken (`quizSettings`, `roundSettings`, `slideInspector`, `startSheet`, `liveControls`, `settings`).
- Quizgegevens onder `plugins.<id>` op de quiz, een ronde of een slide (`PluginDataSchema`). De app kijkt er niet in.

**Wat per plug-in met de hand gaat**

|                                     | MagicHome-licht                    | Afstandsbediening       |
| ----------------------------------- | ---------------------------------- | ----------------------- |
| Instellingen per Mac                | adres van de controller (`host`)   | geheime sleutel (`key`) |
| Quizgegevens (quiz ⊕ ronde ⊕ slide) | ja, het licht                      | nee                     |
| Knoppen in de show (Mac)            | Licht                              | Telefoon                |
| Status                              | wat er brandt, met de hand gekozen | adres, aantal telefoons |
| Op de telefoon                      | Licht-paneel                       | (is de telefoon zelf)   |

**Waar het knelt**

1. **De afstandsbediening kent MagicHome bij naam.** `RemoteView.light`, de actie `light` in `RemoteActionSchema`, `host.invoke('magichome', …)` in `src/main/remote.ts` en `LightPanel` in `RemoteApp.vue`. Een derde plug-in met knoppen in de show (Spotify: afspelen, volgende) moet al die plekken weer aanpassen. Anders krijgt de telefoon zijn knoppen niet, en dat botst met de regel "Mac en telefoon hebben dezelfde knoppen".
2. **Status gaat via polling.** `LiveLight.vue` en `RemoteQr.vue` vragen elke 2 seconden `pluginInvoke(id, 'status')`. Main weet wanneer iets verandert; vensters hoeven niet te vragen.
3. **Niets is getypeerd over de grens.** `pluginInvoke(id, action: string, payload: unknown)`, `config: Record<string, unknown>`. Elke plug-in controleert zelf, of niet: een fout in een actienaam zie je pas als het niet werkt.
4. **Quizgegevens hebben eigen code.** `lightOf`, `setLight` en `resolveLight` in `src/shared/light.ts` doen slide ⊕ ronde ⊕ quiz. Een volgende plug-in (een Spotify-afspeellijst per ronde) schrijft dat opnieuw.
5. **Drie lijsten.** `PLUGINS` (shared), `FACTORIES` (main) en `RENDERER_PLUGINS` (renderer) moeten met de hand gelijk blijven. Dat is klein, maar met een gedeelde definitie vangt TypeScript een vergeten plek.

**Wat Spotify en YouTube (later) nodig hebben**

- Instellingen per Mac met een **geheim** (een OAuth-token). Dat hoort niet als platte tekst in `settings.json`, maar via `safeStorage` van Electron in de sleutelhanger.
- Quizgegevens per quiz, ronde of slide (een afspeellijst, een video), met dezelfde terugval als het licht.
- Knoppen in de show, op de Mac **en** de telefoon, met een status ("speelt: …").
- Rekening houden met de show: pauzeren bij een fragment, net als de achtergrondmuziek. Dat kan al met `update(quiz, state)`.
- YouTube heeft een eigen venster met een localhost-origin nodig (anders Error 153). Dat is een nieuwe mogelijkheid voor `PluginHost`, maar pas als YouTube er echt komt.

## Voorstel: één definitie per plug-in

### 1. Eén definitie in `src/shared/`

```ts
// src/shared/plugins/magichome.ts
export const magichome = definePlugin({
  id: 'magichome',
  name: 'MagicHome-licht',
  description: '…',
  /** Instellingen per Mac; ongeldig = de standaard. */
  config: z.object({ host: z.string().default('') }),
  /** Quizgegevens op de quiz, een ronde of een slide; ongeldig telt als niets. */
  data: z.object({ light: LightSchema }),
  /** Wat de vensters en de telefoon te zien krijgen (alleen een type, main maakt het zelf). */
  status: typeOnly<LightStatus>(),
  /** Wat een knop, de telefoon of de AI kan vragen: per actie de invoer en wat hij teruggeeft. */
  actions: {
    choose: action<MagicHomeResult>()(LightSchema.nullable()),
    preview: action<MagicHomeResult>()(LightSchema.nullable()),
    probe: action<MagicHomeProbe>()(z.string())
  }
})
```

Gebouwd zijn de acties een object met per naam een schema, geen `discriminatedUnion`: zo heeft elke actie zijn eigen type voor wat hij teruggeeft, en kan stap 3 de acties voor de telefoon bij naam noemen (`remoteActions: ['choose']`).

- `PLUGINS` wordt de lijst van deze definities. `PluginId`, de config, de status en de acties volgen eruit, getypeerd.
- Generieke hulpjes voor quizgegevens: `pluginData(def, holder)`, `setPluginData(def, holder, value)` en `resolvePluginData(def, quiz, state)` (slide ⊕ ronde ⊕ quiz, zoals `resolve.ts`). `light.ts` gebruikt die; het gedrag blijft hetzelfde.

### 2. Status duwen in plaats van vragen

- `PluginHost` krijgt `publish(status)`. Main bewaart de laatste status per plug-in en stuurt hem naar alle vensters (`IPC.pluginStatus`) en naar de telefoons.
- De session-store houdt `pluginStatus[id]` bij. `LiveLight.vue` en `RemoteQr.vue` lezen dat; de timers van 2 seconden gaan weg.
- `pluginInvoke` blijft bestaan voor acties, maar dan getypeerd: `act(id, action)`, gecontroleerd met het `actions`-schema van de plug-in.

Gebouwd als: `PluginHost.publish`, `status` en `act`; `StatusBoard` in `src/main/plugin-status.ts` stuurt alleen een echte verandering, hooguit eens per 250 ms. De vensters krijgen `IPC.pluginStatus` en `session.statusOf(id)`, en vragen acties met `pluginAct`. Een plug-in in main heeft `actions` (per actie een functie) in plaats van `invoke`, en `statusChanged` in plaats van `changed`. De status is alleen wat de plug-in al weet: publiceren maakt nooit een verbinding met de controller.

### 3. Knoppen in de show op de Mac én de telefoon

Twee manieren; **advies: B**.

- **A. Knoppen beschrijven.** Een plug-in geeft een lijst knoppen (naam, icoon, aan/uit, keuzes). De werkbalk op de Mac en de telefoon tekenen ze met één gedeeld onderdeel. Overal hetzelfde, maar te beperkt voor het licht-paneel met kleuren en effecten, en straks voor een afspeellijst.
- **B. Eén Vue-onderdeel per plug-in, op beide plekken.** De telefoonpagina is ook Vue en gebruikt `LightPanel` nu al. Een plug-in levert voor `liveControls` één onderdeel dat alleen `status` en `act(action)` krijgt, en dat zowel in de werkbalk als op de telefoon staat. Zo krijgt elke nieuwe knop vanzelf een plek op allebei.

Daarmee wordt de afstandsbediening een gewone plug-in die van de andere niets weet:

- `RemoteView` krijgt `plugins: { id, status }[]` in plaats van `light`.
- `RemoteAction` krijgt `{ type: 'plugin', id, action }` in plaats van `light`; main controleert de actie met het schema van die plug-in.
- `RemoteApp.vue` toont een `PluginSlot name="liveControls"` in plaats van `LightPanel`.

### 4. Geheimen (pas bij Spotify)

- `PluginHost` krijgt `secret.get/set(name)`, met `safeStorage` en een eigen bestand in `userData`. Niet in `settings.json`, niet in de quiz.
- Nu nog niet bouwen: geen van de twee plug-ins heeft een geheim. De sleutel van de afstandsbediening mag gewoon in de instellingen blijven.

## Wat het oplevert

- Een nieuwe plug-in is: één definitie in `src/shared/`, één klasse in main, en onderdelen voor de plekken die hij gebruikt. Geen wijzigingen in `remote.ts`, `RemoteApp.vue`, `ipc.ts` of de session-store.
- Mac en telefoon tonen vanzelf dezelfde knoppen van een plug-in.
- Geen timers meer die elke 2 seconden vragen.
- Fouten in acties en instellingen vangt TypeScript of zod, niet de gebruiker.

## In kleine stappen

Elke stap is een eigen pull request, zonder verschil in beeld (behalve stap 3 op de telefoon, waar de knoppen op dezelfde plek blijven):

1. `definePlugin` en de generieke hulpjes voor quizgegevens; `light.ts` en de config van beide plug-ins erop overzetten. **Klaar.** De acties (`actions`, met `remoteActions` voor wat de telefoon en de AI mogen) komen in stap 2 en 3.
2. Status duwen (`publish`, `IPC.pluginStatus`, de store); de timers in `LiveLight.vue` en `RemoteQr.vue` weg. **Klaar.** Het adres in de QR-code (ander netwerk) controleert main nu zelf elke 3 seconden.
3. De afstandsbediening los van MagicHome: `plugins` in `RemoteView`, de actie `plugin`, `PluginSlot` op de telefoon.
4. Pas bij Spotify of YouTube: geheimen, en eventueel een eigen venster.

Wat **niet** verandert: de plug-ins doen voor de gebruiker hetzelfde, `settings.json` en `quiz.json` houden hetzelfde formaat (dus geen migratie), en de e2e-tests voor MagicHome en de afstandsbediening blijven ongewijzigd slagen.
