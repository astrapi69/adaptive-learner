# EXP-042: Content-Engine — kanonisches internes Format + Source-Adapter-Grenze

**Kategorie:** Querschnitt (Architektur-Grenze, Lib-Extraktions-Vorbereitung)
**Phase:** ausgeliefert (Boundary + Extraktion) / Fundament
**Priorität:** Mittel-Hoch
**Abhängig von:** EXP-039 (JSON-Schema als Single Source of Truth), EXP-002
(Content-Repository), EXP-003 (Lektionsformat)
**Issue:** astrapi69/adaptive-learner#1309
**Status:** Boundary UND Library-Extraktion **ausgeliefert**. Die Engine ist als
eigenständiges npm-Paket [`learn-content-engine`](https://github.com/astrapi69/learn-content-engine)
extrahiert, publiziert und wird von der App konsumiert
(`learn-content-engine@0.4.0`, gepinnt in `frontend/package.json`, App-vs-Engine-
Paritätstest); die Content-Repos spiegeln denselben gepinnten Engine-Release. Die
**Schema-Hoheit bleibt vorerst in der App-Pydantic** (`schema.py`, EXP-039); sie
kann später zur Engine wandern. Ein Mehrdatei-Adapter ist weiterhin
**zurückgestellt** (kommt nur bei konkretem Projekt-/Nutzer-Bedarf, dann als neu
definiertes Format). Dieses Dokument hält die ursprüngliche Architektur-
Entscheidung fest; der Abschnitt-4/7-Wortlaut unten beschreibt den Stand VOR der
Extraktion und bleibt zur Nachvollziehbarkeit stehen.

> Dieses Dokument definiert die **Content-Engine-Grenze**: ein kanonisches
> internes Format, ein Source-Adapter-Muster, und die Naht, an der die Engine
> später als eigenständige Library herausgetrennt werden kann. Der zugehörige
> PR setzt die Abgrenzung um (Parse-/Transform-Logik buendeln), **ohne** das
> Ladeverhalten, die Dateinamen-Konvention oder das Schema zu ändern.

---

## Grundprinzip: die Engine besitzt das kanonische Format, nicht die Quelle

EXP-039 hat die **App als autoritative Schema-Quelle** festgelegt (Pydantic
`schema.py` führt, das JSON-Schema fällt daraus ab). EXP-042 baut darauf auf und
zieht die **Laufzeit-Grenze**: Es gibt genau **ein kanonisches internes
Lesson-Format** — das aktuelle **Single-JSON-Lesson-Objekt** (schema_version
`1.4`, exakt das EXP-039-Schema). Jede Quelle wird über einen **Source-Adapter**
in dieses kanonische Format transformiert. Der Rest der App (Viewer, Renderer,
SRS, Adaptive-Generator) kennt **nur** das kanonische Objekt — nie die Quelle,
aus der es stammt.

Heute gibt es genau eine Quelle (Single-JSON) und damit einen trivialen Adapter
(im Kern `JSON.parse` / `json.loads` + Validierung gegen das Schema). Der Wert
dieses Dokuments + PRs ist **nicht** ein neuer Adapter, sondern die **saubere
Naht**: die Parse-/Transform-Logik ist heute im Frontend inline im
Dexie-God-Loader vergraben und im Backend zwar zentral, aber nicht als Grenze
benannt. Die Naht macht (a) ein kuenftiges Mehrdatei-Format zu einem *zusaetzlichen
Adapter* statt einem Umbau, und (b) die Engine später als Library extrahierbar.

**Nicht in diesem PR:** der Mehrdatei-Adapter, die Library-Extraktion, ein
Adapter-Registry-Mechanismus. Ein Registry für genau einen Adapter wäre
Over-Engineering — die Naht ist eine benannte, getypte Schnittstelle, mehr nicht.

---

## 1. Ist-Aufnahme (Verify-First)

Verifiziert gegen `develop` (Branch `claude/content-engine-canonical-whky8c`).

### 1.1 Backend — die Grenze existiert bereits, ist aber nicht benannt

| Stelle | Rolle | Innerhalb/Ausserhalb der Engine |
|--------|-------|--------------------------------|
| `content_loader/manifest_parser.py` — `parse_lesson_json(text) -> Lesson`, `parse_manifest_yaml(text) -> ContentManifest` | **Parse/Transform**: Roh-Text → kanonisches Objekt (inkl. `json.loads`/`yaml.safe_load`, Schema-Versions-Gate, Pydantic-Validierung mit referenzieller Integritaet) | **innen** |
| `content_loader/schema.py` (Pydantic `Lesson`/`Exercise`/`Card`/…) | Definition des kanonischen Formats (EXP-039-Quelle) | **innen** |
| `content_loader/models.py` (`ContentManifest`, `CURRENT_SCHEMA_VERSION = "1.4"`, `is_supported_schema_version`) | Manifest-Modell + Versions-Gate | **innen** |
| `content_loader/cache.py` (`read_lesson` → ruft `parse_lesson_json`) | Filesystem-Cache (Storage) | **aussen (Konsument)** |
| `content_loader/service.py` (Fetch-Orchestrierung → ruft `parse_manifest_yaml`) | HTTP-Fetch + Reconciliation | **aussen (Konsument)** |
| `content_loader/github_adapter.py` (`raw.githubusercontent.com`-Fetch) | Netzwerk | **aussen** |

Befund: Das Backend hat die Parse-Grenze faktisch schon (`manifest_parser.py`),
aber sie ist als "Manifest-Parser" benannt, nicht als **Content-Engine /
Source-Adapter**. Fetch (`github_adapter`), Cache (`cache`) und Routen (`routes`,
`service`) sind bereits sauber getrennt.

### 1.2 Frontend — Parse/Transform inline im Dexie-Loader

`frontend/src/storage/content/content-loader-dexie.ts` (~980 LOC) mischt drei
Belange:

| Belang | Beispiele | Innerhalb/Ausserhalb der Engine |
|--------|-----------|--------------------------------|
| **Fetch** | `fetchGitHubFileText`, `fetchWithRetry`, `RAW_BASE`, bundled-Assets | aussen |
| **Dexie/Storage** | `getDb()`, `contentSets`/`contentSetFiles`, `cacheKey`, `fileKey`, `latestCachedRow` | aussen |
| **Parse/Transform (kanonisch)** | `getLessonDexie`: `JSON.parse(file.body)` + Injektion von `target_language`/`source_language`/`domain` aus der Set-Zeile; Manifest-Transform `asContentSetEntry` + `resolveLanguagePair` + `setBasePath` + `asContentSetBook` | **innen** — heute inline vergraben |

Befund: Die kanonische Transform-Logik (Roh-JSON/Manifest → kanonisches
`ContentLesson` / `ContentSetEntry`) lebt **inline** im God-Loader, direkt neben
Fetch + Dexie. Es gibt keine benannte Grenze; ein zweiter Adapter müsste heute
den Loader anfassen.

### 1.3 Asymmetrie

Das Backend ist bereits nah an der Ziel-Architektur (Parse zentral in
`manifest_parser.py`); das Frontend ist es nicht (Parse inline im Loader). Die
Abgrenzung gleicht beide Seiten auf **dieselbe benannte Grenze** an — das ist
zugleich die Voraussetzung für Cross-Language-Parität (Abschnitt 5).

---

## 2. Kanonisches internes Format

Das kanonische Format ist das **Single-JSON-Lesson-Objekt**:

- **Backend:** die Pydantic-`Lesson` (`schema.py`) — feldvollstaendig,
  Runtime-erzwingend (`extra="forbid"`, typ-spezifische `model_validator`).
- **Frontend:** der `ContentLesson`-Typ (`storage/types/content/content.ts`),
  laut EXP-039 aus dem App-Schema generiert/gespiegelt.
- **Version:** `schema_version = 1.4`, Major-Match-Gate (`v1.x` akzeptiert).

Jede Quelle produziert **exakt dieses** Objekt. Der Adapter fuegt keine neuen
Felder hinzu; er transformiert nur die Quelle in die kanonische Form (heute:
parse + Sprach-/Domänen-Normalisierung aus dem Set-Kontext, weil eine Lektion
ihr Sprachpaar vom Set erbt).

**Warum Single-JSON kanonisch bleibt (auch falls je ein Mehrdatei-Format
kommt):** Single-JSON ist bereits das, was Viewer/Renderer/SRS/Generatoren
konsumieren, es ist das EXP-039-Schema, und es ist selbst-enthaltend (ein Objekt,
keine Datei-Joins). Ein Mehrdatei-Format wäre ein **Autoren-Komfort** an der
Quelle, kein besseres internes Modell — deshalb würde ein künftiger
Mehrdatei-Adapter **nach** Single-JSON transformieren, nicht umgekehrt. Ein
solches Format ist derzeit **zurückgestellt** (Abschnitt 6): es gibt kein
aktuelles Mehrdatei-Template im Content-Repo, und die Engine bezieht sich auf
keines — sie hält nur die Naht offen.

---

## 3. Source-Adapter-Muster

```
   Quelle (roh)                Source-Adapter               kanonisch
   ------------                --------------               ---------
   NN.json (Text)      ──►  single-json Adapter    ──►  ContentLesson / Lesson

   [zurueckgestellt: ein
    kuenftig NEU definiertes ──►  multi-file Adapter ──►  ContentLesson / Lesson
    Mehrdatei-Format]            (nur bei Bedarf)
```

- **Ein Adapter = eine Quelle → kanonisches Lesson.** Signatur (konzeptionell,
  FE+BE gleich): `(rawSource) -> canonicalLesson`.
- **Heute existiert genau der Single-JSON-Adapter.** Er ist im Kern
  `parse + validate + normalize`. Die Grenze ist so gezogen, dass ein zweiter
  Adapter *daneben* tritt, ohne Fetch/Cache/Loader/Routen zu ändern.
- **Kein Registry.** Solange es einen Adapter gibt, ist die Auswahl trivial (der
  Aufrufer nennt den Single-JSON-Adapter direkt, per Default-Parameter). Ein
  Registry/Dispatch ("welcher Adapter für diese Quelle?") ist erst fällig, wenn
  der zweite Adapter kommt — dann ist es eine kleine, lokale Erweiterung an der
  Engine-Grenze, kein App-Umbau.

Der Aufrufer (Fetch/Cache) kennt **nur** die Adapter-Signatur, nie die Innereien
einer Quelle. So ist "Quelle → kanonisch" ein austauschbarer Schritt.

---

## 4. Lib-Extraktions-Grenze (die Naht)

Die Engine ist so abgegrenzt, dass sie später als eigenständige Library
extrahiert werden kann. **Jetzt NICHT extrahieren** — nur die Naht ziehen.

**Was in die Lib gehört (die Engine):**

- Das kanonische Format (Schema/Typen): `schema.py` / `content.ts`-Typen,
  `models.py` (`ContentManifest`, Versions-Gate).
- Parsing + Validierung: `parse_lesson_json` / `parse_manifest_yaml` (BE), die
  neuen `content/engine`-Transformationen (FE).
- Die Source-Adapter (heute: single-json) + die Adapter-Signatur.
- Künftig (zurückgestellt): das Merging eines Mehrdatei-Adapters (mehrere
  Quelldateien → kanonisches Single-JSON), falls je ein solches Format definiert
  wird.

**Was ausserhalb der Lib bleibt (der Host):**

- Netzwerk/Fetch (`github_adapter`, `github-fetch`).
- Persistenz/Cache (Filesystem-Cache BE, Dexie/IndexedDB FE).
- HTTP-Routen (`routes.py`), Storage-Namespaces, UI.

**Die Lib-Grenze als Schnittstelle:** *Input = rohe Quell-Daten (heute:
JSON-Text; künftig ggf. mehrere Quelldateien) + Set-Kontext (Sprachpaar/Domäne,
die eine Lektion vom Set erbt). Output = validiertes kanonisches Lesson-Objekt.*
Alles, was für diese Transformation nötig ist, gehört in die Lib; alles, was
die rohen Daten *beschafft* oder das Ergebnis *speichert*, bleibt aussen.

Konkret markiert der PR diese Grenze, indem die Parse-/Transform-Logik in ein
`content/engine`-Modul (FE) bzw. ein `content_engine`-Modul (BE) wandert, das
**keine** Fetch-/Cache-/UI-Imports hat. Genau dieses Modul wäre später das
Paket. Der Import-Graph (Konsument → Engine, nie Engine → Konsument) ist die
mechanische Prüfung, dass die Naht hält.

---

## 5. Cross-Language-Parität (FE ⟷ BE)

FE (TS) und BE (Python) haben je einen Loader; die Engine-Grenze gilt für
**beide, parallel**. Das Repo hat ein etabliertes **Cross-Language-Parity-Golden**
-Muster (z. B. `lesson-splitter.parity.test.ts`, `lesson-xp.parity.test.ts`,
`badge-tier.parity.test.ts`): gemeinsame Golden-Testdaten, gegen die beide
Sprachen gepinnt werden, sodass FE und BE **byte-identisch** rechnen.

Für die Engine-Grenze bedeutet Parität: derselbe rohe Input + derselbe
Set-Kontext ergeben in FE und BE **dasselbe kanonische Lesson**. Der
Single-JSON-Adapter ist heute im Kern Identität + Normalisierung (Sprachpaar aus
dem Set, Domänen-Default), sodass die Parität strukturell gegeben ist. Der
begleitende PR **benennt die Grenze in beiden Sprachen konsistent** (gleiche
Konzeptnamen: `content engine`, `single-json` Source-Adapter, `canonical
Lesson`), sodass ein spaeteres Parity-Golden direkt andocken kann.

**Entscheidung:** Ein dediziertes Parse/Merge-Parity-Golden wird **als
Folge-Schritt** vermerkt (es trägt erst mit dem Mehrdatei-Adapter, wo das
Merging nicht-trivial wird). Für diesen PR reicht die konsistente Benennung +
die identische kanonische Form; die bestehenden FE- und BE-Tests bleiben der
Verhaltens-Beweis.

---

## 6. Mehrdatei-Format als zurückgestellter künftiger Adapter

**Status: zurückgestellt (nicht verworfen), kein aktueller Plan, kein Bezug auf
ein bestehendes Template.** Ein frueheres `v1.4-preview`-Mehrdatei-Template wurde
bereits aus den Content-Repos **entfernt**; dieses EXP und die Engine beziehen
sich **nicht** darauf. Ein Mehrdatei-Format kommt nur, **wenn das Projekt oder
konkrete Nutzer es verlangen** — und dann als **neu definiertes** Format, nicht
als Wiederbelebung des entfernten Previews. Bis dahin ist Single-JSON die einzige
Quelle.

Was dieses EXP festhaelt, ist ausschliesslich, dass die Engine-Grenze **so
beschaffen ist**, dass ein solches kuenftiges Format als **weiterer
Source-Adapter** andocken könnte, **ohne** die Engine-Grenze zu ändern. Die
Naht bleibt offen, mehr nicht.

Wenn ein Mehrdatei-Format je definiert wird, saehe der Adapter konzeptionell so
aus (illustrativ, KEINE Festlegung auf konkrete Dateinamen/Struktur):

1. Er liest die dann definierten Quelldateien (Metadaten / Theorie / Karten /
   Übungen — die konkrete Aufteilung ist Teil der späteren Format-Definition).
2. Er merged sie zu **einem** kanonischen Single-JSON-Lesson-Objekt.
3. Er validiert das Ergebnis gegen **dasselbe** kanonische Schema (EXP-039).
4. Der Rest der App bleibt unverändert — der Viewer sieht nur das kanonische
   Objekt.

Der einzige Punkt, der sich ändert, ist dann die **Adapter-Auswahl** an der
Engine-Grenze (welcher Adapter für welche Quell-Form) — heute trivial (nur
single-json), dann eine kleine Fallunterscheidung. Fetch/Cache/Routen/UI bleiben
unberührt. Das ist der Beweis, dass die Naht richtig gezogen ist.

---

## 7. Abgrenzung / Scope

**Dieser PR (verhaltensgleich):**

- Dieses EXP-Dokument + EXP-INDEX-Eintrag.
- FE: kanonische Parse-/Transform-Logik aus `content-loader-dexie.ts` in ein
  abgegrenztes `content/engine`-Modul buendeln (Single-JSON-Adapter +
  Manifest-Transform). Fetch/Dexie/UI bleiben aussen. Der Loader ruft die Engine.
- BE: die Parse-Grenze unter einem `content_engine`-Modul als
  Source-Adapter-Grenze benennen; Konsumenten (`cache.py`/`service.py`) rufen die
  Engine statt direkt `manifest_parser`. `manifest_parser.py` bleibt als
  Low-Level-Parser (unverändert getestet).
- Gleiche Konzeptnamen FE/BE.
- **Kein** Verhaltenswechsel: keine Änderung an Ladeweg, Dateinamen-Konvention,
  Schema. Bestehende Tests bleiben unverändert grün (Sicherheitsnachweis); die
  neue Engine-Schnittstelle bekommt eigene Tests.

**Später (Folge-Arbeit, nicht dieser PR):**

- Ein Mehrdatei-Adapter (Abschnitt 6) — **zurückgestellt**, nur bei konkretem
  Projekt-/Nutzer-Bedarf, dann als neu definiertes Format.
- Die echte Library-Extraktion (Abschnitt 4) in ein eigenes Paket.
- Ein Cross-Language-Parse/Merge-Parity-Golden (Abschnitt 5).
- Eine Adapter-Auswahl/Dispatch, sobald der zweite Adapter existiert.

---

## Questions and assumptions

- **Annahme (verifiziert):** Das Backend hat die Parse-Grenze faktisch schon in
  `manifest_parser.py` — die Abgrenzung ist dort ein **Benennen** der Grenze
  (additives `content_engine`-Modul, das die vorhandenen Parser als
  Source-Adapter führt), kein Umbau. Der eigentliche Extraktions-Aufwand liegt
  im Frontend, wo die Parse-/Transform-Logik inline im Dexie-Loader vergraben
  ist. Das ist der Grund, warum der PR asymmetrisch aussieht (viel FE-Bewegung,
  wenig BE-Bewegung).
- **Annahme (konservativ):** Cross-Language-Parse-Parity via Golden trägt erst
  mit dem Mehrdatei-Adapter (heute ist der Single-JSON-Adapter im Kern
  Identität + Normalisierung). Deshalb: konsistente Benennung jetzt,
  Parity-Golden als Folge-Schritt — statt ein Golden zu bauen, das nur die
  Identität pinnt.
- **Kein Registry jetzt:** Ein Adapter-Dispatch für genau einen Adapter wäre
  Over-Engineering (VIBE-CODING/Reusability §7 — Selbst-Bauen nur, wenn nötig).
  Die Naht ist eine getypte Signatur + ein Default-Adapter; der Dispatch kommt
  mit dem zweiten Adapter.
- **Keine STOP-blockierende Frage.** Der Auftrag war als autonomes Design +
  verhaltensgleiche Abgrenzung formuliert; alle Richtungsentscheidungen sind hier
  festgehalten.

---

*EXP-042, erstellt 2026-07-01. Design + verhaltensgleiche Erst-Abgrenzung im
begleitenden PR. Issue: astrapi69/adaptive-learner#1309.*
