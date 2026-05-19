# Adaptive Learner

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow.svg)](LICENSE)

Ein adaptives Lernsystem nach dem forschungsbasierten
Sechs-Methoden-Modell (Asterios Raptis, *Von Theorie zur
Praxis*, Medium-Serie). Wähle die Methode, die zum Lernenden
passt — deduktiv, induktiv, fehlerbasiert, dialogisch,
kontextuell oder KI-adaptiv — gehe pro Session durch einen
Sieben-Schritt-Zyklus, und lass ein Dual-Prompt-KI entscheiden,
wann der Lernende für den nächsten Schritt bereit ist.

**Seit v0.6.0 als installierbare Progressive Web App verfügbar**
— füge sie auf jedem modernen Smartphone oder Desktop zum
Startbildschirm hinzu und starte wie eine native App, ohne
Browser-Tab.

**Online ausprobieren** (kein Backend nötig, Daten bleiben im
Browser): [astrapi69.github.io/adaptive-learner/](https://astrapi69.github.io/adaptive-learner/).
Bring deinen eigenen KI-Schlüssel mit; die öffentliche Seite
läuft im Local-First-Modus und speichert alles in IndexedDB.

[🇬🇧 English](README.md)

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

## Schnellstart

```bash
# Einmalig
make install              # Poetry + npm + Plugins

# Täglich
make dev                  # Backend (18001) + Frontend (15174)
make test                 # Backend + Plugins + Frontend
make test-coverage        # Opt-in-Coverage-Lauf

# Docker
make prod                 # docker compose up
make prod-down            # stoppen
```

E2E: `cd e2e && npx playwright test --project=smoke`.

## Dokumentation

- [`docs/CONCEPT.md`](docs/CONCEPT.md) — Kurzüberblick
- [`docs/adaptive-learner-project-reference.md`](docs/adaptive-learner-project-reference.md)
  — vollständiger Projektplan: Domänen-Modelle, Hooks,
  Plugins, API
- [`docs/configuration.md`](docs/configuration.md) —
  dreischichtige Konfig-Kette (Projekt-YAML < User-Overlay <
  Env)
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — was als Nächstes kommt
- [`CLAUDE.md`](CLAUDE.md) — Entwicklungsleitfaden für Claude
  Code (auch für Menschen brauchbar). Regeln in
  [`.claude/rules/`](.claude/rules/).
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Contributor-
  Onboarding, Testkonvention, Mobile-Viewport-Abdeckung.

## Status

Aktive Entwicklung. v0.7.0 wurde am 2026-05-19 veröffentlicht.
Test-Baseline: **1312 Tests** (447 Backend + 478 Plugins +
387 Frontend Vitest + 8 Playwright-Smoke-Specs). Jedes Release
erscheint mit annotierten Tags + GitHub-Releases am gleichen
Tag.

## Herkunft

Im Mai 2026 aus [Bibliogon](https://github.com/astrapi69/bibliogon)
v0.33.0 ausgegliedert. Die Plugin-Loader-Infrastruktur, die
Schichten-Architektur, die Test-Disziplin und der
Pythonic+React-Stack wurden 1:1 übernommen; die
Bibliogon-EXAMPLE-DOMAIN-Modelle (Book / Chapter / Article /
Author / ...) und deren Plugins wurden entfernt. Phasen 1-10
brachten das Projekt in den aktuellen Stand; siehe annotierte
Tags `v0.0.1` bis `v0.7.0` für die schrittweise Spur.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
