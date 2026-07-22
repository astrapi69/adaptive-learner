# Lektionsinhalte erstellen

Dieser Leitfaden beschreibt Schritt für Schritt, wie man ein
neues Lektionsset für den Adaptive-Learner-Content-Loader
aufsetzt. Wer ein Sprach- oder Themenset bauen möchte — für den
Eigengebrauch oder als Beitrag zum öffentlichen Content-Pool —
sollte ihn vor der ersten Lektion einmal komplett durchlesen.

## Was ist ein Content-Set?

Ein **Content-Set** ist ein versioniertes Bündel von Lektionen,
das ein Nutzer über die Set-Browser-Seite (`/content`)
herunterladen kann. Das Content-Loader-Plugin (v1.27.0) übernimmt
Discovery, Download, Caching und Versionsabgleich in beiden
Speichermodi.

Ein Set hat drei Ebenen:

1. **Root-Manifest** (`manifest.yaml`) — listet jedes Set des
   Repos. Wird vom Set Browser für den Quell-Katalog gelesen.
2. **Set-Manifest** (`sets/{set-id}/manifest.yaml`) — Schwester
   des Root-Manifests, listet die Lektions-Dateien des konkreten
   Sets.
3. **Lektionsdateien** (`sets/{set-id}/lessons/NN-slug.json`) —
   eine JSON-Datei pro Lektion, bei jedem Download gegen das
   Lektions-Schema validiert (siehe *Das Schema ist die alleinige
   Wahrheitsquelle* weiter unten).

