# Contributing to Adaptive Learner

Thank you for considering a contribution. Adaptive Learner is a
project skeleton template built on PluginForge. The skeleton
ships with a working full-stack foundation; most non-trivial
features should land as plugins, not core changes.

## Project Layout

- `backend/` - FastAPI app, SQLAlchemy models, Alembic migrations
- `frontend/` - React + TypeScript + Vite, TipTap editor
- `plugins/` - empty placeholder + plugin loader (zero plugins ship)
- `launcher/` - Cross-platform launcher (PyInstaller)
- `docs/` - Architecture overview, MkDocs site, in-app help structure
- `.claude/rules/` - Project rules read on demand
- `e2e/` - Playwright smoke + full suites

## Getting Started

New here? Start with the **[Developer Onboarding guide](docs/help/en/developer/onboarding.md)**
— a practical, step-by-step walkthrough of your first bug-fix
(clone → find a bug → branch → fix → test → PR). The sections below
are the reference details it builds on.

### Prerequisites

- Python 3.11 or newer
- Node.js 24 (Active LTS; 20.19+ also works for tests but the
  full Vite 8 build requires 24)
- Poetry (Python dependency management)
- Docker + Docker Compose v2+ (for the prod-shape integration
  flow; not required for `make dev`)

### Bootstrap

```bash
git clone https://github.com/astrapi69/adaptive_learner.git
cd adaptive_learner
make install      # Poetry + npm + plugin path-deps
make test         # baseline; should be green before you start
make dev          # backend on :18001, frontend on :15174 (overridable via ADAPTIVE_LEARNER_PORT / ADAPTIVE_LEARNER_FRONTEND_PORT)
```

`make help` lists every available target. The
[Makefile](Makefile) is the canonical source of truth for build
commands - this file references targets that exist there; do
not invent new ones in PRs without adding them to the Makefile
in the same change.

### Running tests

```bash
make test                     # all tests (backend + plugins + frontend)
make test-backend             # backend only
make test-frontend            # Vitest only
make test-plugin-{name}       # single plugin (assessment, session, ...)
make check-types              # mypy + tsc --noEmit
```

E2E (Playwright):

```bash
cd e2e && npx playwright test --project=smoke
```

### Mobile viewport coverage (v0.6.0)

Adaptive Learner is a Progressive Web App. UI changes MUST be
verified against the following viewport sizes — the mobile-first
viewports are the user's daily experience, the iPad covers the
tablet / split-screen case:

| Device | Width | Notes |
|---|---|---|
| Smallest target | 360px | Layout safety net; no horizontal scroll |
| iPhone SE | 375px | Compact iOS phones |
| iPhone 14 | 390px | Standard iOS |
| Pixel 7 | 412px | Standard Android |
| iPad | 768px | Tablet / split-screen; at the mobile breakpoint |

The `e2e/smoke/mobile-viewports.spec.ts` Playwright spec pins
no-horizontal-overflow + hamburger visibility + online indicator
at iPhone SE / iPhone 14 / Pixel 7 / iPad. Run it after any
CSS / layout change:

```bash
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

Touch-target rule: every interactive element under the
`@media (max-width: 768px)` block must be ≥44x44px (Apple/Google
guideline). Inputs also need `font-size: 16px` to suppress
iOS-Safari focus-zoom.

Manual checks during smoke-test (handled per-release by the
person tagging):

- Chrome DevTools device emulation at all 4 sizes — confirm no
  horizontal scroll, hamburger works, Session input is reachable.
- Chrome "Install app" prompt — open in a real browser, confirm
  the prompt appears and the installed app launches standalone.
- Toggle DevTools "Offline" — verify the online indicator flips,
  `/session` shows the offline message, the `offline.html` page
  renders when refreshing a non-cached route.
- Lighthouse audit — target PWA score > 90, Performance > 80.

### Feature-Screenshots

Every UI feature is documented visually. Screenshots are generated with
Playwright and tracked under `e2e/visual/features/` — doubling as pixel-diff
regression and a documentation gallery.

On any UI change:

- Update the screenshot spec (a `FeatureShot` in the `FEATURES` map in
  `e2e/scripts/capture-feature-screenshots.ts` — a kebab-case
  `<feature>/<shot>` path + a `setup(page)` driving the dexie preview build
  into the state).
- `make capture-screenshots`
- Commit the PNGs: `git add e2e/visual/features/`

```bash
make capture-screenshots   # build dexie frontend + --update-snapshots
# review every new PNG under e2e/visual/features/, then commit it
make verify-screenshots    # pixel-compare against the committed baselines
```

Naming convention:

- Folder: kebab-case (e.g. `matching-animation/`)
- Desktop: `feature.png` (1280×720)
- Mobile: `feature.mobile.png` (375×812)
- Default theme (`dark`), German, realistic test data (no "Test-1" titles)

Baselines are generated + reviewed on a consistent machine (font anti-aliasing
differs between machines), not in CI. Never `--update-snapshots` to silence a
diff that reveals a real bug. Features Playwright can't reach (the desktop
launcher) are captured manually into the matching folder. This applies to every
PR with UI changes; pure backend / launcher / test / docs PRs are exempt. See
[`e2e/visual/features/README.md`](e2e/visual/features/README.md) and
[`docs/developer/testing.md`](docs/developer/testing.md).

## Plugin Development

Adaptive Learner plugins are standalone Poetry packages that register
through PluginForge ^0.5.0 entry points. New format-specific or
workflow-specific features generally belong in a plugin, not in
core.

### Quickstart

The smallest existing plugin to copy is
[`plugins/adaptive-learner-plugin-getstarted/`](plugins/adaptive-learner-plugin-getstarted/).
Mirror its shape:

```
plugins/adaptive-learner-plugin-yourname/
  pyproject.toml                # name, version, pluginforge dep, entry point
  adaptive_learner_yourname/
    __init__.py
    plugin.py                   # YourPlugin(BasePlugin)
    routes.py                   # FastAPI APIRouter (optional)
  tests/                        # pytest tests
  README.md
