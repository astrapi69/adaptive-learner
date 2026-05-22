# Core endpoints

Endpoints not registered by a plugin: users, projects,
settings, i18n, health.

## Health

```
GET /api/health
```

```json
{
  "status": "ok",
  "version": "1.20.0",
  "debug": false
}
```

## i18n catalog

```
GET /api/i18n/{lang}
```

Returns the full nested catalog for the requested language.
Falls back to EN if `{lang}` isn't registered.

```json
{
  "common": {"save": "Save", "cancel": "Cancel"},
  "settings": {"title": "Settings", "section_language": "Language", ...},
  ...
}
```

## Users

```
POST /api/users
```

Body:

```json
{"name": "Asterios", "email": "ar@example.com", "language": "de"}
```

Response (201):

```json
{
  "id": "abc-123",
  "name": "Asterios",
  "email": "ar@example.com",
  "language": "de",
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

```
GET /api/users/{user_id}
```

Returns the user. 404 if not found.

```
PATCH /api/users/{user_id}
```

Body: any subset of `{name, email, language}`. Returns the
updated row.

## Projects (user-scoped)

```
GET /api/users/{user_id}/projects
POST /api/users/{user_id}/projects
```

POST body:

```json
{
  "topic": "Spanish grammar",
  "goal": "Pass B2 exam",
  "timeframe": "6 weeks",
  "daily_minutes": 30,
  "current_problem": "Tenses",
  "active": true
}
```

Response (201):

```json
{
  "id": "p1",
  "user_id": "abc-123",
  "topic": "Spanish grammar",
  "goal": "Pass B2 exam",
  "timeframe": "6 weeks",
  "daily_minutes": 30,
  "current_problem": "Tenses",
  "active": true,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

## Projects (direct)

```
GET /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

PATCH body: any subset of `{topic, goal, timeframe,
daily_minutes, current_problem, active}`. Returns the updated
row.

## Settings

```
GET /api/settings/{user_id}
```

Returns UserSettings with API-key fields **as booleans + source
enums** (the backend never sends cleartext keys back):

```json
{
  "id": "s1",
  "user_id": "abc-123",
  "language": "de",
  "active_provider": "anthropic",
  "has_anthropic_key": true,
  "has_openai_key": false,
  "has_gemini_key": false,
  "key_source_anthropic": "secrets_yaml",
  "key_source_openai": "none",
  "key_source_gemini": "none",
  "model_override_anthropic": "claude-sonnet-4-20250514",
  "model_override_openai": null,
  "model_override_gemini": null,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

`key_source_*` values: `env` (env var set + value differs
from yaml), `secrets_yaml` (value matches yaml OR env-
hydrated-from-yaml), `settings` (Fernet DB column), `none`.

```
PATCH /api/settings/{user_id}
```

Body: any subset of `{active_provider, language,
model_override_anthropic, model_override_openai,
model_override_gemini}`. Empty string clears an override;
omitting a field leaves it alone.

## API keys

```
POST /api/settings/{user_id}/api-key
```

Body:

```json
{"provider": "anthropic", "key": "sk-ant-..."}
```

Encrypts with Fernet and stores. Returns updated UserSettings
with `has_<provider>_key: true`.

```
DELETE /api/settings/{user_id}/api-key/{provider}
```

Clears the key. Returns updated UserSettings with
`has_<provider>_key: false`.

## Curriculum

```
GET /api/users/{user_id}/curricula
POST /api/users/{user_id}/curricula
GET /api/curricula/{curriculum_id}
PATCH /api/curricula/{curriculum_id}
DELETE /api/curricula/{curriculum_id}
```

Curriculum POST body:

```json
{"title": "Spanish", "description": "Grammar + vocab", "language": "de"}
```

```
GET /api/curricula/{curriculum_id}/topics
POST /api/curricula/{curriculum_id}/topics
GET /api/topics/{topic_id}
PATCH /api/topics/{topic_id}
DELETE /api/topics/{topic_id}
```

Topic POST body:

```json
{"title": "Subjunctive", "description": null, "parent_id": null, "order_index": 0}
```

```
GET /api/curricula/{curriculum_id}/lessons
POST /api/curricula/{curriculum_id}/lessons
GET /api/lessons/{lesson_id}
PATCH /api/lessons/{lesson_id}
DELETE /api/lessons/{lesson_id}
```

Lesson POST body:

```json
{"title": "Past subjunctive", "content": "# Past subjunctive...", "order_index": 0}
```
