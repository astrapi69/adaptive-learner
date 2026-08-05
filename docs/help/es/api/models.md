# Modelos de datos

Los **25 modelos SQLAlchemy** en
`backend/app/models/__init__.py`, con sus esquemas Pydantic en formato
wire. La superficie de sincronización incluye 28 tablas (los 25
modelos + 3 tablas de asociación: `project_subjects`,
`project_tags`, `user_badges`).

Los 14 modelos originales de v0.7.0 se documentan en detalle a
continuación; los 11 añadidos desde entonces (imports de la Fase 12+,
materias/etiquetas de la Fase 22, gamificación + anki de las Fases
29-30, notebooklm de la Fase 32) se listan al final por nombre +
tabla. Consulta la especificación OpenAPI en `/openapi.json` para
todos los campos de cada modelo.

## User

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| name | string | Obligatorio |
| email | string \| null | Único cuando se establece, opcional |
| language | string | Por defecto `"de"` |
| created_at | datetime (ISO 8601) | Asignado automáticamente |
| updated_at | datetime (ISO 8601) | Actualizado automáticamente |

Relaciones: `projects`, `curriculums`, `profiles`,
`settings` (1:1).

## UserSettings

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| user_id | string (UUID) | FK → User, único |
| language | string | Por defecto `"de"` |
| active_provider | enum `AIProvider` | `anthropic` / `openai` / `gemini`, por defecto `anthropic` |
| api_key_anthropic | string \| null | Cifrado con Fernet; solo backend |
| api_key_openai | string \| null | Cifrado con Fernet; solo backend |
| api_key_gemini | string \| null | Cifrado con Fernet; solo backend |
| model_override_anthropic | string \| null | Por defecto `null` (usa el por defecto del plugin) |
| model_override_openai | string \| null | Por defecto `null` |
| model_override_gemini | string \| null | Por defecto `null` |

El esquema wire (`UserSettingsOut`) reemplaza los tres campos
`api_key_*` con booleanos `has_<provider>_key: bool`:
el texto plano nunca viaja de vuelta al cliente. Desde v1.20.0 /
Fase 34, el esquema wire también lleva
`key_source_<provider>: ApiKeySource` (enum:
`env | secrets_yaml | settings | none`) que indica qué capa
eligió el resolvedor.

## LearningProject

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| user_id | string (UUID) | FK → User |
| topic | string | Máx. 500 caracteres |
| goal | string | Texto, ilimitado |
| timeframe | string | Máx. 100 caracteres |
| daily_minutes | integer | Obligatorio |
| current_problem | string \| null | Texto, opcional |
| active | boolean | Por defecto `true` |
| created_at | datetime | |
| updated_at | datetime | |

## LearningProfile

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| user_id | string (UUID) | FK → User |
| project_id | string (UUID) | FK → LearningProject |
| deductive | float | 0.0-1.0 |
| inductive | float | 0.0-1.0 |
| error_based | float | 0.0-1.0 |
| dialogic | float | 0.0-1.0 |
| contextual | float | 0.0-1.0 |
| ai_adaptive | float | 0.0-1.0 |
| assessed_at | datetime | |
| version | integer | Se incrementa al revaluar |

El esquema wire añade `dominant_method` (propiedad calculada,
argmax sobre los 6 pesos, desempate alfabético).

## LearningSession

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| project_id | string (UUID) | FK → LearningProject |
| method | enum `LearningMethod` | Uno de los seis |
| started_at | datetime | Asignado automáticamente al crear |
| ended_at | datetime \| null | Se establece en `/end` |
| cycle_step | integer | 1-7, por defecto 1 |
| status | enum `SessionStatus` | `active` / `completed` / `abandoned` |

## SessionMessage

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| session_id | string (UUID) | FK → LearningSession |
| role | enum `MessageRole` | `user` / `assistant` / `system` |
| content | string | Texto, ilimitado |
| created_at | datetime | |

## SessionRating

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| session_id | string (UUID) | FK → LearningSession |
| understanding | integer | 1-5 |
| stress | integer | 1-5 |
| method_fit | integer | 1-5 |
| notes | string \| null | Opcional |
| created_at | datetime | |

## SessionNote

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| session_id | string (UUID) | FK → LearningSession |
| content | string | Obligatorio |
| created_at | datetime | |

