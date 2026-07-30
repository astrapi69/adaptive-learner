# Adaptive Learner

[![Version](https://img.shields.io/badge/version-v2.8.1-blue)](https://github.com/astrapi69/adaptive-learner/releases/latest)
[![Tests](https://img.shields.io/badge/tests-10293%20grün-brightgreen)](#tests)
[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow.svg)](LICENSE)
[![Doku](https://img.shields.io/badge/doku-online-blue)](https://astrapi69.github.io/adaptive-learner/docs/)

Eine vollständige adaptive Lernplattform auf Basis des
sechsmethodigen Lernmodells (Asterios Raptis, *Von Theorie zur
Praxis*, Medium-Serie). Wähle die Methode, die zum Lernenden
passt — deduktiv, induktiv, fehlerbasiert, dialogisch, kontextuell
oder KI-adaptiv — durchlaufe in jeder Sitzung einen Sieben-Schritt-
Zyklus, und lass eine Dual-Prompt-KI entscheiden, wann der
Lernende bereit für den nächsten Schritt ist. Auto-Loop in einen
neuen Zyklus, sobald das Thema integriert ist. Bring deinen
eigenen KI-Schlüssel mit (Anthropic / OpenAI / Gemini) oder
konfiguriere die Schlüssel in
`~/.config/adaptive_learner/secrets.yaml` für den Desktop-Launcher.

[🇬🇧 English](README.md)

## Dokumentation

Vollständige Dokumentation (Deutsch als Standard unter `/docs/`,
Englisch unter `/docs/en/`):
[**astrapi69.github.io/adaptive-learner/docs/**](https://astrapi69.github.io/adaptive-learner/docs/)

- [Benutzerhandbuch](https://astrapi69.github.io/adaptive-learner/docs/user-guide/getting-started/)
  — wie die App benutzt wird
- [Die Lernmethode](https://astrapi69.github.io/adaptive-learner/docs/concept/philosophy/)
  — warum adaptives Lernen funktioniert
- [Entwicklerhandbuch](https://astrapi69.github.io/adaptive-learner/docs/developer/architecture/)
  — Architektur, Plugins, Mitwirken
- [API-Referenz](https://astrapi69.github.io/adaptive-learner/docs/api/overview/)
  — alle Endpunkte und Modelle
- [Konfiguration](docs/configuration.md) — Drei-Schichten-Config-
  Kette (env > `secrets.yaml` > DB)

## Was du bekommst

Die vollständige, kanonische Feature-Liste lebt auf der Doku-Site:
**[Feature-Übersicht](https://astrapi69.github.io/adaptive-learner/docs/features/overview/)**
(eine Quelle, mit jedem Release aktuell gehalten; dieses README fasst
nur zusammen). In Kurzform:

- **Lern-Kern** - sechs Lernmethoden, ein Sieben-Schritt-Zyklus mit
  Dual-Prompt-Evaluator, Auto-Loop, Methodenwechsel.
- **KI-Tutor-Chat** - assistant-ui-Thread mit gestreamten Antworten,
  Spracheingabe, Vorlesen, Fortsetzung importierter Unterhaltungen;
  eigener Schlüssel (Anthropic / OpenAI / Gemini).
- **Übungen** - sechs Kern-Typen (Matching, Bildauswahl, Freitext,
  Lückentext, Wort-Kacheln, Multiple Choice) plus fünf
  Extension-Typen (Kategorisierung, Fehlerkorrektur, Leseverständnis,
  benoteter Quiz, Audio-Diktat).
- **Lektionen** - sieben Spielmodi (Üben / Prüfung / Auf Zeit /
  Reverse / Zufall / Endlos / Fehler trainieren), SRS-Wiederholung,
  adaptive Lektionen aus eigenen Fehlern, Pause/Fortsetzen.
- **Authoring** - der Create-Lesson-Wizard: bearbeitbare Übungen,
  Buchtext-Ingestion (Einfügen oder EPUB/DOCX/TXT/MD-Upload mit
  Kapitel-Auswahl und Batch-Generierung), KI-Übungsgenerierung mit
  Quality-Gate.
- **Content** - herunterladbare Lektions-Sets aus föderierten
  GitHub-Content-Repos, Community-Sharing per Pull Request,
  Deep-Links und QR-Codes pro Set.
- **Import + Analyse** - Chat-Verlauf-Import (ChatGPT / Claude /
  Gemini / Markdown) mit KI-Analyse zu Curricula, Sitzungen oder
  Offline-Lektionen.
- **Gamification** - XP, gestufte Badges, Streaks, tägliche
  Missionen, Celebrations.
- **Exporte + Backup** - Anki, NotebookLM, Learning Repository,
  Markdown-/PDF-Berichte, `.alb`-Backups und verschlüsselter
  `.alk`-Schlüssel-Export.
- **Plattform** - installierbare Offline-PWA, duale Speicherung
  (Browser-IndexedDB oder self-hosted Server), lokales Netzwerk-Sync,
  Desktop-Launcher für Linux/macOS/Windows, elf UI-Sprachen.
- **Barrierefreiheit** - WCAG-AA-Themes, Tastatur-Navigation,
  Screenreader-Unterstützung, reduzierte Bewegung, Vorlesen (TTS).

## Installation

Vier Wege, Adaptive Learner zu betreiben, in Reihenfolge
zunehmenden Aufwands.

### 1. Online ausprobieren (kein Install)

Die öffentliche PWA läuft im **Local-Modus** — alle Daten
bleiben in deinem Browser (IndexedDB), KI-Calls gehen direkt
von der Seite an Anthropic / OpenAI / Gemini mit deinem
eigenen API-Schlüssel. Kein Backend, keine Installation.

[**Live-App öffnen →**](https://astrapi69.github.io/adaptive-learner/)

Auf Chrome / Edge / Safari erscheint beim ersten Besuch
ein „Zum Startbildschirm hinzufügen"-Prompt — annehmen und
Adaptive Learner wird zu einer eigenständigen PWA, die du
vom Desktop oder Handy-Startbildschirm aus startest.

### 2. Desktop-App (nativer Launcher)

Vorgebaute Single-Binary-Executables, die das Backend
hochfahren und die App in deinem Standardbrowser öffnen.
Kein Docker, kein Terminal nötig.

Download vom
[**neuesten GitHub-Release**](https://github.com/astrapi69/adaptive-learner/releases/latest):

| OS | Asset | Ausführen |
|---|---|---|
| Linux | `adaptive-learner-launcher` | `chmod +x adaptive-learner-launcher && ./adaptive-learner-launcher` |
| macOS | `adaptive-learner-launcher-macos.zip` | Entpacken, dann Doppelklick (oder `./adaptive-learner-launcher` im Terminal) |
| Windows | `adaptive-learner-launcher.exe` | Doppelklick |

Jedes Release liefert auch eine `.sha256` neben jedem
Binary zur Integritätsprüfung. Der Launcher lädt beim
ersten Start den passenden getaggten Source-Tree
herunter, baut die Docker-Images und startet die App
unter `http://localhost:8501`. Beim Erststart wird
außerdem `~/.config/adaptive-learner/secrets.yaml` als
auskommentierte Vorlage angelegt — Zeilen einkommentieren
und mit den eigenen Provider-Keys füllen, um das
Einstellungs-UI zu überspringen.

### 3. Docker (self-hosted)

Voraussetzung: Docker (Docker Desktop oder Docker Engine
mit Compose).

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/astrapi69/adaptive-learner/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/astrapi69/adaptive-learner/main/install.ps1 | iex
```

Beide Skripte klonen das getaggte Release nach
`~/adaptive-learner/`, erzeugen einen
`ADAPTIVE_LEARNER_SECRET_KEY` (Fernet-Verschlüsselung at
rest), bauen die Docker-Images und starten den Stack unter
`http://localhost:8501` (ein Port, ein Container; FastAPI
liefert das statische Frontend und `/api/*` selbst).

```bash
cd ~/adaptive-learner
./stop.sh   # docker compose down
./start.sh  # docker compose up -d
# Deinstallation: ./stop.sh && cd ~ && rm -rf adaptive-learner
```

### 4. Entwickler-Setup (Source-Build)

Manuelles Poetry-+-Bun-Setup für Mitwirkende.
Voraussetzungen: Python 3.11+, Node ≥24, Poetry, Bun 1.3+, Make.

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install   # Poetry + Bun + alle 13 Plugins als Path-Deps
make dev       # Backend :18001 + Frontend :15174 (Vite-Dev-Server)
```

Vollständige Setup-Anleitung unter
[docs/developer/setup](https://astrapi69.github.io/adaptive-learner/docs/developer/setup/).

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Backend | Python 3.11+, FastAPI ^0.136, SQLAlchemy ^2.0, Pydantic v2, Alembic, aiosqlite, cryptography (Fernet), platformdirs, Poetry |
| Frontend | React 19, TypeScript 6 (strict), Vite 8, react-router-dom 7, react-toastify, Recharts 3, TipTap 2 + 15 Erweiterungen, Dexie 4 (IndexedDB), html5-qrcode, sql.js + jszip |
| PWA | vite-plugin-pwa, Workbox SW, Manifest + Maskable-PNG-Icons |
| Plugins | pluginforge ^0.10.0 (PyPI), identitätsgegated über `target_application = "adaptive_learner"` |
| KI-Anbieter | Anthropic SDK, OpenAI SDK, google.genai 2.x |
| Launcher | PyInstaller, cross-OS (Linux + macOS + Windows) |
| Testing | pytest ^9, Vitest 4 (happy-dom), Playwright (E2E-Smoke) |
| Tooling | Poetry, Bun, Docker, Make, ruff, pre-commit |

## Ausgelieferte Plugins

13 Plugins, alle unter `plugins/`. Routen werden unter
`/api/plugins/<name>/*` eingebunden.

| Plugin | Routen | Zweck |
|---|---|---|
| ai-anthropic | hook-only | `ai_complete*` für `claude-*` |
| ai-openai | hook-only | `ai_complete*` für `gpt-*` |
| ai-gemini | hook-only | `ai_complete*` für `gemini-*` |
| assessment | /questions, /evaluate, /profile/{id} | 12-Frage-Profil → Sechs-Methoden-Gewichte |
| session | /start, /{id}/message, /message/stream, /rate, /end, /switch, /pronunciation/* | 7-Schritt-Zyklen, Dual-Prompt-Eval, Streaming, Auto-Loop, Aussprache-Bewertung |
| tracking | /progress/{id}, /commits/{id} | Pro-Projekt-Aggregate + Schritt-Evaluations-Insights |
| tools | /recommendations/{id}, /spaced/{id} | Methoden-bezogene Tool-Liste + Spaced-Practice |
| gamification | /xp/*, /badges/*, /streak/*, /reset | XP + 28 abgestufte Abzeichen + Streak-Heatmap |
| anki | /cards CRUD, /extract/{session,conversation}, /mark-exported | KI-extrahierte Karteikarten + .apkg-Export |
| notebooklm | /questions CRUD, /generate/{session,project}, /study-guide/{id} | Aktive-Recall-Fragen + Studienführer + ZIP-Export |
| learning-repo | /render/{id}, /export-zip/{id}, /persist/{id} | Git-gestütztes Lern-Repository (Markdown-Artefakte + optionaler Commit) |
| content-loader | /sets, /sets/{src}/{id}/download, /sets/{src}/{id}/lessons | Lädt strukturierte Lektionssets aus öffentlichen GitHub-Repos; lokal gecacht |
| missions | /templates, /today/{user_id}, /regenerate/{user_id} | Tägliche adaptive Missionen, gegen vorhandene Daten ausgewertet |

## Nützliche Make-Targets

```bash
make dev               # Backend (18001) + Frontend (15174)
make test              # Backend + Plugins + Vitest (9708 Tests)
make test-coverage     # Opt-In-Coverage (CI nachts)
make sync-versions     # Version über 19 Dateien propagieren
make sync-i18n         # Backend-YAML → Frontend-JSON-Bundles
make docs-serve        # MkDocs-Preview auf :8000 mit Hot-Reload
make prod / prod-down  # docker-compose-Stack
```

E2E-Smoke: `cd e2e && npx playwright test --project=smoke`
(17 Spec-Dateien).

## Tests

Verifiziert am 2026-07-24 (v2.6.0):

| Suite | Anzahl |
|---|---|
| Backend (pytest) | 1475 |
| Plugins (13 × pytest) | 1096 |
| Frontend (Vitest 4) | 7722 |
| **Gesamt** | **10293** |

Plus 17 Playwright-Smoke-Spec-Dateien, die abdecken: Landing,
Onboarding+Assessment, Sitzung (3-Chunk-SSE), Curriculum,
Einstellungen, Mobile-Viewports, Sync-Pairing, Backup-Roundtrip,
Multi-Cycle-Auto-Loop, Import + Analyse, MD-Export, Subjects/
Tags-Filter, Rich-Text-Notizen, Modellauswahl — plus ein separates
Dexie-Modus-Release-Gate (`make test-dexie-smoke`), das jede
navigierbare Route gegen den GitHub-Pages-Build durchläuft.

## Lokale Projekt-Referenzen

- [`CLAUDE.md`](CLAUDE.md) — Entwicklungs-Leitfaden für
  Claude Code (unter 10K, Single-Line-State-Pointer).
- [`docs/configuration.md`](docs/configuration.md) —
  Drei-Schichten-Config-Kette.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Phasenhistorie + Nächstes.
- [`docs/backlog.md`](docs/backlog.md) — Daily-Planning-View
  (P0–P5-Tiers + Blocked-Items).
- [`docs/adaptive-learner-project-reference.md`](docs/adaptive-learner-project-reference.md)
  — Originalplan + ausgelieferte Architektur.

Benutzergerichtete Prosa lebt auf der
[**Doku-Site**](https://astrapi69.github.io/adaptive-learner/docs/);
die In-Repo-Dateien oben sind für Mitwirkende.

## Status

Aktive Entwicklung. Das aktuelle Release ist **v2.8.0**, dessen
Kernstück der **Vertriebswechsel** ist: Der Desktop-Launcher **bezieht
jetzt ein veröffentlichtes, je Architektur verifiziertes Image aus der
GHCR** statt auf dem Gerät zu bauen (Selbstbauen aus dem Quellbaum
bleibt erhalten), abgesichert durch einen **Volume-Migrations-Stopp**,
der nie still zwischen zwei Datenbeständen wählt. Die App ergänzt
**Bildbeschreibungs-Aufgaben** (`ext:al-image-description`), das
**Löschen einzelner Lektionen** und einen **Set-Update-Wächter**, der
verhindert, dass Content-Updates Lernfortschritt still verwaisen
lassen (Dialog in 11 Sprachen). Das vorige **v2.6.x** baute den
**Sitzungs-Chat auf assistant-ui** neu auf, machte den Buch-Pfad von
Create-Lesson zum echten Ingestion-Werkzeug (**Buchdatei-Upload** mit
Kapitel-Mehrfachauswahl und Batch-Generierung), komplettierte das
Diktat-Authoring mit **Audio-Upload** und härtete die CI. Das vorige
**v2.5.0** machte **Create-Lesson zu
einem vollwertigen Aufgaben-Editor**: jeder Kern-Aufgabentyp ist
bearbeitbar, Aufgaben lassen sich von Hand ergänzen,
`multiple_choice` ist mit einer Single/Multi-Umschaltung
autorierbar, und ein **Extension-Authoring-Assistent** deckt alle
vier KI-autorierten Extension-Typen ab; **`ext:al-dictation`
(Audio-Diktat)** kam als fünfter Extension-Typ hinzu, und das
PWA-Update-System sowie der KI-Schlüssel-Tresor werden als
**veröffentlichte npm-Pakete konsumiert** (`@astrapi69/pwa-update`,
`@astrapi69/ai-key-vault`). Das vorige **v2.4.0** brachte ein
**Create-Lesson-Authoring-Upgrade** (eine Wissens-Lektion aus
eingefügtem Lehrbuchtext, das Bearbeiten und Kombinieren eigener
Lektionen sowie Karten-Bild-Upload),
**Freitext-Aufgaben mit mehreren akzeptierten Antworten** samt einer
KI-Zweitmeinung, einen **KI-Schlüssel-Import** direkt auf dem
Einstellungen-KI-Tab und die auf **0.13.0 (Schema 1.8)** neu
gepinnte Content-Engine. Das vorige **v2.3.0** vollendete den
**EXP-044-CSS-Concern-Split** (`global.css` byte-identisch in
Per-Concern-Legacy-Dateien zerlegt, hinter einem
Byte-Identitäts-Gate), überarbeitete die **Lesson-Player-UX**
(einklappbares Options-Panel, Pause-Steuerung im Footer, schlankerer
Titelbereich), ergänzte **Listen-First-Audio** und einen
Cold-Start-Prior aus der vom Autor gesetzten Schwierigkeit und
härtete den Datei-Import/-Export von Lektionen/Sets. Per-Release-Notes
in [`changelog/releases/`](changelog/releases/).

## Herkunft

Die Plugin-Loader-Infrastruktur, geschichtete Architektur,
Test-Disziplin und der Python+React-Stack wurden im März
2026 aus [Bibliogon](https://github.com/astrapi69/bibliogon)
v0.33.0 extrahiert. Die Bibliogon-Buchdomänen-Modelle und
ihre Plugins wurden entfernt; Adaptive Learner ist auf der
Domänenebene (Lernsitzungen, Curricula, Assessment,
KI-Integration) komplett eigenständig. Die Launcher-Form
wurde übernommen; die Anwendung ist eine separate Codebasis.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
