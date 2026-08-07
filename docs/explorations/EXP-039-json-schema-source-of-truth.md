# EXP-039: JSON-Schema als Single Source of Truth für das Lesson-/Exercise-Format

**Kategorie:** Querschnitt (Schema-Governance, Cross-Repo-Koordination)
**Phase:** laufend / Fundament
**Priorität:** Hoch
**Abhängig von:** EXP-002 (Content-Repository), EXP-003 (Lektionsformat), EXP-004 (GitHub-Organisation)
**Issue:** astrapi69/adaptive-learner#1193
**Status:** Freigegeben (Richtung A). **App-Seite implementiert** — Pydantic ist
SoT; `schema/lesson.schema.json` + `schema/quality-rules.json` + generierte
TS-Typen + Referenz-Doku werden via `make sync-schema` erzeugt, Drift-Gate via
`make sync-schema-check`. Cross-Repo-Mirror (Content-Repo) ist der CCWc-Folgeschritt.

> Dieses Dokument ist **reines Design**. Es liefert **keinen** Code, **kein**
> fertiges JSON-Schema, **keine** Typ- oder Validator-Änderung. Es entwirft den
> Weg zu einem formalen JSON-Schema als autoritative, maschinen- und
> menschenlesbare Quelle des Aufgaben-/Lesson-Formats. Nach diesem Dokument:
> **STOPP** zur Freigabe.

---

## Grundprinzip (nicht verhandelbar): App gewinnt

Die App ist die autoritative Definition des Schemas. Das galt für
`accept_orderings` (App-Format hat gewonnen, Content musste nachziehen), das gilt
für die Ausdrucksweise von Multiple-Choice (App definiert, Content folgt) und es
gilt auch hier: Das JSON-Schema-SoT-Projekt macht die **App-Seite zur Quelle**,
aus der das maschinenlesbare JSON-Schema abgeleitet/gepflegt wird. Der
Python-Validator und die Doku im Content-Repo **richten sich danach** — nicht
umgekehrt. Das Schema gehört NICHT primär ins Content-Repo.

Diese Richtung ist im gesamten Dokument fix. Offen ist nur, *welches* App-seitige
Artefakt die Quelle ist und *wie* das abgeleitete Schema ins Content-Repo gelangt.

---

## Kontext und Motivation

Das Lesson-/Exercise-Format ist das Herzstueck der Plattform: Menschen, KI und
Tools schreiben, editieren und lesen Aufgaben gegen dieses Format. Genau deshalb
ist Schema-Drift hier besonders teuer — eine Abweichung bricht entweder das
Laden bestehender Sets oder lässt korrupte Inhalte durch die Validierung.

Der konkrete Ausloeser ist die `accept_orderings`-Episode: Die App-Seite
definierte das Feld als `accept_orderings` (eine Liste akzeptierter
Tile-Index-Permutationen), das Content-Repo verwendete `accepted_orders`. Die
beiden Definitionen liefen auseinander, weil es **keine geteilte, autoritative
Quelle** gibt, gegen die beide Seiten prüfen. Die App-Seite war korrekt; das
Content-Repo musste manuell nachziehen. Dieselbe Klasse Cross-Repo-Koordination
kann jederzeit erneut zuschlagen, solange das Schema an mehreren Stellen
parallel von Hand gepflegt wird.

Ziel: **EINE** autoritative Quelle in der App, aus der alle anderen Artefakte
abgeleitet oder gegen die sie geprüft werden — sodass Drift entweder
strukturell unmöglich (generiert) oder im CI sofort sichtbar (drift-checked)
wird.

---

## 1. Ist-Aufnahme (Verify-First)

Verifiziert gegen den Code-Stand auf `develop` (Branch
`claude/json-schema-sot-design-4jy6ve`, Stand 2026-06-27). Das Schema lebt heute
an **sieben** Stellen — vier mehr als die naive Annahme "TS-Typen + Validator +
Doku". Jede Stelle ist eine potenzielle Drift-Quelle.

### 1.1 Wo das Schema heute definiert ist

| # | Artefakt | Repo | Art | Vollstaendigkeit | Pflege |
|---|----------|------|-----|------------------|--------|
| 1 | `plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema.py` | App | Pydantic v2 Modelle (`Lesson`/`LessonStep`/`Exercise`/`Card`/`ClozeBlank`/`CardTokenRole`), `extra="forbid"`, feldweise + typ-spezifische Validatoren | **Feldvollstaendig + Runtime-erzwingend** | Hand |
| 2 | `frontend/src/storage/types/content/content.ts` | App | TS-Interfaces (`ContentLesson*`) | Typ-Ebene, **kein** Runtime-Check; explizit "mirrored from `schema.Lesson`" | Hand |
| 3 | `frontend/src/lib/content/content-validator.ts` (~445 LOC) | App | TS-Runtime-Validator: Schema-Shape **+** Quality-Minimums; Dexie-Modus + Community-Share-Gate | Shape + Quality; **Paritäts-Vertrag** mit #4 | Hand |
| 4 | `docs/ci/adaptive-learner-content/scripts/validate_content.py` (291 LOC, Mirror des Content-Repo-CI) | App (Mirror) / Content | stdlib + PyYAML Re-Implementierung: Quality/Struktur/Sprachpaar | **NICHT feldvollstaendig** (kennt z. B. `accept_orderings`/Cloze-Regeln nicht) | Hand |
| 5 | `plugins/.../models.py` `CURRENT_SCHEMA_VERSION = "1.4"` + `is_supported_schema_version` | App | Versions-Konstante (Major-Match `v1.x`) | Versions-Gate | Hand |
| 6 | `frontend/src/lib/ai/generation/exercise-generation-prompt.ts` | App | KI-Prompt, kodiert "die fünf Typen" + erlaubte Felder für die Generierung | Generierungs-Kontext | Hand |
| 7 | `LESSON-FORMAT.md` | Content | Menschenlesbare Autoren-Doku | Prosa | Hand |

