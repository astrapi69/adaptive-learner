# EXP-040: Directory-Restrukturierung (God-Folders nach Concern gruppieren)

**Kategorie:** Querschnitt (Code-Organisation, Wartbarkeit, Tech-Debt)
**Phase:** abgeschlossen (laufender Erosionsschutz via CI-Gate)
**Prioritaet:** Mittel (Hygiene, kein User-sichtbarer Effekt)
**Abhaengig von:** EXP-024 (Schichtentrennung) als verwandte Struktur-Disziplin; ansonsten keine
**Issue:** astrapi69/adaptive-learner#809 (Umbrella) — Slices #1203/#1206 (Slice A), #1207/#1210 (Slice B); verwandt #917/#1190 (lib/ai), #868/#874-#879 (v1.92.0-Batch)
**Status:** Umgesetzt und abgeschlossen. Alle god-folders unter `frontend/src/` sind
nach Concern in Subfolder gruppiert; `.dirsize-baseline` ist **leer**; der
CI-Directory-Size-Guard (`scripts/check-directory-size.sh`, Warn-Schwelle 15,
Ratchet-Gate) ist verdrahtet (`complexity-check.yml`, Makefile-Targets) und
sichert den Zustand gegen Rückkehr.

> Dieses Dokument ist eine **nachgezogene Architektur-Notiz**: die Arbeit lief
> über mehrere Releases (v1.92.0 .. v1.97.1) und das Umbrella-Issue #809 wurde
> geschlossen, aber die EXP-Nummer 040 — bei der EXP-041-Arbeit für genau diese
> Restrukturierung freigehalten — blieb ungeschrieben. Diese Datei schließt die
> Nummerierungslücke und hält die Entscheidung nachträglich fest. Sie ist aus
> dem **tatsächlichen Code-Stand** geschrieben (verify-first), nicht aus dem
> ursprünglichen Plan; wo Plan und Umsetzung auseinanderlaufen, zählt die
> Umsetzung.

---

## 1. Das Problem: God-Folders, das Verzeichnis-Analog zu God-Files

Das Projekt hatte bereits eine etablierte Disziplin gegen **God-Files** (zu lange
Einzeldateien) mit einem Filesize-Watcher und einer `.filesize-baseline`. Auf
Verzeichnis-Ebene fehlte das Gegenstück: mehrere Verzeichnisse unter
`frontend/src/` hielten 20-40+ Quelldateien **flach** ohne Substruktur. Ein
flaches Verzeichnis mit 80+ Dateien ist genauso schwer zu navigieren und zu
verstehen wie eine 1000-Zeilen-Datei — die Datei-Liste wird zur Wand, fachlich
zusammengehörige Module liegen verstreut zwischen fremden, und ein neuer
Contributor findet "wo gehört das hin?" nicht mehr aus der Struktur heraus.

Audit-Stand bei Issue-Eröffnung (#809, rekursive Datei-Zählung pro
Top-Level-Bereich):

| Verzeichnis              | Dateien |
| ------------------------ | ------- |
| `components/`            | 143     |
| `shared/`               | 96      |
| `lib/content/`          | 88      |
| `storage/`              | 79      |
| `hooks/`                | 72      |
| `pages/`                | 59      |
| `lib/`                  | 52      |
| `components/content/`   | 36      |
| `components/lesson/`    | 29      |
| `components/exercises/` | 27      |
| `storage/types/`        | 18      |

(Die Zahlen sind rekursiv inkl. Tests; der später eingeführte Guard zählt
**flach**, maxdepth 1, ohne Tests — daher die kleineren Schwellwerte unten.)

---

## 2. Die Entscheidung: Gruppierung nach fachlichem Concern

Das Leitprinzip ist exakt das der God-File-Disziplin, eine Ebene höher
angewandt: **ein Verzeichnis ist kohäsiv, wenn man seine Dateien nach genau
einem fachlichen Concern lesen kann.** Wenn das nicht geht, gruppiert man.

Konkrete Regeln:

- **Max ~15 flache Quelldateien pro Verzeichnis.** Darüber: nach Concern in
  Subfolder gruppieren.
- **Jeder Subfolder bekommt ein `index.ts`-Barrel**, das seine öffentliche
  Fläche exportiert.
- **Der Parent re-exportiert** über sein eigenes Barrel, damit externe
  Konsumenten ihren Import-Pfad nicht ändern müssen — die Restrukturierung ist
  **rückwärts-kompatibel** an der Modulgrenze.
- **Ko-lokierte Tests wandern mit ihrem Subjekt** (Konvention: `*.test.tsx`
  liegt neben der getesteten Datei).
- **Ein Commit pro Verzeichnis-Migration** (kleiner Rollback-Scope, sauber
  bisectbar).
- **Reines Refactoring:** null Verhaltensänderung, null Bugfix, null Feature.
  Nach jedem Schritt `tsc --noEmit` sauber, volle Vitest-Suite grün,
  `npm run build` + Dexie-Build ok, `madge` 0 Zyklen.

