# Theorie-Content aus Lehrbuch für Lektionen: Stand der Dinge

**Stand:** 2026-07-16
**Typ:** Status- und Verifikations-Dokument (kein neues EXP, keine
Design-Entscheidung)
**Verwandt:** EXP-021 (Lektions-Creator), EXP-025 (Author-provided Lesson
Sets / Buch-Begleiter), EXP-036 (KI-Uebungsgenerierung aus Theorie-Content)

> Dieses Dokument löst die früheren, ehrlich-unsicheren
> Zusammenstellungen ("vermutlich nie fertig verfolgt") gegen den echten
> Code-Stand auf. Zwei Punkte, die als lose Faeden galten, sind in
> Wirklichkeit fertige, schema-gestützte Features. Die Lücken-Analyse
> wird dadurch **kleiner und praeziser**: nicht "Feature fehlt", sondern
> "Feature existiert, nur der Eingabepfad vom Wizard dorthin fehlt".

---

## 1. Was im Schema und Code existiert (gegen Code verifiziert)

### 1.1 Lektionsstruktur

Jede Lektion (`ContentLesson`) hat `steps[]`, gemischt aus Theorie-Schritten
(Markdown-`body`) und Übungs-Schritten. Das ist die Grundstruktur, in die
Theorie-Content hineinfliesst - unabhängig davon, woher er stammt.

### 1.2 `theory_ref` - FERTIG, nicht offen (#709)

Der früher als "loser Faden" eingeordnete Punkt ist implementiert:

- **Schema-Feld** auf Übungs-Steps: `theory_ref` (String, `maxLength 200`,
  optional) - `schema/lesson-step.schema.json`, generiert nach TS und Python.
