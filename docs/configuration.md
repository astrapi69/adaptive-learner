# Configuration

Adaptive Learner uses a three-layer config chain so secrets stay
out of the project tree:

```
┌─────────────────────────────────────────────────────────────┐
│ env-vars (CI / Docker / shell, highest priority)            │
│ ADAPTIVE_LEARNER_ANTHROPIC_API_KEY, ..._OPENAI_API_KEY, ... │
│ ADAPTIVE_LEARNER_SECRET_KEY (Fernet)                        │
└─────────────────────────────────────────────────────────────┘
                  ↑ overrides
┌─────────────────────────────────────────┐
│ user override file (outside the repo)   │
│ ~/.config/adaptive_learner/secrets.yaml │
└─────────────────────────────────────────┘
                  ↑ overrides (for AI keys only)
┌─────────────────────────────────────────┐
│ database UserSettings (Settings UI)     │
│ Fernet-encrypted api_key_<provider>     │
└─────────────────────────────────────────┘
```

Override-wins semantics: a value in `secrets.yaml` replaces the
encrypted DB column; an env-var replaces both. Lists are
**replaced**, not merged.

Phase 34 (v1.20.0) — the secrets.yaml layer was introduced for
the desktop launcher use case, alongside the existing UI-driven
Settings flow. Web / Docker deployments can still rely entirely
on env vars + the Settings UI.

---

## What goes where

| Layer | Examples | Lives in |
|---|---|---|
| Project `app.yaml` | non-secret defaults: `app.name`, `app.default_language`, `plugins.enabled`, server.port. **Never** API keys. | committed to git |
| User `secrets.yaml` | `ai.<provider>.api_key`, `ai.<provider>.default_model`, `secret_key` (Fernet) | `~/.config/adaptive_learner/secrets.yaml` (Linux/macOS), `%APPDATA%/adaptive_learner/secrets.yaml` (Windows) |
| Settings UI (DB) | per-user `api_key_<provider>`, `model_override_<provider>`, `language`, `active_provider` | SQLite, Fernet-encrypted for the api_key_* columns |
| Env-var | CI / Docker / shell overrides of any of the above | environment |

**Rule of thumb:** anything sensitive belongs in `secrets.yaml`,
env-vars, or the Fernet-encrypted DB column. Nothing sensitive
belongs in `app.yaml`.

---

## `secrets.yaml` format

A first-run template is auto-generated at the path above with all
keys commented out. POSIX permissions are set to `0600` on
creation. Uncomment + fill in the keys you want:

```yaml
# secret_key: "generate with: python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"

ai:
  anthropic:
    api_key: "sk-ant-..."
    default_model: "claude-sonnet-4-20250514"  # optional override
  openai:
    api_key: "sk-..."
    default_model: "gpt-4o"  # optional override
  gemini:
    api_key: "AIza..."
    default_model: "gemini-2.0-flash"  # optional override
```

The file is parsed with `yaml.safe_load`. Missing keys are
treated as "not configured here" and resolution falls through to
the next layer. Malformed YAML logs a single WARNING at startup
and the loader falls back to "no overrides" (the app continues
to start). World-readable permissions trigger a one-line WARNING
at startup recommending `chmod 0600`.

---

## Key resolution chain at runtime

