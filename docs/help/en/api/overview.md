# API overview

AdaptiveLearner's backend exposes a FastAPI REST API. In
Server mode the frontend talks to it; in Local (Dexie) mode
the API isn't reachable — the same operations run in the
browser.

## Base URL

- **Local dev**: `http://localhost:18001/api`
- **Docker prod**: configured per deployment (e.g.
  `https://yourdomain.com/api`)
- **GH Pages**: not applicable (Dexie mode)

The frontend resolves the base URL from `VITE_API_BASE` at
build time; default is `/api` so the Vite dev server proxy
forwards transparently.

## Authentication

v0.7.0 has no per-request authentication. The system is
single-user-per-browser: a `user_id` is stored in
`localStorage` and passed in URL paths
(`/users/{user_id}/...`). AI provider keys are stored
encrypted (Fernet) on the backend and never travel back to the
frontend in plaintext.

A future multi-user / multi-tenant phase will add
authentication. For now, deployments should sit behind their
own auth layer (reverse proxy with HTTP basic auth, Tailscale,
VPN, etc.) when exposed to a network.

## Response format

Successful responses return the data object directly, no
envelope:

```json
{
  "id": "abc-123",
  "topic": "Spanish grammar",
  "active": true
}
```

Lists return JSON arrays:

```json
[
  {"id": "p1", "topic": "Spanish"},
  {"id": "p2", "topic": "Calculus"}
]
```

HTTP status codes:

| Code | Meaning |
|---|---|
| 200 | OK (read) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Validation error (Pydantic) |
| 404 | Not found |
| 409 | Conflict (rare) |
| 422 | Pydantic validation error (FastAPI default) |
| 500 | Server error |
| 502 | External service unreachable (AI provider) |

## Error format

Errors return a single `detail` field:

```json
{"detail": "Project abc-123 not found"}
```

Pydantic validation errors return a structured list:

```json
{
  "detail": [
    {"loc": ["body", "daily_minutes"], "msg": "value is not a valid integer", "type": "type_error.integer"}
  ]
}
```

In debug mode (`ADAPTIVE_LEARNER_DEBUG=true`) the response
also includes a `traceback` field. Production deployments
should leave debug off.

The frontend's `ApiError` class consumes both shapes — see
`frontend/src/api/client.ts` for the exact parser.

## Endpoint groups

| Group | Prefix | What it does |
|---|---|---|
| Health + i18n | `/health`, `/i18n/{lang}` | App health + UI strings |
| Users | `/users` | User CRUD + nested projects |
| Projects | `/projects` | Project-scoped reads / updates |
| Settings | `/settings/{user_id}` | UserSettings + API keys |
| Assessment plugin | `/plugins/assessment/...` | Questions, evaluate, profile |
| Session plugin | `/plugins/session/...` | Start, message, rate, end, switch |
| Tracking plugin | `/plugins/tracking/...` | Progress + commits |
| Tools plugin | `/plugins/tools/...` | Recommendations + spaced |
| Curriculum | `/users/{user_id}/curricula`, `/curricula/{id}` | Curriculum + topics + lessons CRUD |
| Plugin discovery | `/plugins/manifests`, `/plugins/health`, `/plugins/errors` | What's registered |

See [Core endpoints](core-endpoints.md) and
[Plugin endpoints](plugin-endpoints.md) for the full method
list with request / response examples.

## OpenAPI / Swagger

FastAPI auto-generates an OpenAPI 3.1 spec from the Pydantic
schemas. In dev mode:

- **Swagger UI**: `http://localhost:18001/api/docs`
- **Redoc**: `http://localhost:18001/api/redoc`
- **Raw OpenAPI JSON**: `http://localhost:18001/api/openapi.json`

These are the authoritative reference for every endpoint's
exact shape. The Markdown pages here are a curated subset for
readability.

## Pagination

v0.7.0 endpoints do not paginate. The dataset is single-user
and small; the largest list (sessions per project) hits
hundreds, not thousands. A future phase will add
cursor-based pagination if the data shape grows.

## Versioning

The API has no version prefix in the URL. Breaking changes
land at semver-major boundaries; the CHANGELOG documents what
moved.
