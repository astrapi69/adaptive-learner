# Contributing to Adaptive Learner

Thank you for considering a contribution. Adaptive Learner is an
adaptive-learning platform built on the six-method learning model
and the PluginForge framework. It ships a working full-stack
foundation plus a set of plugins (the catalogue lives in
[CLAUDE.md](CLAUDE.md)); most non-trivial, format- or
workflow-specific features land as plugins, not core changes.

New here? The fastest path is the
**[Developer Onboarding guide](docs/help/en/developer/onboarding.md)**
- a step-by-step walkthrough of your first bug-fix (clone -> find a
bug -> branch -> fix -> test -> PR). When a CI gate or a ratchet
blocks you, read
**[Gates, ratchets, and branch protection](docs/help/en/developer/gates-and-ratchets.md)**
- it explains what each gate is and what to do. The sections below are
the reference details those guides build on.

## Project Layout

- `backend/` - FastAPI app, SQLAlchemy models, Alembic migrations
- `frontend/` - React + TypeScript + Vite, TipTap editor
- `plugins/` - the shipped PluginForge plugins, one Poetry package each
- `launcher/` - cross-platform launcher (PyInstaller)
- `docs/` - architecture overview, MkDocs site, in-app help
- `.claude/rules/` - the project rule set (also the source of truth
  for the norms; injected into every agent session)
- `e2e/` - Playwright smoke + full suites

## Getting Started

### Prerequisites

- Python 3.12 (the backend constraint is `~3.12`)
- Node.js 24 (Active LTS; required by the Vite 8 build). Bun is the
  frontend package manager
- Poetry (Python dependency management)
- Docker + Docker Compose v2+ (for the prod-shape integration flow;
  not required for `make dev`)

### Bootstrap

```bash
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner
make install      # Poetry backend + plugin path-deps + Bun frontend + e2e
make test         # baseline; should be green before you start
make dev          # backend on :18001, frontend on :15174
```

Ports are overridable via `ADAPTIVE_LEARNER_PORT` /
`ADAPTIVE_LEARNER_FRONTEND_PORT`. `make help` lists every target. The
[Makefile](Makefile) is the canonical source of truth for build
commands - this file references targets that exist there; do not
invent new ones in a PR without adding them to the Makefile in the
same change.

If `make install` fails, the usual culprit is Poetry picking the wrong
Python: run `poetry env use python3.12` in `backend/` and re-install.

### Running tests

```bash
make test                     # all tests (backend + plugins + frontend)
make test-backend             # backend only
make test-frontend            # Vitest only (runs from frontend/)
make test-plugin-{name}       # a single plugin (tools, session, ...)
make check-types              # mypy + tsc --noEmit
```

E2E (Playwright, separate from `make test`):

```bash
cd e2e && npx playwright test --project=smoke
```

`make test` must stay green after every change. Why red matters and
how the gates/ratchets work: see
[Gates, ratchets, and branch protection](docs/help/en/developer/gates-and-ratchets.md).

### Mobile viewport coverage

Adaptive Learner is a Progressive Web App. UI changes must be verified
against the mobile-first viewports the user actually lives in:

| Device | Width | Notes |
|---|---|---|
| Smallest target | 360px | Layout safety net; no horizontal scroll |
| iPhone SE | 375px | Compact iOS phones |
| iPhone 14 | 390px | Standard iOS |
| Pixel 7 | 412px | Standard Android |
| iPad | 768px | Tablet / split-screen; at the mobile breakpoint |

`e2e/smoke/mobile-viewports.spec.ts` pins no-horizontal-overflow +
hamburger visibility + the online indicator at those sizes. Run it
after any CSS / layout change:

