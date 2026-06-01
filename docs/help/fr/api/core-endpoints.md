# Endpoints principaux

Endpoints non enregistrés par un plugin : utilisateurs, projets,
paramètres, i18n, santé.

## Santé

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

## Catalogue i18n

```
GET /api/i18n/{lang}
```

Retourne le catalogue imbriqué complet pour la langue demandée.
Replie sur EN si `{lang}` n'est pas enregistré.

```json
{
  "common": {"save": "Enregistrer", "cancel": "Annuler"},
  "settings": {"title": "Paramètres", "section_language": "Langue", ...},
  ...
}
```

## Utilisateurs

```
POST /api/users
```

Corps :

```json
{"name": "Asterios", "email": "ar@example.com", "language": "fr"}
```

Réponse (201) :

```json
{
  "id": "abc-123",
  "name": "Asterios",
  "email": "ar@example.com",
  "language": "fr",
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

```
GET /api/users/{user_id}
```

Retourne l'utilisateur. 404 si non trouvé.

```
PATCH /api/users/{user_id}
```

Corps : n'importe quel sous-ensemble de `{name, email, language}`.
Retourne la ligne mise à jour.

## Projets (scoped utilisateur)

```
GET /api/users/{user_id}/projects
POST /api/users/{user_id}/projects
```

Corps du POST :

```json
{
  "topic": "Grammaire espagnole",
  "goal": "Passer l'examen B2",
  "timeframe": "6 semaines",
  "daily_minutes": 30,
  "current_problem": "Temps verbaux",
  "active": true
}
```

Réponse (201) :

```json
{
  "id": "p1",
  "user_id": "abc-123",
  "topic": "Grammaire espagnole",
  "goal": "Passer l'examen B2",
  "timeframe": "6 semaines",
  "daily_minutes": 30,
  "current_problem": "Temps verbaux",
  "active": true,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

## Projets (accès direct)

```
GET /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

Corps du PATCH : n'importe quel sous-ensemble de `{topic, goal,
timeframe, daily_minutes, current_problem, active}`. Retourne la
ligne mise à jour.

## Paramètres

```
GET /api/settings/{user_id}
```

Retourne UserSettings avec les champs de clé API **sous forme
booléenne + enums source** (le backend ne renvoie jamais les clés
en clair) :

```json
{
  "id": "s1",
  "user_id": "abc-123",
  "language": "fr",
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

Valeurs `key_source_*` : `env` (variable d'env définie et valeur
différente du yaml), `secrets_yaml` (valeur correspondant au yaml
ou hydratée depuis le yaml via env), `settings` (colonne DB
Fernet), `none`.

```
PATCH /api/settings/{user_id}
```

Corps : n'importe quel sous-ensemble de `{active_provider,
language, model_override_anthropic, model_override_openai,
model_override_gemini}`. Une chaîne vide efface un override ;
omettre un champ le laisse inchangé.

## Clés API

```
POST /api/settings/{user_id}/api-key
```

Corps :

```json
{"provider": "anthropic", "key": "sk-ant-..."}
```

Chiffre avec Fernet et stocke. Retourne UserSettings mis à jour
avec `has_<provider>_key: true`.

```
DELETE /api/settings/{user_id}/api-key/{provider}
```

Efface la clé. Retourne UserSettings mis à jour avec
`has_<provider>_key: false`.

## Curriculum

```
GET /api/users/{user_id}/curricula
POST /api/users/{user_id}/curricula
GET /api/curricula/{curriculum_id}
PATCH /api/curricula/{curriculum_id}
DELETE /api/curricula/{curriculum_id}
```

Corps du POST Curriculum :

```json
{"title": "Espagnol", "description": "Grammaire + vocab", "language": "fr"}
```

```
GET /api/curricula/{curriculum_id}/topics
POST /api/curricula/{curriculum_id}/topics
GET /api/topics/{topic_id}
PATCH /api/topics/{topic_id}
DELETE /api/topics/{topic_id}
```

Corps du POST Topic :

```json
{"title": "Subjonctif", "description": null, "parent_id": null, "order_index": 0}
```

```
GET /api/curricula/{curriculum_id}/lessons
POST /api/curricula/{curriculum_id}/lessons
GET /api/lessons/{lesson_id}
PATCH /api/lessons/{lesson_id}
DELETE /api/lessons/{lesson_id}
```

Corps du POST Lesson :

```json
{"title": "Subjonctif passé", "content": "# Subjonctif passé...", "order_index": 0}
```