When the AI orchestrator needs an API key for `<provider>`:

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` env var.
2. `ai.<provider>.api_key` in `secrets.yaml`.
3. Fernet-decrypted `api_key_<provider>` column on the user's
   `UserSettings` row (set via the Settings UI).
4. `None` — the AI call returns an error asking the user to
   configure a key.

The Settings UI surfaces which layer the active key came from
via per-provider badges:

- "Key from: environment"
- "Key from: secrets.yaml"
- "Key from: Settings"
- "No key configured"

When the source is `environment` or `secrets.yaml`, the Save +
Remove buttons in Settings are disabled and an info banner tells
the user where to edit the key.

Same chain for `default_model` (per-provider model override) —
the only difference is that the third layer is
`UserSettings.model_override_<provider>` instead of the
encrypted key column. Per the v1.20.0 decision, `secrets.yaml`
beats the UI override (file-level config wins over UI for power
users).

---

## Path resolution per OS

### Linux / macOS

Default: `~/.config/adaptive_learner/secrets.yaml`.

Set `XDG_CONFIG_HOME` to relocate (XDG-conformant):

```bash
export XDG_CONFIG_HOME=/srv/configs
# Adaptive Learner now reads /srv/configs/adaptive_learner/secrets.yaml
```

### Windows

Default: `%APPDATA%/adaptive_learner/secrets.yaml`.

Falls back to `~/AppData/Roaming/adaptive_learner/secrets.yaml`
when `%APPDATA%` is unset.

---

## Env-var list

| Env-var | Maps to | Notes |
|---|---|---|
| `ADAPTIVE_LEARNER_ANTHROPIC_API_KEY` | `ai.anthropic.api_key` | Beats secrets.yaml + DB |
| `ADAPTIVE_LEARNER_OPENAI_API_KEY` | `ai.openai.api_key` | Beats secrets.yaml + DB |
| `ADAPTIVE_LEARNER_GEMINI_API_KEY` | `ai.gemini.api_key` | Beats secrets.yaml + DB |
| `ADAPTIVE_LEARNER_ANTHROPIC_DEFAULT_MODEL` | `ai.anthropic.default_model` | Beats secrets.yaml + UI override |
| `ADAPTIVE_LEARNER_OPENAI_DEFAULT_MODEL` | `ai.openai.default_model` | Beats secrets.yaml + UI override |
| `ADAPTIVE_LEARNER_GEMINI_DEFAULT_MODEL` | `ai.gemini.default_model` | Beats secrets.yaml + UI override |
| `ADAPTIVE_LEARNER_SECRET_KEY` | Fernet encryption key for `api_key_*` DB columns | hydrated from `secret_key:` in `secrets.yaml` when env empty; fail-hard if neither is set |
| `ADAPTIVE_LEARNER_PORT` | backend listen port (default 18001) | uvicorn reads its own `--port` flag too |
| `ADAPTIVE_LEARNER_CORS_ORIGINS` | CORS allowed origins | comma-separated |
| `ADAPTIVE_LEARNER_DEBUG` | `DEBUG` constant in `main.py` | `true`/`1`/`yes` to enable |
| `ADAPTIVE_LEARNER_TEST` | enables test isolation guards | set automatically by `conftest.py` |
| `ADAPTIVE_LEARNER_CONFIG_DIR` | overrides `platformdirs.user_config_dir(...)` | rarely needed; XDG-conformant default works |
| `ADAPTIVE_LEARNER_DATA_DIR` | overrides `platformdirs.user_data_dir(...)` | for sandboxed installations |

---

## Docker / CI usage

For Docker / CI / Kubernetes you typically inject every secret
via env vars from your orchestrator's secrets store. The
`secrets.yaml` layer is meant for human desktop use — it works
in Docker too if you bind-mount the path, but env-vars are the
idiomatic choice in containers:

```yaml
# docker-compose.prod.yml (example excerpt)
services:
  backend:
    image: adaptive_learner:1.19.2
    environment:
      ADAPTIVE_LEARNER_SECRET_KEY: ${ADAPTIVE_LEARNER_SECRET_KEY}
      ADAPTIVE_LEARNER_ANTHROPIC_API_KEY: ${ADAPTIVE_LEARNER_ANTHROPIC_API_KEY}
      ADAPTIVE_LEARNER_DEBUG: "false"
    volumes:
      - adaptive-learner-data:/app/data
```

Inject the env-vars from your CI secrets store (GitHub Actions
secrets, GitLab CI variables, Vault, AWS Secrets Manager, etc.).

---

## Debugging: which layer wins?

```bash
# What does the Settings endpoint say about each provider?
curl http://localhost:18001/api/settings/<user-id> \
  | jq '.key_source_anthropic, .key_source_openai, .key_source_gemini'
