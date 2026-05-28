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
   eine JSON-Datei pro Lektion, bei jedem Download gegen Schema
   v1.0 validiert.

Die beiden mit Adaptive Learner ausgelieferten Pilot-Sets (FR A1
+ ES A1) liegen unter `docs/explorations/sample-content/{fr,es}-a1/`
und eignen sich gut als Vorlage.

## Verzeichnislayout

```
mein-content-repo/
  manifest.yaml               # Root: listet jedes Set
  sets/
    language-en-b1/           # ein Verzeichnis pro Set
      manifest.yaml           # Set: listet die Lektionen
      lessons/
        01-intro.json
        02-articles.json
        ...
      assets/
        img/                  # optionale Bilder für picture-choice
        audio/                # optionale TTS-Aufnahmen
```

## Manifest-Format

Beide Manifest-Dateien (Root + Set) verwenden die gleiche Form
mit `schema_version: '1.0'`. Pflichtfelder:

```yaml
schema_version: '1.0'
name: Mein Englisch-B1-Set
description: >-
  Optionale Langbeschreibung.
sets:
  - id: language-en-b1        # slug-sicher, eindeutig
    title: Englisch B1 (Fortgeschrittene)
    language: en              # BCP-47 (z.B. en, fr, zh-Hans)
    level: B1                 # CEFR für Sprachen, frei für andere Domänen
    version: '1.0.0'          # Semver — pro Set-Release erhöht
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Optionale Set-Beschreibung.
    tags:
      - intermediate
      - business
metadata:
  author: Dein Name
  license: CC-BY-SA-4.0       # oder die Lizenz deiner Wahl
```

Das Set-Manifest listet zusätzlich jede Lektionsdatei:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

Der Content-Loader iteriert `metadata.lessons` in der gegebenen
Reihenfolge; die Dateinamen auf der Festplatte sind irrelevant —
nur die Manifest-Reihenfolge zählt.

## Lektionsschema (v1.0)

Jede Lektion ist eine einzelne JSON-Datei. Top-Level-Struktur:

```json
{
  "id": "01-greetings",
  "title": "Begrüßungen",
  "description": "Optionale 1-2-Satz-Zusammenfassung.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Cards

Eine Card ist die kleinste lernbare Einheit — typischerweise ein
einzelner Begriff oder ein Konzept. Jede Card hat eine stabile
id (aus Übungen referenziert) und ein front/back-Paar:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "der (männlich Singular)",
  "notes": "Vor konsonantenanfangenden männlichen Substantiven. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

`notes` akzeptiert Markdown. Nutze sie für Ausspracheregeln,
Falsche-Freunde-Warnungen, Ausnahme-Hinweise — alles, was die
Langzeitspeicherung verbessert. `tags` steuern das SRS-Filtering.

### Steps

Eine Lektion ist eine Schritt-für-Schritt-Sequenz, jeder Schritt
entweder THEORY (ein Markdown-Block) oder EXERCISE (eine der vier
Übungstypen):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Warum Artikel wichtig sind",
  "body": "# Artikel im Französischen\n\nJedes französische Nomen hat ein Geschlecht..."
}
```

Oder eine Übung:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Begrüßungen zuordnen",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Ordne jede Begrüßung ihrer Übersetzung zu.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hallo"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Übungstyp-Referenz

### matching

Drag-pair-Übung. Der Renderer mischt vor der Anzeige.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Ordne jedem französischen Nomen seinen Artikel zu.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Jedes Pair muss genau zwei Schlüssel haben: `left` + `right`.

### picture_choice

Multiple-Choice mit Bildern. ≥ 2 Bilder, genau eines als richtig
markiert.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Welche Begrüßung passt zum Abend?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optionaler Markdown-Tipp auf Knopfdruck.",
  "distractors": ["Bonjour"]
}
```

Wichtig: `is_correct` ist ein **String** `"true"`, kein JSON-Boolean.

Zeigt der `src`-Pfad auf eine nicht vorhandene Datei, fällt der
Renderer auf das `label` zurück — picture_choice funktioniert
also auch ohne Illustrations-Assets.

### free_text

Antwort eintippen. Der Renderer matched erst exakt, dann
Levenshtein-tolerant.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "Wie sagt man 'Danke' auf Französisch?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Beginnt mit M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` ist die kanonische Antwort, die bei einem falschen
Versuch angezeigt wird. Liste ≥ 3 Varianten auf, um Groß/Klein-
schreibung + Interpunktion abzudecken; Whitespace wird vom
Renderer normalisiert.

### word_tiles

Kacheln in die richtige Reihenfolge bringen. Der Renderer mischt
vor der Anzeige.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Bring die Kacheln in die Reihenfolge: Ich sehe eine Katze.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Gleiche Wortreihenfolge wie im Deutschen."
}
```

Falls mehrere Wortreihenfolgen korrekt sind, ergänze
`accept_orderings`:

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Jede Reihenfolge ist eine Permutation der Tile-Indizes.

## Qualitäts-Checkliste

Vor dem PR für eine neue Lektion prüfen:

- [ ] **3-5 Theorie-Schritte** + **8-12 Übungen** pro Lektion
- [ ] **Alle 4 Übungstypen** vertreten (matching, picture-choice, free-text, word-tiles)
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

## Lokales Testen

Der Schema-Validator des Content-Loaders läuft im Rahmen von
`make test`. Eine einzelne Lektion von Hand validieren:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = 'docs/explorations/sample-content/fr-a1/sets/language-fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

Alle Lektionen im Pilot-Tree auf einmal validieren:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run pytest tests/test_pilot_content.py -v
```

Dieser parametrisierte Test findet jede JSON-Datei unter
`docs/explorations/sample-content/*/sets/*/lessons/` und
validiert sie gegen das Schema. Neue Lektionen werden
automatisch erkannt — keine Test-Änderung nötig.

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

## Referenz: die Pilot-Sets

Die beiden mit Adaptive Learner ausgelieferten Sets sind die
kanonischen Referenzen:

- `docs/explorations/sample-content/fr-a1/` — Französisch A1
  (10 Lektionen, ~2 Stunden Gesamtinhalt)
- `docs/explorations/sample-content/es-a1/` — Spanisch A1
  (5 Lektionen, ~70 Minuten Gesamtinhalt)

Beide folgen den in diesem Leitfaden beschriebenen Konventionen.
Eine vollständige Lektion durchzulesen ist der schnellste Weg,
die Struktur zu verinnerlichen.