```

Steps:

1. Copy the directory; rename `adaptive-learner-plugin-getstarted` and
   `adaptive_learner_getstarted` to your plugin name.
2. Edit `pyproject.toml`: package name, description, the
   `[tool.poetry.plugins."adaptive_learner.plugins"]` entry point.
3. Implement `plugin.py` extending `BasePlugin` with `name`,
   `version`, `api_version = "1"`, `license_tier = "core"`.
   Override `activate()`, `get_routes()`,
   `get_frontend_manifest()` as needed.
4. Add a path-dep in `backend/pyproject.toml` mirroring the
   existing entries.
5. Add the plugin slug to `backend/config/app.yaml.example`
   under `plugins.enabled`.
6. If your plugin has runtime settings, drop them at
   `backend/config/plugins/{slug}.yaml` (PluginForge reads from
   there, not from inside the plugin's own dir).
7. `cd backend && poetry lock && poetry install`, then
   `make test-plugin-{yourname}`.

The plugin development guide at
[docs/help/en/developers/plugins.md](docs/help/en/developers/plugins.md)
covers the hook spec catalogue, frontend manifest slots, and
ZIP-distribution layout in more depth.

### Plugin licensing

All plugins currently ship under MIT with
`license_tier = "core"`. A licensing layer in
`backend/app/licensing.py` exists but is dormant
(`LICENSING_ENABLED = False`); no plugin is gated at runtime
today. If a future plugin adopts a paid tier, source remains
public and licensing affects only runtime activation.

## Coding Standards

Project rules live in [`.claude/rules/`](.claude/rules/) and are
read on demand:

- [architecture.md](.claude/rules/architecture.md) - layered
  architecture, plugin structure, UI strategy
- [coding-standards.md](.claude/rules/coding-standards.md) -
  naming, function design, dependency policy
- [code-hygiene.md](.claude/rules/code-hygiene.md) - linting,
  pre-commit, error-handling architecture, API conventions
- [quality-checks.md](.claude/rules/quality-checks.md) - test
  pyramid, coverage targets, mutation testing
- [lessons-learned.md](.claude/rules/lessons-learned.md) (index to `lessons/`) - known
  pitfalls (TipTap, import, export, Alembic logging)
- [ai-workflow/](.claude/rules/ai-workflow/) - session
  workflow, documentation protocol
- [release-workflow.md](.claude/rules/release-workflow.md) -
  release process

The pre-commit hooks (ruff, ruff-format, trailing-whitespace,
end-of-file, YAML/JSON validation) run automatically on
`git commit`. Install them once with
`cd backend && poetry run pre-commit install`.

### Internationalization

Adaptive Learner ships in 8 languages: DE, EN, ES, FR, EL, PT, TR, JA.
Every user-facing change must add or update keys in all 8
catalogs under `backend/config/i18n/{lang}.yaml`. Parity tests
fail the build if a key is missing in any language.

German content (i18n catalogs, help docs, README-de) uses real
UTF-8 umlauts. ASCII transliterations like `fuer`, `ueber`,
`oeffentlich` are forbidden. The
`scripts/find_umlaut_candidates.py` and
`scripts/replace_umlauts.py` tooling enforces this with a
whitelist.

## Commit Conventions

Adaptive Learner uses [Conventional Commits](https://www.conventionalcommits.org/).
There is no commit-msg-time tool enforcing this; the convention
is documentation-only and reinforced through code review.

Common types: `feat`, `fix`, `refactor`, `docs`, `test`,
`chore`. Provide a scope when one is obvious:
`feat(export): ...`, `fix(editor): ...`.

Atomic commits. Each commit must leave the tree green
(`make test` passes); intermediate commits with broken tests
break bisect. Combine source + test changes in the same commit
when splitting them would create a red intermediate state.

## Pull Requests

1. Fork the repository and clone your fork.
2. Branch: `git checkout -b feat/short-name` or
   `fix/short-name`.
3. Make changes; keep commits atomic.
4. Run `make test` and `make check-types` locally; both must be
   green.
5. Push and open a PR. The PR template asks for type, testing
   evidence, doc updates, and plugin impact.

For larger changes, open an issue first to discuss design. Use
the
[Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml)
template.

## Code of Conduct

Adaptive Learner follows
[Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Reports go to
asterios.raptis@web.de.

## Security

For security vulnerabilities, do not open a public issue. Use
GitHub Private Vulnerability Reporting per
[SECURITY.md](SECURITY.md).