Beobachtung: Die im Auftrag genannten "TS-Typen / Validator / Doku" sind nur
drei von sieben Flächen. Insbesondere ist die **faktisch führende** Definition
NICHT die TS-Typen, sondern das Pydantic-Modell (#1) — es ist das einzige
Artefakt, das das Format zur Download-/Lade-Zeit *erzwingt* (`extra="forbid"`,
typ-spezifische `model_validator`-Regeln). Die TS-Typen (#2) sind ausdrücklich
ein handgepflegter Spiegel davon.

### 1.2 Was jede Stelle abdeckt (und was nicht)

- **#1 Pydantic `schema.py`** — die Wahrheit zur Ladezeit. `ExerciseType`-Enum
  mit fünf Werten (`matching`, `picture_choice`, `free_text`, `word_tiles`,
  `cloze`). Pro Typ erzwingen `model_validator`-Methoden die Pflichtfelder
  (MATCHING braucht `pairs`; PICTURE_CHOICE genau ein `is_correct: "true"`;
  WORD_TILES `accept_orderings` als echte Permutation; CLOZE `sentence`-Marker ==
  `len(blanks)`). Referenzielle Integritaet: jede `exercise.card_ids`-Referenz
  muss in `cards` existieren. Slug-Regex auf allen IDs.
- **#2 TS-Interfaces** — exakt dieselbe Form als TypeScript, aber **nur statisch**
  (TS-Interfaces validieren zur Laufzeit nichts). Subtile Form-Kopplung von Hand:
  z. B. `images: Array<{ src; label; is_correct?: string }>` — `is_correct` ist
  ein *string-getyptes* Boolean (`"true"`), das beide Seiten unabhängig so
  kodieren müssen.
- **#3 TS-Runtime-Validator** — der eigentliche Laufzeit-Check im Dexie-Modus +
  das Gate vor dem Community-Share. Deckt Schema-Shape **und** Quality-Minimums
  ab (>= 5 Übungen, >= 2 Typen, Distractor-Regeln, keine leeren Karten). Steht
  laut #699 in einem "byte-for-byte"-Paritäts-Vertrag mit #4.
- **#4 Content-Repo `validate_content.py`** — die zweite, **separate**
  Validierungs-Ebene (stdlib-only, damit das Content-CI ohne App-Installation
  läuft). Prüft Quality-Minimums + Verzeichnisstruktur (`sets/{source}/
  {target-level}`) + Sprachpaar + Skript-Heuristik. Prueft **nicht**: `extra=
  "forbid"`, Feldtypen, `accept_orderings`-Permutationen, Cloze-Marker-Anzahl,
  das Picture-Choice-Single-Correct-Invariant. D. h. #1 und #4 prüfen
  **verschiedene** Dinge: ein Lesson, das #1 ablehnt, kann das Content-CI
  bestehen — und das Content-CI erzwingt Quality-Schwellen, die #1 gar nicht
  kennt.
- **#5 `CURRENT_SCHEMA_VERSION = "1.4"`** — die Versionsnummer + die
  Major-Match-Logik (`v1.x` wird akzeptiert). Eine additive Feld-Erweiterung ist
  ein Minor-Bump; ein neuer Exercise-Typ ist ein Minor-Bump.
- **#6 KI-Generierungs-Prompt** — eine vierte Stelle, die "die fünf Typen" und
  ihre erlaubten Felder von Hand auffuehrt. Heute *bewusst* synchron gehalten
  (siehe Multiple-Choice unten), aber strukturell ungebunden.
- **#7 `LESSON-FORMAT.md`** — die Autoren-Doku im Content-Repo. Reine Prosa, kein
  maschineller Drift-Check gegen irgendeine der sechs Code-Stellen.

### 1.3 Welche Stelle heute faktisch führt

**Pydantic `schema.py` (#1) führt** — es ist das einzige feldvollstaendige,
Runtime-erzwingende Artefakt, und alle anderen Code-Stellen sind als Spiegel/
Teilmengen davon dokumentiert (#2 explizit "mirrored from `schema.Lesson`"). Der
Auftrag nominiert die TS-Typen (#2) als App-Master; die Verifikation zeigt aber,
dass die **eigentliche** Autorität das Pydantic-Modell ist. Das ist eine
relevante Korrektur für die Richtungsentscheidung in Abschnitt 3 (die
App-interne Quelle ist selbst gespalten — Pydantic vs. TS — und das ist die
*erste* zu treffende Entscheidung, noch vor der Cross-Repo-Frage).

### 1.4 Gefundene bzw. latente Drift

- **`accept_orderings` vs. `accepted_orders`** (historisch, der Ausloeser): App =
  `accept_orderings` (bestätigt in #1 `schema.py:458` und #2 `content.ts:140`).
  Content verwendete `accepted_orders` und musste auf die App-Form korrigiert
  werden.
- **Multiple-Choice — eine *vermiedene* Drift, kein gemergter Typ.** Der Auftrag
  nahm an, `multiple_choice` (#890) sei "schon gemergt, Content zieht nach". Die
  Verifikation widerlegt das: `multiple_choice` ist **kein** Schema-Typ. Weder
  `schema.py` (#1) noch `content.ts` (#2) kennen ihn; der KI-Prompt (#6) sagt
  ausdrücklich "there is deliberately no `multiple_choice` (it is not a schema
  type; MC is expressed via a `cloze` in select mode). See EXP-036 §4.3." Das ist
  ein Beispiel für eine Entscheidung, die *heute nur in Prosa-Kommentaren* lebt
  und die ein formales Schema explizit machen würde (geschlossenes
  `ExerciseType`-Enum => `multiple_choice` ist strukturell ungültig, nicht nur
  per Kommentar).
- **#1 vs. #4 prüfen disjunkte Regelmengen** (siehe 1.2): Feld-Schema lebt nur
  in #1/#2/#3; Quality-Minimums nur in #3/#4. Es gibt **keine** Stelle, die beide
  Mengen zusammen autoritativ hält. Das ist die strukturelle Wurzel der
  Drift-Anfaelligkeit.
- **string-getyptes Boolean** `is_correct: "true"` (#2 vs. #1) — eine
  handkodierte Form-Kopplung, die ein generiertes Schema vereinheitlichen würde.
- **#6 (KI-Prompt) und #7 (Doku)** haengen an **keiner** maschinellen
  Prüfung — sie driften lautlos, bis ein Mensch es bemerkt.

---

## 2. Zielbild

Eine autoritative, **maschinenlesbare** JSON-Schema-Definition aller Lesson-/
Exercise-Strukturen, **verankert auf der App-Seite**.

- **Draft:** JSON Schema **2020-12** (aktueller, breit unterstuetzter Draft;
  `$defs`, `unevaluatedProperties`, `prefixItems` für Tupel wie
  `accept_orderings`-Permutationen, discriminator-fähiges `oneOf`/`if-then` für
  typ-spezifische Exercise-Formen).
- **Ein kanonisches Artefakt**, z. B. `schema/lesson.schema.json` im App-Repo, mit
  `$id` und `$schema`, versioniert parallel zu `CURRENT_SCHEMA_VERSION`.
- **Eigenschaften:**
  - **IDE-Autocomplete:** Autoren bekommen per `$schema`-Verweis (oder
    `.vscode/settings.json` `json.schemas`-Mapping auf `lessons/*.json`)
    Vervollstaendigung + Inline-Fehler beim Editieren.
  - **KI-Kontext:** das JSON-Schema ist ein kompakter, vollständiger
    Format-Kontext, den der Generierungs-Prompt (#6) referenzieren oder einbetten
    kann — statt die Typliste erneut von Hand zu pflegen.
  - **Maschinell validierbar:** ein Standard-Validator (Python `jsonschema`, JS
    `ajv`) prüft jede Lesson-Datei gegen genau dieselbe Definition — App-Seite,
    Content-CI und lokales Autoren-Tooling.
- **Grenze (bewusst benannt):** Vanilla-JSON-Schema deckt **Struktur** ab
  (Felder, Typen, Enums, Pflicht/Optional, typ-spezifische Form via
  `if/then`/`oneOf`). Es deckt **nicht** alle *semantischen* Querbezuege ab, die
  heute imperativ in Pydantic-`model_validator` und im TS-Validator leben:
  referenzielle Integritaet (`card_ids` -> `cards`), `sentence.count("___") ==
  len(blanks)`, die Quality-Minimums (>= 5 Übungen ...). Das Zielbild ist
  deshalb **zweischichtig**: JSON-Schema für die Struktur (autoritativ,
  generiert/geteilt) **+** eine dünne, klar abgegrenzte Semantik-/Quality-Schicht
  obendrauf, die ebenfalls aus der App-Quelle stammt. Wichtig ist, dass die
  *Struktur*-Schicht nicht mehr an mehreren Stellen von Hand gepflegt wird.

---

## 3. Konsistenz-Strategie (der Kern: keine vierte driftende Quelle)

Die zentrale Gefahr ist, ein JSON-Schema einfach *zusätzlich* zu den heutigen
sieben Flächen zu legen — dann gibt es eine achte Stelle, die driften kann. Das
JSON-Schema muss **gebunden** sein: entweder generiert (Drift strukturell
unmöglich) oder per CI-Drift-Check (Drift sofort sichtbar). Alle Optionen unten
halten die autoritative Definition **im App-Repo** (App gewinnt).

### 3.1 TS-Typen <-> JSON-Schema: Richtung

Der Auftrag rahmt zwei Optionen:

- **Option A — Typcode ist die Quelle, JSON-Schema wird generiert.**
  Tooling: `ts-json-schema-generator` (aus TS-Typen) bzw. — und das ist die
  entscheidende Verifikations-Erkenntnis — **Pydantic v2 `model_json_schema()`**
  (aus den Pydantic-Modellen). Pydantic emittiert Draft-2020-12-JSON-Schema
  **nativ**, ohne Zusatz-Dependency.
- **Option B — JSON-Schema ist die Quelle, Typcode wird generiert.**
  Tooling: `json-schema-to-typescript` (-> TS-Interfaces);
  `datamodel-code-generator` (-> Pydantic).

In **beiden** Faellen liegt die autoritative Definition im App-Repo.

**Empfehlung: Option A, mit Pydantic `schema.py` als Quelle** (eine Praezisierung
der A/B-Rahmung — der getypte Quell-Code ist Pydantic, nicht TS):

```
schema.py  (Pydantic v2, HAND-gepflegt, autoritativ, App gewinnt)
   |  model_json_schema()  (nativ, keine Extra-Dependency)
   v
lesson.schema.json  (Draft 2020-12, GENERIERT, eingecheckt)
   |  json-schema-to-typescript
   v
content.ts  (TS-Interfaces, GENERIERT statt handgepflegt)
```

Begruendung:

1. **Pydantic ist heute schon die faktische Autorität** (Abschnitt 1.3) und das
   einzige feldvollstaendige Runtime-Artefakt. Es zur Quelle zu machen, formalisiert
   den Ist-Zustand, statt die Autorität künstlich zu den (gespiegelten,
   nicht-erzwingenden) TS-Typen zu verschieben.
2. **`model_json_schema()` ist kostenlos** — kein `ts-json-schema-generator`,
   keine zweite Toolchain. Ein `make sync-schema`-Target (analog zu den
   bestehenden `sync-*`-Targets) ruft es auf und schreibt `lesson.schema.json`.
3. **Der handgepflegte TS-Spiegel (#2) wird generiert** — die Drift-anfaelligste
   Fläche verschwindet als Hand-Arbeit (`json-schema-to-typescript`).
4. **Wer editiert?** Schema-Änderungen sind Pydantic-Änderungen — also dort, wo
   die typ-spezifischen `model_validator`-Regeln ohnehin schon leben. Ein Autor,
   der einen Exercise-Typ erweitert, fasst genau eine Datei an; die anderen drei
   Artefakte (JSON-Schema, TS-Typen, Content-Mirror) fallen daraus ab.

Gegen Option B (JSON-Schema von Hand als Quelle): JSON-Schema von Hand zu pflegen
ist fehleranfaelliger als Pydantic (kein Typchecker, kein Test-Harness am Schema
selbst), und die imperative Semantik-Schicht (`model_validator`) bleibt ohnehin in
Pydantic — zwei Quellen statt einer. Gegen "TS als Quelle": die TS-Interfaces
erzwingen nichts zur Laufzeit; sie zur Autorität zu erheben verschoebe die
Wahrheit weg vom einzigen erzwingenden Artefakt.

> Offene Entscheidung für die Freigabe: A (Pydantic-Quelle, empfohlen) vs. B
> (JSON-Schema-Quelle). Beide App-autoritativ. Siehe Abschnitt 7.

### 3.2 Python-Validator (Content-Repo) folgt dem App-Schema

Heute ist `validate_content.py` (#4) eine **eigenständige Re-Implementierung**.
Zielbild: der Content-Validator validiert die *Struktur* künftig **gegen das aus
der App stammende `lesson.schema.json`** (via stdlib-naher `jsonschema`-Bibliothek)
statt die Feldregeln zu duplizieren. Seine Daseinsberechtigung bleibt die
**Quality-/Semantik-Schicht** (>= 5 Übungen, >= 2 Typen, Sprachpaar-/Skript-
Heuristik) — diese Schicht ist content-politisch, nicht Format-strukturell, und
darf im Content-Repo bleiben, solange sie ebenfalls aus einer App-Quelle gespeist
wird (siehe 3.3).

Der Validator **folgt** dem App-Schema, er **definiert** es nicht. Falls
`jsonschema` als Dependency im Content-CI unerwuenscht ist (heute bewusst
stdlib-only), ist die Alternative ein CI-Job, der das Content-Repo gegen das
gespiegelte App-Schema prüft — die Prüfung bleibt App-autoritativ, nur der
Validator-Standort variiert.

### 3.3 Quality-/Semantik-Regeln: ebenfalls aus der App

Die Quality-Minimums leben heute doppelt (#3 TS-Validator `content-validator.ts`
und #4 Python-Validator) mit einem "byte-for-byte"-Paritäts-Vertrag (#699). Das
ist dieselbe Drift-Klasse eine Ebene höher. Zwei Wege:

- **(a)** Die Quality-Schwellen als **maschinenlesbare Config** (z. B.
  `schema/quality-rules.json`: `min_exercises: 5`, `min_types: 2`, ...) aus der
  App exportieren; beide Validatoren lesen dieselbe Config statt sie zu
  hardcoden. Klein, sofort umsetzbar, beseitigt die Zahlen-Drift.
- **(b)** Laengerfristig die *strukturell ausdrueckbaren* Quality-Regeln ins
  JSON-Schema heben (`minItems`, `minContains`, `oneOf`), nur die wirklich
  imperativen (Skript-Heuristik, "zwei *distinct* Typen") in Code lassen.

Empfehlung: (a) als Teil dieses Projekts (es ist die zweite Haelfte der "keine
vierte Quelle"-Disziplin); (b) als Folge-Option benennen, nicht erzwingen.

### 3.4 LESSON-FORMAT.md (Content-Repo): generiert oder drift-gecheckt

Zwei Optionen, beide binden die Doku an das App-Schema:

- **Generiert:** ein Doc-Generator rendert `LESSON-FORMAT.md` aus
  `lesson.schema.json` (`description`-Felder + Beispiele) — die Doku kann nicht
  driften, weil sie ein Build-Artefakt ist.
- **Manuell + CI-Drift-Check:** die Prosa bleibt von Hand, ein CI-Job prüft, dass
  jeder im Schema definierte Typ/jedes Feld in der Doku erwähnt ist (analog zum
  bestehenden `verify-docs.py`-Muster der App).

Empfehlung: **generiert** für den Feld-/Typ-Referenzteil (Tabelle aller Felder),
**manuell** für den erklärenden Prosa-Teil (Beispiele, Best Practices) mit einem
leichten Drift-Check, dass kein Typ fehlt. Pydantics `Field(description=...)` ist
bereits reich befüllt (siehe `schema.py`) — der Referenzteil fällt nahezu
kostenlos ab. **Wo diese generierte Doku als gerenderte Seite erscheint
(MkDocs-Site, App- vs. Content-Repo-Sichtbarkeit), behandelt Abschnitt 6.**

### 3.5 KI-Generierungs-Prompt (#6) bindet ans Schema

Der Prompt führt heute "die fünf Typen" von Hand auf. Zielbild: er liest die
erlaubten Typen/Felder aus `lesson.schema.json` (oder bettet das Schema als
Kontext ein), statt sie zu duplizieren — so kann die KI nie einen Typ erzeugen,
den das Schema nicht kennt, und ein neuer Typ wird der KI automatisch bekannt.

### 3.6 Zielbild der Bindungen (Übersicht)

```
                         schema.py (Pydantic, HAND, App gewinnt)
                                  |
                    model_json_schema() / make sync-schema
                                  |
                                  v
                    schema/lesson.schema.json  (Draft 2020-12, GENERIERT)
        ________________________|________________________________
       |                |                |              |          |
       v                v                v              v          v
  content.ts       TS-Validator     KI-Prompt    LESSON-FORMAT   Content-Repo
 (GENERIERT)     (Struktur ←        (liest        (Referenz       validate_content.py
                  Schema; Quality    Schema)       generiert)     (Struktur ← Schema,
                  ← quality-rules)                                 Quality ← quality-rules)
```

Statt sieben handgepflegter Parallel-Definitionen: **eine** handgepflegte Quelle
(Pydantic) + **eine** maschinenlesbare Ableitung (JSON-Schema) + lauter
generierte/geprueete Sekundaerartefakte.

---

## 4. Cross-Repo-Strategie (App -> Content)

Das App-autoritative `lesson.schema.json` muss dem Content-Repo verfügbar sein,
damit dessen Validator + Doku darauf aufsetzen. Richtung ist fix: **App ist
Quelle, Content konsumiert.** Optionen:

| Option | Mechanik | Pro | Contra |
|--------|----------|-----|--------|
| **A. Mirror + CI-Drift-Check** | App-Repo hält die kanonische `lesson.schema.json`; Content-Repo hält eine eingecheckte Kopie; ein CI-Job im Content-Repo (und/oder App-Release-Gate) schlägt fehl, wenn die Kopie abweicht | Kein Package-Infra; deterministisch; **exakt das bereits etablierte Muster** (`docs/ci/adaptive-learner-content/` spiegelt heute schon den Content-Validator ins App-Repo); offline-tauglich | Kopie muss aktiv synchron gehalten werden (vom Drift-Check erzwungen) |
| **B. Publiziertes Artefakt (npm/PyPI)** | App publiziert das Schema als versioniertes Paket; Content zieht es als Dependency | Saubere Versionierung; Standard-Toolchain | Neue Release-/Publish-Pipeline; Latenz zwischen App-Änderung und Content-Verfügbarkeit; Overkill für eine JSON-Datei |
| **C. git-Referenz (Submodule / Raw-URL)** | Content liest das Schema per Submodule oder GitHub-Raw-URL aus dem App-Repo | Eine Quelle physisch, kein Kopieren | Submodule sind operativ fragil; Raw-URL-Fetch im CI ist nicht-deterministisch/netzabhaengig (vgl. lessons-learned zu Raw-Fetch-Bruechen) |
| **D. Build-time-Copy** | Ein Build-Schritt kopiert das Schema beim Content-Build aus dem App-Repo | Kein eingecheckter Duplikat | Setzt einen gemeinsamen Build-Kontext voraus, den die Repos nicht teilen |

**Empfehlung: Option A (Mirror + CI-Drift-Check).**

Begruendung — es ist **kein neues Muster, sondern das vorhandene**: Das App-Repo
spiegelt heute bereits `validate_content.py` + `validate-content.yml` unter
`docs/ci/adaptive-learner-content/` als kanonische Kopie, die das Content-Repo
übernimmt. Denselben Mechanismus auf `lesson.schema.json` auszudehnen ist die
geringste neue Komplexitaet, ist deterministisch (kein Netz-Fetch im CI) und hat
mit dem `verify_version_pins.sh`/`sync-*`-Apparat der App schon die passende
Werkzeugklasse (generieren + `--check`-Drift-Gate). Die `accept_orderings`-Episode
war genau diese Cross-Repo-Koordination ohne Master-Richtung — Option A löst sie
mit klarer App->Content-Richtung und einem CI-Gate, das die Abweichung sichtbar
macht, bevor sie Inhalte bricht.

Option B bleibt der spätere Pfad, falls ein dritter Konsument (mehrere
Content-Repos, externe Tools) das Schema braucht — dann lohnt die Package-Infra.

---

## 5. Beitragenden-Workflow (Mensch / KI / Tool)

Wo das Schema liegt: **kanonisch im App-Repo** (`schema/lesson.schema.json`,
generiert aus Pydantic), **gespiegelt im Content-Repo** (für Content-Autoren, die
nur das Content-Repo ausgecheckt haben).

### 5.1 Mensch (Content-Autor)

1. Editiert `lessons/NN-slug.json` im Content-Repo.
2. Die Datei trägt `"$schema": "./.schema/lesson.schema.json"` (oder ein
   `.vscode/settings.json`-Mapping auf `lessons/*.json`) — die IDE liefert
   Autocomplete + Inline-Validierung gegen das gespiegelte App-Schema.
3. Lokal: `python -m jsonschema` / ein `make validate`-Target prüft Struktur
   (Schema) **+** Quality (quality-rules) vor dem Commit.
4. CI: `validate_content.py` prüft beides erneut serverseitig.

### 5.2 KI

- Erhält `lesson.schema.json` als Kontext (kompakt, vollständig) und generiert
  strukturell gültige Lessons; der Generierungs-Prompt (#6) referenziert das
  Schema statt einer handgepflegten Typliste.
- Dieselbe Schema-Datei dient als Validierungs-Gate für KI-Output, bevor er
  gespeichert/geteilt wird.

### 5.3 Tool (Lesson Creator, Importer, Adaptive-Snapshot)

- App-interne Generatoren (Lesson Creator EXP-021, Analyse->Lesson, Adaptive-
  Snapshot) validieren ihren Output gegen dasselbe Pydantic-Modell (heute schon)
  — nach diesem Projekt ist klar, dass dieses Modell *die* Quelle ist, aus der das
  JSON-Schema fällt, sodass app-interne und externe Tools garantiert dieselbe
  Definition sehen.

### 5.4 Autocomplete-Quelle

`$schema`-Verweis in der Lesson-Datei **oder** `json.schemas`-Mapping in
`.vscode/settings.json` — beide zeigen auf die (gespiegelte) `lesson.schema.json`.
Kein Plugin nötig; VS Code / die meisten Editoren validieren JSON gegen ein
verlinktes Schema nativ.

---

## 6. MkDocs-Publikation (gerenderte Schema-Doku für Beitragende)

Die generierte, menschenlesbare Schema-/Lesson-Format-Doku (Abschnitt 3.4) soll
nicht nur als Repo-Datei existieren, sondern als **gerenderte Seite auf der
MkDocs-Doku-Site** auffindbar sein. Verifiziert gegen die vorhandene Pipeline.

### 6.1 Die MkDocs-Pipeline liegt im App-Repo

Bestätigt im `Makefile` + `scripts/`:

- `make docs-build` / `docs-serve` rufen `scripts/generate_mkdocs_nav.py` auf.
- **`docs/help/_meta.yaml` ist die Single Source of Truth für die Nav** —
  `generate_mkdocs_nav.py` rendert daraus die `nav:`-Blöcke in `mkdocs.yml`.
- `make sync-mkdocs-nav` regeneriert; `make verify-mkdocs-nav`
  (`generate_mkdocs_nav.py --check`) + `make check-mkdocs-orphans`
  (`verify_docs.py --check mkdocs`) sind **release-blockende Gates**
  (`verify-docs-discipline`): jede Help-`.md` ohne Nav-Eintrag (orphan) bzw.
  jeder Nav-Eintrag ohne Datei (dangling) bricht das Gate.
- Die MkDocs-Site rendert ausschliesslich `docs/help/{en,de}/**`. **Die
  `docs/explorations/`-Dokumente (wie dieses EXP) sind bewusst NICHT Teil der
  Site** — sie sind interne Design-Dokumente, keine Beitragenden-Doku.

Konsequenz für die Platzierung: Die generierte Schema-Referenz gehört unter
`docs/help/{en,de}/developer/` (neben den bereits existierenden
`developer/authoring-content.md` und `developer/lessons-and-srs.md`), **nicht**
unter `docs/explorations/`. Vorschlag:
`docs/help/{en,de}/developer/lesson-format-reference.md`.

### 6.2 Einbindung ohne Gate-Bruch

Die generierte Seite muss im **selben Schritt** in `docs/help/_meta.yaml`
eingetragen werden, in dem sie erzeugt wird — sonst meldet `check-mkdocs-orphans`
sie als verwaiste Datei (lessons-learned: "Doc files: existence is not
discoverability"). Konkret:

1. Der Schema-Doc-Generator (Abschnitt 3.4) schreibt
   `developer/lesson-format-reference.md` in **beiden** Sprachen (en + de) —
   `verify_docs.py` erzwingt en<->de-Help-Page-Parität.
2. Ein `_meta.yaml`-Eintrag unter der Developer-Docs-Sektion mit Slug
   `developer/lesson-format-reference` + Icon + Titel (de/en).
3. `make sync-mkdocs-nav` regeneriert `mkdocs.yml`; `make verify-docs-discipline`
   muss grün bleiben.

Weil die Seite **generiert** ist (aus `lesson.schema.json`, das wiederum aus
Pydantic fällt), kann ihr Inhalt nicht gegen das Schema driften — sie ist ein
Build-Artefakt. Der erklaerende Prosa-Teil (Beispiele, Best Practices) bleibt
ggf. handgepflegt mit dem Drift-Check aus 3.4 (kein Typ fehlt).

### 6.3 Cross-Repo-Sichtbarkeit (zentral): App-Site vs. Content-Repo-Spiegel

Spannungsfeld: Die MkDocs-Site liegt im **App-Repo**, Content-Autoren arbeiten im
**Content-Repo**. Drei Optionen:

| Option | Wo erscheint die Schema-Doku | Pro | Contra |
|--------|------------------------------|-----|--------|
| **A. Nur App-MkDocs** | Eine gerenderte Seite auf der App-Doku-Site; Content-`README`/`LESSON-FORMAT.md` verlinkt dorthin | Eine autoritative Doku-Seite (App ist Schema-Quelle); kein Cross-Repo-Doku-Sync | Content-Autoren müssen das App-Doku-URL kennen; ein Klick weg vom Arbeitsplatz |
| **B. App-MkDocs + Verweis/Spiegel im Content-Repo** | App-Site autoritativ **plus** ein kurzer, generierter/gespiegelter Doku-Stub im Content-Repo, der auf die App-Site verweist (und optional die Feld-Referenz mit-spiegelt, drift-gecheckt) | Auffindbar genau dort, wo Content-Autoren sind; App bleibt autoritativ | Ein zweiter, gespiegelter Doku-Ort (muss drift-gecheckt sein, sonst neue Drift) |
| **C. Eigene MkDocs-Site im Content-Repo** | Content-Repo baut eine eigene Doku-Site | Vollständig lokal für Content-Autoren | Doppelte MkDocs-Infra; höchste Drift-/Wartungslast; widerspricht "App gewinnt" |

**Empfehlung: Option B.** Die **App-MkDocs-Seite ist die autoritative
Schema-Doku** (die App ist die Schema-Quelle, also gehört die kanonische
gerenderte Doku auf die App-Site). Zusätzlich ein **kurzer Verweis-Stub im
Content-Repo** (z. B. ein `LESSON-FORMAT.md`-Kopf, der auf die App-Doku-URL
zeigt), damit Content-Autoren die Doku ohne Repo-Wechsel finden. Falls der Stub
auch die Feld-Referenz spiegelt, fällt sie unter denselben Cross-Repo-Drift-Check
wie das Schema selbst (Abschnitt 4, Option A — Mirror + CI-Drift-Check), sodass
**kein** manuell parallel gepflegter Doku-Zweig entsteht. Option A ist der
minimale Fallback (nur Link, kein Spiegel); C ist abzulehnen (doppelte Infra,
widerspricht der Master-Richtung).

Wichtig in allen Faellen: Die Doku ist **aus dem App-autoritativen Schema
generiert oder gegen es drift-geprüft**, nie manuell parallel gepflegt — sonst
entsteht genau die Drift, die das Projekt beseitigt.

---

## 7. Migration (abwaertskompatibel, ohne bestehende Sets zu brechen)

Leitplanke: **keine** bestehende Lesson darf nach der Migration ungültig werden.
Das JSON-Schema muss anfangs exakt das beschreiben, was Pydantic heute akzeptiert
(inkl. aller optionalen/additiven Felder bis `CURRENT_SCHEMA_VERSION = 1.4`).

Schrittfolge (Reihenfolge so, dass jeder Schritt für sich grün ist):

1. **(App / CCW) Schema-Generierung verdrahten, read-only.** `make sync-schema`
   ruft `model_json_schema()` und schreibt `schema/lesson.schema.json`. Noch kein
   Konsument; reine Erzeugung + ein Test, dass das Schema jede gebuendelte
   Beispiel-Lesson akzeptiert (Abwaertskompatibilitaets-Beweis gegen `sample-
   content/` + die ausgelieferten Sets).
2. **(App / CCW) TS-Typen aus dem Schema generieren.** `content.ts` wird zum
   Build-Artefakt (`json-schema-to-typescript`); ein Test pinnt, dass die
   generierten Typen die heutigen Interfaces formgleich ersetzen (kein
   Verhaltens-/Compile-Bruch).
3. **(App / CCW) quality-rules.json exportieren** und den TS-Validator (#3) +
   später den Content-Validator (#4) daraus lesen lassen (Zahlen-Drift beseitigt).
4. **(App / CCW) Drift-Gate.** `make sync-schema --check` ins Release-Gate
   (analog `sync-versions-check`): ein nicht regeneriertes Schema blockt den Tag.
5. **(App / CCW) KI-Prompt + LESSON-FORMAT-Referenzteil ans Schema binden.**
6. **(App / CCW) MkDocs-Seite generieren + verdrahten (Abschnitt 6).** Den
   Schema-Doc-Generator `developer/lesson-format-reference.md` (en + de) schreiben
   lassen, im selben Schritt den `_meta.yaml`-Eintrag setzen, `make sync-mkdocs-nav`
   laufen lassen; `make verify-docs-discipline` (orphan-/nav-Gate) muss grün
   bleiben.
7. **(Content / CCWc) Schema-Mirror + Drift-Check.** `lesson.schema.json` ins
   Content-Repo spiegeln; CI-Job, der gegen die App-Kopie prüft (Option A).
8. **(Content / CCWc) `validate_content.py` auf Schema-Validierung umstellen**
   (Struktur via `jsonschema`/Mirror; Quality via quality-rules), unter Erhalt des
   bestehenden Paritäts-Vertrags, bis die geteilte Quelle ihn ersetzt.
9. **(Content / CCWc) `$schema`-Verweis / `.vscode`-Mapping + Doku-Verweis-Stub**
   (Abschnitt 6.3, Option B) in den Lesson-Dateien + Content-Repo-Doku, damit
   Autoren Autocomplete bekommen und die gerenderte App-Doku ohne Repo-Wechsel
   finden.

Versionierung: das Schema trägt `CURRENT_SCHEMA_VERSION`; additive Felder bleiben
Minor-Bumps (Major-Match-Gate unverändert), sodass ältere Sets weiter laden.

Aufteilung: Schritte 1-6 sind **App-Repo (CCW)**, 7-9 sind **Content-Repo (CCWc)**.
Die App-Seite kann vollständig zuerst landen (sie bricht nichts, solange das
Schema nur generiert + getestet + als Doku-Seite verdrahtet wird); das
Content-Repo zieht nach.

---

## 8. Offene Fragen / Entscheidungen für die Freigabe

1. **TS <-> JSON-Schema-Richtung (Abschnitt 3.1).** Empfehlung: **Option A mit
   Pydantic als Quelle** (App-autoritativ, `model_json_schema()` nativ, TS +
   Schema generiert). Alternative: Option B (JSON-Schema von Hand als Quelle, TS +
   Pydantic generiert). Beide App-autoritativ. **Entscheidung des Architekten.**
   Nuance: der Auftrag nominierte die *TS-Typen* als App-Master; die Verifikation
   zeigt, dass das *Pydantic-Modell* faktisch führt — die Empfehlung folgt dem
   Ist-Zustand.
2. **Cross-Repo-Sync-Methode (Abschnitt 4).** Empfehlung: **Option A (Mirror +
   CI-Drift-Check)** — deckt sich mit dem bereits etablierten
   `docs/ci/adaptive-learner-content/`-Muster. Alternativen B/C/D benannt.
3. **Semantik-/Quality-Schicht (Abschnitt 3.3).** Geteilte `quality-rules.json`
   jetzt (empfohlen) vs. Quality-Regeln später strukturell ins JSON-Schema heben.
4. **LESSON-FORMAT.md (Abschnitt 3.4):** Referenzteil generieren (empfohlen) vs.
   vollständig manuell mit Drift-Check.
5. **`jsonschema` als Content-CI-Dependency** (Abschnitt 3.2): das bewusst
   stdlib-only gehaltene Content-CI um `jsonschema` erweitern vs. Struktur-Check
   als App-Release-Gate gegen die Content-Sets führen.
6. **MkDocs-Sichtbarkeit (Abschnitt 6.3).** Empfehlung: **Option B (App-MkDocs
   autoritativ + generierter/drift-gecheckter Verweis-Stub im Content-Repo)**.
   Alternative: Option A (nur App-Site + Link). Option C (eigene Content-Site)
   abgelehnt. Die generierte Seite lebt unter `docs/help/{en,de}/developer/`,
   nicht in `docs/explorations/`, und wird über `_meta.yaml` eingebunden
   (orphan-Gate grün halten).
7. **Multiple-Choice (Abschnitt 1.4):** bestätigen, dass MC bewusst **kein**
   eigener Schema-Typ bleibt (Ausdruck via `cloze`-select, EXP-036 §4.3) — das
   geschlossene `ExerciseType`-Enum macht diese Entscheidung im Schema explizit.
8. **Implementierungs-Aufteilung:** CCW (App: Schema-Generierung, TS-Typen,
   quality-rules, Drift-Gate, KI-Prompt, MkDocs-Seite) vs. CCWc (Content: Mirror,
   Validator-Umstellung, Autoren-Doku/Autocomplete/Verweis-Stub). Schritte
   gemaess Abschnitt 7.

---

## Questions and assumptions

- **Annahme (konservativ):** Der Auftrag nennt die TS-Typen als App-Master; die
  Code-Verifikation zeigt, dass das Pydantic-Modell `schema.py` faktisch führt
  (einziges feldvollstaendiges Runtime-Artefakt, TS explizit als Mirror
  dokumentiert). Das Dokument folgt dem verifizierten Ist-Zustand und legt die
  Richtungsfrage als offene Entscheidung 8.1 vor — statt die Auftrags-Annahme
  ungeprüft zu übernehmen.
- **MkDocs-Infrastruktur verifiziert (Abschnitt 6):** `docs-build` /
  `sync-mkdocs-nav` / `verify-mkdocs-nav` / `check-mkdocs-orphans` existieren im
  `Makefile`; `docs/help/_meta.yaml` ist die Nav-Quelle (via
  `scripts/generate_mkdocs_nav.py`); die Site rendert nur `docs/help/**`, also
  gehört die generierte Schema-Doku dorthin (nicht in `docs/explorations/`), mit
  `_meta.yaml`-Eintrag im selben Schritt (orphan-Gate).
- **Korrektur der Auftrags-Praemisse:** `multiple_choice` (#890) ist **nicht**
  als Schema-Typ gemergt; er ist bewusst kein Typ (Ausdruck via `cloze`-select,
  belegt im KI-Prompt-Kommentar + EXP-036 §4.3). Im Sinne von GITHUB-ISSUE-PFLICHT
  Punkt 4 wurde dies als Befund festgehalten, nicht als gemergter Typ behandelt.
- **Nicht eingesehen:** der Inhalt des Content-Repos selbst (`LESSON-FORMAT.md`,
  die echten `lessons/*.json`) — der GitHub-Zugriff dieser Session ist auf
  `astrapi69/adaptive-learner` beschränkt. Aussagen über das Content-Repo
  stuetzen sich auf den App-internen Mirror (`docs/ci/adaptive-learner-content/`)
  und die dokumentierten Konventionen. Für die Content-Repo-Schritte (CCWc) ist
  eine Verifikation im Content-Repo Teil der Umsetzung.
- **Keine STOP-blockierende Frage** ist aufgetreten; der Auftrag war als
  autonomes Design formuliert. Alle Richtungsentscheidungen sind als Abschnitt 7
  zur Freigabe vorgelegt.

---

*EXP-039, erstellt 2026-06-27. Reines Design — wartet auf Architekten-Freigabe
vor jeder Umsetzung. Issue: astrapi69/adaptive-learner#1193.*
