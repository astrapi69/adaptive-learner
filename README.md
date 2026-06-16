# Adaptive Learner

[![Version](https://img.shields.io/badge/version-v1.83.0-blue)](https://github.com/astrapi69/adaptive-learner/releases/latest)
[![Tests](https://img.shields.io/badge/tests-6372%20green-brightgreen)](#tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-blue)](https://astrapi69.github.io/adaptive-learner/docs/en/)

A complete adaptive-learning platform built on the six-method
learning model (Asterios Raptis, *Von Theorie zur Praxis*, Medium
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

### Learning core

- **Six learning methods** with bespoke per-(method, step) AI
  prompts — a 42-cell prompt matrix tailored to where the
  learner is in the cycle and how the chosen method asks them to
  engage.
- **Seven-step cycle** on every session — input, focus, attempt,
  feedback, refine, transfer, integrate. The dual-prompt
  evaluator judges each turn and decides advance, repeat,
  skip-ahead, or step back.
- **Auto-loop** beyond step 7 — when the topic is integrated,
  a third AI call picks a new subtopic and starts a fresh
  cycle (capped at 5 cycles per session for runaway protection).
- **Method switching** — stagnation detection recommends a
  different method when ratings flatline; one-click accept in
  the Session header.
- **Streaming AI replies** — token-by-token rendering via SSE;
  inline cursor while the assistant thinks; no "Thinking..."
  placeholder.

### Three AI providers

- **Anthropic Claude**, **OpenAI GPT**, **Google Gemini** —
  shipped as separate plugins, all routed through the
  `ai_complete` / `ai_complete_async` / `ai_complete_stream`
  hooks.
- **Provider model picker** — live model discovery via each
  provider's `/v1/models` endpoint (cached 1h), with chat-only
  filtering and a Recommended / All grouping in Settings.
- **Bring-your-own key** — three resolution layers:
  - Environment variables (CI / Docker).
  - `~/.config/adaptive_learner/secrets.yaml` (desktop
    launcher; auto-generated template with `chmod 0600` on
    POSIX).
  - Settings UI (Fernet-encrypted in SQLite).
  - The UI shows the per-provider source ("Key from:
    secrets.yaml" / "environment" / "Settings") and disables
    the input when externally managed.

### Dual storage

- **Server mode** (`ApiStorage`) — FastAPI backend, SQLite,
  per-user Fernet-encrypted API keys, sync between devices.
- **Local-first mode** (`DexieStorage`) — everything in browser
  IndexedDB, AI calls fire direct to the providers. No backend
  needed; the public GH Pages deploy uses this mode.
- One `IStorageService` interface, 22 namespaces; switch at
  startup via Settings.

### Sync + backup

- **Local-network sync** between devices — bidirectional WiFi
  sync with AI-merge conflict resolution. QR-code camera scan
  for pairing (with image-upload fallback for restricted
  browsers).
- **Backup / restore** — JSON export + import, automatic
  rotation, side-by-side compare UI with field-level diffs.
  API keys stripped from exports.

### Import + analysis

- **Chat-history import** from ChatGPT (JSON), Claude (JSON
  bulk export), Claude (single-conversation Markdown export),
  Gemini, and arbitrary markdown.
- **AI-driven analysis** extracts topic, weaknesses, error
  patterns, recommended method, vocabulary (for language
  conversations), and a suggested curriculum.
- One click to **seed a curriculum** + **start a targeted
  session** from the analysis.

### Exports

- **Anki .apkg export** — AI-extracted flashcards (Basic +
  Cloze), reviewed in the `/anki` page, packaged client-side
  via sql.js + JSZip.
- **NotebookLM ZIP** — summary + vocabulary + rules + errors
  + flashcards + sessions packaged for NotebookLM's source
  upload.
- **Markdown + PDF** progress reports — Progress, Session
  Detail, Curriculum Overview, identical wire shape across
  storage modes.

### Content Browser + interactive lessons

- **Downloadable lesson sets** from public GitHub content repos,
  cached locally (filesystem in server mode, IndexedDB in local
  mode); a source/trust badge per set; connect your own repos,
  plus a recommended-repos discovery section.
- **Five exercise types** — Matching, Picture-Choice, Free-Text,
  Cloze (fill-in-the-blank), Word-Tiles — with token-level diff
  feedback. **Matching is bidirectional** (start a pair from
  either column, not only A → B).
- **Auto-splitting** of oversized imported lessons into parts,
  with localized part titles ("… - Teil 2" / "… - Part 2").
- **Adaptive lessons** (rule-based, client-side) synthesised from
  your per-element error history + **SRS review** queue
  (1d/3d/7d), with 0-3 star ratings and an error-replay round.
- **Lesson Creator** — a standalone, no-API-key wizard to build
  and share a complete lesson (card editor + auto-generated
  exercises + CSV import).
- **Book companion** — an author-provided content repo can
  declare a `book` block; the Content Browser renders a discreet
  card (cover / author / edition) linking to the published book.
- **Your lessons in the tree** — user-generated lessons fold into
  the matching published tree node with a "Your lesson" / "Your
  edit" badge and a "(+N own)" count, indexed in search.

### Accessibility

- **WCAG 2.1 AA** across all 12 theme variants (computationally
  pinned contrast); skip-to-content link that moves keyboard
  focus to main; focus management + focus traps on modal dialogs;
  colour-blind-safe exercise feedback (never colour alone).

### Gamification

- **XP + levels** with an exponential curve, streak multipliers
  on session completion, first-method bonuses.
- **Visible XP** — a persistent XP/level badge in the nav header
  (live on route change / focus / XP-affecting celebrations) plus
  a "+N XP" reward pill on the lesson-summary screen, so progress
  is shown where the learner sees it.
- **28 tiered badges** across 5 categories (getting started,
  consistency, method explorer, depth, polyglot) with
  bronze/silver/gold tiers + a badge gallery, seeded from YAML.
- **Daily missions** — up to 3 deterministic, adaptive goals per
  day on the Dashboard, evaluated against existing data.
- **Streak heatmap** (GitHub-style, last 365 days) with
  weekend-mode toggle + freeze stockpile (1 freeze per 7
  streak days, max 3).

### Voice (Web Speech API)

- **Text-to-speech** on AI replies + Assessment results.
- **Speech-to-text** on the Session input (interim transcripts
  populate the textarea before send).
- **Pronunciation practice** for language projects (target
  phrase → speak → AI judges similarity).

### Mobile / PWA

- **Installable** on Chrome / Edge / Safari — "Add to home
  screen" prompt, standalone display, no browser tab.
- **Offline** for past sessions + Dashboard + Progress via the
  service worker (24h LRU on GET `/api/`); new sessions need
  network for the AI call.
- **Swipe gestures** — Assessment left/right navigation,
  Curriculum topic swipe-to-reveal, session cycle peek;
  reduced-motion respected.
- **Mobile-tested** at iPhone SE / iPhone 14 / Pixel 7 / iPad
  viewports.

### Rich text + i18n

- **TipTap rich text** in session notes + curriculum
  descriptions + lessons (bold/italic, headings, lists,
  blockquotes, code blocks with lowlight syntax highlight,
  links, character count).
- **8 languages fully translated**: DE, EN, ES, FR, EL, PT,
  TR, JA — single-source YAML catalogs in
  `backend/config/i18n/` mirrored to the frontend Dexie
  bundle via `make sync-i18n`.

### Bundled Content

<!-- CONTENT-STATS:START -->
**334 lessons · 17 sets · 3 domain(s)** (language, programming, psychology) — bundled offline into the GitHub Pages build from [astrapi69/adaptive-learner-content](https://github.com/astrapi69/adaptive-learner-content).

| Set | Source | Target | Level | Lessons |
|-----|--------|--------|-------|--------:|
| अंग्रेज़ी A1 (हिंदी भाषियों के लिए) | hi | en | A1 | 3 |
| French A1 (for English speakers) | en | fr | A1 | 15 |
| Spanish A1 (for English speakers) | en | es | A1 | 15 |
| Spanish A2 — Elementary | en | es | A2 | 15 |
| Spanish B1 — Intermediate | en | es | B1 | 15 |
| French A2 — Elementary | en | fr | A2 | 15 |
| Französisch A1 (für Deutschsprachige) | de | fr | A1 | 15 |
| Französisch A2 — Grundlagen | de | fr | A2 | 15 |
| Französisch B1 — Mittelstufe | de | fr | B1 | 15 |
| Spanisch A1 (für Deutschsprachige) | de | es | A1 | 15 |
| Spanisch A2 — Grundlagen | de | es | A2 | 15 |
| Spanisch B1 — Mittelstufe | de | es | B1 | 15 |
| Englisch A1 (für Deutschsprachige) | de | en | A1 | 15 |
| Englisch A2 — Grundlagen | de | en | A2 | 15 |
| Englisch B1 — Mittelstufe | de | en | B1 | 15 |
| Psychologie — Grundlagen | de | de | A1 | 106 |
| Python — Grundlagen | de | de | A1 | 15 |
<!-- CONTENT-STATS:END -->

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

Pre-built single-binary executables that bootstrap the backend
and open the app in your default browser. No Docker, no
terminal needed.

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
and starts the app on `http://localhost:7880`. On first start
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
`http://localhost:7880` (single port; nginx serves the static
frontend and proxies `/api/*` to FastAPI).

```bash
cd ~/adaptive-learner
./stop.sh   # docker compose down
./start.sh  # docker compose up -d
# uninstall: ./stop.sh && cd ~ && rm -rf adaptive-learner
```

### 4. Developer setup (source build)

Manual Poetry + npm setup for contributors. Prerequisites:
Python 3.11+, Node ≥24, Poetry, npm, Make.

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install   # Poetry + npm + all 13 plugins as path-deps
make dev       # backend :18001 + frontend :15174 (Vite dev server)
```

Full setup walkthrough lives at
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
| Tooling | Poetry, npm, Docker, Make, ruff, pre-commit |

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
make test              # backend + plugins + Vitest (6372 tests)
make test-coverage     # opt-in coverage (CI runs it nightly)
make sync-versions     # propagate version across 18 files
make sync-i18n         # backend YAML → frontend JSON bundles
make docs-serve        # MkDocs preview on :8000 with hot-reload
make prod / prod-down  # docker compose stack
```

E2E smoke: `cd e2e && npx playwright test --project=smoke`
(17 spec files).

## Tests

Verified 2026-06-15 (v1.79.0):

| Suite | Count |
|---|---|
| Backend (pytest) | 1215 |
| Plugins (13 × pytest) | 1018 |
| Frontend (Vitest 4) | 4139 |
| **Total** | **6372** |

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

Active development. **v1.79.0 was released 2026-06-14** with
visible XP, bidirectional matching, and a completed
architecture thread (god-file decomposition, R-M-W
data-integrity remediation, and complexity burn-down all done;
both ratchet baselines empty). Per-release notes in
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
