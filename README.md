# Adaptive Learner

[![Version](https://img.shields.io/badge/version-v2.7.1-blue)](https://github.com/astrapi69/adaptive-learner/releases/latest)
[![Tests](https://img.shields.io/badge/tests-10293%20green-brightgreen)](#tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-blue)](https://astrapi69.github.io/adaptive-learner/docs/en/)

A complete adaptive-learning platform built on the six-method
learning model (Asterios Raptis, *From Theory to Practice: The Series*, Medium
series). Pick the method that fits the learner — deductive,
inductive, error-based, dialogic, contextual, or AI-adaptive —
walk through a seven-step cycle on every session, and let a
dual-prompt AI decide when the learner is ready to advance.
Auto-loop into a new cycle once the topic is integrated. Bring
your own AI key (Anthropic / OpenAI / Gemini), or configure
keys in `~/.config/adaptive_learner/secrets.yaml` for the
desktop launcher.

[🇩🇪 Deutsch](README-de.md)

## Documentation

Full documentation (German default at `/docs/`, English at
`/docs/en/`):
[**astrapi69.github.io/adaptive-learner/docs/en/**](https://astrapi69.github.io/adaptive-learner/docs/en/)

- [User Guide](https://astrapi69.github.io/adaptive-learner/docs/en/user-guide/getting-started/)
  — how to use the app
- [The Learning Method](https://astrapi69.github.io/adaptive-learner/docs/en/concept/philosophy/)
  — why adaptive learning works
- [Developer Guide](https://astrapi69.github.io/adaptive-learner/docs/en/developer/architecture/)
  — architecture, plugins, contributing
- [API Reference](https://astrapi69.github.io/adaptive-learner/docs/en/api/overview/)
  — all endpoints and models
- [Configuration](docs/configuration.md) — three-layer config
  chain (env > `secrets.yaml` > DB)

## What you get

The full, canonical feature list lives on the docs site:
**[Feature overview](https://astrapi69.github.io/adaptive-learner/docs/en/features/overview/)**
(one source, kept current with every release; this README only
summarizes). In short:

- **Learning core** - six learning methods, a seven-step session
  cycle with a dual-prompt evaluator, auto-loop, method switching.
- **AI tutor chat** - assistant-ui thread with streaming replies,
  voice input, read-aloud, imported-conversation continuation;
  bring your own key (Anthropic / OpenAI / Gemini).
- **Exercises** - six core types (matching, picture choice, free
  text, cloze, word tiles, multiple choice) plus five extension
  types (categorization, error correction, reading comprehension,
  graded quiz, audio dictation).
- **Lessons** - seven play modes (Practice / Exam / Timed / Reverse /
  Shuffle / Endless / train-errors), SRS review, adaptive lessons
  from your own errors, pause/resume.
- **Authoring** - the Create-Lesson wizard: editable exercises,
  book-text ingestion (paste or EPUB/DOCX/TXT/MD upload with chapter
  picker and batch generation), AI exercise generation with a
  quality gate.
- **Content** - downloadable lesson sets from federated GitHub
  content repos, community sharing via pull request, per-set deep
  links and QR codes.
- **Import + analysis** - chat-history import (ChatGPT / Claude /
  Gemini / markdown) with AI analysis into curricula, sessions, or
  offline lessons.
- **Gamification** - XP, tiered badges, streaks, daily missions,
  celebrations.
- **Exports + backup** - Anki, NotebookLM, learning repository,
  Markdown/PDF reports, `.alb` backups and encrypted `.alk` key
  export.
- **Platform** - installable offline PWA, dual storage (browser
  IndexedDB or self-hosted server), local-network sync, desktop
  launcher for Linux/macOS/Windows, eleven UI languages.
- **Accessibility** - WCAG-AA themes, keyboard-first navigation,
  screen-reader support, reduced motion, TTS.

### Bundled Content

<!-- CONTENT-STATS:START -->
**325 lessons · 28 sets · 2 domain(s)** (language, software) — bundled offline into the GitHub Pages build from [astrapi69/adaptive-learner-content](https://github.com/astrapi69/adaptive-learner-content).

| Set | Source | Target | Level | Lessons |
|-----|--------|--------|-------|--------:|
| अंग्रेज़ी A1 (हिंदी भाषियों के लिए) | hi | en | A1 | 10 |
| अंग्रेज़ी A2 (हिंदी भाषियों के लिए) | hi | en | A2 | 5 |
| French A1 (for English speakers) | en | fr | A1 | 15 |
| Spanish A1 (for English speakers) | en | es | A1 | 15 |
| Spanish A2 — Elementary | en | es | A2 | 15 |
| Spanish B1 — Intermediate | en | es | B1 | 15 |
| Spanish B2 (for English speakers) | en | es | B2 | 5 |
| German A1 (for English speakers) | en | de | A1 | 5 |
| German A2 (for English speakers) | en | de | A2 | 5 |
| French A2 — Elementary | en | fr | A2 | 15 |
| French B1 (for English speakers) | en | fr | B1 | 5 |
| Französisch A1 (für Deutschsprachige) | de | fr | A1 | 15 |
| Γαλλικά A1 (για ελληνόφωνους) | el | fr | A1 | 8 |
| Französisch A2 — Grundlagen | de | fr | A2 | 15 |
| Französisch B1 — Mittelstufe | de | fr | B1 | 15 |
| Spanisch A1 (für Deutschsprachige) | de | es | A1 | 15 |
| Spanisch A2 — Grundlagen | de | es | A2 | 15 |
| Spanisch B1 — Mittelstufe | de | es | B1 | 15 |
| Englisch A1 (für Deutschsprachige) | de | en | A1 | 15 |
| Englisch A2 — Grundlagen | de | en | A2 | 15 |
| Englisch B1 — Mittelstufe | de | en | B1 | 15 |
| Japanisch Schrift: Hiragana (Vorstufe) | de | ja | A0 | 10 |
| Japanisch A1 (für Deutschsprachige) | de | ja | A1 | 10 |
| Koreanisch A1 (für Deutschsprachige) | de | ko | A1 | 10 |
| Italienisch A1 (für Deutschsprachige) | de | it | A1 | 10 |
| Portugiesisch (Brasilianisch) A1 (für Deutschsprachige) | de | pt | A1 | 10 |
| Chinesisch A1 (für Deutschsprachige) | de | zh | A1 | 10 |
| Adaptive Learner — App-Tutorial | de | de | Einsteiger | 12 |
<!-- CONTENT-STATS:END -->

### Content repos

The content system is open: beyond the bundled library, anyone can host
their own **content repository** on GitHub, connect it in
**Settings > Data > Content repositories**, and have it browsed (and
optionally recommended) in the app. The official library and user repos
share the exact same format, so a validating repo is a first-class
content source.

Want to create your own lessons? See the
[Content-Repo Guide](docs/reference/CONTENT-REPO-GUIDE.md) — what a content repo
is, the directory layout, local validation, trust levels, and the
ready-made [starter kit](https://github.com/astrapi69/adaptive-learner-content-test).

## Install

Four ways to run Adaptive Learner, in order of friction.

### 1. Try online (zero install)

The public PWA runs in **Local mode** — all your data stays in
your browser (IndexedDB), AI calls fire direct from the page to
Anthropic / OpenAI / Gemini using your own API key. No backend,
no install.

[**Open the live app →**](https://astrapi69.github.io/adaptive-learner/)

On Chrome / Edge / Safari you'll see an "Add to home screen"
prompt the first time — accept and Adaptive Learner becomes a
standalone PWA you launch from your desktop or phone home
screen.

### 2. Desktop app (native launcher)

Pre-built single-binary executables that manage the backend for
you and open the app in your default browser. The launcher drives
Docker itself, so you still need Docker installed and running, but
no manual Docker or Compose commands. The per-platform start guide
(set the execute bit on Linux, get past Gatekeeper on macOS or
SmartScreen on Windows, verify the checksum) is at
[Start the desktop launcher](https://astrapi69.github.io/adaptive-learner/docs/en/install/launcher/).

Download from the
[**latest GitHub release**](https://github.com/astrapi69/adaptive-learner/releases/latest):

| OS | Asset | How to run |
|---|---|---|
| Linux | `adaptive-learner-launcher` | `chmod +x adaptive-learner-launcher && ./adaptive-learner-launcher` |
| macOS | `adaptive-learner-launcher-macos.zip` | Unzip, then double-click (or `./adaptive-learner-launcher` from Terminal) |
| Windows | `adaptive-learner-launcher.exe` | Double-click |

Each release also ships a `.sha256` next to each binary for
integrity verification. The launcher downloads the matching
tagged source tree on first run, builds the Docker images,
and starts the app on `http://localhost:8501`. On first start
it also creates `~/.config/adaptive-learner/secrets.yaml` as a
commented template — uncomment and fill in your provider API
keys to skip the Settings UI dance.

### 3. Docker (self-hosted)

Prerequisite: Docker (Docker Desktop or Docker Engine with
Compose).

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/astrapi69/adaptive-learner/main/install.sh | bash
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/astrapi69/adaptive-learner/main/install.ps1 | iex
```

Both scripts clone the tagged release into `~/adaptive-learner/`,
generate an `ADAPTIVE_LEARNER_SECRET_KEY` (Fernet at-rest
encryption), build the Docker images, and start the stack at
`http://localhost:8501` (single port, single container; FastAPI
serves the static frontend and `/api/*` itself).

```bash
cd ~/adaptive-learner
./stop.sh   # docker compose down
./start.sh  # docker compose up -d
# uninstall: ./stop.sh && cd ~ && rm -rf adaptive-learner
```

### 4. Developer setup (source build)

Manual Poetry + Bun setup for contributors. Prerequisites:
Python 3.11+, Node ≥24, Poetry, Bun 1.3+, Make.

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install   # Poetry + Bun + all 13 plugins as path-deps
make dev       # backend :18001 + frontend :15174 (Vite dev server)
```

### Testing on a real phone in your LAN

To check the app on a real iPhone/Android without deploying, use the
single-origin LAN mode. Your computer and phone must be on the **same
Wi-Fi**:

```bash
make dev-lan   # builds the frontend, then serves it + the API on one origin at 0.0.0.0:18001
```

It prints a URL like `http://<your-PC-LAN-IP>:18001` — open that in mobile
Safari/Chrome. The frontend and API share one origin (no CORS hop, no
second server), and the backend runs without `--reload` so app state
survives. This is a **dev build served over plain HTTP**, not the
installed PWA — for the PWA install flow, deploy or use the launcher.
Stop with Ctrl+C.

New contributors should start with the
[Developer Onboarding guide](https://astrapi69.github.io/adaptive-learner/docs/en/developer/onboarding/)
— a step-by-step walkthrough of your first bug-fix. The full setup
reference lives at
[docs/developer/setup](https://astrapi69.github.io/adaptive-learner/docs/en/developer/setup/).

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI ^0.136, SQLAlchemy ^2.0, Pydantic v2, Alembic, aiosqlite, cryptography (Fernet), platformdirs, Poetry |
| Frontend | React 19, TypeScript 6 (strict), Vite 8, react-router-dom 7, react-toastify, Recharts 3, TipTap 2 + 15 extensions, Dexie 4 (IndexedDB), html5-qrcode, sql.js + jszip |
| PWA | vite-plugin-pwa, Workbox SW, manifest + maskable PNG icons |
| Plugins | pluginforge ^0.10.0 (PyPI), identity-gated `target_application = "adaptive_learner"` |
| AI providers | Anthropic SDK, OpenAI SDK, google.genai 2.x |
| Launcher | PyInstaller, cross-OS (Linux + macOS + Windows) |
| Testing | pytest ^9, Vitest 4 (happy-dom), Playwright (E2E smoke) |
| Tooling | Poetry, Bun, Docker, Make, ruff, pre-commit |

## Plugins shipped

13 plugins, all under `plugins/`. Routes mounted at
`/api/plugins/<name>/*`.

| Plugin | Routes | Purpose |
|---|---|---|
| ai-anthropic | hook-only | `ai_complete*` for `claude-*` |
| ai-openai | hook-only | `ai_complete*` for `gpt-*` |
| ai-gemini | hook-only | `ai_complete*` for `gemini-*` |
| assessment | /questions, /evaluate, /profile/{id} | 12-question profile → six-method weights |
| session | /start, /{id}/message, /message/stream, /rate, /end, /switch, /pronunciation/* | 7-step cycles, dual-prompt eval, streaming, auto-loop, pronunciation judge |
| tracking | /progress/{id}, /commits/{id} | Per-project aggregates + step-evaluation insights |
| tools | /recommendations/{id}, /spaced/{id} | Method-tailored tool list + spaced practice |
| gamification | /xp/*, /badges/*, /streak/*, /reset | XP + 28 tiered badges + streak heatmap |
| anki | /cards CRUD, /extract/{session,conversation}, /mark-exported | AI-extracted flashcards + .apkg export |
| notebooklm | /questions CRUD, /generate/{session,project}, /study-guide/{id} | Active-recall questions + study guide + ZIP export |
| learning-repo | /render/{id}, /export-zip/{id}, /persist/{id} | Git-backed Learning Repository (Markdown artefacts + opt-in commit) |
| content-loader | /sets, /sets/{src}/{id}/download, /sets/{src}/{id}/lessons | Downloads structured lesson sets from public GitHub repos; caches locally |
| missions | /templates, /today/{user_id}, /regenerate/{user_id} | Daily adaptive missions evaluated against existing data |

## Useful make targets

```bash
make dev               # backend (18001) + frontend (15174)
make test              # backend + plugins + Vitest (9708 tests)
make test-coverage     # opt-in coverage (CI runs it nightly)
make sync-versions     # propagate version across 18 files
make sync-i18n         # backend YAML → frontend JSON bundles
make docs-serve        # MkDocs preview on :8000 with hot-reload
make prod / prod-down  # docker compose stack
```

E2E smoke: `cd e2e && npx playwright test --project=smoke`
(17 spec files).

## Tests

Verified 2026-07-24 (v2.6.0):

| Suite | Count |
|---|---|
| Backend (pytest) | 1475 |
| Plugins (13 × pytest) | 1096 |
| Frontend (Vitest 4) | 7722 |
| **Total** | **10293** |

Plus 17 Playwright smoke spec files covering: landing,
onboarding+assessment, session (3-chunk SSE), curriculum,
settings, mobile viewports, sync pairing, backup roundtrip,
multi-cycle auto-loop, import + analysis, MD export,
subjects/tags filter, rich-text notes, model picker — and a
separate Dexie-mode release gate (`make test-dexie-smoke`)
walking every nav-reachable route against the GH-Pages build.

## Local project references

- [`CLAUDE.md`](CLAUDE.md) — development guide for Claude Code
  (under 10K, single-line state pointer).
- [`docs/configuration.md`](docs/configuration.md) — the
  three-layer config chain.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phase history + next.
- [`docs/backlog.md`](docs/backlog.md) — daily-planning view
  (P0–P5 tiers + blocked items).
- [`docs/adaptive-learner-project-reference.md`](docs/adaptive-learner-project-reference.md)
  — original plan + shipped architecture.

User-facing prose lives on the [**docs site**](https://astrapi69.github.io/adaptive-learner/docs/);
the in-repo files above are for contributors.

## Status

Active development. The current release is **v2.7.1**, whose headline
is the **distribution switch**: the desktop launcher now **pulls a
published, per-architecture verified image from GHCR** instead of
building on the user's device (building from source stays for
self-builders), guarded by a **volume-migration stop** that never
chooses between two data sets silently. The app adds
**image-description exercises** (`ext:al-image-description`),
**single-lesson deletion**, and a **set-update guard** that stops
content updates from silently orphaning learning progress (dialog in
11 languages). Prior **v2.6.x** rebuilt the **session chat on
assistant-ui**, made Create-Lesson's book path a real ingestion tool
(**book-file upload** with chapter multi-select and batch generation),
completed dictation authoring with an **audio-file upload**, and
hardened CI. Prior **v2.5.0** turned **Create-Lesson into a full
exercise authoring tool**: every core exercise type is editable,
exercises can be added by hand, `multiple_choice` is authorable with
a single/multi mode control, and an **extension-authoring wizard**
covers all four AI-authored extension types, with
**`ext:al-dictation` (audio dictation)** joining as the fifth
extension type; the PWA update system and the AI key vault became
**consumed npm packages** (`@astrapi69/pwa-update`,
`@astrapi69/ai-key-vault`). Prior **v2.4.0** shipped a **Create-Lesson
authoring upgrade** (a knowledge lesson from pasted textbook text,
editing and combining your own lessons, and card image upload),
**free-text multiple accepted answers** with an AI second opinion, an
**AI key-import** shortcut on the settings AI tab, and the content
**engine re-pinned to 0.13.0 (schema 1.8)** so uploaded images feed
picture-choice exercises. Prior **v2.3.0** completed the **EXP-044 CSS concern-split** (`global.css`
decomposed byte-identically into per-concern legacy files behind a
byte-identity gate), reworked the **lesson-player UX** (collapsible
options panel, footer pause control, slimmer title area), added
**listen-first audio** exercises and an authored-difficulty
cold-start prior for adaptive lessons, and hardened lesson/set
**file import/export**. Prior **v2.2.0** added an
**extension-exercise tier** (four AI-authored exercise types) and a
native **multiple_choice** type, with the app consuming the lesson
schema and TypeScript types from **`learn-content-engine`** (additive
schema 1.5 -> 1.7), a **federated content-repository registry**, and
a simpler mobile navigation. Recent feature
work includes the **Content hub** redesign (Discover / My content /
Import tabs, a global list ⇄ grid view toggle, and a compact
search/filter bar), the full **lesson-mode system** (Practice / Exam /
Timed / Reverse / Shuffle / Endless + train-errors), **cloze
multiselect** "select all that apply", an exam-mode SRS interval
boost, **passphrase-encrypted `.alk`** export of AI keys, and a
single-primary-navigation cleanup (one nav per viewport: horizontal
top bar on desktop, bottom tab bar on mobile). Per-release notes in
[`changelog/releases/`](changelog/releases/).

## Origin

The plugin-loader infrastructure, layered architecture, test
discipline, and Python + React stack were extracted from
[Bibliogon](https://github.com/astrapi69/bibliogon) v0.33.0 in
March 2026. The Bibliogon book-domain models and plugins were
removed; adaptive-learner has diverged on domain (learning
sessions, curricula, assessment, AI integration) entirely. The
launcher shape carries over; the application is a separate
codebase.

## License

MIT — see [LICENSE](LICENSE).
