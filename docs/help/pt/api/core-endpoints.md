<!-- Translation: AI-generated, pending native review -->

# Endpoints principais

Endpoints não registados por um plugin: utilizadores, projetos,
definições, i18n, saúde.

## Saúde

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

Retorna o catálogo aninhado completo para o idioma pedido.
Volta para EN se `{lang}` não estiver registado.

```json
{
  "common": {"save": "Save", "cancel": "Cancel"},
  "settings": {"title": "Settings", "section_language": "Language", ...},
  ...
}
```

## Utilizadores

```
POST /api/users
```

Corpo:

```json
{"name": "Asterios", "email": "ar@example.com", "language": "de"}
```

Resposta (201):

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

Retorna o utilizador. 404 se não encontrado.

```
PATCH /api/users/{user_id}
```

Corpo: qualquer subconjunto de `{name, email, language}`.
Retorna a linha atualizada.

## Projetos (com âmbito de utilizador)

```
GET /api/users/{user_id}/projects
POST /api/users/{user_id}/projects
```

Corpo POST:

```json
{
  "topic": "Gramática espanhola",
  "goal": "Passar exame B2",
  "timeframe": "6 semanas",
  "daily_minutes": 30,
  "current_problem": "Tempos verbais",
  "active": true
}
```

Resposta (201):

```json
{
  "id": "p1",
  "user_id": "abc-123",
  "topic": "Gramática espanhola",
  "goal": "Passar exame B2",
  "timeframe": "6 semanas",
  "daily_minutes": 30,
  "current_problem": "Tempos verbais",
  "active": true,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

## Projetos (direto)

```
GET /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

Corpo PATCH: qualquer subconjunto de `{topic, goal, timeframe,
daily_minutes, current_problem, active}`. Retorna a linha
atualizada.

## Definições

```
GET /api/settings/{user_id}
```

Retorna UserSettings com os campos de chave de API **como booleanos
+ enums de fonte** (o backend nunca envia chaves em texto simples
de volta):

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

Valores de `key_source_*`: `env` (variável de ambiente definida +
valor diferente do yaml), `secrets_yaml` (valor corresponde ao
yaml OU hidratado do yaml via env), `settings` (coluna DB Fernet),
`none`.

```
PATCH /api/settings/{user_id}
```

Corpo: qualquer subconjunto de `{active_provider, language,
model_override_anthropic, model_override_openai,
model_override_gemini}`. Uma string vazia limpa uma substituição;
omitir um campo deixa-o como está.

## Chaves de API

```
POST /api/settings/{user_id}/api-key
```

Corpo:

```json
{"provider": "anthropic", "key": "sk-ant-..."}
```

Encripta com Fernet e armazena. Retorna UserSettings atualizado
com `has_<provider>_key: true`.

```
DELETE /api/settings/{user_id}/api-key/{provider}
```

Limpa a chave. Retorna UserSettings atualizado com
`has_<provider>_key: false`.

## Currículo

```
GET /api/users/{user_id}/curricula
POST /api/users/{user_id}/curricula
GET /api/curricula/{curriculum_id}
PATCH /api/curricula/{curriculum_id}
DELETE /api/curricula/{curriculum_id}
```

Corpo POST de Currículo:

```json
{"title": "Espanhol", "description": "Gramática + vocabulário", "language": "de"}
```

```
GET /api/curricula/{curriculum_id}/topics
POST /api/curricula/{curriculum_id}/topics
GET /api/topics/{topic_id}
PATCH /api/topics/{topic_id}
DELETE /api/topics/{topic_id}
```

Corpo POST de Tópico:

```json
{"title": "Conjuntivo", "description": null, "parent_id": null, "order_index": 0}
```

```
GET /api/curricula/{curriculum_id}/lessons
POST /api/curricula/{curriculum_id}/lessons
GET /api/lessons/{lesson_id}
PATCH /api/lessons/{lesson_id}
DELETE /api/lessons/{lesson_id}
```

Corpo POST de Lição:

```json
{"title": "Conjuntivo imperfeito", "content": "# Conjuntivo imperfeito...", "order_index": 0}
```
