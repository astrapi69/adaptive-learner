# Adaptive Learner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-blue)](https://astrapi69.github.io/adaptive-learner/docs/en/)

An adaptive learning system built on a research-backed six-method
model (Asterios Raptis, *Von Theorie zur Praxis*, Medium series).
Pick the method that fits the learner — deductive, inductive,
error-based, dialogic, contextual, or AI-adaptive — walk through
a seven-step cycle on every session, and let a dual-prompt AI
decide when the learner is ready to advance.

[🇩🇪 Deutsch](README-de.md)

## Documentation

Full documentation (German default at `/docs/`, English at
`/docs/en/`):
[**astrapi69.github.io/adaptive-learner/docs/en/**](https://github.com/astrapi69/adaptive-learner/docs/en/)

- [User Guide](https://astrapi69.github.io/adaptive-learner/docs/en/user-guide/getting-started/)
  — how to use the app
- [The Learning Method](https://astrapi69.github.io/adaptive-learner/docs/en/concept/philosophy/)
  — why adaptive learning works
- [Developer Guide](https://astrapi69.github.io/adaptive-learner/docs/en/developer/architecture/)
  — architecture, plugins, contributing
- [API Reference](https://astrapi69.github.io/adaptive-learner/docs/en/api/overview/)
  — all endpoints and models

## Install

Four ways to run AdaptiveLearner, in order of friction.

### 1. Try online (zero install)

The public PWA runs in **Local mode** — all your data stays in
your browser (IndexedDB), AI calls fire direct from the page to
Anthropic / OpenAI / Gemini using your own API key. No backend,
no install.

[**Open the live app →**](https://astrapi69.github.io/adaptive-learner/)

On Chrome / Edge / Safari you'll see an "Add to home screen"
prompt the first time — accept and AdaptiveLearner becomes a
standalone PWA you launch from your desktop or phone home
screen, no browser tab required.

### 2. Desktop app (native launcher)

Pre-built single-binary executables that bootstrap the backend
and open the app in your default browser. No Docker, no
terminal needed.

Download from the
[**latest GitHub release**](https://github.com/astrapi69/adaptive-learner/releases/latest):

| OS | Asset | How to run |
|---|---|---|
| Linux | `adaptive-learner-launcher` | `chmod +x adaptive-learner-launcher && ./adaptive-learner-launcher` |
| macOS | `adaptive-learner-launcher-macos.zip` | Unzip, then double-click `adaptive-learner-launcher` (or `./adaptive-learner-launcher` from Terminal) |
| Windows | `adaptive-learner-launcher.exe` | Double-click |

Each release also ships a `.sha256` next to each binary for
integrity verification.

The launcher downloads the matching tagged source tree on first
run, builds the Docker images, and starts the app on
`http://localhost:7880`. Building the launcher from source is
documented in
[docs/developer/deployment](https://astrapi69.github.io/adaptive-learner/docs/en/developer/deployment/).

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

Both scripts:

1. Clone or fetch the tagged release into `~/adaptive-learner/`
   (`%USERPROFILE%\adaptive-learner` on Windows).
2. Generate an `ADAPTIVE_LEARNER_SECRET_KEY` if you don't have
   one yet (used to encrypt user API keys at rest with Fernet).
3. Build the Docker images and start the stack.
4. Open the app at `http://localhost:7880` — single port,
   nginx serves the static frontend and proxies `/api/*` to
   the FastAPI backend.

To stop / start / uninstall:

```bash
cd ~/adaptive-learner
./stop.sh      # docker compose down
./start.sh     # docker compose up -d
# uninstall:  ./stop.sh && cd ~ && rm -rf adaptive-learner
```

Port and other knobs (CORS origins, debug mode) live in the
generated `.env`. See
[docs/developer/deployment](https://astrapi69.github.io/adaptive-learner/docs/en/developer/deployment/)
for the full config-chain reference.

### 4. Developer setup (source build)

Manual Poetry + npm setup for contributors. Prerequisites:
Python 3.12+, Node 24+, Poetry, npm, Make.

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install         # Poetry + npm + all 7 plugins as path-deps
make dev             # backend on :18001, frontend on :15174 (Vite dev server)
```

Full setup walkthrough, including pre-commit hooks and the
docs venv, lives at
[docs/developer/setup](https://astrapi69.github.io/adaptive-learner/docs/en/developer/setup/).

## What you get

- **Six learning methods** with bespoke per-(method, step) AI
  prompts. 42-cell prompt matrix tailored to where the learner
  is in the cycle and how their method asks them to engage.
- **Dual-prompt cycle transitions (v0.5.0)** — every chat
  exchange fires a second AI call that judges readiness and
  decides the next step (advance, repeat, skip-ahead, or move
  back if confusion shows). Configurable confidence threshold;
  config-disable falls back to deterministic +1.
- **Progressive Web App (v0.6.0)** — installable manifest +
  service worker. Past sessions and the Dashboard stay readable
  offline; new sessions need network (the AI provider lives
  outside the browser). Hamburger nav on mobile, 44×44 touch
  targets, no horizontal scroll at 360-768px.
- **Local-first storage mode (v0.7.0)** — toggle in Settings.
  In Dexie mode the whole app runs in your browser: IndexedDB
  stores users, projects, sessions, messages, ratings, and
  progress commits; AI calls fire direct to Anthropic / OpenAI
  / Gemini from the page. No backend needed; the public GH
  Pages deploy uses this mode.
- **Bring-your-own AI key** — three providers shipped
  (Anthropic Claude, OpenAI GPT, Google Gemini). Per-provider
  model override in the Settings UI. Keys live encrypted at
  rest (Fernet); the frontend never sees the plaintext.
- **Analytics that mean something** — average AI confidence per
  session, "where do learners get stuck", time-per-cycle-step.
  Surfaced as the Progress page's insight cards.
- **i18n at 222/222 across 8 languages** — DE / EN / ES / FR /
  EL fully native; PT / TR / JA EN-passthrough scaffolding.

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2, Poetry, Alembic |
| Frontend | React 19, TypeScript 6 (strict), Vite 8, react-router-dom 7, react-toastify, Recharts 3, tree-model |
| PWA | vite-plugin-pwa, Workbox service worker, manifest + maskable PNG icons |
| Plugins | pluginforge ^0.7.0 (PyPI), pluggy entry points under group `adaptive_learner.plugins` |
| AI providers | Anthropic SDK, OpenAI SDK, google.genai 2.x |
| Launcher | PyInstaller, cross-OS (Linux + macOS + Windows) |
| Testing | pytest, Vitest, Playwright |
| Tooling | Poetry, npm, Docker, Make, ruff, pre-commit |

## Plugins shipped

| Plugin | Routes | Purpose |
|---|---|---|
| assessment | /questions, /evaluate, /profile/{id} | 12-question profile (7 multi-select, 5 single-select) → six-method weights |
| ai-anthropic | hook-only | `ai_complete` for `claude-*` models |
| ai-openai | hook-only | `ai_complete` for `gpt-*` models |
| ai-gemini | hook-only | `ai_complete` for `gemini-*` models |
| session | /start, /{id}/message, /{id}/rate, /{id}/end, /switch | Per-(method, step) prompts + dual-prompt cycle transitions |
| tracking | /progress/{id}, /commits/{id}, /spaced/{id} | Per-project aggregates incl. v0.5.0 step-evaluation insights |
| tools | /recommendations/{id} | Static external-tool catalogue ranked by method weights |

## Mobile / PWA

**Install on mobile:**

1. Open the app in Chrome (Android) or Safari (iOS).
2. Add to Home Screen — Chrome surfaces our "Add to home
   screen" prompt automatically; on iOS use the Share menu.
3. Launch from the home screen icon — the app opens
   standalone, no browser chrome.

**Offline behaviour:**

- Past sessions, the Dashboard, and your learning profile
  stay readable offline (service worker caches GET `/api/`
  responses for 24h with a 60-entry LRU).
- Starting a new chat session needs network — the AI
  provider lives outside the browser. The `/session` route
  detects offline and renders a clear inline message
  instead of failing silently.
- An online/offline indicator sits in the navigation
  (`role="status"`, polite live-region) so the network state
  is always visible.

**Responsive design:**

- Mobile-friendly under 768px — hamburger drawer, 44×44
  touch targets, no horizontal scroll at 360-768px on every
  route. iOS Safari focus-zoom suppressed via 16px input
  font-size.
- Tablet (≥768px) and desktop (≥1024px) keep the original
  horizontal top-bar nav.
- Tested in Playwright at iPhone SE (375), iPhone 14 (390),
  Pixel 7 (412), and iPad (768) viewports.

## Useful make targets

```bash
make dev                  # backend (18001) + frontend (15174)
make test                 # backend + plugins + frontend
make test-coverage        # opt-in coverage run
make prod                 # docker compose up (full stack)
make prod-down            # stop the docker stack
make docs-serve           # MkDocs preview on :8000 with hot-reload
```

E2E: `cd e2e && npx playwright test --project=smoke`.

## Local project references

- [`CLAUDE.md`](CLAUDE.md) — development guide for Claude Code
  (also useful for humans). Rules in
  [`.claude/rules/`](.claude/rules/).
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contributor onboarding,
  testing convention, mobile viewport coverage.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's next.
- [`docs/adaptive-learner-project-reference.md`](docs/adaptive-learner-project-reference.md)
  — the project plan: domain models, hooks, plugins, API.

User-facing prose lives on the
[**docs site**](https://astrapi69.github.io/adaptive-learner/docs/) —
the in-repo files above are for contributors.

## Status

Active development. v0.8.0 was released 2026-05-19. Test
baseline: **1312 tests** (447 backend + 478 plugins +
387 frontend Vitest + 8 Playwright smoke specs). Public
docs at
[astrapi69.github.io/adaptive-learner/docs/](https://astrapi69.github.io/adaptive-learner/docs/).
All releases ship with annotated tags + GitHub Releases on
the same date.

## Origin

Scaffolded from [Bibliogon](https://github.com/astrapi69/bibliogon)
v0.33.0 on 2026-05-17. The plugin-loader infrastructure,
layered architecture, test discipline, and Pythonic+React stack
were retained intact; the Bibliogon EXAMPLE-DOMAIN models
(Book / Chapter / Article / Author / ...) and their plugins were
removed. Phases 1-11 brought the project to its current shape;
see annotated tags `v0.0.1` through `v0.8.0` for the
incremental trail.

## License

MIT — see [LICENSE](LICENSE).