Diese Konvention deckt sich mit der Reusability-Regel
(`.claude/rules/reusability.md`): Barrel-Exports an Modulgrenzen, generische
Benennung, App-unabhängige Teile unter `frontend/src/shared/`.

---

## 3. Tatsächliche Umsetzung (verify-first)

Die Restrukturierung lief **gestaffelt über mehrere Releases**, nicht in einem
Big-Bang. Stand heute (`frontend/src/`) ist jeder god-folder aus der Audit-Tabelle
nach Concern gruppiert. Was wann passierte:

### 3a. Bulk-Splits (v1.92.0, #868 / #874-#879)

Der Großteil war bereits vor der formalen Gate-Verdrahtung erledigt. v1.92.0
("technical-debt sweep") gruppierte sechs flache Verzeichnisse plus den
Storage-Baum, jeweils mit Barrel + Parent-Re-Export, und ließ jeden Eintrag aus
`.dirsize-baseline` fallen:

- `components/` (84 flache Dateien) → Concern-Folder
  (`assessment`, `badges`, `charts`, `content`, `dashboard`, `editor`, `lesson`,
  `nav`, `onboarding`, `progress`, `session`, `settings`, `share`, `sync`, `ui`,
  `voice`, ...).
- `lib/content/` (49) → `analysis`, `browse`, `invites`, `language`, `lesson`,
  `media`, `placement`, `repos`, `validation`.
- `lib/` (29) → fachliche Domänen-Folder
  (`adaptive`, `ai`, `anki`, `assessment`, `backup`, `badges`, `export`,
  `gamification`, `learning-path`, `review`, `srs`, `statistics`, ...).
- `components/content/` (28) → `browser`, `contributions`, `invites`, `lessons`,
  `media`, `quality`, `share`.
