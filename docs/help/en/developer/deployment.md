# Deployment

Four deployment modes ship:

| Mode | Where | Backend | AI calls | Key source |
|---|---|---|---|---|
| Local dev | `make dev` | FastAPI on :18001 | Server-side | env / secrets.yaml / DB |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | None (Dexie) | Browser-direct | DB (IndexedDB) |
| Desktop launcher | PyInstaller binary | FastAPI bootstrapped locally | Server-side | secrets.yaml (auto-created) / Settings UI |
| Docker | Docker Compose self-host | FastAPI in container | Server-side | env / Settings UI |

## Local development

```bash
make dev
```

Starts backend (FastAPI + uvicorn `--reload`) on port 18001
and frontend (Vite dev server) on port 15174 in parallel.
Press Ctrl-C once to stop both.

The frontend's Vite proxy forwards `/api/*` to the backend, so
the frontend always uses `/api` as its base URL — no CORS
config needed for local dev.

For background mode:

```bash
make dev-bg     # detached
make dev-down   # stop
```

## GitHub Pages (Dexie-only)

`.github/workflows/deploy-gh-pages.yml` builds the frontend
with:

- `VITE_BASE="/adaptive-learner/"` — prefixes every asset URL
  for the per-repo Pages path.
- `VITE_STORAGE_MODE="dexie"` — pins DexieStorage as the
  default mode.
- `VITE_API_BASE=""` — no backend to point at.

The workflow runs on every push to `main` and on manual
dispatch. After build it copies `dist/index.html` to
`dist/404.html` for the SPA-router fallback, then uses
`actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`
to publish.

The site URL is `https://astrapi69.github.io/adaptive-learner/`.
Custom-domain users add a `CNAME` file to `frontend/public/`
with the domain name; GitHub's domain-aware Pages routing
takes care of the rest.

## Docker Compose (full stack)

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml` ships:

- **backend** (FastAPI in a Python 3.12 image), exposing port
  7880.
- **nginx** sidecar that serves the built frontend
  (`frontend/dist/`) and proxies `/api/*` to the backend.
- **A SQLite volume** that survives container restarts.

`install.sh` and `install.ps1` are the curl-pipe installers
for end users — they pull a tagged release tarball, set up
`ADAPTIVE_LEARNER_SECRET_KEY`, and `docker compose up`.

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
   fails hard at startup if it's unset (no silent default).
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

## Desktop launcher

The PyInstaller binaries under `launcher/` bootstrap a local
FastAPI on `http://localhost:7880`, then open the user's
default browser. On first start the launcher also creates
`~/.config/adaptive-learner/secrets.yaml` as a commented
template + `chmod 0600` on POSIX so the user can drop their
API keys there without ever touching the Settings UI.

The full three-layer config chain (project YAML < user overlay
< env vars) is documented in `docs/configuration.md`.

## Launcher (cross-OS desktop)

`launcher/` is a PyInstaller-based one-binary installer.
GitHub Actions builds three binaries per release:

- `launcher-linux.yml` → `adaptive-learner-launcher-linux`
- `launcher-macos.yml` → `adaptive-learner-launcher-macos`
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

Each launcher embeds the version (`__version__` literal +
`_build_info.py` written by the spec file at build time) and
fetches the matching tagged release tarball + extracts +
bootstraps the backend + opens the frontend in the user's
browser.

The launcher is intentionally not the primary distribution
channel (Docker is). It exists for users who want a "double-
click to install" experience.

## CI/CD architecture

Each workflow runs in isolation; no shared state between them:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push, pull_request | Tests + lint + tsc |
| `coverage.yml` | push to main | Coverage HTML + xml |
| `release-gate.yml` | tag push | Version pin drift check |
| `deploy-gh-pages.yml` | push to main, dispatch | GH Pages build + deploy |
| `launcher-{linux,macos,windows}.yml` | release: created | Build + attach launcher binary |
| `docs.yml` | push to main | MkDocs build (currently inactive — site comes from GH Pages workflow) |
