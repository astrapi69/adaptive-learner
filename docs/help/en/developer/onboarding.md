# Onboarding: your first bug-fix

A practical, step-by-step walkthrough for a new contributor. Unlike
the [Architecture](architecture.md) and [Setup](setup.md) pages
(which explain *what* the system is), this page walks you through
*doing* your first bug-fix end to end - from a fresh clone to a
merged pull request.

## 1. Set up the development environment

Prerequisites: **Python 3.11+** (3.12 recommended - plugins test
against 3.12), **Node 24+** (required by Vite 8), **Poetry**, **Bun**,
and **GNU Make**.

```bash
# Clone
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Install everything: Poetry backend + plugin path-deps + Bun frontend
make install

# Establish a green baseline before you change anything
make test

# Run the app (backend on :18001, frontend on :15174)
make dev
```

The frontend dev server runs at **http://localhost:15174**, the
backend at **http://localhost:18001**. Both ports are overridable via
`ADAPTIVE_LEARNER_FRONTEND_PORT` / `ADAPTIVE_LEARNER_PORT`. Press
Ctrl-C once to stop both.

If `make install` fails, the usual culprit is Poetry picking the wrong
Python - run `poetry env use python3.12` in `backend/` and re-install.
For the full configuration chain (secrets, AI keys, the mandatory
`ADAPTIVE_LEARNER_SECRET_KEY`) see [Setup](setup.md).

## 2. Find a bug

Issues are the work queue. Every fix needs an issue **first**
(`GITHUB-ISSUE-PFLICHT`).

```bash
# Open bug issues
gh issue list --label bug --state open
```

Or on GitHub:
<https://github.com/astrapi69/adaptive-learner/issues?q=is%3Aissue+is%3Aopen+label%3Abug>

Pick something small to start - look for `good first issue` or a
low-effort `bug`. If no issue exists for the bug you found, **create
one before you touch code** - and file a *separate* issue for any new
bug you discover along the way.

## 3. Understand the issue

- Read the description and reproduce the bug locally.
- Note which storage mode it occurs in. Adaptive Learner ships **dual
  storage** (API/SQLite *and* Dexie/IndexedDB); a bug may live in one
  mode, the other, or both. See [Storage layer](storage-layer.md).
- If you cannot reproduce it, ask in the issue rather than guessing.

## 4. Create a branch

Adaptive Learner uses **gitflow**: `develop` is the active branch;
`main` holds releases only. Branch *from* `develop` and open your PR
*against* `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b fix/short-description
```

Branch naming:

| Prefix | For |
|---|---|
| `fix/...` | bug fixes |
| `feature/...` | new features |
| `refactor/...` | refactors |
| `docs/...` | documentation |
| `chore/...` | tooling / housekeeping |

## 5. Fix the bug

Tips for finding the code:

```bash
# Search by an error string / symbol (use ripgrep)
rg "the error message" frontend/src backend/app
```

- Frontend errors: open the browser DevTools console.
- `cd frontend && bunx vitest --watch <file>` gives live test feedback
  while you edit (always run vitest from `frontend/`, not the repo
  root).
- **Styling: Tailwind utility classes only**, no inline color styles
  and no new rules in `global.css`. Colors go through design tokens
  (CSS variables) - see [Theme system](themes.md).
