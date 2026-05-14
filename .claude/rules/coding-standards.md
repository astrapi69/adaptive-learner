# Coding Standards

## Allgemein

- Entwickler: Asterios Raptis (Ein-Mann-Show, KI-gestuetzt).
- Ziel: Pragmatisch, wartbar, schnell lieferbar. Kein Over-Engineering.
- Wenn unklar: Nachfragen statt raten.

## Python (Backend + Plugins)

- Python 3.11+, Poetry fuer Dependency Management.
- Type Hints IMMER. Kein `Any` ohne Kommentar.
- Docstrings fuer oeffentliche Funktionen (Google-Style).
- pytest fuer Tests. Fixtures bevorzugen, kein setUp/tearDown.
- Async bevorzugen wo FastAPI es unterstuetzt.
- Import-Reihenfolge: stdlib, third-party, local (isort-kompatibel).
- Pydantic v2 fuer Schemas. Field-Validatoren statt manuelle Checks.
- SQLAlchemy 2.0 Mapped Columns.

## TypeScript (Frontend)

- Strict Mode aktiv. Kein `any` ohne Kommentar.
- Interfaces fuer Datenmodelle, Types fuer Unions/Aliases.
- Funktionale Komponenten mit Hooks. Keine Klassen-Komponenten.
- Props als Interface definiert.
- Komplexe Logik in Utility-Funktionen oder den API Client auslagern.

## Benennung

- Python: snake_case (Dateien, Funktionen, Variablen), PascalCase (Klassen).
- TypeScript: PascalCase (Komponenten, Interfaces), camelCase (Funktionen, Variablen).
- Plugin-Ordner: backend/plugins/{name} (snake_case).
- Methoden-Keys: snake_case (deductive, error_based, ai_adaptive).
- Zyklus-Keys: snake_case (input, attempt, error, feedback, adapt, repeat, integrate).
- Kein I-Prefix fuer Interfaces. `User` statt `IUser`.
- Keine generischen Namen: data, info, result, temp, item, obj, val sind verboten.
  Stattdessen: session_data, profile_info, assessment_result, commit_item.
  Ausnahme: Loop-Variablen (i, j) und Lambdas.

## Formatierung

- Kein Em-Dash (-- oder Unicode U+2014). Bindestriche (-) oder Kommas nutzen.
- Nur Standard-UTF-8-Zeichen.
- Keine Emojis im Code oder in Kommentaren.
- Einrueckung: 4 Spaces (Python), 2 Spaces (TypeScript/CSS).
- Automatische Formatierung: ruff + black (Python). Siehe code-hygiene.md.

## Git

- Conventional Commits: feat:, fix:, refactor:, docs:, test:, chore:
- Scope angeben wenn klar: feat(session): ..., fix(assessment): ...
- Ein Commit pro logische Aenderung.
- Branch-Benennung: feature/{name}, fix/{name}, chore/{name}
- Kein `Co-Authored-By` Trailer fuer KI-Tools oder Bots.

## Function Design und Kohaesion

### Grundregeln

- Jede Funktion hat genau eine Verantwortung.
- Max 40 Zeilen pro Funktion. Ueber 50 ist ein sofortiges Refactoring-Signal.
- Funktionen die mehrere Dinge tun (parse UND save, validate UND transform) werden aufgeteilt.
- Indikator fuer niedrige Kohaesion: Kommentare wie "# Step 1", "# Step 2" in einer Funktion. Jeder Schritt wird eine eigene Funktion.

### Abstraktionsebenen nicht mischen

- Eine Funktion operiert auf EINER Abstraktionsebene.
- FALSCH: db.query() und String-Formatierung in der gleichen Funktion.
- RICHTIG: High-Level-Funktion ruft Low-Level-Helper auf.

### Route-Handler

- routes.py enthaelt NUR Routing-Logik: Input validieren, Service aufrufen, Response zurueckgeben.
- Geschaeftslogik gehoert in Service-Module, NICHT in Route-Handler.

### Daten zwischen Funktionen

- Gemeinsame Daten: ein Dataclass oder TypedDict, NICHT lose Dicts die herumgereicht werden.
- Jede extrahierte Funktion muss einzeln testbar sein.

### Crash Early

- Ungueltige Inputs am Anfang der Funktion abfangen, nicht tief verschachtelt.
- Pydantic-Validierung fuer API-Input.
- Guard Clauses statt tief verschachtelter if/else.

## DRY - Don't Repeat Yourself

- Gleiche Logik an zwei Stellen: In eine gemeinsame Funktion extrahieren.
- Gleiche Konstanten an zwei Stellen: In eine zentrale Datei verschieben.
- Drei Duplikate: Sofort refactoren, nicht spaeter.

## Boy Scout Rule

- Code sauberer hinterlassen als vorgefunden. Kleine Verbesserungen bei jeder Aenderung.
- Gilt auch fuer Claude Code: Wenn du eine Funktion anfasst die gegen Regeln verstoesst, den Verstoss gleich mitfixen.

## Error Reporting

Fehlerdetails muessen praezise genug sein, dass ein GitHub Issue daraus direkt umsetzbar ist.

- Kein `except` ohne logger.error(). Nie eine Exception verschlucken.
- Exception-Detail muss den Grund enthalten, nicht nur den Funktionsnamen.
- Services: str(e) in eigene Exception-Klassen einbauen (NICHT HTTPException).
- Generische Fehlermeldungen wie "Session failed" oder "Import failed" ohne Details sind VERBOTEN.
- Frontend: API-Fehler dem User zeigen, nicht nur console.log.

## Tests

- Backend: pytest. Plugin-Tests in backend/plugins/{name}/.
- Frontend: Vitest (spaeter).
- AI-Provider: IMMER mocken, keine echten API-Calls.
- Neue Endpoints: Mindestens ein Happy-Path-Test.
- Bugfixes: Erst failing Test, dann Fix.
- `make test` muss gruen bleiben nach jeder Aenderung.
- Bestehende Tests NIEMALS loeschen oder abschwaechen.

## Sicherheit

- ADAPTIVE_LEARNER_SECRET_KEY niemals committen.
- .env Dateien in .gitignore.
- API-Keys nur verschluesselt speichern (Fernet).
- Kein Klartext-Key ans Frontend senden.

## Abhaengigkeiten

Neue Dependencies nur nach Rueckfrage. Bestehender Stack:

Backend: FastAPI 0.136+, SQLAlchemy 2.0, Pydantic 2.11+, pluginforge, PyYAML, cryptography, anthropic
Frontend: React 19, TypeScript 6, Vite 8, Recharts 3.8, Lucide React, react-router-dom 7
Testing: pytest 8, pytest-cov, httpx, vitest 4, happy-dom, @testing-library/react
Linting: ruff 0.11+, mypy, pre-commit
Tooling: Poetry, npm, Docker, Make
