# Adaptive Learner

[![Version](https://img.shields.io/badge/version-v1.43.0-blue)](https://github.com/astrapi69/adaptive-learner/releases/latest)
[![Tests](https://img.shields.io/badge/tests-4570%20grün-brightgreen)](#tests)
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

### Lern-Kern

- **Sechs Lernmethoden** mit eigenen Prompts pro
  (Methode, Schritt) — eine 42-Zellen-Prompt-Matrix, abgestimmt
  auf den Punkt im Zyklus und darauf, wie die gewählte Methode
  zum Mitmachen einlädt.
- **Sieben-Schritt-Zyklus** in jeder Sitzung — Input, Fokus,
  Versuch, Feedback, Verfeinerung, Transfer, Integration. Der
  Dual-Prompt-Evaluator bewertet jeden Turn und entscheidet
  „voran", „wiederholen", „überspringen" oder „zurück".
- **Auto-Loop** über Schritt 7 hinaus — wenn das Thema
  integriert ist, wählt ein dritter KI-Call ein neues Unterthema
  und startet einen frischen Zyklus (auf 5 Zyklen pro Sitzung
  begrenzt zum Schutz vor Endlosschleifen).
- **Methodenwechsel** — Stagnationserkennung empfiehlt eine
  andere Methode, wenn die Bewertungen abflachen; Ein-Klick-
  Annahme im Sitzungs-Header.
- **Streaming-KI-Antworten** — Token-für-Token-Rendering via
  SSE; Inline-Cursor während die KI denkt; kein
  „Denke nach…"-Platzhalter.

### Drei KI-Anbieter

- **Anthropic Claude**, **OpenAI GPT**, **Google Gemini** —
  als separate Plugins ausgeliefert, alle über die Hooks
  `ai_complete` / `ai_complete_async` / `ai_complete_stream`
  geroutet.
- **Provider-Modellauswahl** — Live-Modellabfrage über den
  `/v1/models`-Endpunkt jedes Anbieters (1 h gecacht), mit
  Chat-Only-Filter und einer „Empfohlen / Alle"-Gruppierung in
  den Einstellungen.
- **Bring-your-own-Key** — drei Auflösungs-Schichten:
  - Umgebungsvariablen (CI / Docker).
  - `~/.config/adaptive_learner/secrets.yaml` (Desktop-Launcher;
    automatisch erzeugte Vorlage mit `chmod 0600` auf POSIX).
  - Einstellungs-UI (Fernet-verschlüsselt in SQLite).
  - Die UI zeigt pro Anbieter die Schlüssel-Quelle
    („Schlüssel aus: secrets.yaml" / „Umgebungsvariable" /
    „Einstellungen") und deaktiviert das Eingabefeld, wenn der
    Schlüssel extern verwaltet wird.

### Duale Speicherung

- **Server-Modus** (`ApiStorage`) — FastAPI-Backend, SQLite,
  pro Nutzer Fernet-verschlüsselte API-Schlüssel, Sync
  zwischen Geräten.
- **Local-First-Modus** (`DexieStorage`) — alles im Browser-
  IndexedDB, KI-Calls gehen direkt an die Anbieter. Kein
  Backend nötig; das öffentliche GH-Pages-Deployment nutzt
  diesen Modus.
- Ein `IStorageService`-Interface, 22 Namespaces; Umschaltung
  beim Start über die Einstellungen.

### Sync + Backup

- **Lokales-Netz-Sync** zwischen Geräten — bidirektionaler
  WLAN-Sync mit KI-Merge-Konfliktauflösung. QR-Code-
  Kamerascan zum Koppeln (mit Bild-Upload-Fallback für
  eingeschränkte Browser).
- **Backup / Restore** — JSON-Export + Import, automatische
  Rotation, Side-by-Side-Vergleichs-UI mit Feld-Diff.
  API-Schlüssel werden aus Exporten entfernt.

### Import + Analyse

- **Chat-Verlauf-Import** aus ChatGPT (JSON), Claude (JSON-
  Bulk-Export), Claude (Single-Conversation-Markdown-Export),
  Gemini und beliebigem Markdown.
- **KI-gesteuerte Analyse** extrahiert Thema, Schwächen,
  Fehlermuster, empfohlene Methode, Vokabular (für
  Sprachgespräche) und einen Lehrplan-Vorschlag.
- Ein Klick, um daraus ein **Curriculum zu erzeugen** und
  eine **gezielte Sitzung** zu starten.

### Exporte

- **Anki .apkg-Export** — KI-extrahierte Karteikarten
  (Basic + Cloze), auf der `/anki`-Seite geprüft und
  client-seitig via sql.js + JSZip verpackt.
- **NotebookLM-ZIP** — Zusammenfassung + Vokabular + Regeln +
  Fehler + Karteikarten + Sitzungen, formatiert für den
  NotebookLM-Source-Upload.
- **Markdown- + PDF-Fortschrittsberichte** — Progress,
  Sitzungsdetail, Curriculum-Übersicht. Identische
  Wire-Shape in beiden Speichermodi.

### Gamification

- **XP + Level** mit Exponentialkurve, Streak-Multiplikatoren
  pro abgeschlossener Sitzung, First-Method-Boni.
- **28 abgestufte Abzeichen** in 5 Kategorien (Einstieg, Konsistenz,
  Methoden-Entdecker, Tiefe, Polyglott), beim ersten Start
  aus YAML geseedet.
- **Streak-Heatmap** (GitHub-Stil, letzte 365 Tage) mit
  Wochenend-Modus-Toggle + Freeze-Vorrat (1 Freeze pro 7
  Streak-Tage, max. 3).

### Sprache (Web Speech API)

- **Text-to-Speech** auf KI-Antworten + Assessment-Ergebnissen.
- **Speech-to-Text** auf dem Sitzungs-Input (Zwischen-
  transkripte füllen das Textarea vor dem Absenden).
- **Aussprache-Übung** für Sprachprojekte (Zielsatz →
  sprechen → KI bewertet Ähnlichkeit).

### Mobile / PWA

- **Installierbar** auf Chrome / Edge / Safari — „Zum
  Startbildschirm hinzufügen"-Prompt, Standalone-Anzeige,
  kein Browser-Tab.
- **Offline** für vergangene Sitzungen + Dashboard +
  Fortschritt über den Service Worker (24 h LRU auf
  GET `/api/`); neue Sitzungen brauchen Netz für den KI-Call.
- **Swipe-Gesten** — Assessment-Links/Rechts-Navigation,
  Curriculum-Topic-Swipe-to-Reveal, Sitzungs-Zyklus-Peek;
  Reduced-Motion wird respektiert.
- **Mobil getestet** auf iPhone-SE-, iPhone-14-, Pixel-7- und
  iPad-Viewports.

### Rich-Text + i18n

- **TipTap-Rich-Text** in Sitzungsnotizen + Curriculum-
  Beschreibungen + Lektionen (Fett/Kursiv, Überschriften,
  Listen, Blockquotes, Code-Blöcke mit Lowlight-Syntax-
  Highlighting, Links, Zeichenzähler).
- **8 Sprachen voll übersetzt**: DE, EN, ES, FR, EL, PT,
  TR, JA — Single-Source-YAML-Kataloge in
  `backend/config/i18n/`, via `make sync-i18n` in das
  Frontend-Dexie-Bundle gespiegelt.

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
unter `http://localhost:7880`. Beim Erststart wird
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
`http://localhost:7880` (ein Port; nginx serviert das
statische Frontend und proxyt `/api/*` an FastAPI).

```bash
cd ~/adaptive-learner
./stop.sh   # docker compose down
./start.sh  # docker compose up -d
# Deinstallation: ./stop.sh && cd ~ && rm -rf adaptive-learner
```

### 4. Entwickler-Setup (Source-Build)

Manuelles Poetry-+-npm-Setup für Mitwirkende.
Voraussetzungen: Python 3.11+, Node ≥24, Poetry, npm, Make.

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install   # Poetry + npm + alle 10 Plugins als Path-Deps
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
| Tooling | Poetry, npm, Docker, Make, ruff, pre-commit |

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
make test              # Backend + Plugins + Vitest (4478 Tests)
make test-coverage     # Opt-In-Coverage (CI nachts)
make sync-versions     # Version über 18 Dateien propagieren
make sync-i18n         # Backend-YAML → Frontend-JSON-Bundles
make docs-serve        # MkDocs-Preview auf :8000 mit Hot-Reload
make prod / prod-down  # docker-compose-Stack
```

E2E-Smoke: `cd e2e && npx playwright test --project=smoke`
(16 Spec-Dateien bei v1.20.0).

## Tests

| Suite | Anzahl |
|---|---|
| Backend (pytest) | 786 |
| Plugins (10 × pytest) | 615 |
| Frontend (Vitest 4) | 1233 |
| **Gesamt** | **2634** |

Plus 16 Playwright-Smoke-Spec-Dateien, die abdecken: Landing,
Onboarding+Assessment, Sitzung (3-Chunk-SSE), Curriculum,
Einstellungen, Mobile-Viewports, Sync-Pairing, Backup-Roundtrip,
Multi-Cycle-Auto-Loop, Import + Analyse, MD-Export, Subjects/
Tags-Filter, Rich-Text-Notizen, Modellauswahl.

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

Aktive Entwicklung. **v1.20.0 wurde am 2026-05-22
veröffentlicht** mit dateibasierter Schlüsselkonfiguration
über `secrets.yaml`. 34 Entwicklungsphasen ausgeliefert; per-
Release-Notes in [`changelog/releases/`](changelog/releases/).

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
