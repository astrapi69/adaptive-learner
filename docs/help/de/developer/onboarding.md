# Onboarding: Dein erster Bug-Fix

Ein praktischer Schritt-für-Schritt-Durchlauf für neue Mitwirkende.
Anders als die Seiten [Architektur](architecture.md) und
[Setup](setup.md) (die erklären, *was* das System ist), führt diese
Seite dich durch das *Tun* deines ersten Bug-Fixes - vom frischen
Klon bis zum gemergten Pull Request.

## 1. Entwicklungsumgebung einrichten

Voraussetzungen: **Python 3.12** (die Backend-Vorgabe ist `~3.12`),
**Node 24+** (von Vite 8 vorausgesetzt),
**Poetry**, **Bun** und **GNU Make**.

```bash
# Klonen
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Alles installieren: Poetry-Backend + Plugin-Path-Deps + Bun-Frontend
make install

# Grüne Basislinie herstellen, bevor du etwas änderst
make test

# App starten (Backend auf :18001, Frontend auf :15174)
make dev
```

Der Frontend-Dev-Server läuft auf **http://localhost:15174**, das
Backend auf **http://localhost:18001**. Beide Ports sind über
`ADAPTIVE_LEARNER_FRONTEND_PORT` / `ADAPTIVE_LEARNER_PORT`
überschreibbar. Ein einmaliges Ctrl-C stoppt beide.

Wenn `make install` fehlschlägt, liegt es meist daran, dass Poetry das
falsche Python wählt - führe `poetry env use python3.12` in `backend/`
aus und installiere neu. Die vollständige Konfigurationskette
(Secrets, KI-Schlüssel, der zwingende `ADAPTIVE_LEARNER_SECRET_KEY`)
steht im [Setup](setup.md).

## 2. Einen Bug finden

Issues sind die Arbeitswarteschlange. Jeder Fix braucht **zuerst** ein
Issue (`GITHUB-ISSUE-PFLICHT`).

```bash
# Offene Bug-Issues
gh issue list --label bug --state open
```

Oder auf GitHub:
<https://github.com/astrapi69/adaptive-learner/issues?q=is%3Aissue+is%3Aopen+label%3Abug>

Such dir für den Anfang etwas Kleines - halte Ausschau nach
`good first issue` oder einem `bug` mit geringem Aufwand. Existiert
für den gefundenen Bug kein Issue, **erstelle eines, bevor du Code
anfasst** - und lege für jeden neu entdeckten Bug ein *separates*
Issue an.

## 3. Das Issue verstehen

- Lies die Beschreibung und reproduziere den Bug lokal.
- Notiere, in welchem Storage-Modus er auftritt. Adaptive Learner hat
  **duales Storage** (API/SQLite *und* Dexie/IndexedDB); ein Bug kann
  in einem Modus, im anderen oder in beiden stecken. Siehe
  [Storage-Layer](storage-layer.md).
- Wenn du ihn nicht reproduzieren kannst, frage im Issue, statt zu
  raten.

## 4. Branch erstellen

Adaptive Learner nutzt **Gitflow**: `develop` ist der aktive Branch,
`main` enthält nur Releases. Branche *von* `develop` und öffne deinen
PR *gegen* `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b fix/kurze-beschreibung
```

Branch-Benennung:

| Präfix | Wofür |
|---|---|
| `fix/...` | Bug-Fixes |
| `feature/...` | neue Features |
| `refactor/...` | Refactorings |
| `docs/...` | Dokumentation |
| `chore/...` | Tooling / Aufräumen |

## 5. Den Bug fixen

Tipps zum Finden des Codes:

```bash
# Nach einem Fehlertext / Symbol suchen (ripgrep verwenden)
rg "die Fehlermeldung" frontend/src backend/app
```

- Frontend-Fehler: öffne die DevTools-Konsole des Browsers.
- `cd frontend && bunx vitest --watch <datei>` gibt dir live
  Test-Feedback beim Editieren (vitest immer aus `frontend/` starten,
  nicht aus dem Repo-Root).
- **Styling: ausschließlich Tailwind-Utility-Klassen**, keine
  inline Farb-Styles und keine neuen Regeln in `global.css`. Farben
  laufen über Design-Tokens (CSS-Variablen) - siehe
  [Theme-System](themes.md).
