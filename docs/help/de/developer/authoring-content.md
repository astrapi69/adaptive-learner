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

### cloze (Phase 52 / v1.35.0 — Schema 1.1)

Lückentext mit sichtbaren `___`-Markern im Satz. Jeder `___`
entspricht einem Eintrag in `blanks[]` (Zuordnung von links nach
rechts; der Loader prüft `sentence.count("___") ==
len(blanks)`).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Setze den unbestimmten Artikel ein.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "männlicher unbestimmter Artikel",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* ist der männliche unbestimmte Artikel."
}
```

**Render-Modi** — pro Übung über `cloze_mode` gesetzt:

- `"type"` (Standard, wenn nicht gesetzt): pro Lücke ein
  `<input>`. Validiert mit demselben NFC + Levenshtein-≤-1-
  Matcher wie free-text, sodass Autorinnen nur semantische
  Varianten auflisten müssen (keine Tippfehler).
- `"select"`: pro Lücke ein `<select>`. Optionen aus
  `accept[0]` + `distractors` der Übung, pro Lücke mit
  stabilem Seed gemischt. **Erfordert nicht-leere
  `distractors`** — der Schema-Validator weist
  `cloze_mode: "select"` ohne sie ab.

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
