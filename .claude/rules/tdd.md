---
description: Test-Driven Development workflow - Red-Green-Refactor cycle, four-test-per-feature guideline, bug-fix discipline
globs:
  - backend/tests/**/*.py
  - plugins/*/tests/**/*.py
  - frontend/src/**/*.test.ts
  - frontend/src/**/*.test.tsx
alwaysApply: false
---

# Test-Driven Development (TDD)

This is the WORKFLOW rule for writing code. It sits on top of the test
STRATEGY in `quality-checks.md` (pyramid, coverage targets, mutation
testing) and the test bullets in `coding-standards.md` ("failing test
FIRST, then fix"). Where those state *what* and *how much* to test, this
rule states the *order*: test first, then the minimal code, then cleanup.

## Pflicht für Code-Änderungen mit Logik

Code-Änderungen mit Verhalten/Logik folgen dem Red-Green-Refactor-Zyklus.
"Mit Logik" heißt: ein neues Verhalten, ein geänderter Code-Pfad, eine
Bedingung, eine Berechnung, eine Validierung, ein Mapping. Reine Mechanik
ohne Verhaltensänderung fällt unter die Ausnahmen unten.

### Phase 1: RED (Test zuerst)

- Test schreiben, der die gewünschte Änderung beschreibt.
- Der Test MUSS fehlschlagen (beweist, dass das Feature/der Fix noch
  nicht existiert).
- Kein Produktionscode vor dem fehlschlagenden Test.

### Phase 2: GREEN (minimale Implementierung)

- Nur den Code schreiben, der den Test grün macht.
- YAGNI: keine vorzeitige Optimierung, kein Code "für später"
  (deckt sich mit `ai-workflow.md` "Nur was jetzt gebraucht wird").
- `tsc --noEmit` + vitest (Frontend) bzw. pytest (Backend) grün.

### Phase 3: REFACTOR (aufräumen)

- Code-Smells, Duplikation, Benennung verbessern (Boy-Scout-Rule,
  `coding-standards.md`).
- Tests bleiben grün.

## Test-Menge pro Feature/Fix

Die bestehende Vorgabe in `quality-checks.md` ("New service or new
function: at least a happy path + one error case"; "New endpoint: at
least one happy-path test") ist der MINIMAL-Boden für triviale Fälle.
Für ein echtes Feature oder einen Fix ist das ZIEL die folgende
Aufteilung - mindestens vier Tests, die zusammen das Verhalten
absichern:

1. **Reproduktionstest** - der Red-Test vor dem Fix/Feature.
2. **Happy-Path** - der erwartete Normalfall.
3. **Edge-Cases** - leere/fehlende/unerwartete Eingaben.
4. **Grenzwerte / Boundary** - die Ränder des gültigen Bereichs.

Boden (happy path + error case) und Ziel (4er-Aufteilung) sind KEIN
Widerspruch: der Boden gilt für triviale neue Funktionen, das Ziel für
Features und Fixes. Mehr Tests sind erlaubt, weniger als der Boden nicht.
Keine künstlichen Tests nur zum Zählen - jeder Test prüft eine echte
Verhaltenseigenschaft (vgl. "Meaningful coverage is the goal" in
`quality-checks.md`).

## Bug-Fixes

- IMMER zuerst einen Test, der den Bug reproduziert (RED, beweist den
  Bug). Das ist die Workflow-Form der Regel "Bug fixes: failing test
  FIRST, then fix" aus `coding-standards.md` / `quality-checks.md`.
- Dann fixen bis GREEN.
- Der Reproduktionstest bleibt als Regressions-Guard im Repo.
- Entspricht der Root-Cause-Disziplin: erst den Fehler reproduzierbar
  machen, dann fixen - kein Fix ohne verstandene Ursache.

## Ausnahmen (etablierte Projektpraxis)

TDD wird NICHT erzwungen für:

- Reine Doku-Änderungen (kein Code).
- Reine Konfiguration (CI, Makefile, YAML) ohne Logik.
- Mechanische Refactors mit bestehender Testabdeckung: Datei-Splits,
  Barrel-/Re-Export-Umzüge, god-folder-Auflösung, Schema-/Typ-
  Generierung. Hier MUSS die bestehende Suite grün bleiben (beweist,
  dass nichts brach), aber es werden keine neuen Verhaltenstests
  erzwungen. (So gehandhabt z. B. beim `lib/ai`-Split und der
  TS-Typen-Generierung.)
- Visuelle / Geräte-only-Aspekte, die im Container nicht testbar sind,
  bleiben manueller Rest - TDD ersetzt weder den Visuellen Device-Check
  noch den BACKUP-AKZEPTANZTEST aus `quality-checks.md`, sondern ergänzt
  sie.

Die Ausnahmen entbinden nicht von der harten Regel "`make test` muss
nach jeder Änderung grün bleiben".
