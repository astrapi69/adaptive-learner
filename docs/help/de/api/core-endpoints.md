# Core-Endpoints

Endpunkte, die nicht von einem Plugin registriert werden:
Users, Projects, Settings, i18n, Health.

## Health

```
GET /api/health
```

```json
{
  "status": "ok",
  "version": "0.7.0",
  "debug": false
}
```

## i18n-Katalog

```
GET /api/i18n/{lang}
```

Liefert den vollständigen verschachtelten Katalog für die
angeforderte Sprache. Fällt auf EN zurück, wenn `{lang}`
nicht registriert ist.

```json
{
  "common": {"save": "Speichern", "cancel": "Abbrechen"},
  "settings": {"title": "Einstellungen", "section_language": "Sprache", ...},
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

Liefert den User. 404 bei Nicht-Fund.

```
PATCH /api/users/{user_id}
```

Body: beliebige Teilmenge von `{name, email, language}`.
Liefert die aktualisierte Zeile.

## Projekte (User-scoped)

```
GET /api/users/{user_id}/projects
POST /api/users/{user_id}/projects
```

POST-Body:

```json
{
  "topic": "Spanische Grammatik",
  "goal": "B2-Prüfung bestehen",
  "timeframe": "6 Wochen",
  "daily_minutes": 30,
  "current_problem": "Konjunktiv",
  "active": true
}
```

Response (201):

```json
{
  "id": "p1",
  "user_id": "abc-123",
  "topic": "Spanische Grammatik",
  "goal": "B2-Prüfung bestehen",
  "timeframe": "6 Wochen",
  "daily_minutes": 30,
  "current_problem": "Konjunktiv",
  "active": true,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

## Projekte (direkt)

```
GET /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

PATCH-Body: beliebige Teilmenge von `{topic, goal, timeframe,
daily_minutes, current_problem, active}`. Liefert die
aktualisierte Zeile.

## Settings

```
GET /api/settings/{user_id}
```

Liefert UserSettings mit API-Key-Feldern **als Booleans**
(das Backend sendet niemals Klartext-Keys zurück):

```json
{
  "id": "s1",
  "user_id": "abc-123",
  "language": "de",
  "active_provider": "anthropic",
  "has_anthropic_key": true,
  "has_openai_key": false,
  "has_gemini_key": false,
  "model_override_anthropic": "claude-sonnet-4-20250514",
  "model_override_openai": null,
  "model_override_gemini": null,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

```
PATCH /api/settings/{user_id}
```

Body: beliebige Teilmenge von `{active_provider, language,
model_override_anthropic, model_override_openai,
model_override_gemini}`. Leerer String löscht eine
Überschreibung; das Auslassen eines Felds lässt es unverändert.

## API-Keys

```
POST /api/settings/{user_id}/api-key
```

Body:

```json
{"provider": "anthropic", "key": "sk-ant-..."}
```

Verschlüsselt mit Fernet und speichert. Liefert
aktualisierte UserSettings mit `has_<provider>_key: true`.

```
DELETE /api/settings/{user_id}/api-key/{provider}
```

Löscht den Schlüssel. Liefert aktualisierte UserSettings mit
`has_<provider>_key: false`.

## Curriculum

```
GET /api/users/{user_id}/curricula
POST /api/users/{user_id}/curricula
GET /api/curricula/{curriculum_id}
PATCH /api/curricula/{curriculum_id}
DELETE /api/curricula/{curriculum_id}
```

Curriculum-POST-Body:

```json
{"title": "Spanisch", "description": "Grammatik + Vokabular", "language": "de"}
```

```
GET /api/curricula/{curriculum_id}/topics
POST /api/curricula/{curriculum_id}/topics
GET /api/topics/{topic_id}
PATCH /api/topics/{topic_id}
DELETE /api/topics/{topic_id}
```

Topic-POST-Body:

```json
{"title": "Konjunktiv", "description": null, "parent_id": null, "order_index": 0}
```

```
GET /api/curricula/{curriculum_id}/lessons
POST /api/curricula/{curriculum_id}/lessons
GET /api/lessons/{lesson_id}
PATCH /api/lessons/{lesson_id}
DELETE /api/lessons/{lesson_id}
```

Lesson-POST-Body:

```json
{"title": "Konjunktiv II", "content": "# Konjunktiv II...", "order_index": 0}
```
