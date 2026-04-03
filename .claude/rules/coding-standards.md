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

## Tests

- Backend: pytest. Plugin-Tests in backend/plugins/{name}/ neben dem Code oder in backend/tests/.
- AI-Provider: IMMER mocken, keine echten API-Calls in Tests.
- Assessment: Profil-Berechnung deterministisch testbar.
- Switching-Logik: Unit-Tests mit verschiedenen Rating-Szenarien.
- `make test` muss gruen bleiben nach jeder Aenderung.
- Bestehende Tests NIEMALS loeschen oder abschwaechen.

## Sicherheit

- ADAPTIVE_LEARNER_SECRET_KEY niemals committen.
- .env Dateien in .gitignore.
- API-Keys nur verschluesselt speichern (Fernet).
- Kein Klartext-Key ans Frontend senden.

## Abhaengigkeiten

Neue Dependencies nur nach Rueckfrage einfuehren. Bestehender Stack:

Backend: FastAPI, SQLAlchemy 2.0, Pydantic v2, pluginforge, PyYAML, cryptography, anthropic
Frontend: React 18, TypeScript, Vite, Recharts
Testing: pytest, pytest-cov, httpx
Linting: ruff, black, mypy, pre-commit
Tooling: Poetry, npm, Docker, Make
