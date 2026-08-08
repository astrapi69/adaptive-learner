# Development setup

## Prerequisites

- **Python 3.12** (the backend constraint is `~3.12`; individual
  plugin packages still declare `^3.11`).
- **Node 24+** (required by Vite 8). Older Node versions will
  fail at the build step with `crypto.hash is not a function`.
- **Poetry** for Python dependency management. Install:
  `curl -sSL https://install.python-poetry.org | python3 -`.
- **Bun** 1.3+ (the frontend package manager, #1492).
- **GNU Make** for the orchestration targets. The Makefile is
  the source of truth - every CI command is in there.

## Clone + install

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install
```

`make install` runs:

1. `cd backend && poetry install` - backend + plugin path-deps.
2. `cd frontend && bun install` - frontend dependencies (Node 24).
3. Installs every plugin in `plugins/` as a path-dep into the
   backend's venv (`develop = true` so edits are live).

If `make install` fails, the most common culprit is Poetry
picking the wrong Python. Run `poetry env use python3.12` in
`backend/` (and each plugin if you went deep) and re-install.

## Configuration

The backend reads its config from a three-layer chain
(highest priority wins):

1. **Environment variables** prefixed `ADAPTIVE_LEARNER_*`.
2. **User secrets** at `~/.config/adaptive_learner/secrets.yaml`
   - auto-generated as a commented template on first start
   (`chmod 0600` on POSIX); never committed to git.
3. **Defaults** in `backend/config/app.yaml`.

Plus per-provider AI key resolution layered on top:
**env > secrets.yaml > Fernet-encrypted DB column** (set via
the Settings UI), surfaced to the UI as the `key_source_*`
field on `UserSettingsOut`.

The one mandatory secret is `ADAPTIVE_LEARNER_SECRET_KEY` -
used to encrypt user API keys at rest with Fernet. Generate
one with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
Three places to put it (highest priority wins):
`ADAPTIVE_LEARNER_SECRET_KEY` env var, `secret_key:` in
`secrets.yaml`, or `make dev-secret` for a one-shot dev key.
The app fails hard at startup if the key is unset (no
silent-generated-default footgun - see
[docs/configuration.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)).

## Run

```bash
make dev
```

Spins up backend on port 18001 and frontend on port 15174, in
parallel. Backend has hot-reload via uvicorn's `--reload`;
frontend is Vite's dev server. Press Ctrl-C once to stop both.

Background mode:

```bash
make dev-bg   # start backend + frontend in the background
make dev-down # stop them
```

## Tests

```bash
make test                 # backend + plugins + frontend Vitest
make test-backend         # backend pytest only
make test-frontend        # frontend Vitest only
make test-coverage        # opt-in coverage run (slow)
```

E2E tests:

```bash
cd e2e && npx playwright test
```

17 smoke spec files: landing, onboarding +
assessment, session (3-chunk SSE), curriculum, settings,
mobile viewports, sync pairing, backup roundtrip,
multi-cycle auto-loop, import + analysis, MD export,
subjects/tags filter, rich-text notes, model picker.

## Linting + formatting

```bash
cd backend && poetry run ruff check .       # Python lint
cd backend && poetry run ruff format .      # Python format
cd frontend && bunx tsc --noEmit             # TypeScript check
cd frontend && bun run lint                 # ESLint
cd frontend && bun run format               # Prettier
```

Pre-commit hooks enforce ruff + formatter checks on every
commit:

```bash
cd backend && poetry run pre-commit install
```

## Docs

```bash
make docs-install   # one-time, installs MkDocs venv in docs/
make docs-serve     # serve docs on localhost:8000 with hot-reload
make docs-build     # build static site to site/
```

The docs venv is separate from backend's - MkDocs has its
own `docs/pyproject.toml` with mkdocs-material +
mkdocs-static-i18n.

## Common gotchas

- **`make dev` crashes with "port already in use"**: another
  AdaptiveLearner instance is still running. `make dev-down`
  or `pkill -f uvicorn`.
- **Tests fail with "duplicate column name"**: an Alembic
  migration changed the schema. Delete
  `backend/adaptive_learner.db` and re-run.
- **`bun run build` fails on Node 18**: bump to Node 24.
  Vite 8 requires it.