- `components/lesson/` (19) → `chrome`, `dialogs`, `steps`, `summary`, `tts`.
- `storage/types/` (18) → `content`, `core`, `integrations`, `learning`.
- Zusätzlich `storage/` (41 → 9 Subdirs, #868): `dexie`, `gamification`,
  `lessons`, `content`, `ai`, `anki`, `backup`, `sync`, `services` — die
  Dexie-Namespace-Aufteilung, die heute in `CLAUDE.md` + `architecture.md` als
  Standard dokumentiert ist (eine neue Dexie-Namespace ist ein neues Modul in der
  passenden Concern-Gruppe, kein weiterer Methoden-Stapel in einer Datei).

`shared/`, `hooks/` (Top-Level) und `pages/` wurden im selben Zeitraum nach
Concern gruppiert — heutiger Stand: `shared/` →
`data-display`, `feedback`, `forms`, `gamification`, `hooks`, `layout`, `media`,
`status`; `hooks/` → `content`, `learning`, `lesson`, `settings`, `system`,
`ui`; `pages/` → `content`, `dashboard`, `learning-path`, `lesson`,
`onboarding`, `system`.

### 3b. Verbleibende Slices unter dem Gate (v1.97.x)

Als der CI-Guard mit `.dirsize-baseline` verdrahtet wurde (#1174/#1176), blieben
drei tolerierte god-folders über der 15-Datei-Schwelle. Sie wurden einzeln
abgearbeitet:

- **`lib/ai`** (16 Dateien, #917 / #1190): Split in
  `generation` / `validation` / `providers`.
- **`components/exercises`** (17 Dateien, **Slice A**, #1203 / #1206): Split in
  - `renderers/` (7): die 5 Typ-Renderer + `MatchingResolution` + matching-parts
  - `shell/` (4): `ExerciseDispatcher`, `ExerciseFooter`, `ExercisePromptRow`,
    `exercise-control`
  - `feedback/` (6): `AnswerCelebration`, `DiffHighlight`, `ExerciseHint`,
    `ExerciseAnswerToggle`, `DirectionInstruction`, `CorrectionBlock`

  Zwei Konsumenten, die selbst im Exercise-Abhängigkeitsgraphen liegen
  (`lib/exercises/useControlledExercise`, `hooks/lesson/useLessonEnterKey`),
  importieren den Vertrag direkt aus `shell/exercise-control`, um einen
  Barrel-Zyklus zu vermeiden — die Barrel-Re-Export-Regel hat hier eine bewusste,
  dokumentierte Ausnahme zugunsten von `madge` 0 Zyklen.
- **`hooks/lesson`** (15 Hooks + Barrel, **Slice B**, #1207 / #1210): Split in
  - `modes/` (6): `useLessonMode`, `useReviewLesson`, `useShuffleLesson`,
    `useTimedLesson`, `useEndlessLesson`, `useAdaptiveLesson`
  - `session/` (4): `useLesson`, `useIsLessonActive`, `useLessonFlowControl`,
    `useLessonNavigation`
  - `interaction/` (3): `useLessonEnterKey`, `useLessonShortcuts`,
    `useExerciseHints`
  - `audio/` (2): `useReadAloud`, `useLessonAutoRead`

  Mit Slice B ist `.dirsize-baseline` **leer** — der god-folder-Guard passiert
  mit null tolerierten Verzeichnissen, und #809 ist komplett.

### 3c. Ehrliche Einordnung

Der Löwenanteil der Restrukturierung (3a) war bereits in v1.92.0 erledigt,
bevor das EXP-Dokument existierte. Was unter dem expliziten #809-Banner und dem
Gate **neu dazukam** (3b), sind die drei verbliebenen Slices `lib/ai`,
`components/exercises` und `hooks/lesson`. Das Umbrella-Issue #809 spannt beide
Phasen: es war von Anfang an der Tracking-Sammelpunkt für "god-folders
auflösen", und die letzte Slice hat es geschlossen.

---

## 4. Erosionsschutz: der CI-Directory-Size-Guard

Damit die Struktur nicht wieder erodiert (genau die Gefahr, die die God-File-
Disziplin auf Datei-Ebene schon adressiert), gibt es einen analogen
Verzeichnis-Guard.

**`scripts/check-directory-size.sh`** (Alias `scripts/check-folder-size.sh`):

- Zählt **flache** (`maxdepth 1`), versionierte (`git ls-files`)
  `*.ts` / `*.tsx`-Quelldateien pro Verzeichnis unter `frontend/src`.
  Ko-lokierte `*.test.ts(x)` zählen nicht — der Guard prüft die Gruppierung von
  **Quell**-Dateien nach Concern; Tests liegen konventionsgemäß neben ihrem
  Subjekt.
- **`WARN_THRESHOLD`** (default 15): Warnung, kein Fail (Standard-/Warn-Lauf).
- **`--gate`** (Ratchet): exit 1, wenn ein **nicht** in `.dirsize-baseline`
  gelistetes Verzeichnis über dem Schwellwert liegt. Bestehende, noch nicht
  migrierte god-folders werden über die Baseline toleriert, dürfen aber nicht
  **neu** entstehen. Die Baseline darf nur schrumpfen, nie wachsen.

**`.dirsize-baseline`** ist die einzige Whitelist (Format: ein Pfad pro Zeile +
`# Begründung / Tracking-Issue`). `.folder-size-whitelist` ist nur ein Pointer
auf diese Datei, damit der angefragte Name auf Dokumentation statt auf eine
divergierende zweite Liste auflöst. Heutiger Stand: **leer** (nur Kommentar-Kopf).

**Verdrahtung:**

- Makefile: `check-directory-size` (warn-only), `check-directory-size-gate`
  (Ratchet-Gate), `check-folder-size` (Gate-Alias), `check-folder-size-update`
  (zeigt aktuelle Offender zum Whitelisten).
- CI (`.github/workflows/complexity-check.yml`): ein **Gate-Schritt**
  ("Folder-size guard (god-folder gate)", `bash scripts/check-folder-size.sh`)
  blockiert einen neuen Offender, plus ein **Warn-View-Schritt**
  ("Directory-size warn-view", blockiert nie), analog zur Aufteilung
  complexity-gate (hart) / complexity-report (warn).

Der Guard sitzt damit in derselben Familie wie der Filesize-Watcher und der
Complexity-Ratchet: ein hartes Gate gegen Rückschritt plus ein informationeller
Warn-View.

---

## 5. Bezug und Einordnung

- **#809** ist das Umbrella-Issue; diese EXP hält die Architektur-Entscheidung
  dahinter fest. Slices: #1203/#1206 (`components/exercises`),
  #1207/#1210 (`hooks/lesson`); verwandt #917/#1190 (`lib/ai`),
  #868 + #874-#879 (v1.92.0-Bulk), #872/#1174/#1176 (Guard-Verdrahtung).
- **EXP-024** (Schichtentrennung) ist die verwandte Struktur-Disziplin auf der
  Abhängigkeits-Achse (UI → Service → Repository → Daten); EXP-040 ist die
  Struktur-Disziplin auf der Datei-Organisations-Achse (Concern-Gruppierung
  innerhalb einer Schicht). Beide verfolgen dasselbe Ziel — Struktur, aus der
  hervorgeht, wo etwas hingehört — auf unterschiedlichen Achsen.
- **EXP-039** (JSON-Schema als SoT) und **EXP-041** (Aufgabentyp-Eignung) sind
  die direkten Nummern-Nachbarn; EXP-040 war für die hier dokumentierte
  Directory-Restrukturierung reserviert und schließt damit die
  Nummerierungslücke zwischen 039 und 041.

### Kernsatz

God-Folders sind das Verzeichnis-Analog zu God-Files: ein flaches Verzeichnis mit
zu vielen Dateien verliert seine Lesbarkeit genauso wie eine zu lange Datei. Die
Lösung ist dieselbe Disziplin eine Ebene höher — nach fachlichem Concern
gruppieren, Barrel pro Subfolder, Parent-Re-Export für Rückwärts-Kompatibilität,
ein Commit pro Migration, grün nach jedem Schritt — abgesichert durch einen
Ratchet-Guard, der den erreichten Zustand gegen Rückkehr verteidigt.
