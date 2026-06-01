# Endpoints principales

Endpoints no registrados por ningún plugin: usuarios, proyectos,
ajustes, i18n, salud.

## Salud

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

## Catálogo i18n

```
GET /api/i18n/{lang}
```

Devuelve el catálogo anidado completo para el idioma solicitado.
Regresa a EN si `{lang}` no está registrado.

```json
{
  "common": {"save": "Save", "cancel": "Cancel"},
  "settings": {"title": "Settings", "section_language": "Language", ...},
  ...
}
```

## Usuarios

```
POST /api/users
```

Cuerpo:

```json
{"name": "Asterios", "email": "ar@example.com", "language": "de"}
```

Respuesta (201):

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

Devuelve el usuario. 404 si no se encuentra.

```
PATCH /api/users/{user_id}
```

Cuerpo: cualquier subconjunto de `{name, email, language}`. Devuelve la
fila actualizada.

## Proyectos (con ámbito de usuario)

```
GET /api/users/{user_id}/projects
POST /api/users/{user_id}/projects
```

Cuerpo del POST:

```json
{
  "topic": "Gramática española",
  "goal": "Aprobar el examen B2",
  "timeframe": "6 semanas",
  "daily_minutes": 30,
  "current_problem": "Los tiempos verbales",
  "active": true
}
```

Respuesta (201):

```json
{
  "id": "p1",
  "user_id": "abc-123",
  "topic": "Gramática española",
  "goal": "Aprobar el examen B2",
  "timeframe": "6 semanas",
  "daily_minutes": 30,
  "current_problem": "Los tiempos verbales",
  "active": true,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

## Proyectos (acceso directo)

```
GET /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

Cuerpo del PATCH: cualquier subconjunto de `{topic, goal, timeframe,
daily_minutes, current_problem, active}`. Devuelve la fila actualizada.

## Ajustes

```
GET /api/settings/{user_id}
```

Devuelve UserSettings con los campos de clave API **como booleanos +
enums de fuente** (el backend nunca envía las claves en texto plano
de vuelta):

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

Valores de `key_source_*`: `env` (var de entorno establecida y valor
diferente del yaml), `secrets_yaml` (valor coincide con yaml O
hidratado-desde-env-a-yaml), `settings` (columna Fernet en BD), `none`.

```
PATCH /api/settings/{user_id}
```

Cuerpo: cualquier subconjunto de `{active_provider, language,
model_override_anthropic, model_override_openai,
model_override_gemini}`. Una cadena vacía limpia una anulación;
omitir un campo lo deja sin cambios.

## Claves API

```
POST /api/settings/{user_id}/api-key
```

Cuerpo:

```json
{"provider": "anthropic", "key": "sk-ant-..."}
```

Cifra con Fernet y almacena. Devuelve UserSettings actualizado
con `has_<provider>_key: true`.

```
DELETE /api/settings/{user_id}/api-key/{provider}
```

Elimina la clave. Devuelve UserSettings actualizado con
`has_<provider>_key: false`.

## Currículo

```
GET /api/users/{user_id}/curricula
POST /api/users/{user_id}/curricula
GET /api/curricula/{curriculum_id}
PATCH /api/curricula/{curriculum_id}
DELETE /api/curricula/{curriculum_id}
```

Cuerpo del POST de currículo:

```json
{"title": "Español", "description": "Gramática + vocabulario", "language": "de"}
```

```
GET /api/curricula/{curriculum_id}/topics
POST /api/curricula/{curriculum_id}/topics
GET /api/topics/{topic_id}
PATCH /api/topics/{topic_id}
DELETE /api/topics/{topic_id}
```

Cuerpo del POST de tema:

```json
{"title": "Subjuntivo", "description": null, "parent_id": null, "order_index": 0}
```

```
GET /api/curricula/{curriculum_id}/lessons
POST /api/curricula/{curriculum_id}/lessons
GET /api/lessons/{lesson_id}
PATCH /api/lessons/{lesson_id}
DELETE /api/lessons/{lesson_id}
```

Cuerpo del POST de lección:

```json
{"title": "Pasado de subjuntivo", "content": "# Pasado de subjuntivo...", "order_index": 0}
```