```

Expected values: `"env"`, `"secrets_yaml"`, `"settings"`, `"none"`.

To confirm WHICH layer holds a value at the source-of-truth level:

```bash
# Env var
echo "$ADAPTIVE_LEARNER_ANTHROPIC_API_KEY"

# secrets.yaml
yq '.ai.anthropic.api_key' ~/.config/adaptive_learner/secrets.yaml

# DB column (encrypted ciphertext)
sqlite3 ~/.local/share/adaptive_learner/adaptive_learner.db \
  "SELECT api_key_anthropic IS NOT NULL FROM user_settings WHERE user_id='<id>';"
```

Whichever is non-empty AND highest in the chain wins. The
Settings UI mirrors this resolution and disables the input
fields when the source is `env` or `secrets_yaml`.

---

## Fernet `secret_key` notes

The `secret_key` is a separate concern from the AI provider API
keys: it's the symmetric encryption key Adaptive Learner uses to
encrypt `api_key_<provider>` columns at rest in SQLite. If you
rotate it, existing encrypted rows become unreadable —
`CryptoDecryptionError` raised on read, and the user has to
re-enter their keys via the Settings UI.

Resolution order at startup:

1. `ADAPTIVE_LEARNER_SECRET_KEY` env var.
2. `secret_key:` in `secrets.yaml` (hydrated into the env var
   by `_hydrate_env_from_config` so downstream readers see it
   too).
3. **Fail-hard** with `CryptoConfigurationError`. No silent
   default — generating one at startup would mean different
   keys per dev machine and across container restarts, which
   would silently corrupt the encrypted DB rows.

Generate a fresh key for local dev:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# -> paste into secrets.yaml as ``secret_key: "..."``,
#    OR export ADAPTIVE_LEARNER_SECRET_KEY="..."
```

For dev convenience, `make dev-secret` writes a key into
`~/.adaptive-learner/dev-secret.env` (gitignored) the first time
it's invoked, so subsequent runs of `make dev` Just Work.

---

## PWA configuration (v0.6.0)

The Progressive Web App manifest and service worker live as
build-time configuration in `frontend/vite.config.ts` under
the `VitePWA(...)` plugin block. There's NO runtime config
chain for PWA settings — they're baked into the generated
`dist/sw.js` and `dist/manifest.webmanifest` during
`npm run build`. Changing them requires a rebuild + a fresh
SW registration in the user's browser (Workbox's
`registerType: "autoUpdate"` handles that on next page load).

### Manifest

```typescript
manifest: {
    name: "Adaptive Learner",
    short_name: "Adaptive",      // ≤12 chars (Android home-screen rec)
    theme_color: "#6366f1",      // matches --accent CSS variable
    background_color: "#ffffff",
    display: "standalone",
    orientation: "any",
    start_url: "/",
    scope: "/",
    lang: "en",
    categories: ["education", "productivity"],
    icons: [
        // SVG + PNG ("any maskable") at 192 and 512.
    ],
}
```

### Service worker cache strategy

```typescript
workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
        {
            // GET /api/ → NetworkFirst with 24h LRU
            urlPattern: ({url, request}) =>
                url.pathname.startsWith("/api/") &&
                request.method === "GET",
            handler: "NetworkFirst",
            options: {
                cacheName: "adaptive-learner-api",
                networkTimeoutSeconds: 4,
                expiration: {maxEntries: 60, maxAgeSeconds: 86400},
                cacheableResponse: {statuses: [0, 200]},
            },
        },
        {
            // Mutating /api/ — NetworkOnly
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
        },
    ],
}
```

Why these defaults:

- **4s `networkTimeoutSeconds`** — gives real network a fair
  chance before falling back to cache; feels snappy on flaky
  cellular without being noticeable on broadband.
- **24h + 60-entry LRU** — keeps the cache useful for a typical
  learning week without growing unbounded.
- **`cacheableResponse.statuses: [0, 200]`** — `0` covers
  opaque-CORS, `200` excludes 5xx so transient backend errors
  don't poison the cache.