Die mit Adaptive Learner ausgelieferten Sets liegen im separaten
Content-Repo [`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(als Geschwister-Checkout `../adaptive-learner-content` ausgecheckt und
offline in den GitHub-Pages-Build über
`frontend/scripts/copy-bundled-content.mjs` gebündelt) und eignen
sich gut als Vorlage. Die aktuelle Größe der Bibliothek (Lektions-,
Set- und Domänen-Zahlen, die Set-Tabelle und die aktiven Domänen)
ist der CONTENT-STATS-Block in der Projekt-[`README.md`](https://github.com/astrapi69/adaptive-learner#readme) —
dieser Block ist die alleinige Wahrheitsquelle, aus einem frischen
Content-Checkout generiert, daher dupliziert dieser Leitfaden die
Zahlen nicht.

## Das Schema ist die alleinige Wahrheitsquelle (EXP-039)

Das Lektions-/Übungsformat hat **eine kanonische Definition**: das
Lektions-JSON-Schema, das das npm-Paket
[learn-content-engine](https://github.com/astrapi69/learn-content-engine)
ausliefert (unveränderlich pro veröffentlichtem Release). Innerhalb
dieser App wird die **strukturelle** Pydantic-Schicht im Content-Loader-
Plugin (`adaptive_learner_content_loader.schema`) aus diesem Spiegel
**regeneriert** (`scripts/generate_pydantic_models.py`); nur die
semantischen feldübergreifenden Validatoren sind handgeschrieben.
`make sync-schema` frischt den Spiegel auf und emittiert die abgeleiteten
Artefakte neu, und Byte-Paritäts-Gates beweisen, dass `schema/*.json` dem
gepinnten Engine-Release gleicht. Die Stellen, die früher
auseinanderdrifteten, können das nicht mehr:

- `schema/lesson.schema.json` (+ Geschwisterdateien) — das
  maschinenlesbare JSON-Schema (Draft 2020-12). Referenziere es aus
  einer Lektions-`.json` über einen `"$schema"`-Schlüssel auf
  oberster Ebene, um IDE-Autovervollständigung und Inline-
  Validierung zu bekommen.
- `schema/quality-rules.json` — die geteilten Qualitäts-Minima
  (z. B. Übungsanzahl, Anzahl akzeptierter Freitext-Antworten), die
  der client-seitige Content-Validator nutzt statt einer zweiten,
  von Hand gepflegten Kopie.
- Die Frontend-TypeScript-Lektionstypen und die MkDocs-Seite
  [Lektionsformat-Referenz](lesson-format-reference.md) werden
  ebenfalls generiert (**nicht von Hand bearbeiten**); sie folgen dem
  Engine-Spiegel, führe also nach einem Re-Pin den Generator erneut aus.

Ein Drift-Gate (`make sync-schema-check`, Teil von `release-test`,
plus `backend/tests/test_lesson_schema_drift.py` in `make test`)
schlägt fehl, wenn ein generiertes Artefakt vom gepinnten Engine-
Spiegel abweicht. Den Kettenschluss bildet das App-vs-Engine-Byte-Paritäts-
Gate: `make engine-parity-check`
(`scripts/check_engine_schema_parity.py`), der Offline-Pin
`engine-schema-parity.test.ts` und der Pin-Kohärenz-Test
`engine-pin.test.ts` (`frontend/package.json`-Dependency ==
`schema/engine-version.txt`). Die Content-Repos spiegeln **das
gepinnte Engine-Release** (nicht dieses Repo) und validieren in ihrer
eigenen CI gegen diesen Spiegel.

**Prozedur für Formatänderungen (Schema-Autorität in der Engine):**
eine Änderung am Lektionsformat beginnt in der Engine oder wird dort
ratifiziert — zuerst Engine-PR + npm-Release; dann bumpt diese App
den Engine-Pin (`frontend/package.json` + `schema/engine-version.txt`)
und führt `make sync-schema` erneut aus, was den Spiegel auffrischt und
die strukturelle Pydantic-Schicht regeneriert; nur neue semantische
Validatoren werden von Hand geschrieben; danach ziehen die Content-Repos
ihren `engine-version.txt`-Pin nach. Ein Hand-Edit am Spiegel (oder ein
veralteter Pin) macht die Byte-Paritäts-Gates rot; der vergessene
Schritt ist sichtbar, nie stiller Drift.

## Sprachpaare (v1.44.0)

Jedes Content-Set deklariert das Sprach-PAAR, das es vermittelt:

- **`target_language`** — was der Lernende LERNT (z. B. `fr`).
- **`source_language`** — was der Lernende bereits SPRICHT, also die
  Sprache, in der die Karten-**`back`**-Felder, **`notes`** und der
  **Theorie**-Text geschrieben sind (z. B. `de`).

Genau das macht "Französisch für Englischsprachige" zu einem
*anderen* Set als "Französisch für Deutschsprachige": gleiches Ziel
(`fr`), andere Ausgangssprache (`en` vs. `de`), andere
Erklärsprache. Ein Lernender sieht nur Sets, deren
`source_language` zu einer von ihm gesprochenen Sprache passt
(App-Sprache plus optionale Zusatzsprachen in Einstellungen →
Lernen).

Set-IDs kodieren das Paar als `{ziel}-{niveau}-from-{quelle}`
(z. B. `fr-a1-from-de`), und jedes Set deklariert einen **`path`**,
der auf sein Ausgangssprach-Verzeichnis zeigt (`sets/de/fr-a1`).
Ein Set trägt außerdem **`title`** (in der Ausgangssprache, was der
Lernende liest) und **`title_native`** (in der Zielsprache, als
Zweittitel).

Beide Codes müssen ISO-639-1 (zwei Buchstaben) sein, und
`source_language` muss sich von `target_language` unterscheiden.
Sets vor v1.2 ohne diese Felder laden weiterhin: der alte
`language`-Schlüssel wird als `target_language` akzeptiert, und
`source_language` fällt auf `en` zurück.

## Verzeichnislayout

Der Baum ist nach AUSGANGSSPRACHE, dann Ziel+Niveau organisiert:

```
mein-content-repo/
  manifest.yaml               # Root: listet jedes Set (mit path + Paar)
  sets/
    de/                       # Ausgangssprache: Deutsch
      fr-a1/                  # Ziel Französisch, Niveau A1  -> ID fr-a1-from-de
        manifest.yaml         # Set: listet die Lektionen
        lessons/
          01-begruessung.json
          ...
        assets/               # optionale Bilder / Audio
    en/                       # Ausgangssprache: Englisch
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

### Such-Index (`search-index.json`)

Content-Discovery und Suche (die *Entdecken*-Oberfläche) werden von
einer schlanken `search-index.json` im Repo-Root angetrieben (~4 KB,
nur Metadaten — kein Karteninhalt). Das offizielle Content-Repo
liefert sie aus, und die App holt die Indizes jedes konfigurierten
Repos clientseitig (CORS-sicher, in localStorage mit 24-h-Stale-
while-Revalidate-TTL gecacht), damit ein Lernender ein Set FINDEN
kann, bevor er es herunterlädt. Jeder Eintrag bewirbt die `id`, den
`name`, die `description`, `source_language` / `target_language`,
`level`, `domain`, `lesson_count`, `card_count`, `tags`, ein
`ai_validated`-Flag, ein `trust_level`, ein optionales Begleitbuch
`book` und einen `updated_at`-Zeitstempel des Sets. Halte sie mit
den Set-Manifesten synchron; ein PR an das offizielle Repo
regeneriert sie.

## Manifest-Format

Das Feld-Schema des Manifests, also das Root-`manifest.yaml`, das die
Sets des Repos auflistet, mit jedem Pflicht- und optionalen Feld
(`schema_version`, `name` sowie pro Set `id`, `title`, `title_native`,
`target_language`, `source_language`, `level`, `version`,
`lesson_count`, `path`, `domain`, `tags`, `book`), steht in der
Engine-Referenz:
[learn-content-engine, Manifest format](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md#manifest-format).
Das strikte Schema der Engine (unbekannte Felder werden abgelehnt)
validiert es, sodass die obige Feldliste nicht driften kann. Die
Sprachpaar-Felder (`target_language` / `source_language`) werden wie
unter [Sprachpaare](#sprachpaare-v1440) beschrieben angegeben; der
Vor-v1.2-Alias `language` lädt weiterhin, ist für neue Sets aber
nicht empfohlen.

App-spezifisches Loader-Verhalten, das zu beachten ist:

- Das Set-Manifest listet jede Lektionsdatei unter `metadata.lessons`,
  und der Content-Loader iteriert diese Liste **in der gegebenen
  Reihenfolge**. Die Dateinamen auf der Festplatte sind irrelevant, nur
  die Manifest-Reihenfolge zählt:

  ```yaml
  metadata:
    lessons:
      - 01-intro.json
      - 02-articles.json
      - ...
  ```

## Lektionsschema

Jede Lektion ist eine einzelne JSON-Datei: Top-Level-Metadaten (`id`,
`title`, `description`, `estimated_minutes`), eine Liste von **Cards**
(die kleinsten lernbaren Einheiten — stabile Ids, Front/Back-Paare,
Markdown-`notes`, `tags` für das SRS) und eine Liste von **Steps**,
jeder entweder ein THEORY-Step (ein Markdown-`body`, optional ein
`example_url`-Link oder inline `examples`) oder ein EXERCISE-Step
(genau eine Übung).

Die vollständige Feld-für-Feld-Formatreferenz — jedes Feld, jeder
Aufgabentyp, jeder Cloze-Modus, mit JSON-Beispielen, die von der
Engine-Testsuite validiert werden — lebt in der **Engine-Referenz**:

- [learn-content-engine — `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
  — die kanonische Lektionsformat-Referenz für Autoren und
  Dritt-Validatoren (kein App-Checkout nötig)
- das maschinenlesbare Schema, das jedem Engine-Release beiliegt:
  `import schema from "learn-content-engine/schema/lesson.schema.json"`
- der In-App-Zwilling: die generierte
  [Lektionsformat-Referenz](lesson-format-reference.md)

Das gebündelte Schema der Engine ist byte-identisch mit dem hier
generierten `schema/lesson.schema.json` (erzwungen durch
`make engine-parity-check`) — "validiert gegen die Engine" und
"validiert in der App" sind dieselbe Aussage.

## Welcher Aufgabentyp für welches Lernziel

Wähle den Aufgabentyp nach dem **Lernziel**, nicht nach Abwechslung.
Wort-für-Wort-Bewertung per exact-match — ein ganzer Satz als `word_tiles`
oder ein Volltext-`free_text` — versagt bei **freier Produktion**: ein Konzept
lässt sich auf viele richtige Weisen formulieren, sodass ein inhaltlich
richtiger Lernender Wort für Wort als falsch markiert wird. Das ist der
demotivierendste Moment, den eine Lektion erzeugen kann. Koppele den Typ
stattdessen an das Ziel:

| Lernziel | Richtiger Typ |
|---|---|
| Faktenwissen mit einer Antwort | `cloze` (Lücke) |
| Konzept wiedererkennen | Multiple-Choice (`cloze` im `select`-Modus) / `matching` |
| Definition eines Konzepts | `cloze` mit Schlüsselbegriff-Lücken |
| Freie Erklärung / Transfer / Vergleich | noch kein exact-match-Typ — vorerst `cloze` / Multiple-Choice; Self-Assessment ist geplant |
| Satz mit eindeutiger Wortreihenfolge (Sprachenlernen) | `word_tiles` |

Faustregel: `word_tiles` nur für Sätze mit wirklich eindeutiger Wortreihenfolge
(eine Übersetzungsübung), und Definitionen sowie Faktenwissen als `cloze` (oder
Multiple-Choice via `cloze` `select`-Modus). Eine freie Definition gehört nie
in `word_tiles` oder Volltext-`free_text` — dafür gibt es keine faire
exact-match-Bewertung. Vollständige Analyse: siehe EXP-041
(`docs/explorations/EXP-041-aufgabentyp-eignung-und-faire-bewertung.md`).

## Aufgabentyp-Katalog (Status)

Eine Referenz über jeden Aufgabentyp: was ausgeliefert wird, was ohne neuen
Typ abbildbar ist, was Kandidat ist und was bewusst ausgeschlossen bleibt. Das
kanonische Modell wird **nicht** auf Vorrat erweitert — ein Typ wird nur
zusammen mit seinem Renderer ausgeliefert (die `SUPPORTED_EXERCISE_TYPES`-
Registry muss dem `ExerciseType`-Enum entsprechen; ein Paritätstest erzwingt
das, die Lehre aus dem v1.4-preview- und dem `picture_choice`-Fall). Neue Typen
kommen bei konkretem Content-Bedarf über das Rezept
[Neuen Aufgabentyp hinzufügen](adding-exercise-type.md).

### Implementiert (das `ExerciseType`-Enum)

| Typ | Wofür (Lernziel, EXP-041) | Hinweis |
|-----|---------------------------|---------|
| `matching` | Konzepte erkennen / zuordnen | Paar-Zuordnung, ≥ 3 Paare. |
| `picture_choice` | Aus einem echten **Bild** erkennen | ≥ 2 Bilder, genau eins korrekt. Nicht für Text-MC. |
| `free_text` | Kurze, faktenförmige Antwort produzieren | Exakt-Match, dann Levenshtein ≤ 1. |
| `word_tiles` | Eine eindeutige Wortreihenfolge (Sprache) | Kacheln gemischt; `accept_orderings` für Varianten. |
| `cloze` (`type`) | Ein Fakt mit einer Antwort | Ein `<input>` pro Lücke. |
| `cloze` (`select`) | Single Multiple Choice (Legacy-Mittel) | Rendert als tappbare Buttons (#1342). `accept[0]` korrekt + `distractors`. |
| `cloze` (`multiselect`) | „Alles Zutreffende auswählen" (Legacy-Mittel) | Exakt-Mengen-Abgleich über `accept` (alle korrekt) + `distractors` (#1195). |
| `multiple_choice` | **Nativer Text-Multiple-Choice** (Schema v1.6, #1525) | `options` (`{text, correct?}`, eindeutige Texte) + `multiple`. Single = genau eine korrekt; Multi = Exakt-Mengen-Abgleich, keine Teilpunkte. |

Seit Schema v1.6 gibt es einen nativen `multiple_choice`-Typ. Er **koexistiert**
mit dem `cloze`-`select`/`multiselect`-Mittel (EXP-036 §4.3, #890) — bestehender
cloze-basierter MC bleibt gültig, nichts ist deprecated. Für neuen Text-MC-
Content ist `multiple_choice` zu bevorzugen: Korrektheit ist ein Flag pro
Option, die accept/distractor-Disjunktheits-Falle kann nicht passieren. Siehe
[Multiple Choice erstellen](#multiple-choice-erstellen).

### Extension-Tier (der `ext:`-Namespace)

Neben dem geschlossenen Core-Enum gibt es Aufgabentypen im Namespace
`ext:<vendor>-<name>`. Für das Core-Schema sind sie strukturell opak: eine
Lektion, die sie nutzt, deklariert sie in `requires_extensions`, und die
Payload validiert die registrierte Extension, nie das Core-Schema. Der
Mechanismus ist in der Engine-Referenz
[learn-content-engine — `docs/extensions.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/extensions.md)
beschrieben. Die App hat fünf Extension-Typen adoptiert
(`SUPPORTED_EXT_EXERCISE_TYPES` im `ExerciseDispatcher`; ein
Paritäts-Gate hält Dispatcher und Load-Guard synchron, sodass alles
Ladbare renderbar ist):

| Typ | Wofür | Payload (`ext_payload`) | Adoptiert |
|-----|-------|-------------------------|-----------|
| `ext:al-categorization` | Begriffe in Gruppen einordnen | `categories: [{name, items[]}]`, mindestens 2 Gruppen | #1591 (erster Extension-Typ, Inventur #1579) |
| `ext:al-error-correction` | Fehlerhaften Text korrigieren | `tokens[]` + `error_index` + `accept[]` | #1593 |
| `ext:al-reading-comprehension` | Leseverständnis (Textpassage + Fragen) | `passage` + `questions[]` (je eine `multiple_choice`- / `free_text`-Teilfrage) | #1603 |
| `ext:al-graded-quiz` | Benotetes Quiz | `questions[]` (je mit `points`) + optionale `pass_threshold` | #1616; das Demo-Referenz-Set ist in Entdecken / Meine Inhalte ausgeblendet (#1702) |
| `ext:al-dictation` | Audio-Diktat (hören, dann transkribieren) | `audio` (ein `assets/`-Clip) + `accept[]` (toleranter Transkriptions-Abgleich) | #1881 (fünfte Adoption) |

**Zwei Autorenwege.** Extension-Aufgaben lassen sich (a) direkt als
Content-Repo-JSON schreiben (der kanonische Weg, in der Engine-Referenz
beschrieben) oder (b) in der App. Der Lektions-Creator hat einen
**Extension-Autoren-Wizard** bekommen (#1852), erreichbar über die Vorlage
*Erweiterte Aufgabentypen* in Schritt 1, der alle fünf Typen abdeckt (#1859
Kategorisierung + Fehlerkorrektur, #1865 Leseverständnis + Graded-Quiz, #1887
Diktat). Diktat ist außerdem über den Core-Aufgabentyp-Picker in Schritt 3
erreichbar, hinter einem verallgemeinerten `requires_extensions`-Gate (#1895).
Beide Wege erzeugen dasselbe Lektions-JSON und setzen `requires_extensions`
(versioniert, z. B. `ext:al-dictation@1`).

#### Beispiel je Extension-Typ

Jeder Block ist das Übungsobjekt, wie es in einer Lektions-`.json` steht; die
typspezifischen Daten liegen unter `ext_payload`. Die kanonische Feldreferenz
ist die `docs/extensions.md` der Engine.

```json
{
  "type": "ext:al-categorization",
  "prompt": "Ordne jedes Wort in Obst oder Gemüse ein.",
  "ext_payload": {
    "categories": [
      {"name": "Obst", "items": ["Apfel", "Banane"]},
      {"name": "Gemüse", "items": ["Karotte", "Kartoffel"]}
    ]
  }
}
```

```json
{
  "type": "ext:al-error-correction",
  "prompt": "Ein Wort ist falsch. Korrigiere es.",
  "ext_payload": {
    "tokens": ["Die", "zwei", "Kind", "spielen"],
    "error_index": 2,
    "accept": ["Kinder"]
  }
}
```

```json
{
  "type": "ext:al-reading-comprehension",
  "prompt": "Lies den Text und antworte.",
  "ext_payload": {
    "passage": "Marie sitzt in einem Café. Sie bestellt einen Kaffee und liest ein Buch.",
    "questions": [
      {
        "prompt": "Wo ist Marie?",
        "type": "multiple_choice",
        "options": [
          {"text": "In einem Café", "correct": true},
          {"text": "Zu Hause"},
          {"text": "Am Bahnhof"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-graded-quiz",
  "prompt": "Begrüßungs-Quiz.",
  "ext_payload": {
    "pass_threshold": 60,
    "questions": [
      {
        "prompt": "Wie sagt man 'hallo' auf Französisch?",
        "type": "multiple_choice",
        "points": 1,
        "options": [
          {"text": "Bonjour", "correct": true},
          {"text": "Merci"},
          {"text": "Au revoir"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-dictation",
  "prompt": "Hör zu und tippe, was du hörst.",
  "ext_payload": {
    "audio": "assets/audio/comment-ca-va.mp3",
    "accept": ["Comment ça va ?", "Comment ca va"]
  }
}
```

### Verfügbarkeit im Lektions-Wizard

Spielbar (ein Renderer existiert), generierbar (der KI-Mix kann den Typ
erzeugen) und manuell anlegbar (in Schritt 3 von Hand hinzufügen + bearbeiten)
sind drei verschiedene Dinge. Alle sechs Core-Typen sind spielbar UND
generierbar: die Typauswahl im Create-Lesson-Wizard (`ALL_TYPES` in
`ExerciseGenerator.tsx`) bietet jeden Core-Typ an, und jede Übung in Schritt 3
ist inline editierbar und umsortierbar, mit einem manuellen **+ Übung
hinzufügen**-Button (#1849, #1853).

| Typ | Spielbar | Generierbar (KI-Mix) | Manuell anlegbar (Schritt 3) |
|-----|----------|----------------------|------------------------------|
| `matching` | ja | ja | ja |
| `free_text` | ja | ja | ja |
| `cloze` | ja | ja | ja |
| `word_tiles` | ja | ja | ja |
| `picture_choice` | ja | ja | ja |
| `multiple_choice` | ja | ja (#1853; Single-/Multi-Modus-Steuerung #1888) | ja |
| `ext:al-dictation` | ja | nein | ja, über den Core-Picker (#1895) oder den Extension-Wizard (#1887) |
| `ext:al-categorization` | ja | nein | über den Extension-Wizard (#1859) |
| `ext:al-error-correction` | ja | nein | über den Extension-Wizard (#1859) |
| `ext:al-reading-comprehension` | ja | nein | über den Extension-Wizard (#1865) |
| `ext:al-graded-quiz` | ja | nein | über den Extension-Wizard (#1865) |

Die vier Nicht-Diktat-Extension-Typen werden im Extension-Wizard (oder als
Content-Repo-JSON) angelegt, nie in die Core-KI-Generierung gemischt.

**Listen-First ist ein Modus, kein Typ.** Seit #1687 (Entscheidung
#1600, Option A) können `free_text`- und `matching`-Aufgaben ein
Audio-Vorschalt-Element erhalten (erst hören, dann antworten). Der
Aufgabentyp der Übung ändert sich dabei nicht. Option B derselben
Entscheidung, ein Diktattyp, ist als Extension `ext:al-dictation`
ausgeliefert (#1881) und oben im Extension-Tier dokumentiert.

### Der Lektions-Creator als Autorenwerkzeug

Der App-interne Lektions-Creator (`/create-lesson`) ist eine vollständige
Autorenoberfläche, nicht nur ein KI-Generieren-Knopf:

- **Jede Übung in Schritt 3 ist an Ort und Stelle editierbar.** Jede
  generierte oder hinzugefügte Übung öffnet sich in einem Inline-Editor (alle
  sechs Core-Typen plus die Extension-Editoren); per Drag umsortieren, löschen
  oder den ganzen Mix neu generieren (#1845).
- **Eine Übung von Hand anlegen.** Der **+ Übung hinzufügen**-Button wählt
  einen Typ und hängt eine leere Übung direkt in den Inline-Editor an, sodass
  ohne jede KI-Generierung geschrieben werden kann (#1849, #1853). Der Picker
  listet die sechs Core-Typen plus Diktat (#1895).
- **Der Beispielsatz steuert die Generierung.** Eine Karte (Schritt 2) kann
  einen optionalen **Beispielsatz** tragen. Er ist es, der die `cloze`- und
  `word_tiles`-Generierung für diese Karte ermöglicht (bei Cloze muss der Satz
  den Front-Begriff der Karte enthalten, damit er ausgeblendet werden kann),
  und ein Kartenbild ermöglicht `picture_choice`. Ohne sie werden diese Typen
  stillschweigend übersprungen, und Schritt 3 erklärt, welcher ausgewählte Typ
  nichts produziert hat (#1847, #1848).

### Ohne neuen Typ abbildbar (Konventionen, keine Typen)

| Konzept | Wie |
|---------|-----|
| Wahr/Falsch, Ja/Nein | Zwei-Optionen-`multiple_choice` (oder Zwei-Optionen-`cloze`-`select`) |
| Dropdown / Radio / Checkbox | Darstellung von `multiple_choice` / cloze select — keine eigenen Typen |

### Geplant bei Bedarf (Kandidaten — KEINE Zusage)

| Kandidat | Nah an | Wann |
|----------|--------|------|
| Reihenfolge festlegen / Sortieren | `word_tiles` | Nur bei konkretem Content-Bedarf, dann über das Rezept. |
| Zahlenfeld (numerischer Vergleich) | `free_text` | Nur bei konkretem Content-Bedarf, dann über das Rezept. |

### Bewusst nicht

| Ausgeschlossen | Warum (ein Satz) |
|----------------|------------------|
| Essay / Langtext / Zeichnen / Formel / Peer-Review / freie Selbstbewertung | Nicht binär SRS-bewertbar; Selbstbewertung zurückgestellt (#1268). |
| Audio / Video / Datei-Upload | Storage + Infrastruktur; widerspricht Offline-First. |
| Hotspot / Simulation / Memory / Kreuzworträtsel | Aufwand ohne SRS-Mehrwert (später ggf. eigene Entscheidung). |
| Matrix / Likert / Slider | Umfrage-Typen, keine Lern-Typen. |
| Datum / Uhrzeit-Auswahl | Formular-Typen, keine Lern-Typen. |

### Video-Inhalte: verlinken, nicht mitliefern

Nativer Video- (und Audio-)Upload ist bewusst ausgeschlossen (siehe
Tabelle oben): Medien-Assets lokal zu speichern widerspricht den
Offline-First-Speichergrenzen. Das empfohlene Muster liefert denselben
Lernwert, ohne ein einziges Byte Video mitzuliefern: das Video extern
verlinken und eine Leseverständnis-Übung über sein Transkript bauen.

**1. Video als begleitendes Medium verlinken.** In die `resources[]` der
Lektion aufnehmen (ein `LessonResource`, EXP-029), damit es im Abschnitt
*Vertiefe das Thema* der Lektion erscheint. Ein YouTube-Clip nutzt
`type: "youtube"`:

```json
"resources": [
  {
    "type": "youtube",
    "title": "Se présenter en français (A1)",
    "url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
    "language": "fr",
    "level": "A1",
    "free": true
  }
]
```

**2. Verständnis über das Transkript prüfen.** Eine
`ext:al-reading-comprehension`-Übung ergänzen, deren `passage` das
Transkript des Videos (oder ein in sich geschlossener Ausschnitt daraus)
ist, mit den Verständnisfragen darüber:

```json
{
  "type": "ext:al-reading-comprehension",
  "prompt": "Sieh dir das Video an und beantworte dann.",
  "ext_payload": {
    "passage": "Bonjour ! Je m'appelle Camille. J'ai vingt-cinq ans et j'habite à Lyon. Je suis étudiante et j'aime la musique.",
    "questions": [
      {
        "prompt": "Où habite Camille ?",
        "type": "multiple_choice",
        "options": [
          {"text": "À Lyon", "correct": true},
          {"text": "À Paris"},
          {"text": "À Marseille"}
        ]
      }
    ]
  }
}
```

Die Übung ist vollständig offline und wird wie jede andere SRS-bewertet;
das Video ist optionale Vertiefung, erreichbar über *Vertiefe das Thema*,
und ein Lernender ohne Verbindung bekommt weiterhin das transkript-basierte
Leseverständnis.

**Das Transkript zahlt sich doppelt aus.** Ein Transkript (oder Untertitel)
ist ohnehin die Barrierefreiheits-Grundlage, die jedes Video für die
WCAG-Konformität mitbringen sollte. Hier wird genau dieses Transkript zur
`passage` der Verständnis-Übung: ein Artefakt, zwei Verwendungen,
Barrierefreiheit und eine bewertbare Übung aus derselben Quelle.

## Übungstyp-Referenz

Die Feld-Referenz je Typ — `matching`, `picture_choice`, `free_text`,
`word_tiles`, `multiple_choice` und `cloze` mit seinen Modi `type` /
`select` / `multiselect`: Pflichtfelder, JSON-Beispiele und die semantischen
Regeln (Cloze-`___`-Marker == `blanks`, referenzielle Integrität der
`card_ids`, Disjunktheit von accept/distractors bei multiselect,
exactly-one-correct bei picture_choice) — lebt in der Engine-Referenz:
[learn-content-engine — `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md).
Jedes JSON-Beispiel dort wird von der Engine-Testsuite extrahiert und
validiert, die Referenz kann also nicht veralten. Die App-spezifischen
Autoren-Konventionen unten bleiben hier.

### Multiple Choice erstellen

**Bevorzugt (Schema v1.6+, #1525): der native `multiple_choice`-Typ.**
Jede Option trägt ihr eigenes `correct`-Flag, es gibt also keine
getrennten accept/distractor-Listen, die disjunkt bleiben müssen.
`multiple: false` (Default) ist Single Choice (genau eine korrekt);
`multiple: true` ist „alles Zutreffende auswählen"
(Exakt-Mengen-Bewertung, keine Teilpunkte):

```json
{
  "id": "ex-hauptstadt",
  "type": "multiple_choice",
  "prompt": "Was ist die Hauptstadt von Frankreich?",
  "card_ids": ["card-paris"],
  "options": [
    {"text": "Paris", "correct": true},
    {"text": "Berlin"},
    {"text": "Madrid"},
    {"text": "Rom"}
  ]
}
```

**Legacy-Mittel (weiterhin voll gültig — Koexistenz, nichts deprecated):**
vor v1.6 wurde Text-MC als `cloze` im `select`-Modus erstellt (EXP-036
§4.3, #890). Eine Single-Choice-Frage ist ein Cloze mit einer Lücke:
der `sentence` (endet auf `___`) ist die Frage, `accept[0]` der
Lücke ist die richtige Option, und `distractors` sind die falschen
Optionen. Beispiel: `"sentence": "Die Hauptstadt von Frankreich ist
___."`, `"blanks": [{"accept": ["Paris"]}]`, `"cloze_mode":
"select"`, `"distractors": ["Berlin", "Madrid", "Rom"]`.

Du kannst die ganze Frage auch in `prompt` schreiben und einen bloßen
`"sentence": "___"` verwenden — der Renderer zeigt ein `<select>` aus
richtiger Antwort + Distraktoren, bewertet die Auswahl, gibt Feedback
und speist das SRS:

```json
{
  "id": "ex-hook-state",
  "type": "cloze",
  "prompt": "Welcher Hook verwaltet lokalen State in einer Funktionskomponente?",
  "card_ids": ["card-usestate"],
  "sentence": "___",
  "blanks": [{"accept": ["useState"]}],
  "cloze_mode": "select",
  "distractors": ["useEffect", "useContext", "useRef"]
}
```

> **Erstelle Text-Multiple-Choice niemals als `picture_choice`.** Dieser
> Typ ist nur für echte Bild-Assets; für Text-Optionen rendert er
> Platzhalter-Kacheln statt einer nutzbaren Kontrolle (vgl.
> astrapi69/adaptive-learner-content-test#10). Text-MC ist
> `multiple_choice` (bevorzugt) oder `cloze` `select`-Modus, wie oben.

**"Alle zutreffenden auswählen"** (zwei oder mehr richtige
Antworten, z. B. eine Führerscheinprüfungs-Frage) nutzt
`cloze_mode: "multiselect"`:

```json
{
  "type": "cloze",
  "cloze_mode": "multiselect",
  "sentence": "Welche Städte liegen in Deutschland?",
  "accept": ["Berlin", "Hamburg"],
  "distractors": ["Wien", "Zürich"]
}
```

**Mehrere Lücken pro Cloze** sind unterstützt: jeder `___` im
Satz wird der Reihe nach auf den nächsten Eintrag in `blanks`
abgebildet. Jede Lücke kann eigenen Hint + Placeholder +
Accept-Liste haben. Das Element-SRS fächert pro Lücke einen
ElementAttempt auf — wer Lücke A fließend füllt, aber Lücke B
ständig verfehlt, bekommt eine lückengranulare Mastery-
Verfolgung.

**Token-Rollen auf Cards (Phase 52I / v1.35.0)** — optionale
Card-Metadaten, mit denen der Cloze-Generator zur Laufzeit
(Review-Sessions + die Korrektur-Runde am Lektionsende) eine
semantisch bedeutsame Lücke wählen kann:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "eine Katze",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Geschlossene Enum von Rollen: `article` / `verb` / `noun` /
`adjective` / `preposition` / `gender_marker` / `tense_marker`.
Eine Rolle hinzuzufügen ist ein Minor-Schema-Version-Bump —
nicht inline erweitern.

## Nicht-lateinische Schriften: Umschrift-Konvention

Verbindliche Regeln für Sets, deren Zielsprache eine nicht-lateinische
Schrift verwendet (Japanisch, Chinesisch, Koreanisch, Griechisch,
Hindi, ...). Im Content-Repo etabliert und angewendet — Präzedenzen:
[content#90](https://github.com/astrapi69/adaptive-learner-content/issues/90),
[content#91](https://github.com/astrapi69/adaptive-learner-content/issues/91);
Restlücken-Sweeps:
[content#106](https://github.com/astrapi69/adaptive-learner-content/issues/106),
[content#107](https://github.com/astrapi69/adaptive-learner-content/issues/107).

**1. Richtungs-Regel.** Umschrift gibt es nur für die nicht-lateinische
**Ziel**sprache bei lateinisch schreibender Quellsprache (de→ja, de→zh,
de→ko, ...). Eine nicht-lateinische **Quell**sprache mit lateinischem
Ziel (hi→en, el→fr) bekommt keine Umschrift — die Lernenden lesen ihre
eigene Schrift bereits.

**2. Format.** Runde Klammern direkt hinter dem Original:
こんにちは (konnichiwa). In Theorie-Schritten immer; in Optionen und
Prompts nur, wo es unschädlich ist (siehe Verrats-Regel).

**3. Verrats-Regel (der Kern).** Die Umschrift darf nie die Lösung
verraten. Schrift-Lese-Aufgaben, Ton-Erkennung, `word_tiles`-Kacheln
und Cloze-Satzkontexte bleiben OHNE Umschrift am abgefragten Element;
Bedeutungs-Aufgaben bekommen sie. Im Zweifel weglassen.

- Positiv-Beispiel (Bedeutungs-Matching, content#91): das Matching-Paar
  `{"left": "妈 (mā)", "right": "Mama / Mutter"}` — abgefragt wird die
  Bedeutung, die Lesehilfe verrät also nichts.
- Negativ-Beispiel (Schrift-Lesen, content#91): die Schrift-Lese-Aufgaben
  in `ko-a1/01-hangul-lesen` bleiben ohne Umschrift, weil die
  Romanisierung selbst die Antwort IST (Zeichen → Laut); `가 (ga)` im
  Prompt würde den Lernenden die Lösung in die Hand geben.

**4. Standard-Romanisierung je Sprache, konsistent pro Set:**
Japanisch Hepburn, Chinesisch Pinyin MIT Tonzeichen, Koreanisch
Revidierte Romanisierung, Griechisch/Hindi eine gängige vereinfachte
Umschrift. Nie Systeme innerhalb eines Sets mischen.

**5. Tipp-Aufgaben** (`free_text` / Cloze-Modus `type`): `accept[0]`
ist die kanonische romanisierte Form; gängige Varianten zusätzlich
akzeptieren — Japanisch: Kunrei-Schreibungen (si/ti/tu/hu/zi, z. B.
`konnitiwa` neben `konnichiwa`); Chinesisch: tonloses Pinyin (`nihao`
neben `nǐ hǎo`); Koreanisch: verbreitete Alternativen (z. B.
`annyeong haseyo`). Merksatz: **Eine Aufgabe darf nie an der Tastatur
der Lernenden scheitern.** Präzedenz (IME-Blocker, content#107): ein
Cloze, das nur 가 akzeptierte, war ohne koreanisches IME unlösbar —
das romanisierte `ga` musste zusätzlich akzeptiert werden.

Welcher Typ welches Lernziel trägt: siehe
[Aufgabentyp-Katalog](#aufgabentyp-katalog-status).

## Übungsrichtung (v1.46.0 / EXP-018)

Jede Übung akzeptiert ein optionales Feld `direction`, das angibt,
in welche Richtung die Lernenden die Karte üben:

- `target_to_source` (Standard) — REZEPTIV: die Zielsprache wird
  gezeigt, die Quellsprache wird erkannt (leichter).
- `source_to_target` — PRODUKTIV: die Quellsprache wird gezeigt,
  die Zielsprache wird produziert (schwerer).
- `both` / `random` — überlässt dem Renderer / adaptiven Generator
  die Wahl einer konkreten Richtung pro Versuch.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

Das Feld ist additiv — das Schema bleibt bei Version 1.2, und
Lektionen ohne `direction` verhalten sich genau wie zuvor
(rezeptiv). Das SRS verfolgt die Beherrschung pro Richtung: eine
rezeptiv gemeisterte Karte ist noch nicht produktiv gemeistert.
Cloze-Übungen sind kontextgebunden und ignorieren `direction`. Für
eine Schwierigkeitsprogression hält man frühe Lektionen rezeptiv
und führt `source_to_target` in späteren Lektionen ein (genau das
macht der gebündelte Pilot-Inhalt).

### Annotationen für den adaptiven Lektions-Generator (v1.36.0+)

Der adaptive Lektions-Generator aus Phase 53
(`/adaptive-lesson/:setId`, F-114) kombiniert die vorhandenen
Übungen neu, um die spezifischen Schwächen der Lernenden
gezielt zu adressieren. Der Generator funktioniert ohne
zusätzliche Annotationen, zwei Felder machen ihn jedoch
deutlich smarter:

1. **Breitere `token_roles`-Abdeckung auf Karten.** Der
   Generator nutzt `token_roles`, um:
   - Semantisch sinnvolle Lücken zu wählen, wenn aus Fehlern
     Cloze-Varianten erzeugt werden (bereits in v1.35.0)
   - Fehler als `article_gender` / `verb_conjugation` zu
     klassifizieren, für die "Übungsschwerpunkt"-Chips im
     Dashboard (53E)
   - ALTERNATIVE Übungen zu finden, die dasselbe Element
     testen, wenn die ursprüngliche Übung falsch war (53D
     Variations-Logik — findet Kandidaten, deren Karte einen
     passenden `token_roles`-Eintrag hat)

   Füge JEDEN Karten, die eine eigene grammatische Einheit
   lehrt (Artikel, konjugierte Verbformen, geschlechtsbezogene
   Substantive), einen `token_roles`-Eintrag hinzu. Kosten:
   ein zusätzlicher JSON-Eintrag pro Karte; Nutzen: deutlich
   reichhaltigere adaptive Generierung.

2. **Karten-Tags wie `tags: ["article", "masculine"]`** werden
   vom Fehler-Klassifizierer als Fallback gelesen, wenn
   `token_roles` fehlt. Sie ersetzen nicht `token_roles` — sie
   sind eine günstige Halbweg-Annotation.

Was wir noch NICHT brauchen (auf einen zukünftigen Schema-Bump
verschoben):

- `related_cards`-Querverweise zwischen Karten aus
  verschiedenen Lektionen
- Schwierigkeits-Ratings pro Übung (der Generator schätzt
  Schwierigkeit aktuell aus `exercise.type` ab)
- Pro-Karte Beispielsätze in `notes`, parsebar als
  alternative Cloze-Kontexte (der Cloze-Generator nutzt
  ausschließlich `front`)

Faustregel: füge `token_roles` zu jeder Karte hinzu, die einen
grammatischen Token lehrt. Das ist die mit Abstand
wirkungsvollste Autoren-Gewohnheit für das adaptive System.

## Assets (Bilder, die ein Set mitbringt) — v1.37.0+

Picture-Choice-Übungen und Karten-Cover-Bilder kommen aus
zwei Quellen:
1. **Autoren-Asset-Dateien**, im Set-Manifest deklariert und
   neben dem Lektions-JSON ausgeliefert
2. **Platzhalter-SVGs**, vom Runtime erzeugt, wenn kein
   Asset existiert (Farbtafeln für Farbwörter, große Ziffern
   für Zahlen, Avatar-Stil für alles andere)

Wenn du ein Set ohne Assets veröffentlichst, funktioniert
Picture-Choice trotzdem — der Platzhalter-SVG-Generator deckt
Farben + Zahlen automatisch ab und fällt für alles andere auf
einen deterministischen Avatar zurück.

### Verzeichnis-Layout

Innerhalb des Set-Verzeichnisses liegen Assets unter
`assets/`:

```
sets/
  language-fr-a1/
    manifest.yaml
    lessons/
      01-greetings.json
      02-numbers.json
      ...
    assets/
      img/
        chat.png
        chien.png
        oiseau.png
```

### Manifest-Deklaration

Jedes Asset muss im Set-Manifest deklariert werden, damit der
Downloader weiß, was er holen soll:

```yaml
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 10
    assets:
      - path: img/chat.png
        size_kb: 45
      - path: img/chien.png
        size_kb: 38
```

Der `path` ist relativ zum `assets/`-Verzeichnis des Sets
(NICHT zum Lektions-JSON). Im Lektions-JSON referenzieren
Picture-Choice-Übungen Assets MIT dem `assets/`-Präfix:

```json
{
  "type": "picture_choice",
  "prompt": "Welches ist 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Katze", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Hund"}
  ]
}
```

Das Frontend entfernt den `assets/`-Präfix automatisch beim
Aufruf des Asset-Resolvers, sodass das Lektions-JSON in der
für Autoren intuitiven Form bleibt.

### Größen- + Format-Limits

- **Pro-Asset-Limit**: 500 KiB. Der Manifest-Validator weist
  Assets ab, deren deklariertes `size_kb` dieses Limit
  überschreitet. Der Downloader weist auch Assets ab, deren
  tatsächliche Bytegröße die Deklaration um mehr als 10%
  überschreitet — hält das Manifest ehrlich.
- **Pro-Set Soft-Limit**: 10 MiB Gesamtgröße. Der Validator
  warnt, lehnt aber nicht ab.
- **Akzeptierte Formate**: `.png` / `.jpg` / `.jpeg` /
  `.webp` / `.svg`. Kein GIF (animierte Inhalte lenken ab),
  kein BMP (keine Kompression). Für Fotos bevorzugt WebP —
  deutlich kleiner als PNG bei vergleichbarer Qualität. Für
  Icons + Diagramme bevorzugt SVG — skaliert sauber + winzige
  Dateigröße.

### Größen-Empfehlungen

Picture-Choice-Kacheln werden bis maximal 150x150 px auf dem
Desktop und 100x100 px auf Mobile gerendert (`object-fit:
contain`). Quellbilder mit 300x300 px liefern auf Retina-
Bildschirmen das beste Ergebnis ohne unnötigen Datenbedarf.
PNGs über 150 KiB sehen selten besser aus als ein gut
komprimiertes WebP halber Größe.

### Wann der Runtime-Platzhalter ausreicht

Drei Lektionsarten, bei denen der Runtime-Platzhalter so gut
ist, dass Autoren-Bilder keinen Lerngewinn bringen:

- **Farb-Lektionen** (`rouge` / `rojo` / `rot` / `red`): der
  Platzhalter-Generator erzeugt eine farbige Hex-Kachel
  passend zum Farbnamen. Autoren-Kacheln sind redundant.
- **Zahlen-Lektionen** (`7` / `42` / `1492`): der Platzhalter
  rendert die Ziffern groß + zentriert. Autoren-Bilder hätten
  nur bei nicht-arabischen Ziffernsystemen Sinn.
- **Abstrakte Konzepte** ohne offensichtliche visuelle
  Darstellung (`patience`, `liberté`): der Avatar-Platzhalter
  liefert einen klaren visuellen Anker, ohne eine umstrittene
  Icon-Wahl zu erzwingen.

Für alles andere (Tiere, Objekte, Essen, Orte, Körperteile)
helfen Autoren-Bilder messbar bei Erkennen + Erinnern.

## Qualitäts-Checkliste

Vor dem PR für eine neue Lektion prüfen:

- [ ] **3-5 Theorie-Schritte** + **8-12 Übungen** pro Lektion
- [ ] **Mindestens 3 Übungstypen** vertreten (matching, picture-choice, free-text, word-tiles oder cloze — cloze ab v1.35.0)
- [ ] **Theorie-Schritte ≤ 200 Wörter** je Schritt
- [ ] **Free-Text-Übungen**: ≥ 3 Akzept-Varianten + ≥ 3 Distraktoren
- [ ] **Word-Tiles**: ≥ 3 Kacheln je Übung
- [ ] **estimated_minutes**: 10-15 (realistisch, nicht idealisiert)
- [ ] **Distraktoren sind falsch-aber-plausibel** — semantisch verwandt, nie zufällig
- [ ] **Card-Notes** liefern echten Mehrwert (Aussprache, falsche Freunde, Ausnahme-Flag)
- [ ] **Progressive Struktur**: spätere Konzepte bauen auf früheren im selben Set auf
- [ ] **Kulturelle Genauigkeit**: realer Sprachgebrauch, nicht nur Lehrbuch-Floskeln
- [ ] **Schema-Validierung**: die Lektion lädt sauber via `dict_to_lesson()` (siehe Lokales Testen)
- [ ] **Card-ID-Integrität**: jedes `exercise.card_ids[i]` existiert in `cards[]` der Lektion
- [ ] **Sprachpaar**: `target_language` + `source_language` gesetzt (ISO 639-1, verschieden), `title_native` vorhanden

## Validierung (zwei Ebenen, v1.44.0)

Inhalte werden durch zwei Validierungsebenen mit den GLEICHEN
Prüfungen abgesichert:

1. **In der App, vor dem Teilen.** Beim Teilen über *Meine
   Lektionen → Für die Community bereitstellen* läuft zuerst eine
   regelbasierte Prüfung (immer, ohne KI). Sie erzwingt die
   **Mindestwerte** unten; ein Set darunter kann nicht geteilt
   werden. Besteht es und ist ein KI-Schlüssel konfiguriert, kann
   der Lernende OPTIONAL eine ergänzende KI-Prüfung starten
   (Übersetzungsgenauigkeit, Distraktor-Plausibilität, Grammatik,
   Niveau, kulturelle Sensibilität, Natürlichkeit). Der KI-Schritt
   ist nie automatisch, erfordert ausdrückliche Zustimmung (der
   Lektionsinhalt wird an den konfigurierten Anbieter gesendet) und
   blockiert das Teilen nie — die regelbasierte Prüfung ist das Tor.
2. **In der CI des Content-Repos.** Ein Pull Request an
   `astrapi69/adaptive-learner-content` führt dessen eigenes
   `scripts/validate_content.py` aus (Struktur gegen den vendored,
   Engine-gepinnten Schema-Spiegel + Qualitäts-Mindestwerte) plus
   ein Engine-Konformitäts-Gate (`learn-content-engine`
   `validate()` über jede Lektion), damit ein manueller PR das Tor
   nicht umgeht.

**Qualitäts-Mindestwerte (hartes Tor):** ≥ 5 Übungen pro Lektion,
≥ 2 Übungstypen, ≥ 1 Theorie-Schritt, Free-Text ≥ 2 akzeptierte
Antworten + Distraktoren, Matching ≥ 3 Paare, Picture-Choice mit
Distraktoren, keine leeren Karten-Vorder-/Rückseiten und (bei
nicht-lateinischen Ausgangsschriften) Karten-Rückseiten in der
Ausgangsschrift. Das sind Mindestwerte, keine Ziele — die
Checkliste oben verlangt mehr.

### Set-weite KI-Inhaltsprüfung (optional)

Neben der Prüfung beim Teilen kann ein heruntergeladenes Set
set-weit über *Mit KI prüfen* begutachtet werden. Das ist völlig
optional und nutzt den **Anbieter + das Modell**, das der Lernende
konfiguriert hat (Anthropic / OpenAI / Gemini); die Karten werden
in Stapeln an diesen Anbieter zur Prüfung gesendet. Der Ablauf
zeigt eine Kostenschätzung, läuft mit Fortschrittsbalken +
Abbrechen und erzeugt einen **Pro-Karte-Bericht**, der im Browser
gecacht und als **Markdown** exportiert werden kann (mit einer
Zeile, die festhält, welcher Anbieter + welches Modell die Prüfung
ausgeführt hat). Besteht der Bericht, erhält das Set eine
**„KI-geprüft"-Plakette**, die durch einen Content-Hash + eine
Signatur abgesichert ist, sodass eine spätere Änderung an den
Karten die Plakette ungültig macht, bis das Set erneut geprüft
wird. Die KI-Prüfung ist nie ein Tor — sie ist beratende
Provenienz, keine Veröffentlichungsvoraussetzung.

## Lokales Testen

Der Schema-Validator des Content-Loaders läuft im Rahmen von
`make test`. Eine einzelne Lektion von Hand validieren:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

Alle Lektionen eines Content-Repos auf einmal validieren — mit dem
Validator des Content-Repos (dasselbe Skript, das dessen CI bei jedem
PR ausführt):

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

Er findet jedes Set unter `sets/{source}/{target-level}/` und prüft das
Schema plus die Qualitäts-Mindestwerte (≥5 Übungen, ≥2 Übungstypen, ≥1
Theorieschritt, Freitext-Akzepte + Distraktoren, Matching-Paare, keine
leeren Karten, Karten-ID-Integrität). Neue Lektionen werden automatisch
erkannt — keine Test-Änderung nötig.

## PR-Workflow

Sobald dein Set fertig ist:

1. Öffne einen PR gegen das Haupt-Repo (für Sets, die mit der
   App ausgeliefert werden sollen), ODER
2. Lege ein eigenes Content-Repo unter deinem GitHub-Account an
   und konfiguriere den Content-Loader über
   `backend/config/plugins/content-loader.yaml` (unter
   `default_sources`).

Der Content-Loader unterstützt jedes öffentliche GitHub-Repo als
Quelle. Private Repos benötigen ein Personal Access Token, das
über die Drei-Schichten-Schlüsselverwaltung gesetzt wird
(`~/.config/adaptive_learner/secrets.yaml`).

## Häufige Stolperfallen

**Card-ID-Verweise**: Jeder `card_ids`-Eintrag in einer Übung
muss in `cards[]` der Lektion existieren. Kopierst du eine Übung
zwischen Lektionen und vergisst die zugehörige Card mitzunehmen,
schlägt die Validierung fehl.

**Slug-sichere IDs**: Alle IDs (Lesson, Card, Step, Exercise)
müssen `^[a-z0-9]+(-[a-z0-9]+)*$` matchen. Keine Unterstriche,
keine Apostrophe, keine Großbuchstaben, keine führenden/abschließenden
Bindestriche.

**`is_correct: "true"`**: Es ist ein String, kein JSON-Boolean.
Das Schema verlangt explizit `"true"`, weil die picture_choice-
Felder intern als dict[str, str] modelliert sind.

**Zusätzliche Felder**: Jedes Modell hat `extra="forbid"`. Ein
nicht-dokumentiertes Feld führt zur Ablehnung der gesamten
Lektion. Halte dich an die dokumentierten Felder.

**Theory-Body**: Theory-Steps benötigen ein nicht-leeres
`body`-Feld (Markdown). Exercise-Steps dürfen kein `body` tragen
— nutze stattdessen den `prompt` der Übung.

## Referenz: die gebündelten Sets

Adaptive Learner liefert eine umfangreiche Bibliothek über mehrere
Domänen aus (Sprachen, Programmierung, Psychologie, KI, Technik —
siehe den CONTENT-STATS-Block in der README für die aktuellen
Zahlen + die vollständige Set-Tabelle). Ein paar gute kanonische
Referenzen im `adaptive-learner-content`-Repo:

- `sets/en/fr-a1/` — Französisch A1 für Englischsprachige;
  `sets/de/fr-a1/` ist das deutschsprachige Gegenstück.
- `sets/en/es-a1/` + `sets/de/es-a1/` — Spanisch A1 (eines je
  Quellsprache).
- Das Set „Python — Grundlagen" unter `sets/de/` ist ein
  `domain: programming`-Beispiel (deutsche Quelle == Ziel),
  nützlich als Nicht-Sprach-Referenz.

Alle folgen den in diesem Leitfaden beschriebenen Konventionen.
Eine vollständige Lektion durchzulesen ist der schnellste Weg,
die Struktur zu verinnerlichen.

---

## Weg zur Community-Beteiligung (v1.42.0)

> **Ausführliche Schritt-für-Schritt-Anleitung mit Screenshots:**
> [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f)
> (Medium) führt den App-internen Lektions-Creator von Anfang bis Ende durch,
> von der ersten Karte bis zum Teilen der fertigen Lektion.

Du musst Lektionen nicht von Grund auf von Hand erstellen. Der
schnellste Weg, etwas beizutragen, ist, **eine Lektion in der App
zu erstellen und zu teilen**:

1. Importiere einen Chat und analysiere ihn, dann **Als
   Offline-Lektion speichern** (oder beende eine adaptive Lektion
   und **Diese Lektion speichern?**). Die Lektion erscheint unter
   **Meine Lektionen** im Set-Browser.
2. Klicke bei „Meine Lektionen" auf **Als Content-Set
   exportieren**, um ein Content-Set als `.zip` herunterzuladen
   (Manifest + Lektionen). Exporte enthalten nur den
   Lektionsinhalt — keinen Fortschritt, keine Fehlerhistorie,
   nichts Persönliches.
3. Klicke auf **Für die Community bereitstellen**, um einen
   vorausgefüllten **Pull Request** im Inhalts-Repository zu öffnen
   — die Lektions-JSON wird am richtigen Pfad im Baum committet,
   kein `.zip`-Anhang nötig.
4. Die CI des Repos validiert den PR automatisch; ein Maintainer
   prüft die Lektion, bringt das Manifest (id, title, language,
   level, tags) in Einklang mit den obigen Konventionen und führt
   ihn unter `sets/` zusammen. Nach dem Merge
   können alle sie aus dem Set-Browser herunterladen.

Das ist der soziale Weg: Die Prüfung ist **manuell** (ein
Maintainer kuratiert jede Ergänzung — nichts wird automatisch
veröffentlicht), und der gesamte Ablauf braucht nur GitHub.
Erzeugte Lektionen werden bereits gegen das Schema validiert, sodass
eine beigetragene Lektion meist nur etwas Manifest-Feinschliff
braucht.

## Teilen-Assistent, Variationen und Autoren-Credit (Phase 64)

Eine Lektion aus **Meine Lektionen** zu teilen öffnet einen
vierstufigen Assistenten, statt direkt zu GitHub zu springen:

1. **Vorschau + Platzierung.** Die App berechnet genau, wo die
   Lektion im Baum landet (`sets/{quelle}/{ziel}-{niveau}/`) und
   einen automatisch nummerierten Dateinamen
   (`{nn}-{slug}.json`, die nächste Nummer nach den bestehenden
   Lektionen). Ein ganz neues Paar + Niveau zeigt *"Neues Set! Du
   bist der Erste."*
2. **Duplikat-Prüfung.** Die Lektion wird mit den bereits in
   diesem Pfad vorhandenen Lektionen verglichen (Karten- und
   Übungs-Überschneidung — beratend, niemals blockierend). Wenn
   etwas Ähnliches existiert, kannst du:
   - **Als Variation teilen** — die Lektion wird mit
     `variation_of: "{original_id}"` plus einer optionalen
     `variation_note` markiert ("Wie unterscheidet sich deine
     Version?").
   - **Nur die neuen Übungen vorschlagen** (bei Beinahe-
     Duplikaten) — der Assistent extrahiert genau die Übungen,
     die dem Original fehlen, samt der zugehörigen Karten, als
     Ergänzungs-Variation.
3. **Qualitäts-Zusammenfassung.** Die Befunde des regelbasierten
   Validators (plus die optionale KI-Prüfung); Warnungen werden
   angezeigt, blockieren aber nie.
4. **Teilen + Feiern.** Ein Klick öffnet den GitHub-Pull-Request
   (Datei-Editor bei kleinen Lektionen, Upload-Seite bei großen),
   und die App bedankt sich mit einer kleinen Feier.

### Variations- und Credit-Felder (Schema 1.3, alle optional)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Mehr Übungen zur Angleichung",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

Alle vier sind additiv und optional; Lektionen ohne sie
verhalten sich genau wie zuvor. `contributed_by` wird gesetzt,
wenn der Autor beim Teilen den Credit aktiviert (ein Feld *"Dein
Name (optional)"*, das lokal für das nächste Mal gemerkt wird).
Ist es vorhanden, zeigt der Viewer eine dezente Zeile
*"Bereitgestellt von {name}"* unter dem Titel, und der
Pull-Request-Text führt den Autor in seiner Metadaten-Tabelle auf.

### Beitrags-Historie und Lücken

Geteilte Lektionen werden lokal gemerkt (kein Konto nötig) unter
**Meine Beiträge** mit einem Zähler und einer
*Community-Beitragende*-Auszeichnung ab fünf geteilten Lektionen.
Der Set-Browser zeigt außerdem **Fehlende Lektionen** —
ermutigende Vorschläge für das nächste CEFR-Niveau eines
bestehenden Paars oder eine Zielsprache, die für eine
Ausgangssprache existiert, für eine andere aber fehlt ("Kannst du
helfen?").

---

## Verwandte Seiten

- [Lektionen erstellen — Überblick](../content-creation/overview.md) — Einstieg + Lektions-Creator in der App
- [Buchempfehlungen](../content-creation/books.md) — `books.yaml` pro Domäne pflegen
- [Mehrere Content-Repositories](../features/content-repos.md) — eigenes Repo verbinden
- [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f) — externe Medium-Anleitung mit Screenshots
