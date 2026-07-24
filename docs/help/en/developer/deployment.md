# Deployment

Four deployment modes ship:

| Mode | Where | Backend | AI calls | Key source |
|---|---|---|---|---|
| Local dev | `make dev` | FastAPI on :18001 | Server-side | env / secrets.yaml / DB |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | None (Dexie) | Browser-direct | DB (IndexedDB) |
| Desktop launcher | PyInstaller binary (Docker-based) | FastAPI in a Docker container | Server-side | `.env` (auto-generated) / Settings UI |
| Docker | Docker Compose self-host | FastAPI in container | Server-side | env / Settings UI |

## Local development

```bash
make dev
```

Starts backend (FastAPI + uvicorn `--reload`) on port 18001
and frontend (Vite dev server) on port 15174 in parallel.
Press Ctrl-C once to stop both.

Both ports are configurable: override `ADAPTIVE_LEARNER_PORT`
(backend) and `ADAPTIVE_LEARNER_FRONTEND_PORT` (frontend) in the
environment, or pass `make BACKEND_PORT=… FRONTEND_PORT=… dev`.
The defaults (18001 / 15174) are intentionally non-standard so
Adaptive Learner coexists with other projects already bound to
8000 / 5173.

The frontend's Vite proxy forwards `/api/*` to the backend, so
the frontend always uses `/api` as its base URL - no CORS
config needed for local dev.

For background mode:

```bash
make dev-bg     # detached
make dev-down   # stop
```

## GitHub Pages (Dexie-only)

`.github/workflows/deploy-gh-pages.yml` builds the frontend
with:

- `VITE_BASE="/adaptive-learner/"` - prefixes every asset URL
  for the per-repo Pages path.
- `VITE_STORAGE_MODE="dexie"` - pins DexieStorage as the
  default mode.
- `VITE_API_BASE=""` - no backend to point at.

The workflow runs on every push to `develop` (the active
development branch under gitflow) and on manual dispatch. After
build it copies `dist/index.html` to `dist/404.html` for the
SPA-router fallback, then uses `actions/upload-pages-artifact@v5`
+ `actions/deploy-pages@v5` to publish.

The result is a fully static, backend-free build: DexieStorage
holds the canonical data in IndexedDB, AI calls go browser-direct
to the provider, and the lesson content is bundled into the build
so the site works offline.

The site URL is `https://astrapi69.github.io/adaptive-learner/`.
Custom-domain users add a `CNAME` file to `frontend/public/`
with the domain name; GitHub's domain-aware Pages routing
takes care of the rest.

## Docker Compose (full stack)

There are two compose files:

- `docker-compose.yml` (dev): mounts the source tree, runs
  uvicorn `--reload` and the Vite dev server, publishing the dev
  ports (backend `${ADAPTIVE_LEARNER_PORT:-18001}`, frontend
  `${ADAPTIVE_LEARNER_FRONTEND_PORT:-15174}`).
- `docker-compose.prod.yml` (production), used by `make prod`:

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml` ships:

- **backend** (FastAPI in a Python 3.12-slim image) running on a
  fixed internal port **8000** with `--workers 2`. The port is an
  implementation detail decoupled from the host-published port.
- **frontend** (nginx) that serves the built frontend and
  reverse-proxies `/api/*` to the backend over the compose
  network. nginx listens on container port 80, published to the
  host on **`${ADAPTIVE_LEARNER_PUBLIC_PORT:-7880}`** - this is
  the port the user reaches in the browser.
- **A named `adaptive-learner-data` volume** mounted at
  `/app/data` (set via `ADAPTIVE_LEARNER_DATA_DIR`) that survives
  container rebuilds. The DB lives at
  `$DATA_DIR/adaptive_learner.db` and uploads at
  `$DATA_DIR/uploads/`.

The backend image runs as a **non-root user** (`adaptive_learner`,
created in `backend/Dockerfile`).

`install.sh` and `install.ps1` are the curl-pipe installers
for end users - they pull a tagged release tarball, set up
`ADAPTIVE_LEARNER_SECRET_KEY`, and `docker compose up`.
`start.sh` is the equivalent local entry point: it checks Docker,
generates a random secret into `.env` from `.env.example` when no
`.env` exists, then brings up the prod stack.

The installers are regenerated at release time from
`install.sh.template` / `install.ps1.template` plus
`backend/pyproject.toml`'s version (see `scripts/sync_versions.py`).
Don't edit the generated files directly.

## Configuration for production

Three things matter for prod:

1. **`ADAPTIVE_LEARNER_SECRET_KEY`**: must be a stable Fernet
   key. Generate once, store it somewhere safe (HashiCorp
   Vault, AWS Secrets Manager, a sealed `.env`). Losing it
   means all encrypted API keys become unreadable. The app
   fails hard at startup if it's unset (no silent default). For
   the Docker stack, `start.sh` / the launcher auto-generate a
   random key into `.env` on first run when none exists.
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: comma-separated list
   of allowed origins. Default is permissive; tighten it down
   for prod.
3. **`ADAPTIVE_LEARNER_DEBUG`**: leave unset / false in prod.
   Debug mode exposes stack traces in error responses.

For containers, env vars are the idiomatic injection channel.
The `~/.config/adaptive_learner/secrets.yaml` overlay is
meant for desktop / launcher use; you can bind-mount it
into a container too if you prefer one config file over
several env vars.

## Desktop launcher (cross-OS, Docker-based)

`launcher/` is a PyInstaller-based one-binary desktop launcher.
It is **not** an embedded server - it orchestrates Docker Compose
under the hood. The flow (`adaptive_learner_launcher/__main__.py`)
is intentionally linear:

1. Check that Docker is installed and running (clear error
   dialogs guide the user to install/start Docker otherwise).
2. Resolve the app install: on a fresh install, download the
   matching tagged release ZIP from GitHub and extract it
   (`installer.py`, stdlib only - no git dependency), then
   generate `.env` from `.env.example` with a random secret.
3. `docker compose up` the prod stack.
4. Wait for the backend health check, then open the user's
   default browser at the published port.
5. On user-controlled stop, `docker compose down`.

The launcher embeds the target version (`__version__` literal +
`_build_info.py` written by the spec file at build time;
source-of-truth is `backend/pyproject.toml`). It also runs a
**background update check** against the GitHub Releases API
(`update_check.py`, added v1.90.0): it queries
`/repos/.../releases/latest`, and only when a strictly newer
release exists does it notify the user. The check fails silently
on any error (no network, GitHub down, rate limit, malformed
response) so it never blocks or interrupts the launcher.

GitHub Actions builds three binaries per release:

- `launcher-linux.yml` → `adaptive-learner-launcher` (Linux)
- `launcher-macos.yml` → `adaptive-learner-launcher` (macOS)
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

The launcher is intentionally not the primary distribution
channel (Docker is). It exists for users who want a "double-
click to install" experience without typing compose commands.

The full three-layer config chain (project YAML < user overlay
< env vars) is documented in `docs/configuration.md`.

## CI/CD architecture

Each workflow runs in isolation; no shared state between them:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push / PR to `develop`, `main` | Tests + lint + tsc |
| `coverage.yml` | daily schedule, dispatch | Coverage HTML + xml |
| `release-gate.yml` | `v*.*.*` tag push, dispatch | Version pin drift check |
| `deploy-gh-pages.yml` | push to `develop`, dispatch | GH Pages build + deploy |
| `launcher-{linux,macos,windows}.yml` | release: created | Build + attach launcher binary |
| `dexie-smoke.yml` | daily schedule, `release/**`, dispatch | Dexie-mode route smoke gate |