- **Aufloesungslogik** in `frontend/src/lib/lesson/theory-link.ts`:
  `findTheoryIndexByRef` matcht die Annotation exakt gegen einen
  Theorie-Step - zuerst per **id**, dann per **title**. Fallback-Kette:
  explizites `theory_ref` (#709) -> Text-Overlap-Heuristik (#634) ->
  nächster vorangehender Theorie-Step. Die Autoren-Annotation gewinnt
  immer.

**Wichtige Abgrenzung (leicht misszuverstehen):** `theory_ref` verlinkt
**innerhalb** einer Lektion (Übung -> Theorie-Step). Es ist **kein** Verweis
auf eine externe Quelle (Buchtitel/Kapitel/Seite). Wer einen externen
Buchverweis sucht, findet ihn hier nicht - dafuer ist der `book`-Block
(1.3) zuständig.

### 1.3 Buch-Metadaten-Block `book` - FERTIG (#769)

- **Schema:** `ContentSetBook` in `schema/content-set.schema.json`, Felder
  `title` (Pflicht), `author`, `url`, `asin`, `extra="ignore"` (toleriert
  kuenftige Felder wie `isbn`/`year`).
- **Ort:** auf Set-Ebene als `sets[].book`.
- **Wirkung:** wird in der Lektions-Sektion "Vertiefe das Thema" als erstes
  Medien-Item gerendert.

Das ist exakt der Block, den die manuell gebauten Buch-Sets nutzen (siehe
Abschnitt 2). Er existiert im Schema - was fehlt, ist ein **Eingabefeld im
Wizard**, das ihn befüllt.

### 1.4 Analyse-zu-Lektion / KI-Uebungsgenerierung - vorhanden

- `frontend/src/lib/content/analysis/analysis-to-lesson.ts` erzeugt
  deterministisch eine spielbare Lektion (Theorie + Übungen) aus einer
  Chat-Analyse.
- Ergaenzend die KI-Uebungsgenerierung aus reiner Prosa-Theorie
  (generate -> quality-gate -> balance -> feedback, "Übungen generieren"
  auf theorie-only Lektionen, braucht API-Key), umbrella EXP-036.

Das ist der **strukturell naechstliegende** existierende Flow zu einem
"Theorie aus Lehrbuch"-Feature - aber die Quelle ist ein **Chat-Verlauf**
(Rollen-/Gespraechsstruktur), kein Buchkapitel.

---

## 2. Bewaehrter manueller Prozess (kein Nutzer-Feature)

Zwei komplette Wissens-Sets wurden aus eigenen Buechern gebaut - **nicht**
über den Wizard, sondern als direkter Agenten-Auftrag gegen das
Content-Repo:

- **"KI für Einsteiger"** (ASIN B0F43H6T2M, 10 Kapitel) -> 12 Lektionen.
- **"Die Währung des Geistes"** -> 11 Lektionen (über mehrere
  Korrekturrunden).

Gemeinsames Muster:

- Pro Lektion 2-3 Theorie-Steps - **nicht** der Buchtext direkt kopiert,
  sondern das Wissen in eigenen Worten als Lerninhalt aufbereitet
  (redaktionelle Vorgabe: Urheberrecht + Qualität).
- 8-10 gemischte Übungen pro Lektion.
- `source_language: de, target_language: de` (Wissens-Lektion, kein
  Sprachpaar).
- Set-Manifest mit `book:`-Block (= 1.3), der auf das Amazon-Listing
  verweist.

**Kern:** Der Prozess (Buch -> Struktur lesen -> Theorie + Übungen pro
Kapitel von Hand schreiben -> Content-Repo) existiert nur als manueller
Agenten-Auftrag. Ein normaler Nutzer ohne Zugriff auf einen Coding-Agenten
kann ihn nicht ausführen.

---

## 3. Ist-Zustand des `/create-lesson`-Wizards

Datei: `frontend/src/pages/lesson/CreateLesson.tsx`, Bausteine unter
`frontend/src/components/create-lesson/`.

- **4 Vorlagen** (`frontend/src/lib/content/lesson/lesson-templates.ts`):
  `blank`, `vocabulary`, `grammar`, `conversation`. Alle sprachlern-lastig;
  **keine** Wissens-/Buch-/Theorie-Vorlage.
- **4 Schritte:** Metadaten (`MetadataStep`) -> Karten-Editor (`CardEditor`)
  -> Übungs-Generator (`ExerciseGenerator`) -> Speichern/Teilen
  (`ReviewStep`).
- **Einziger Import:** `importCards` (CSV mit `front`/`back`/`notes`).
  **Kein** Schritt "Theorie-Text eingeben/importieren".
- **Kein** Eingabefeld für den `book`-Block aus 1.3.

---

## 4. Praezisierte Luecke

Weil `theory_ref` (#709) und `book` (#769) bereits im Schema/Code stehen,
schrumpft die Luecke auf **zwei konkrete Bausteine** - nicht "alles neu":

1. **Ein Eingabepfad im Wizard für strukturierten Buch-/Textinput**, der
   mit KI-Umformulierung Theorie-Steps erzeugt - analog
   `analysis-to-lesson`, aber Quelle = Buchkapitel statt Chat.
2. **Ein Buch-Metadaten-Feld im Wizard**, das in den bereits existierenden
   `sets[].book`-Block schreibt.

`theory_ref` und der `book`-Block müssen **nicht** gebaut werden - sie
warten nur darauf, vom Wizard befüllt zu werden.

---

## 5. Offene Fragen - ENTSCHIEDEN (2026-07-16), Feature-Auftrag #1743

Die früher offenen Fragen sind entschieden; daraus entstand der
scope-geklaerte Feature-Auftrag
[#1743](https://github.com/astrapi69/adaptive-learner/issues/1743).
Entscheidungen (Prinzip durchgaengig: **einfachere Variante zuerst**):

1. **Eingabeformat:** reiner Text-Paste zuerst, **kein** PDF/Word-Upload in
   v1 (Textextraktion ist eigener, nicht trivialer Aufwand; Paste ist durch
   den Chat-Import als tragfaehig belegt). PDF/Word = spaeteres Follow-up.
2. **Kapitel-Segmentierung:** der Nutzer fuegt selbst in Haeppchen ein,
   **keine** automatische Grenzenerkennung (Segmentierung ist eine
   redaktionelle Entscheidung, wie der manuelle Prozess zeigte).
3. **Umformulierungs-Pflicht:** bleibt Design-Leitplanke, keine Wahl - die
   KI muss umformulieren, nicht textnah zerlegen (Urheberrecht + Qualität).
4. **Buch-Metadaten im Wizard:** ja, im **selben** Auftrag (schreibt
   `sets[].book`, #769) - sonst halbes Feature.

Die urspruenglichen Frageformulierungen bleiben unten als Herleitung stehen.

1. **Eingabeformat:** Reiner Text-Paste (wie beim Chat-Import) als erster
   Wurf - oder direkt auch PDF/Word-Upload mit Textextraktion?
2. **Kapitel-Segmentierung:** Erkennt die App automatisch Kapitel-/
   Lektionsgrenzen (wie es der Agent manuell entschied) - oder fuegt der
   Nutzer selbst in Haeppchen ein?
3. **Umformulierungs-Pflicht:** Die manuelle Vorgabe "nicht kopieren,
   sondern in eigenen Worten" muss eine automatisierte Lösung **ebenfalls**
   erzwingen (KI-Umformulierung), nicht bloss strukturell zerlegen - sonst
   entstehen textnahe, urheberrechtlich heikle Lektionen. (Praktisch eher
   Design-Leitplanke als offene Wahl, aber explizit festzuhalten.)
4. **Buch-Metadaten im Wizard:** Bekommt der Wizard ein `book`-Eingabefeld
   (Titel/Autor/ASIN/URL) analog zum Manifest, damit ein selbst erstelltes
   Set denselben Buchverweis trägt wie die offiziellen Sets? (Schema
   trägt es bereits - reine UI-/Flow-Frage.)

---

## 6. Fazit

Es gibt **kein** fertiges, ungenutztes "Theorie aus Lehrbuch"-Feature, das
nur freigeschaltet werden müsste. Es gibt:

- einen **bewaehrten manuellen Prozess** (zweimal erfolgreich für eigene
  Bücher),
- einen strukturell aehnlichen **App-Flow** (KI-Chat-Import /
  `analysis-to-lesson`),
- und **zwei bereits fertige Schema-Bausteine** (`theory_ref` #709,
  `book` #769), die auf einen Wizard-Eingabepfad warten.

Ein Wizard-Feature "Theorie aus Lehrbuch" wäre eine **Neuentwicklung des
Eingabepfads**, die sich am Chat-Import orientiert, aber buch-spezifisch
angepasst ist (Kapitel-Struktur, Umformulierungs-Pflicht, `book`-Metadaten).
Umfang: kleiner als ursprünglich eingeschaetzt, weil die Ziel-Datenstruktur
schon steht.

---

## Anhang: Verifikations-Belege

| Aussage | Beleg im Repo |
| --- | --- |
| `theory_ref` implementiert | `schema/lesson-step.schema.json`, `frontend/src/lib/lesson/theory-link.ts` (#709, Heuristik #634) |
| `book`-Block implementiert | `schema/content-set.schema.json` -> `ContentSetBook` (#769) |
| 4 Wizard-Vorlagen | `frontend/src/lib/content/lesson/lesson-templates.ts` (`blank`/`vocabulary`/`grammar`/`conversation`) |
| Wizard-Struktur + einziger Import = CSV | `frontend/src/pages/lesson/CreateLesson.tsx`, `frontend/src/components/create-lesson/` |
| Analyse-zu-Lektion existiert | `frontend/src/lib/content/analysis/analysis-to-lesson.ts` |
