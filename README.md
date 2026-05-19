# Adaptive Learner

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An adaptive learning system built on a research-backed six-method
model (Asterios Raptis, *Von Theorie zur Praxis*, Medium series).
Pick the method that fits the learner — deductive, inductive,
error-based, dialogic, contextual, or AI-adaptive — walk through
a seven-step cycle on every session, and let a dual-prompt AI
decide when the learner is ready to advance.

**Available as an installable Progressive Web App** since v0.6.0
— add it to your home screen on any modern phone or desktop and
launch like a native app, no browser tab required.

**Try it online** (no backend required, all data stays in your
browser): [astrapi69.github.io/adaptive-learner/](https://astrapi69.github.io/adaptive-learner/).
Bring your own AI API key; the public site runs in local-first
mode and stores everything in IndexedDB.

[🇩🇪 Deutsch](README-de.md)

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
| Plugins | pluginforge ^0.5.0 (PyPI), pluggy entry points under group `adaptive_learner.plugins` |
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

## Quickstart

```bash
# One-time
make install              # Poetry + npm + plugins

# Daily
make dev                  # backend (18001) + frontend (15174)
make test                 # backend + plugins + frontend
make test-coverage        # opt-in coverage run

# Docker
make prod                 # docker compose up
make prod-down            # stop
```

E2E: `cd e2e && npx playwright test --project=smoke`.

## Documentation

- [`docs/CONCEPT.md`](docs/CONCEPT.md) — short overview
- [`docs/adaptive-learner-project-reference.md`](docs/adaptive-learner-project-reference.md)
  — full project plan: domain models, hooks, plugins, API
- [`docs/configuration.md`](docs/configuration.md) —
  three-layer config chain (project YAML < user overlay < env)
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's next
- [`CLAUDE.md`](CLAUDE.md) — development guide for Claude Code
  (also useful for humans). Rules in
  [`.claude/rules/`](.claude/rules/).
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contributor onboarding,
  testing convention, mobile viewport coverage.

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