```bash
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

Touch-target rule: every interactive element under the
`@media (max-width: 768px)` block must be at least 44x44px
(Apple/Google guideline). Inputs also need `font-size: 16px` to
suppress iOS-Safari focus-zoom.

### Feature screenshots

Every UI feature is documented visually. Screenshots are generated
with Playwright and tracked under `e2e/visual/features/`, doubling as
pixel-diff regression and a documentation gallery. On any UI change:

```bash
make capture-screenshots   # build dexie frontend + --update-snapshots
# review every new PNG under e2e/visual/features/, then commit it
git add e2e/visual/features/
make verify-screenshots    # pixel-compare against the committed baselines
```

Naming: kebab-case folder, `feature.png` (1280x720) desktop and
`feature.mobile.png` (375x812) mobile, default theme (`dark`), German,
realistic test data. Baselines are generated and reviewed on a
consistent machine (font anti-aliasing differs between machines), not
in CI. Never `--update-snapshots` to silence a diff that reveals a
real bug. This applies to every PR with UI changes; pure backend /
launcher / test / docs PRs are exempt. See
[`e2e/visual/features/README.md`](e2e/visual/features/README.md) and
[`docs/developer/testing.md`](docs/developer/testing.md).

## Plugin Development

Adaptive Learner plugins are standalone Poetry packages that register
through PluginForge (`^0.10.0`) entry points. Most format- or
workflow-specific features belong in a plugin, not in core.

### A real example: the `tools` plugin

The smallest self-contained functional plugin to copy is
[`plugins/adaptive-learner-plugin-tools/`](plugins/adaptive-learner-plugin-tools/).
Its actual layout:

```
plugins/adaptive-learner-plugin-tools/
  pyproject.toml                       # name, version, pluginforge dep, entry point
  adaptive_learner_tools/
    __init__.py
    plugin.py                          # ToolsPlugin(BasePlugin) + hook impls
    routes.py                          # FastAPI APIRouter
    catalogue.py                       # business logic (no FastAPI here)
    spaced_recommendations.py
  tests/
    test_plugin.py
    test_catalogue.py
    test_spaced_recommendations.py
```

Its real `plugin.py` shows exactly what `BasePlugin` needs today - a
name, a version, the `target_application` gate, the hook
implementations, and `get_routes`. There is no `license_tier` and no
`api_version`:

```python
from pluginforge import BasePlugin

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class ToolsPlugin(BasePlugin):
    name = "tools"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = "Static external-tool recommendations tailored to the learner's method-weight profile."
    author = "Asterios Raptis"

    @hookimpl
    def get_tool_recommendations(self, profile, lang):
        return rank_tools(profile, lang)

    def get_routes(self) -> list:
        from .routes import router

        return [router]
