# EXP-028: User-Event-Recording (Fehlerbericht aus Ring Buffer)

**Kategorie:** Querschnitt · **Phase:** laufend / Zukunft · **Priorität:** P3
(Infrastruktur / Support-Qualität, kein MVP-Blocker) · **Abhängig von:**
bestehender `eventRecorder` (`frontend/src/utils/eventRecorder.ts`),
`EventRecorderSetup`, `ErrorReportDialog`, `notify.ts`, `api/client-core.ts` ·
**Issue:** —

> Design-Dokument. Kein Code. Es beschreibt, wie aus dem bereits ausgelieferten
> In-Memory-Event-Recorder ein **persistenter, kategorisierter,
> nutzer-initiierter Fehlerbericht-Flow** wird. Leitplanken: kein automatisches
> Senden, kein Server-Upload, keine PII. Der Nutzer sieht und kontrolliert
> alles, was den Browser verlässt.

---

## 0. Was es heute schon gibt (Ist-Stand)

Wichtig für die ehrliche Einordnung: ein großer Teil der Idee ist **bereits
ausgeliefert** und in den Complexity-Burn-down eingegangen
(`eventRecorder.ts`, cx 4). EXP-028 ist eine **Erweiterung**, kein Neubau.

| Baustein | Datei | Status |
|---|---|---|
| Ring Buffer (FIFO, max 100, `push`/`shift`) | `utils/eventRecorder.ts` | **da** |
| Privacy-Sanitizer (Redaction, Query-Strip, Truncate) | `utils/eventRecorder.ts` | **da** |
| Globale Listener: Klick, Navigation, `window.onerror`, `unhandledrejection` | `components/EventRecorderSetup.tsx` | **da** |
| Toast-Aufzeichnung | `utils/notify.ts` | **da** |
| API-Call/-Error-Aufzeichnung | `api/client-core.ts` | **da** |
| Review-vor-Senden-Dialog + GitHub-Issue-URL + Clipboard | `components/ErrorReportDialog.tsx` | **da** |
| 12 feingranulare `EventType`s + Formatter | `utils/eventRecorder.ts` | **da** |

**Was fehlt** (= der Inhalt dieses Dokuments):

1. Eine **grobe Kategorie-Taxonomie** über den feingranularen `EventType`
   (navigation / exercise / storage / error / network) — für Filterung und
   Lesbarkeit im Bericht.
2. **App-State-Snapshot** (Storage-Modus, Sprache, online/offline) — heute nur
   implizit über die Env-Info zum Report-Zeitpunkt, nicht pro Ereignis.
3. **Persistenz**: der Buffer ist heute reines RAM und stirbt beim Tab-Close /
   Reload. Ein Crash, der einen Reload auslöst, nimmt die Vorgeschichte mit.
4. Ein **dedizierter Einstiegspunkt** in Settings (heute nur über den
   Fehler-Toast erreichbar — also nur *nachdem* ein Fehler-Toast erschien).
5. **JSON-Export** als Download (heute nur Markdown via GitHub-URL + Clipboard).

---

## 1. Idee

Ein **Ring Buffer** hält die letzten ~100 Nutzer-Aktionen rein im Browser. Wenn
etwas schiefgeht, kann der Nutzer **selbst** einen Fehlerbericht erzeugen, der
diese Vorgeschichte enthält — als JSON (für Debugging) und als Markdown (für ein
GitHub-Issue). Der Bericht zeigt **vorab transparent**, was er enthält.

Drei harte Leitplanken (unverändert aus dem Ist-Stand):

- **Kein automatisches Senden.** Nichts verlässt den Browser ohne expliziten
  Nutzer-Klick.
- **Kein Server-Upload.** Der Transport ist eine vom Nutzer geöffnete
  GitHub-Issue-URL oder eine heruntergeladene Datei — die App schickt keine
  Telemetrie.
- **Keine PII.** Passwörter, API-Keys, Lerninhalte, Antworten, Profilbilder
  werden nie aufgezeichnet (§4.3).