- **Both storage modes must keep working.** A feature that ships in
  API mode without a Dexie path (or a graceful "not available in
  browser mode" message) is a release blocker.

## 6. Write a regression test

Every fix needs at least one test that fails before the change and
passes after it.

```bash
# Frontend (Vitest) - run from frontend/
cd frontend && bunx vitest run src/path/to/file.test.ts

# Backend (pytest)
cd backend && poetry run pytest tests/path/ -v

# A single plugin
make test-plugin-gamification
```

For backup-touching changes there is an extra gate: a real
Export → Import round-trip in `make dev` with real data (the
`BACKUP-AKZEPTANZTEST`). Unit tests alone never justify a backup
merge.

## 7. Run the full gate locally

```bash
make test            # backend + plugins + frontend Vitest
make check-types     # mypy + tsc --noEmit
make test-dexie-smoke  # GH-Pages-shape build, every route, no backend
cd frontend && bun run build
```

Everything must be green before you open a PR.

## 8. Commit and push

[Conventional Commits](https://www.conventionalcommits.org/). Reference
the issue with a closing keyword so the merge auto-closes it.

```bash
git add -A
git commit -m "fix(area): short description

Longer description of what the problem was and how it was fixed.

Closes #123"

git push -u origin fix/short-description
```

Keep commits **atomic** - each commit leaves the tree green
(`make test` passes). Combine a source change with its test change in
the same commit when splitting them would create a red intermediate.

## 9. Open a pull request

```bash
gh pr create --base develop \
  --title "fix(area): short description" \
  --body "Closes #123

## What changed
- ...

## Tests
- ..."
```

Always target **`develop`**, never `main` (`main` is the release
branch). For a sub-issue of an umbrella/epic, cite the *sub-issue*
with `Closes #<sub-issue>`, plus `Refs #<umbrella>` for traceability.

## 10. Wait for CI

CI runs the correctness gates on every PR:

- Frontend tests (Vitest) + Backend / plugin tests (pytest)
- TypeScript (`tsc --noEmit`) + mypy + ruff + ESLint
- Pre-commit hooks
- Complexity gate (baseline ratchet - new functions must stay under
  the cyclomatic-complexity threshold)
- Folder-size + file-size guards (god-file / god-folder prevention)
- i18n parity (all 11 languages must define every key)
- Design-token guard (no hardcoded colors / fixed-palette utilities)
- Docs-drift verifier

Heavier checks (Dexie-mode E2E, coverage, mutation testing,
security scan, content-stats drift) run nightly + at release, not on
every PR.

## 11. Review and merge

Wait for review (or self-merge if you have maintainer rights). PRs are
**squash-merged** into `develop`, so your branch's commits collapse to
one clean commit on the trunk.

---

## Project rules (short version)

| Rule | Meaning |
|---|---|
| `GITHUB-ISSUE-PFLICHT` | every fix/feature needs an issue first |
| Tailwind-only | no `global.css` additions, no inline color styles |
| Design tokens | colors via CSS variables, never hex literals |
| Dexie-mode parity | everything works in Dexie *and* API mode |
| Library-first | native API > framework > library > custom code |
| Conventional Commits | `fix()`, `feat()`, `refactor()`, `docs()`, ... |
| i18n | all UI strings in all 11 languages |
| 44px touch targets | mobile-friendly interactive elements |

Full rule set: [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).

## Common commands

```bash
make dev               # start backend + frontend
make test              # all tests (backend + plugins + Vitest)
make test-dexie-smoke  # Dexie-mode release gate (no backend)
make check-types       # mypy + tsc --noEmit
make check-complexity-gate   # complexity ratchet
make check-folder-size       # god-folder guard
make sync-i18n         # regenerate frontend i18n from backend YAML
make sync-versions     # propagate the canonical version
cd frontend && bun run build   # build the frontend
```

`make help` lists every target; the
[Makefile](https://github.com/astrapi69/adaptive-learner/blob/develop/Makefile)
is the source of truth for build commands.

## Architecture in one screen

```
frontend/src/
  api/          FastAPI client (the only place fetch() lives)
  components/   UI components, grouped by concern (dashboard/, lesson/, ...)
  features/     feature-strategy gating (useFeatureAvailable)
  hooks/        React hooks
  lib/          business logic, grouped by domain (lesson/, srs/, ai/, ...)
  pages/        route components (+ content/, dashboard/, lesson/ subdirs)
  shared/       app-independent reusable components
  storage/      dual storage: getStorage() -> IStorageService
  styles/       design tokens + per-theme CSS

backend/app/
  routers/      thin FastAPI endpoints (delegate to services)
  services/     business logic (no FastAPI imports)
  repositories/ data layer (Session-free contracts)
  models/       SQLAlchemy models (single-file domain model)
  hookspecs.py  the 10 plugin hooks

plugins/        13 PluginForge plugins (one package each)
```

Details: [Architecture](architecture.md).

## Where do I find...?

| What | Where |
|---|---|
| Project rules | [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules) |
| Architecture | [Architecture](architecture.md) |
| Storage layer | [Storage layer](storage-layer.md) |
| Plugin system | [Plugin guide](plugin-guide.md) |
| AI integration | [AI integration](ai-integration.md) |
| Testing | [Testing](testing.md) |
| Release workflow | [Release workflow](release.md) |
| Lesson content format | [Authoring lesson content](authoring-content.md) |
| i18n | [i18n](i18n.md) |
| Deployment | [Deployment](deployment.md) |
| Roadmap | [`docs/ROADMAP.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/ROADMAP.md) |