- **`navigateFallbackDenylist: [/^\/api\//]`** stops the SPA
  `index.html` from masking real backend 4xx/5xx responses.

## Identity persistence + browser-wipe recovery (Phase 41)

Adaptive Learner writes a small YAML at
`~/.config/adaptive_learner/identity.yaml` that lets the app
recover your user identity after a browser data wipe. The
file is auto-managed; do not edit it manually.

### Format

```yaml
# Auto-generated by Adaptive Learner. Do not edit manually.
# Last written: 2026-05-23T14:30:00+00:00
active_project_id: 86071d42-653f-4827-a4e5-242207f3c2ab
language: de
last_seen: '2026-05-23T14:30:00+00:00'
user_id: d2a7e8dd-078b-4489-852c-d2ab87c1d589
```

- File permissions: `0600` (owner read/write only, same as
  `secrets.yaml`).
- Path: same XDG-conformant config dir as `secrets.yaml`.
  Override with `ADAPTIVE_LEARNER_CONFIG_DIR` if you need a
  non-default location (tests, Docker).

### When it gets written

The backend updates `identity.yaml` automatically after every
domain change that affects who-am-I or which-project state:

- `POST /api/users` (user creation) seeds `user_id` +
  `language`.
- `PATCH /api/users/{id}` (language switch) refreshes
  `language`.
- `POST /api/users/{user_id}/projects` (new project) sets
  `active_project_id` to the new project.
- `PATCH /api/projects/{id}` when `active=true` (project
  switch) moves `active_project_id` to the chosen project.

`last_seen` refreshes on every write so the Settings >
About > Identity panel can surface a meaningful timestamp.

### Recovery flow

On Landing, if `localStorage` is empty (cleared, private mode,
fresh browser, etc.):

- **API mode**: the frontend calls `GET /api/identity`. A hit
  re-seeds `localStorage` and redirects to the Dashboard
  silently — recovery is invisible per design.
- **Dexie mode**: the frontend queries the most recent
  `users` row + its active `learningProjects` row from
  IndexedDB. A hit re-seeds `localStorage`, redirects, and
  shows a friendly "Welcome back! Your learning data is
  still here." toast.

When neither path produces a hit, the regular onboarding flow
runs as if this were a first visit.

### Inspecting + resetting

The Settings page surfaces the identity file in two places:

- **Settings > About > Identity file** shows the path,
  Active / Not found status, and the last-updated timestamp.
  Read-only.
- **Settings > Danger Zone** (bottom of Settings) is the
  Reset Everything action with the typed-confirm gate.
  Deletes the identity file along with every other piece of
  learner state.

### Danger Zone reset semantics

`POST /api/reset {confirmation: "RESET"}` (API mode) wipes
everything the backend owns:

- Every SQLite table (truncated in reverse FK order).
- `identity.yaml` (removed entirely).
- The `ai.*` block inside `secrets.yaml` (API keys + per-
  provider defaults).

`secrets.yaml`'s top-level `secret_key` Fernet field is
deliberately preserved — removing it would make any
surviving encrypted data unreadable forever, which is a
worse failure mode than retaining a key whose ciphertexts no
longer exist. The same field survives the Dexie-mode reset
(it isn't touched there).

The confirmation token is case-sensitive and must be the
exact string `"RESET"`. Anything else returns 400 before
any side effect runs.

### Install-prompt dismissal state

User dismissal of the "Add to home screen" banner persists in
`localStorage`:

```text
adaptive-learner.install_dismissed = "1"
```

Clear that key (DevTools → Application → Local Storage) to
re-test the prompt without uninstalling the app.

### Mobile breakpoints

CSS breakpoints live in `frontend/src/styles/global.css`
under the `Mobile responsive polish (Phase 9A)` block:

- `@media (max-width: 768px)` — canonical mobile cut-over
  (hamburger drawer, 44px touch targets, stacked layouts).
- `@media (max-width: 360px)` — extreme-narrow safety net.
- Desktop styles (≥769px) remain unchanged.