No utilizado por la UI de v0.7.0; reservado para una función de
bloc de notas integrado en una fase futura.

## ProgressCommit

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| project_id | string (UUID) | FK → LearningProject |
| session_id | string (UUID) | FK → LearningSession |
| method | enum `LearningMethod` | |
| understanding | float | 0.0-1.0 (reescalado desde 1-5) |
| stress | float | 0.0-1.0 |
| error_rate | float | 0.0-1.0, actualmente siempre 0.0 |
| duration_minutes | integer | Calculado desde ended_at - started_at |
| committed_at | datetime | |

Escrito por el hookimpl `on_session_complete` del plugin de
seguimiento cuando se finaliza una sesión con valoración.

## StepEvaluation

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| session_id | string (UUID) | FK → LearningSession |
| from_step | integer | Paso del ciclo ANTES de la evaluación |
| to_step | integer | Paso del ciclo DESPUÉS (= from_step si no se aplicó) |
| advance | boolean | ¿Dijo la IA que avanzara? |
| confidence | float | 0.0-1.0 |
| applied | boolean | ¿Se aplicó realmente la sugerencia? |
| fallback_used | boolean | True si el análisis JSON falló |
| reason | string | Explicación legible por humanos de la IA |
| evaluated_at | datetime | |

## MethodSwitch

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Clave primaria |
| project_id | string (UUID) | FK → LearningProject |
| from_method | enum `LearningMethod` | |
| to_method | enum `LearningMethod` | |
| reason | string | Por qué el usuario aceptó el cambio |
| switched_at | datetime | |

## Curriculum, LearningTopic, Lesson

| Curriculum | Tipo | Notas |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK |
| title, description, language | string, string\|null, string | |

| LearningTopic | Tipo | Notas |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| parent_id | UUID \| null | Auto-FK para árbol |
| title, description, order_index | | |

| Lesson | Tipo | Notas |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| title, content, order_index | | |

## Enums

```python
class LearningMethod(str, Enum):
    DEDUCTIVE = "deductive"
    INDUCTIVE = "inductive"
    ERROR_BASED = "error_based"
    DIALOGIC = "dialogic"
    CONTEXTUAL = "contextual"
    AI_ADAPTIVE = "ai_adaptive"

class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class AIProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GEMINI = "gemini"

# Desde v1.20.0 / Fase 34
class ApiKeySource(str, Enum):
    ENV = "env"
    SECRETS_YAML = "secrets_yaml"
    SETTINGS = "settings"
    NONE = "none"

# Desde v0.9.0 / Fase 12
class ImportedConversationSource(str, Enum):
    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    GEMINI = "gemini"
    MANUAL = "manual"
    UNKNOWN = "unknown"
```

La forma wire es el valor de cadena en minúsculas (p. ej.
`"deductive"`, no `"DEDUCTIVE"`).

## Modelos añadidos desde el punto de referencia v0.7.0 (11)

| Modelo | Tabla | Desde | Propósito |
|---|---|---|---|
| ImportedConversation | imported_conversations | v0.9.0 | Un chat importado (fuente, título, analysis_result JSON) |
| ImportedMessage | imported_messages | v0.9.0 | Un turno en un chat importado |
| Subject | subjects | v1.9.0 | Nodo de taxonomía jerárquica global |
| Tag | tags | v1.9.0 | Etiqueta de texto libre por usuario |
| ProjectSubject | project_subjects | v1.9.0 | M:N (LearningProject, Subject) |
| ProjectTag | project_tags | v1.9.0 | M:N (LearningProject, Tag) |
| UserXP | user_xp | v1.16.0 | XP + nivel singleton por usuario |
| Badge | badges | v1.16.0 | Catálogo de insignias (sembrado desde YAML) |
| UserBadge | user_badges | v1.16.0 | Registro de insignia ganada (solo acumulación) |
| UserStreak | user_streaks | v1.16.0 | Estado de racha + pausas + modo fin de semana |
| AnkiCardSuggestion | anki_card_suggestions | v1.17.0 | Candidato a tarjeta extraída con IA |
| StudyQuestion | study_questions | v1.19.0 | Pregunta de recuerdo activo generada con IA |