Der Wert: Support-Anfragen und Bug-Reports werden **ohne Rückfragen
handlungsfähig** — die Vorgeschichte ("ich war auf X, klickte Y, dann kam der
Fehler") ist enthalten, statt aus dem Gedächtnis rekonstruiert zu werden. Das
deckt sich mit der bestehenden Fehler-Reporting-Doktrin
(`code-hygiene.md`: AdaptiveLearnerError → ApiError → Toast mit „Report Issue").

---

## 2. Architektur

### 2.1 Ring Buffer (bereits implementiert, hier nur dokumentiert)

- **Feste Größe** (`MAX_BUFFER_SIZE = 100`), **FIFO**, älteste fallen raus.
- Aktuelle Umsetzung: `Array` + `push()` / `shift()`. Bewertung der Alternative
  (Index-basierter Fixed-Array) siehe §4.1 — für 100 Einträge **kein
  messbarer Unterschied**; die einfache Variante bleibt.
- **Singleton**, von überall importierbar (`export const eventRecorder`).
- `add()` ruft synchron den Sanitizer und pusht — **null nennenswerter
  Overhead** (kein `await`, kein I/O auf dem Hot-Path; Persistenz ist
  entkoppelt, §2.4).

### 2.2 Eintrags-Schema

Bestehend pro Eintrag: `type` (feingranular), `timestamp`
(`performance.now()`, ms seit Page-Load), plus typ-spezifische Felder
(`text`, `testId`, `method`, `endpoint`, `status`, `durationMs`, `message`, …).

**Neu (EXP-028):**

- `category` — grobe Klasse, abgeleitet aus `type` (§2.3). Erlaubt Filterung
  im Vorschau-Dialog und im Export.
- Optionaler **App-State-Snapshot** auf Fehler-Ereignissen (`error`-Kategorie):
  `{ storageMode, language, online }` — der minimale Kontext, der einen Bug
  einordnet, ohne PII.

```ts
// Erweiterung, NICHT Neudefinition
interface RecordedEvent {
  // ... bestehende Felder ...
  category?: EventCategory;          // EVT-01
  appState?: AppStateSnapshot;       // EVT-02, nur auf error-Events
}

type EventCategory =
  | "navigation" | "exercise" | "storage" | "error" | "network" | "ui";

interface AppStateSnapshot {
  storageMode: "api" | "dexie";      // aus getStorage()-Modus
  language: string;                  // useI18n().lang
  online: boolean;                   // navigator.onLine
}
```

### 2.3 Kategorie-Taxonomie

Die 12 feingranularen `EventType`s mappen auf 6 grobe Kategorien. Das Mapping
ist eine reine Lookup-Tabelle (kein Verhaltenswechsel an der Aufzeichnung):

| Kategorie | EventTypes | Quelle |
|---|---|---|
| `navigation` | `navigation` | `EventRecorderSetup` |
| `exercise` | (neu) `exercise_attempt`, `lesson_step` | Lesson-Runner (§4.x) |
| `storage` | (neu) `storage_read`, `storage_write`, `sync` | `getStorage()`-Wrapper |
| `network` | `api_call`, `api_error` | `api/client-core.ts` |
| `error` | `uncaught_error`, `unhandled_rejection`, `toast`(level=error) | `EventRecorderSetup`, `notify.ts` |
| `ui` | `click`, `dialog_open/close`, `dropdown_change`, `checkbox_change`, `file_upload` | `EventRecorderSetup` |

`exercise` und `storage` sind heute **nicht** instrumentiert; sie sind die
sinnvollste inhaltliche Erweiterung (§5, EVT-01). Wichtig: **nur IDs, nie
Antworten/Inhalte** (§4.3).

### 2.4 Persistenz (der Kern-Neubau)

Heute: reines RAM → ein Reload löscht die Vorgeschichte. Genau der häufigste
Fall (eine Exception, die zum Reload führt) verliert damit den Kontext, der ihn
erklären würde.

Vorschlag: **Write-through in einen persistenten Speicher**, vom Hot-Path
entkoppelt:

- **Stufe 1 — `sessionStorage`** (Default-Empfehlung): überlebt
  Reload/Tab-Refresh, stirbt mit dem Tab. Datenschutzfreundlich (keine
  dauerhafte Spur auf der Platte), synchron, ~5 MB Limit (für 100 kleine
  Einträge weit überdimensioniert). Write throttled/debounced (z. B. alle
  500 ms oder bei `error`-Events sofort), damit der Klick-Hot-Path frei bleibt.
- **Stufe 2 — Dexie/IndexedDB** (optional, wenn Tab-übergreifende
  Persistenz gewünscht): asynchron, größer, überlebt auch Tab-Close. Nur
  sinnvoll, wenn der Bug-Report-Flow „App neu öffnen und Bericht erstellen"
  unterstützen soll. Mehraufwand (eigene Tabelle, Aufräum-Sweep). **Default:
  nicht** — `sessionStorage` deckt 95 % ab.

`localStorage` wird **bewusst nicht** empfohlen: dauerhafte Spur ohne klaren
Lebenszyklus, datenschutzseitig die schlechteste Option.

Beim App-Start lädt der Recorder einen vorhandenen `sessionStorage`-Stand
zurück in den Buffer (Reload-Survival), bevor neue Events dazukommen.

### 2.5 Automatische Fehler-Erfassung (bereits da)

`window.onerror` + `unhandledrejection` füllen den Buffer bereits
(`EventRecorderSetup`). EXP-028 ergänzt nur den **App-State-Snapshot** auf
genau diesen Ereignissen (§2.2) und den **sofortigen Persistenz-Flush** bei
einem Fehler-Event (damit ein direkt folgender Reload den Crash-Kontext
behält).

---

## 3. User-Flow

### 3.1 Einstiegspunkte

1. **Reaktiv (heute da):** Fehler-Toast → „Report Issue" → `ErrorReportDialog`.
2. **Proaktiv (neu, EVT-04):** `Settings > Hilfe / Support >
   „Fehlerbericht erstellen"` — erreichbar **ohne** vorausgehenden Fehler.
   Genau das fehlt heute: ein Nutzer, dessen App sich „komisch" verhält (ohne
   Exception), hat keinen Weg zum Bericht.

### 3.2 Schritte

1. Dialog öffnet, zeigt die **Vorschau der letzten ~100 Schritte** (Transparenz
   — der Nutzer sieht exakt, was gesendet würde). Filter nach Kategorie.
2. Optionale **Freitext-Beschreibung** („Was wolltest du tun? Was ist
   passiert?").
3. Opt-in-Toggles (bestehend): Umgebungsinfo (Version, Browser, OS, Route),
   Aktions-Historie, Voll-Vorschau.
4. **Export-Optionen:**
   - **GitHub-Issue** (Markdown, bestehend) — öffnet die vorausgefüllte
     Issue-URL; bei Überlänge (> ~7800 enc. Zeichen) Hinweis + Clipboard-
     Fallback (bestehende `MAX_ENCODED_URL`-Logik).
   - **Clipboard-Copy** (Markdown, bestehend).
   - **JSON-Download** (neu, EVT-05) — die rohe `RecordedEvent[]` + Snapshot,
     für tiefes Debugging / Anhängen an ein Issue.

Kein Schritt sendet automatisch. Jeder Transport ist eine explizite
Nutzer-Aktion.

---

## 4. Technische Details

### 4.1 Ring-Buffer-Implementierung: Array vs. Index

| Variante | Vorteil | Nachteil |
|---|---|---|
| `Array` + `push`/`shift` (heute) | trivial, lesbar, `getAll()` = `[...buffer]` | `shift()` ist O(n) |
| Fixed-Array + Schreib-Index (modulo) | `add()` strikt O(1) | `getAll()` muss umsortieren, mehr Code |

Bei `n = 100` ist `shift()`-O(n) **praktisch irrelevant** (100 Pointer-Moves,
sub-Mikrosekunde, nicht auf einem gerenderten Frame-Budget). **Empfehlung: bei
der Array-Variante bleiben.** Die Index-Variante erst erwägen, falls die
Puffergröße je in den Tausender-Bereich wandert (kein realistischer Fall).

### 4.2 Kategorie-Taxonomie

Wie §2.3. Das Mapping ist eine `Record<EventType, EventCategory>`-Tabelle neben
den bestehenden `EVENT_FORMATTERS`. `add()` setzt `category` aus dem Lookup,
falls nicht explizit gesetzt. Rückwärtskompatibel: alte Aufrufer ohne
`category` funktionieren weiter (Lookup füllt es).

### 4.3 Privacy-Filter — was NICHT aufgezeichnet wird

Bestehend + erweitert. Harte Negativliste:

- **Nie:** Tastatureingaben, Textarea-/Editor-Inhalt, Passwörter, API-Keys,
  Tokens, Lizenzschlüssel, Lerninhalte (Karten-Vorder-/Rückseiten),
  Nutzer-**Antworten** in Übungen, Profilbilder, jede PII.
- **Redaction** (bestehend): Felder/Texte, die auf
  `password|token|api.?key|secret|license|credential` matchen → `[REDACTED]`.
- **Query-Params** werden aus URLs/Endpoints gestrippt (bestehend) — ein Token
  in `?token=…` landet nie im Buffer.
- **Truncation** auf 200 Zeichen (bestehend) — begrenzt versehentliches
  Durchsickern.
- **Exercise-Events (neu) tragen nur IDs** (`lessonId`, `exerciseId`,
  `correct: boolean`), **nie** den eingegebenen oder erwarteten Text.

Diese Liste ist der **Akzeptanztest** für jede neue Event-Quelle: bevor ein
neuer `add()`-Aufrufer landet, wird geprüft, dass sein Payload nur IDs/Flags
enthält. (Analog zur Backup-Akzeptanz-Gate-Doktrin: die Garantie wird geprüft,
nicht angenommen.)

### 4.4 Bundle-Size-Impact

- Der bestehende Recorder ist winzig (eine Klasse + Formatter, < ~5 KB
  ungzippt).
- EVT-01 (Kategorie-Lookup) + EVT-02 (Snapshot) + EVT-05 (JSON-Download):
  **vernachlässigbar** (wenige Hundert Byte Logik, kein neues Dependency).
- EVT-03 Stufe 1 (`sessionStorage`): Web-API, **kein** Dependency.
- EVT-03 Stufe 2 (Dexie): Dexie ist **bereits** im Bundle (Storage-Layer) — kein
  zusätzliches Gewicht, nur eine Tabelle mehr.
- **Netto-Empfehlung:** EVT-01/02/04/05 sind quasi gratis; nur EVT-03 Stufe 2
  bringt Komplexität (nicht Gewicht).

### 4.5 Beide Storage-Modi

- Der Recorder ist **rein Frontend** und **storage-modus-agnostisch** — er läuft
  in API- **und** Dexie-Modus identisch (kein Backend-Roundtrip, keine
  `api.*`-Abhängigkeit). Damit ist die „Dexie-mode is part of the contract"-
  Regel automatisch erfüllt.
- Der `AppStateSnapshot.storageMode` macht den Modus im Bericht **sichtbar** —
  nützlich, weil viele Bugs modus-spezifisch sind (GH-Pages/Dexie vs. Desktop/
  API).
- EVT-03 Stufe 2 (Dexie-Persistenz) würde im API-Modus genauso laufen (Dexie ist
  im Frontend immer verfügbar), ist aber **nur** dort nötig, wo Tab-übergreifende
  Persistenz gewünscht ist.

---

## 5. Roadmap-Tasks

Prefix `EVT-`. Aufwand: S/M/L. Reihenfolge = empfohlene Umsetzung.

| ID | Task | Abhängig | Aufwand |
|----|------|----------|---------|
| EVT-01 | Kategorie-Taxonomie: `EventCategory` + `Record<EventType, EventCategory>`-Lookup; `add()` füllt `category`; Vorschau-Dialog filtert nach Kategorie. Optional: Exercise-/Storage-Event-Quellen (nur IDs, §4.3). | — | S |
| EVT-02 | App-State-Snapshot (`storageMode` / `language` / `online`) auf `error`-Kategorie-Events; im Bericht-Kopf anzeigen. | EVT-01 | S |
| EVT-03 | Persistenz Stufe 1: Write-through nach `sessionStorage` (throttled; sofort-Flush bei Fehler-Event); Rück-Laden beim App-Start. (Stufe 2 Dexie optional, eigenes Ticket.) | — | M |
| EVT-04 | Proaktiver Einstiegspunkt: `Settings > Hilfe/Support > „Fehlerbericht erstellen"` öffnet `ErrorReportDialog` ohne vorausgehenden Fehler; i18n in 8 Sprachen. | — | S |
| EVT-05 | JSON-Export: Download der rohen `RecordedEvent[]` + Snapshot neben dem bestehenden Markdown/Clipboard-Pfad. | EVT-02 | S |

Alle Tasks sind **additiv** und brechen den bestehenden reaktiven Flow nicht.
EVT-01/04/05 sind unabhängig parallelisierbar; EVT-02 hängt an EVT-01,
EVT-05 an EVT-02.

---

## 6. Offene Fragen + Empfehlungen

1. **`sessionStorage` vs. Dexie als Default-Persistenz?**
   *Empfehlung: `sessionStorage` (Stufe 1).* Reload-Survival deckt den
   häufigsten Fall (Crash → Reload); Tab-übergreifende Persistenz ist selten
   den Mehraufwand + die dauerhaftere Spur wert. Dexie nur, wenn ein konkreter
   Support-Workflow „App neu öffnen, dann Bericht" verlangt.
2. **Buffer-Größe 100 — richtig?**
   *Empfehlung: 100 belassen.* Genug Vorgeschichte für die meisten Bugs, klein
   genug für URL-Limit/Lesbarkeit. Konfigurierbar machen ist Over-Engineering,
   solange kein konkreter Bedarf besteht.
3. **Exercise-/Storage-Events jetzt instrumentieren oder später?**
   *Empfehlung: später / opt-in pro Quelle.* Erst die Taxonomie + Persistenz
   (EVT-01..03) liefern, dann Quellen nachziehen, wo Bugs sie brauchen — jede
   neue Quelle durchläuft den Privacy-Akzeptanztest (§4.3).
4. **App-State-Snapshot pro Event oder nur pro Report?**
   *Empfehlung: nur auf `error`-Events (pro Ereignis) + einmal im Report-Kopf.*
   Ein Snapshot auf jedem Klick wäre redundant (Modus/Sprache ändern sich
   selten); auf Fehlern ist der exakte Zustand-zum-Crash-Zeitpunkt wertvoll.
5. **Soll der proaktive Einstieg unter „Hilfe/Support" oder „Daten" liegen?**
   *Empfehlung: „Hilfe/Support".* Der mentale Anker ist „etwas ist kaputt, ich
   melde es", nicht Datenverwaltung. (Settings ist bereits getabbt — passt in
   den Help/About-Bereich.)
6. **Redaction-Regex pflegen — reicht die Negativliste?**
   *Empfehlung: Liste als Akzeptanztest behandeln, nicht als Allheilmittel.* Die
   stärkere Garantie ist „neue Quellen tragen nur IDs/Flags" (§4.3), nicht „der
   Regex fängt alles". Defense-in-depth: beides.

---

## Bewertung

Der teure Teil — Ring Buffer, Sanitizer, globale Listener, Review-Dialog — ist
**schon gebaut und gehärtet**. EXP-028 ist die **günstige, hochwertige
Vervollständigung**: eine Kategorie-Schicht (Lesbarkeit), ein
App-State-Snapshot (Einordnung), `sessionStorage`-Persistenz (überlebt den
Reload, der den Bug auslöste) und ein proaktiver Settings-Einstieg (Bericht
auch ohne Exception).

Empfohlener Schnitt:

1. **EVT-03 (`sessionStorage`-Persistenz) zuerst** — schließt die größte echte
   Lücke (Kontextverlust beim Crash-Reload).
2. **EVT-01 + EVT-02** — Kategorie + Snapshot, machen Berichte handlungsfähiger.
3. **EVT-04 + EVT-05** — proaktiver Einstieg + JSON-Export, reine UX-Gewinne.

**Kein MVP-Blocker.** Support-/Qualitäts-Infrastruktur, additiv, beide
Storage-Modi, kein Datenmodell-Eingriff, kein Server.
