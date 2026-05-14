# Adaptive Learner - Systematic Audit Prompt

Drop-in fuer jede zukuenftige Audit-Session. Verbatim in eine frische
Claude Code Session im Repo-Root kopieren.

---

Analysiere die Adaptive Learner Codebase im Arbeitsverzeichnis. Fuehre ein
systematisches Audit gegen die dokumentierten Standards durch. Adaptive Learner
ist ein Python 3.11+ / FastAPI / SQLAlchemy 2.0 / Pydantic v2 Backend; React 18 /
TypeScript / Vite / Recharts Frontend; PluginForge-basierte Plugin-Architektur;
adaptives Lernsystem mit 6 Methoden und 7-Schritte-Zyklus.

## Massgebliche Quellen

Vor jedem Finding konsultieren:

- `CLAUDE.md` (Projekt-Uebersicht, Plugin-Tabelle, Konventionen)
- `.claude/rules/architecture.md` (Schichtenmodell, Plugin-Struktur)
- `.claude/rules/coding-standards.md` (Benennung, Funktionsdesign, Tests)
- `.claude/rules/code-hygiene.md` (Error-Handling, API-Konventionen)
- `.claude/rules/lessons-learned.md` (Bekannte Fallstricke)
- `.claude/rules/quality-checks.md` (Testpyramide, Coverage-Ziele)
- `docs/ROADMAP.md` (Aktuelle Phase, offene Items)
- `docs/CONCEPT.md` (Fachliches Modell, Architektur)

Wenn ein Finding einer dokumentierten Konvention widerspricht, die Rule-Datei zitieren.

## Audit-Scope

### 1. Test-Validitaet

- Tests gegen aktuelle Implementierung pruefen.
- Veraltete, redundante oder unerreichbare Tests identifizieren.
- Coverage der kritischen Pfade verifizieren.
- AI-Provider-Tests: Mocks statt echte API-Calls.

### 2. Code-Qualitaet und Technische Schulden

- Deprecated Patterns, verwaiste Imports, ungenutzte Variablen, tote Funktionen.
- Error-Handling Architektur per code-hygiene.md.
- Plugin-Compliance per architecture.md: BasePlugin-Subklasse, @hookimpl, Config via YAML.
- Function Design: Max 40 Zeilen, Single Responsibility.
- Keine hardcodierten Strings in UI (i18n nutzen).
- Keine `any` in TypeScript ohne Kommentar.
- Keine Em-Dashes.

### 3. Infrastruktur und Dependencies

- Poetry: `backend/pyproject.toml`, `poetry show --outdated`.
- Frontend: `package.json`, `npm outdated`.
- Docker: Dockerfile, docker-compose.yml Konsistenz.
- Git: Conventional Commits, pre-commit hooks aktiv.
- .gitignore: .env, *.db, __pycache__/, coverage.xml.
- Secrets: API-Keys nur verschluesselt, Secret Key aus Env-Variable.

### 4. Dokumentation und Struktur

- README: Aktuell, Install-Anleitung, Tech Stack.
- ROADMAP: Offene Items aktuell, erledigte markiert.
- API: Endpunkte dokumentiert oder via FastAPI /docs.
- CONCEPT.md: Architektur-Entscheidungen aktuell.

## Output-Format

- Markdown, gruppiert nach den 4 Sektionen.
- Jedes Finding als Tabellenzeile:
  `| [Datei:Zeile] | [Typ] | [Grund] | [Empfohlene Aktion] | [Prioritaet] |`
- **Typ:** `Blocker`, `Outdated`, `Improvement`, `Info`.
- **Prioritaet:** P0 (sofort), P1 (diese Session), P2 (naechstes Release), P3 (nice-to-have).
- Rule-Dateien zitieren bei Verletzungen.

## Nach dem Audit

1. **Summary Counts** nach Prioritaet.
2. **Automatisierbar:** Findings die in einem mechanischen Commit fixbar sind.
3. **Halt-Liste:** Findings die ohne User-Genehmigung nicht angefasst werden.
4. **Verifizierungsbefehle** die das Audit ausgefuehrt hat.

Code NICHT aendern als Teil des Audits, es sei denn explizit angefragt.