```

The entry point in `pyproject.toml` is what PluginForge discovers:

```toml
[tool.poetry.plugins."adaptive_learner.plugins"]
tools = "adaptive_learner_tools.plugin:ToolsPlugin"
```

### Scaffolding your own

1. Copy the directory; rename `adaptive-learner-plugin-tools` and the
   inner `adaptive_learner_tools` package to your plugin name
   (kebab-case dir, snake_case package).
2. Edit `pyproject.toml`: package name, description, and the
   `[tool.poetry.plugins."adaptive_learner.plugins"]` entry point.
3. Implement `plugin.py` extending `BasePlugin` with `name`,
   `version`, and `target_application = "adaptive_learner"` (a plugin
   without it is filtered out at discovery). Implement the hooks you
   need and override `get_routes()` if you expose an API.
4. Add a path-dep in `backend/pyproject.toml` mirroring the existing
   entries (mandatory - plugin discovery only sees installed packages).
5. Add the plugin slug to `backend/config/app.yaml.example` under
   `plugins.enabled`.
6. If your plugin has runtime settings, drop them at
   `backend/config/plugins/{slug}.yaml` - PluginForge reads them from
   the backend config dir, not from inside the plugin's own directory.
7. `cd backend && poetry lock && poetry install`, then
   `make test-plugin-{yourname}`.

A green run looks like this (captured from `tools`; `make
test-plugin-tools` is the wrapper, and runs the same tests once
`make install` has set the environment up):

```
$ cd backend && poetry run pytest ../plugins/adaptive-learner-plugin-tools/tests/ -q
..........................................................       [100%]
58 passed in 0.20s
```

The hook-spec catalogue, the frontend manifest slots, and the
ZIP-distribution layout are covered in more depth in the
[plugin guide](docs/help/en/developer/plugin-guide.md).

### Plugin licensing

There is none. Every plugin ships under MIT; there is no license key,
license store, or runtime gating. Do not reintroduce per-plugin
licensing without an architecture decision.

## Coding Standards

The project rules live in [`.claude/rules/`](.claude/rules/) and carry
the binding wording; the developer docs explain and reference them
rather than duplicating:

- [architecture.md](.claude/rules/architecture.md) - layered
  architecture, plugin structure, dual storage, UI strategy
- [coding-standards.md](.claude/rules/coding-standards.md) - naming,
  function design, Git, dependency policy
- [code-hygiene.md](.claude/rules/code-hygiene.md) - linting,
  pre-commit, error-handling architecture, API conventions
- [quality-checks.md](.claude/rules/quality-checks.md) - test pyramid,
  coverage targets, the gate-test contract, CI cadence
- [lessons-learned.md](.claude/rules/lessons-learned.md) (index to
  `lessons/`) - known pitfalls
- [ai-workflow/](.claude/rules/ai-workflow/) - the issue / PR /
  testplan obligations and the documentation protocol
- [release-workflow.md](.claude/rules/release-workflow.md) - the
  release process

Install the pre-commit hooks once with
`cd backend && poetry run pre-commit install`; they run automatically
on `git commit`.

### Internationalization

Adaptive Learner is multilingual; the catalogs live under
[`backend/config/i18n/`](backend/config/i18n/) (that directory listing
is the source of truth for which languages ship - do not hardcode a
count). Every user-facing change must add or update the key in every
catalog; the docs-drift verifier fails the build on a missing key.

German content (i18n catalogs, help docs, `README-de.md`) uses real
UTF-8 umlauts. ASCII transliterations like `fuer`, `ueber`,
`oeffentlich` are forbidden. `scripts/verify_i18n_scripts.py` is the
automated gate (run via `make verify-i18n-scripts` and the
`i18n-script-sanity` pre-commit hook); the docs-umlaut ratchet
(`make verify-docs-hygiene`) guards German prose in `docs/`.

## Commit Conventions

Adaptive Learner uses
[Conventional Commits](https://www.conventionalcommits.org/). Common
types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`. Provide a
scope when one is obvious: `feat(export): ...`, `fix(editor): ...`.

Atomic commits. Each commit must leave the tree green (`make test`
passes); intermediate commits with broken tests break bisect. Combine
source + test changes in the same commit when splitting them would
create a red intermediate state.

Do not add `Co-Authored-By` trailers attributing non-human
collaborators.

## Pull Requests

Every bug or change needs a GitHub issue first (`GITHUB-ISSUE-PFLICHT`),
and every pushed code change opens a PR against `develop`
(`PR-PFLICHT`), whether or not one was requested. One coherent concern
per PR.

1. Branch from `develop`: `git checkout -b fix/short-name` (or
   `feat/...`, `refactor/...`, `docs/...`, `chore/...`). `main` holds
   releases only - never target it.
2. Make changes; keep commits atomic; cite the issue with a closing
   keyword (`Closes #NN`).
3. Run `make test` and `make check-types` locally; the build-free
   gates run with `make ci`. All must be green.
4. Push and open a PR against `develop`. The PR template asks for
   type, testing evidence, doc updates, and plugin impact.
5. A change to user-visible behaviour also updates the manual test
   plan (`TESTPLAN-PFLICHT`) in the same PR.

`develop` has branch protection: an up-to-date branch and green
required checks are needed to merge, and this binds admins too. For
larger changes, open an issue first to discuss design.

## Code of Conduct

Adaptive Learner follows
[Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Reports go to
asterios.raptis@web.de.

## Security

For security vulnerabilities, do not open a public issue. Use GitHub
Private Vulnerability Reporting per [SECURITY.md](SECURITY.md).