- **Beide Storage-Modi müssen funktionieren.** Ein Feature, das in
  API-Modus erscheint, aber keinen Dexie-Pfad hat (oder keine
  freundliche „im Browser-Modus nicht verfügbar"-Meldung), ist ein
  Release-Blocker.

## 6. Einen Regressionstest schreiben

Jeder Fix braucht mindestens einen Test, der vor der Änderung
fehlschlägt und danach grün ist.

```bash
# Frontend (Vitest) - aus frontend/ starten
cd frontend && bunx vitest run src/pfad/zu/datei.test.ts

# Backend (pytest)
cd backend && poetry run pytest tests/pfad/ -v

# Ein einzelnes Plugin
make test-plugin-gamification
```

Bei backup-relevanten Änderungen gibt es ein zusätzliches Gate: ein
echter Export-→-Import-Round-Trip in `make dev` mit echten Daten (der
`BACKUP-AKZEPTANZTEST`). Unit-Tests allein rechtfertigen niemals einen
Backup-Merge.

## 7. Das volle Gate lokal laufen lassen

```bash
make test            # Backend + Plugins + Frontend-Vitest
make check-types     # mypy + tsc --noEmit
make test-dexie-smoke  # GH-Pages-Build, jede Route, ohne Backend
cd frontend && bun run build
```

Alles muss grün sein, bevor du einen PR öffnest.

## 8. Commit + Push

[Conventional Commits](https://www.conventionalcommits.org/).
Referenziere das Issue mit einem Closing-Keyword, damit der Merge es
automatisch schließt.

```bash
git add -A
git commit -m "fix(bereich): kurze beschreibung

Ausführlichere Beschreibung, was das Problem war und wie es
gefixt wurde.

Closes #123"

git push -u origin fix/kurze-beschreibung
```

Halte Commits **atomar** - jeder Commit lässt den Baum grün
(`make test` läuft durch). Kombiniere eine Quelländerung mit ihrer
Teständerung im selben Commit, wenn ein Trennen einen roten
Zwischenzustand erzeugen würde.

## 9. Pull Request erstellen

```bash
gh pr create --base develop \
  --title "fix(bereich): kurze beschreibung" \
  --body "Closes #123

## Was geändert
- ...

## Tests
- ..."
```

Immer gegen **`develop`**, nie gegen `main` (`main` ist der
Release-Branch). Für ein Sub-Issue eines Umbrella/Epics zitierst du
das *Sub-Issue* mit `Closes #<sub-issue>`, plus `Refs #<umbrella>` zur
Nachverfolgbarkeit.

## 10. CI abwarten

Die CI prüft bei jedem PR die Korrektheits-Gates:

- Frontend-Tests (Vitest) + Backend-/Plugin-Tests (pytest)
- TypeScript (`tsc --noEmit`) + mypy + ruff + ESLint
- Pre-commit-Hooks
- Complexity-Gate (Baseline-Ratsche - neue Funktionen bleiben unter
  der zyklomatischen Komplexitätsschwelle)
- Folder-Size- + File-Size-Guards (God-File-/God-Folder-Vermeidung)
- i18n-Parität (jeder Katalog unter `backend/config/i18n/` muss
  jeden Key definieren)
- Design-Token-Guard (keine hartcodierten Farben / Fixed-Palette-Klassen)
- Docs-Drift-Verifier

Schwerere Checks (Dexie-Modus-E2E, Coverage, Mutation-Testing,
Security-Scan, Content-Stats-Drift) laufen nächtlich + beim Release,
nicht bei jedem PR. Ein grüner PR ist also kein Beweis, dass `develop`
grün ist.

Wenn ein Tor dich blockiert - besonders eine **Ratsche** (Komplexität,
Dateigröße, Ordnergröße, ...) - lies erst
[Tore, Ratchets und Zweigschutz](gates-and-ratchets.md), bevor du es
für falsch hältst. Dort steht, was jedes Tor ist, was zu tun ist, wenn
eine Ratsche blockiert, und wie du die Tore mit `make ci` lokal fährst,
bevor du pushst.

## 11. Review + Merge

Warte auf das Review (oder self-merge, wenn du Maintainer-Rechte
hast). PRs werden **squash-gemergt** nach `develop`, sodass die
Commits deines Branches zu einem sauberen Commit auf dem Trunk
zusammenfallen.

---

## Projekt-Regeln (Kurzfassung)

| Regel | Bedeutung |
|---|---|
| `GITHUB-ISSUE-PFLICHT` | jeder Fix/jedes Feature braucht zuerst ein Issue |
| Tailwind-only | keine `global.css`-Ergänzungen, keine inline Farb-Styles |
| Design-Tokens | Farben über CSS-Variablen, nie Hex-Literale |
| Dexie-Modus-Parität | alles funktioniert in Dexie *und* API-Modus |
| Library-First | native API > Framework > Library > eigener Code |
| Conventional Commits | `fix()`, `feat()`, `refactor()`, `docs()`, ... |
| i18n | alle UI-Texte in jedem `backend/config/i18n/`-Katalog |
| 44px Touch-Targets | mobil-freundliche interaktive Elemente |
| Ein Concern pro PR | jeder PR trägt genau eine zusammenhängende Änderung |
| Zweigschutz | `develop` braucht aktuellen Branch + grüne Checks (gilt auch für Admins) |

Vollständiges Regelwerk: [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).

## Häufige Befehle

```bash
make dev               # Backend + Frontend starten
make test              # alle Tests (Backend + Plugins + Vitest)
make test-dexie-smoke  # Dexie-Modus-Release-Gate (ohne Backend)
make check-types       # mypy + tsc --noEmit
make check-complexity-gate   # Complexity-Ratsche
make check-folder-size       # God-Folder-Guard
make sync-i18n         # Frontend-i18n aus Backend-YAML regenerieren
make sync-versions     # kanonische Version propagieren
cd frontend && bun run build   # Frontend bauen
```

`make help` listet jedes Target; das
[Makefile](https://github.com/astrapi69/adaptive-learner/blob/develop/Makefile)
ist die Quelle der Wahrheit für Build-Befehle.

## Architektur auf einen Blick

```
frontend/src/
  api/          FastAPI-Client (der einzige Ort mit fetch())
  components/   UI-Komponenten, nach Concern gruppiert (dashboard/, lesson/, ...)
  features/     Feature-Strategy-Gating (useFeatureAvailable)
  hooks/        React-Hooks
  lib/          Business-Logik, nach Domain gruppiert (lesson/, srs/, ai/, ...)
  pages/        Route-Komponenten (+ content/, dashboard/, lesson/ Unterordner)
  shared/       app-unabhängige wiederverwendbare Komponenten
  storage/      duales Storage: getStorage() -> IStorageService
  styles/       Design-Tokens + Themes pro CSS-Datei

backend/app/
  routers/      schlanke FastAPI-Endpunkte (delegieren an Services)
  services/     Business-Logik (keine FastAPI-Imports)
  repositories/ Datenschicht (Session-freie Kontrakte)
  models/       SQLAlchemy-Modelle (Single-File-Domänenmodell)
  hookspecs.py  die 10 Plugin-Hooks

plugins/        PluginForge-Plugins (je ein Paket; der Katalog
                steht in CLAUDE.md)
```

Details: [Architektur](architecture.md).

## Wo finde ich...?

| Was | Wo |
|---|---|
| Projekt-Regeln | [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules) |
| Architektur | [Architektur](architecture.md) |
| Tore, Ratchets, Zweigschutz | [Tore, Ratchets und Zweigschutz](gates-and-ratchets.md) |
| Storage-Layer | [Storage-Layer](storage-layer.md) |
| Plugin-System | [Plugin-Leitfaden](plugin-guide.md) |
| KI-Integration | [KI-Integration](ai-integration.md) |
| Testen | [Testen](testing.md) |
| Release-Prozess | [Release-Prozess](release.md) |
| Lektionsinhalt-Format | [Lektionsinhalte erstellen](authoring-content.md) |
| i18n | [i18n](i18n.md) |
| Deployment | [Deployment](deployment.md) |
| Roadmap | [`docs/ROADMAP.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/ROADMAP.md) |
