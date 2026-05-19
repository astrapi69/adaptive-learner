# Adaptive Learner

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow.svg)](LICENSE)
[![Doku](https://img.shields.io/badge/doku-online-blue)](https://astrapi69.github.io/adaptive-learner/docs/)

Ein adaptives Lernsystem nach dem forschungsbasierten
Sechs-Methoden-Modell (Asterios Raptis, *Von Theorie zur
Praxis*, Medium-Serie). Wähle die Methode, die zum Lernenden
passt — deduktiv, induktiv, fehlerbasiert, dialogisch,
kontextuell oder KI-adaptiv — gehe pro Session durch einen
Sieben-Schritt-Zyklus, und lass ein Dual-Prompt-KI entscheiden,
wann der Lernende für den nächsten Schritt bereit ist.

[🇬🇧 English](README.md)

## Dokumentation

Vollständige Dokumentation (DE + EN):
[**astrapi69.github.io/adaptive-learner/docs/**](https://astrapi69.github.io/adaptive-learner/docs/)

- [Benutzerhandbuch](https://astrapi69.github.io/adaptive-learner/docs/user-guide/getting-started/)
  — wie du die App nutzt
- [Die Lernmethode](https://astrapi69.github.io/adaptive-learner/docs/concept/philosophy/)
  — warum adaptives Lernen funktioniert
- [Entwickler-Doku](https://astrapi69.github.io/adaptive-learner/docs/developer/architecture/)
  — Architektur, Plugins, Beitragen
- [API-Referenz](https://astrapi69.github.io/adaptive-learner/docs/api/overview/)
  — alle Endpoints und Modelle

## Installation

Vier Wege, AdaptiveLearner zu starten — nach Aufwand sortiert.

### 1. Online ausprobieren (kein Install)

Die öffentliche PWA läuft im **Lokal-Modus** — alle Daten
bleiben in deinem Browser (IndexedDB), KI-Aufrufe gehen direkt
aus der Seite an Anthropic / OpenAI / Gemini mit deinem
eigenen API-Schlüssel. Kein Backend, keine Installation.

[**Zur Live-App →**](https://astrapi69.github.io/adaptive-learner/)

Auf Chrome / Edge / Safari erscheint beim ersten Besuch ein
"Zum Startbildschirm hinzufügen"-Banner — annehmen, und
AdaptiveLearner wird zu einer eigenständigen PWA auf deinem
Desktop oder Smartphone-Startbildschirm, kein Browser-Tab
nötig.

### 2. Desktop-App (nativer Launcher)

Vorgebaute Single-Binary-Executables, die das Backend
bootstrappen und die App im Standard-Browser öffnen. Kein
Docker, kein Terminal nötig.

Download aus dem
[**letzten GitHub-Release**](https://github.com/astrapi69/adaptive-learner/releases/latest):

| OS | Datei | Starten mit |
|---|---|---|
| Linux | `adaptive-learner-launcher` | `chmod +x adaptive-learner-launcher && ./adaptive-learner-launcher` |
| macOS | `adaptive-learner-launcher-macos.zip` | Entpacken, `adaptive-learner-launcher` doppelt anklicken (oder `./adaptive-learner-launcher` im Terminal) |
| Windows | `adaptive-learner-launcher.exe` | Doppelklick |

Jedes Release legt neben jedem Binary eine `.sha256`-Datei zur
Integritätsprüfung ab.

Der Launcher lädt beim ersten Start den passenden getaggten
Quellbaum, baut die Docker-Images und startet die App auf
`http://localhost:7880`. Den Launcher aus dem Quelltext zu
bauen, ist unter
[docs/developer/deployment](https://astrapi69.github.io/adaptive-learner/docs/developer/deployment/)
dokumentiert.

### 3. Docker (selbst gehostet)

Voraussetzung: Docker (Docker Desktop oder Docker Engine mit
Compose).

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/astrapi69/adaptive-learner/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/astrapi69/adaptive-learner/main/install.ps1 | iex
```

Beide Skripte:

1. Klonen oder holen das getaggte Release nach
   `~/adaptive-learner/`
   (`%USERPROFILE%\adaptive-learner` auf Windows).
2. Erzeugen einen `ADAPTIVE_LEARNER_SECRET_KEY`, falls noch
   keiner existiert (für die Fernet-Verschlüsselung der
   User-API-Keys im Ruhezustand).
3. Bauen die Docker-Images und starten den Stack.
4. Öffnen die App unter `http://localhost:7880` — ein Port,
   nginx liefert das statische Frontend und proxied
   `/api/*` ans FastAPI-Backend.

Stoppen / Starten / Deinstallieren:

```bash
cd ~/adaptive-learner
./stop.sh      # docker compose down
./start.sh     # docker compose up -d
# Deinstallieren:  ./stop.sh && cd ~ && rm -rf adaptive-learner
```

Port und andere Stellschrauben (CORS-Origins, Debug-Modus)
leben in der erzeugten `.env`. Volle Konfig-Kette unter
[docs/developer/deployment](https://astrapi69.github.io/adaptive-learner/docs/developer/deployment/).

### 4. Entwickler-Setup (Source-Build)

Manuelles Poetry + npm-Setup für Contributors.
Voraussetzungen: Python 3.12+, Node 24+, Poetry, npm, Make.

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install         # Poetry + npm + alle 7 Plugins als Path-Deps
make dev             # Backend auf :18001, Frontend auf :15174 (Vite-Dev-Server)
```

Vollständiger Setup-Walkthrough inkl. Pre-Commit-Hooks und
Docs-Venv unter
[docs/developer/setup](https://astrapi69.github.io/adaptive-learner/docs/developer/setup/).

## Was du bekommst

- **Sechs Lernmethoden** mit eigenen Prompts pro (Methode,
  Schritt). 42-Zellen-Prompt-Matrix, zugeschnitten darauf, wo
  der Lernende im Zyklus steht und wie die Methode ihn zur
  Auseinandersetzung einlädt.
- **Dual-Prompt-Zyklusübergänge (v0.5.0)** — jeder Chat-
  Austausch löst einen zweiten KI-Call aus, der die Bereitschaft
  bewertet und den nächsten Schritt vorschlägt (vorwärts,
  wiederholen, überspringen oder zurück, wenn Verwirrung
  sichtbar wird). Konfigurierbarer Konfidenz-Schwellenwert; bei
  Deaktivierung greift das deterministische +1.
- **Progressive Web App (v0.6.0)** — Manifest +
  Service-Worker. Vergangene Sessions und das Dashboard
  bleiben offline lesbar; neue Sessions brauchen Netz (der
  KI-Anbieter sitzt außerhalb des Browsers). Hamburger-Menü
  auf Mobile, 44×44-Touch-Targets, kein horizontaler Scroll
  zwischen 360-768px.
- **Local-First-Speicher (v0.7.0)** — umschaltbar in den
  Einstellungen. Im Dexie-Modus läuft die ganze App im
  Browser: IndexedDB speichert Benutzer, Projekte, Sessions,
  Nachrichten, Bewertungen und Fortschritts-Commits;
  KI-Aufrufe gehen direkt aus der Seite an Anthropic / OpenAI
  / Gemini. Kein Backend nötig; das öffentliche GH-Pages-
  Deployment nutzt diesen Modus.
- **Eigener KI-Schlüssel** — drei Anbieter mitgeliefert
  (Anthropic Claude, OpenAI GPT, Google Gemini). Modell-
  Override pro Anbieter in den Einstellungen. Schlüssel liegen
  verschlüsselt (Fernet) im Speicher; das Frontend sieht den
  Klartext nie.
- **Aussagekräftige Analytik** — durchschnittliche KI-Konfidenz
  pro Session, "wo bleiben Lernende hängen", Zeit pro
  Zyklusschritt. Auf der Progress-Seite als
  Insight-Karten angezeigt.
- **i18n bei 222/222 in 8 Sprachen** — DE / EN / ES / FR /
  EL vollständig nativ; PT / TR / JA als EN-Passthrough-
  Gerüst.

## Tech-Stack

| Schicht | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry, Alembic |
| Frontend | React 19, TypeScript 6 (strict), Vite 8, react-router-dom 7, react-toastify, Recharts 3, tree-model |
| PWA | vite-plugin-pwa, Workbox-Service-Worker, Manifest + maskable PNG-Icons |
| Plugins | pluginforge ^0.5.0 (PyPI), pluggy-Entry-Points unter `adaptive_learner.plugins` |
| KI-Anbieter | Anthropic SDK, OpenAI SDK, google.genai 2.x |
| Launcher | PyInstaller, plattformübergreifend (Linux + macOS + Windows) |
| Testing | pytest, Vitest, Playwright |
| Tooling | Poetry, npm, Docker, Make, ruff, pre-commit |

## Mitgelieferte Plugins

| Plugin | Routen | Zweck |
|---|---|---|
| assessment | /questions, /evaluate, /profile/{id} | 12-Fragen-Profil (7 Multi-, 5 Single-Select) → Sechs-Methoden-Gewichte |
| ai-anthropic | nur Hook | `ai_complete` für `claude-*`-Modelle |
| ai-openai | nur Hook | `ai_complete` für `gpt-*`-Modelle |
| ai-gemini | nur Hook | `ai_complete` für `gemini-*`-Modelle |
| session | /start, /{id}/message, /{id}/rate, /{id}/end, /switch | Per-(Methode, Schritt)-Prompts + Dual-Prompt-Zyklusübergänge |
| tracking | /progress/{id}, /commits/{id}, /spaced/{id} | Aggregate pro Projekt inkl. v0.5.0-Step-Evaluation-Insights |
| tools | /recommendations/{id} | Statischer externer Tool-Katalog, nach Methoden-Gewichten sortiert |

## Mobile / PWA

**Auf dem Smartphone installieren:**

1. Öffne die App in Chrome (Android) oder Safari (iOS).
2. Zum Startbildschirm hinzufügen — Chrome zeigt unseren
   "Zum Startbildschirm hinzufügen"-Banner automatisch; auf
   iOS über das Teilen-Menü.
3. Vom Startbildschirm starten — die App öffnet standalone,
   ohne Browser-Chrome.

**Offline-Verhalten:**

- Vergangene Sessions, das Dashboard und dein Lernprofil
  bleiben offline lesbar (Service-Worker cached GET `/api/`-
  Antworten 24 h mit 60-Eintrag-LRU).
- Eine neue Chat-Session braucht Netz — der KI-Anbieter sitzt
  außerhalb des Browsers. Die `/session`-Route erkennt Offline
  und zeigt eine klare Inline-Nachricht statt still zu
  scheitern.
- Ein Online/Offline-Indikator in der Navigation
  (`role="status"`, höfliche Live-Region) macht den
  Netzstatus jederzeit sichtbar.

**Responsives Design:**

- Mobile-tauglich unter 768px — Hamburger-Drawer, 44×44-
  Touch-Targets, kein horizontaler Scroll zwischen 360-768px
  auf jeder Route. iOS-Safari-Fokus-Zoom durch
  16px-Input-Schrift unterdrückt.
- Tablet (≥768px) und Desktop (≥1024px) behalten die
  ursprüngliche horizontale Top-Bar-Navigation.
- Getestet in Playwright bei iPhone SE (375), iPhone 14
  (390), Pixel 7 (412) und iPad (768) Viewports.

## Nützliche Make-Targets

```bash
make dev                  # Backend (18001) + Frontend (15174)
make test                 # Backend + Plugins + Frontend
make test-coverage        # Opt-in-Coverage-Lauf
make prod                 # docker compose up (voller Stack)
make prod-down            # Docker-Stack stoppen
make docs-serve           # MkDocs-Preview auf :8000 mit Hot-Reload
```

E2E: `cd e2e && npx playwright test --project=smoke`.

## Repo-interne Referenzen

- [`CLAUDE.md`](CLAUDE.md) — Entwicklungsleitfaden für Claude
  Code (auch für Menschen brauchbar). Regeln in
  [`.claude/rules/`](.claude/rules/).
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Contributor-
  Onboarding, Testkonvention, Mobile-Viewport-Abdeckung.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — was als Nächstes kommt.
- [`docs/adaptive-learner-project-reference.md`](docs/adaptive-learner-project-reference.md)
  — der Projektplan: Domänen-Modelle, Hooks, Plugins, API.

User-orientierte Texte liegen auf der
[**Docs-Site**](https://astrapi69.github.io/adaptive-learner/docs/) —
die Repo-internen Dateien oben sind für Contributors.

## Status

Aktive Entwicklung. v0.8.0 wurde am 2026-05-19 veröffentlicht.
Test-Baseline: **1312 Tests** (447 Backend + 478 Plugins +
387 Frontend Vitest + 8 Playwright-Smoke-Specs). Öffentliche
Doku unter
[astrapi69.github.io/adaptive-learner/docs/](https://astrapi69.github.io/adaptive-learner/docs/).
Jedes Release erscheint mit annotierten Tags +
GitHub-Releases am gleichen Tag.

## Herkunft

Im Mai 2026 aus [Bibliogon](https://github.com/astrapi69/bibliogon)
v0.33.0 ausgegliedert. Die Plugin-Loader-Infrastruktur, die
Schichten-Architektur, die Test-Disziplin und der
Pythonic+React-Stack wurden 1:1 übernommen; die
Bibliogon-EXAMPLE-DOMAIN-Modelle (Book / Chapter / Article /
Author / ...) und deren Plugins wurden entfernt. Phasen 1-11
brachten das Projekt in den aktuellen Stand; siehe annotierte
Tags `v0.0.1` bis `v0.8.0` für die schrittweise Spur.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
