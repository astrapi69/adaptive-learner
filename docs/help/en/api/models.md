# Data models

The 14 SQLAlchemy models in `backend/app/models/__init__.py`,
with their wire-shape Pydantic schemas.

## User

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| name | string | Required |
| email | string \| null | Unique when set, optional |
| language | string | Default `"de"` |
| created_at | datetime (ISO 8601) | Auto-set |
| updated_at | datetime (ISO 8601) | Auto-updated |

Relationships: `projects`, `curriculums`, `profiles`,
`settings` (1:1).

## UserSettings

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| user_id | string (UUID) | FK → User, unique |
| language | string | Default `"de"` |
| active_provider | enum `AIProvider` | `anthropic` / `openai` / `gemini`, default `anthropic` |
| api_key_anthropic | string \| null | Fernet-encrypted; backend-only |
| api_key_openai | string \| null | Fernet-encrypted; backend-only |
| api_key_gemini | string \| null | Fernet-encrypted; backend-only |
| model_override_anthropic | string \| null | Default `null` (use plugin default) |
| model_override_openai | string \| null | Default `null` |
| model_override_gemini | string \| null | Default `null` |

The wire schema (`UserSettingsOut`) replaces the three
`api_key_*` fields with `has_<provider>_key: bool` booleans —
cleartext never travels back to the client.

## LearningProject

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| user_id | string (UUID) | FK → User |
| topic | string | Max 500 chars |
| goal | string | Text, unlimited |
| timeframe | string | Max 100 chars |
| daily_minutes | integer | Required |
| current_problem | string \| null | Text, optional |
| active | boolean | Default `true` |
| created_at | datetime | |
| updated_at | datetime | |

## LearningProfile

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| user_id | string (UUID) | FK → User |
| project_id | string (UUID) | FK → LearningProject |
| deductive | float | 0.0-1.0 |
| inductive | float | 0.0-1.0 |
| error_based | float | 0.0-1.0 |
| dialogic | float | 0.0-1.0 |
| contextual | float | 0.0-1.0 |
| ai_adaptive | float | 0.0-1.0 |
| assessed_at | datetime | |
| version | integer | Bumps on re-evaluate |

Wire schema adds `dominant_method` (computed property, argmax
over the 6 weights, alphabetical tie-break).

## LearningSession

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| project_id | string (UUID) | FK → LearningProject |
| method | enum `LearningMethod` | One of the six |
| started_at | datetime | Auto-set on create |
| ended_at | datetime \| null | Set on `/end` |
| cycle_step | integer | 1-7, default 1 |
| status | enum `SessionStatus` | `active` / `completed` / `abandoned` |

## SessionMessage

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| session_id | string (UUID) | FK → LearningSession |
| role | enum `MessageRole` | `user` / `assistant` / `system` |
| content | string | Text, unlimited |
| created_at | datetime | |

## SessionRating

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| session_id | string (UUID) | FK → LearningSession |
| understanding | integer | 1-5 |
| stress | integer | 1-5 |
| method_fit | integer | 1-5 |
| notes | string \| null | Optional |
| created_at | datetime | |

## SessionNote

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| session_id | string (UUID) | FK → LearningSession |
| content | string | Required |
| created_at | datetime | |

Currently unused by the v0.7.0 UI; reserved for an inline
notepad feature in a future phase.

## ProgressCommit

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| project_id | string (UUID) | FK → LearningProject |
| session_id | string (UUID) | FK → LearningSession |
| method | enum `LearningMethod` | |
| understanding | float | 0.0-1.0 (rescaled from 1-5) |
| stress | float | 0.0-1.0 |
| error_rate | float | 0.0-1.0, currently always 0.0 |
| duration_minutes | integer | Computed from ended_at - started_at |
| committed_at | datetime | |

Written by the tracking plugin's `on_session_complete` hookimpl
when a session is ended with a rating.

## StepEvaluation

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| session_id | string (UUID) | FK → LearningSession |
| from_step | integer | Cycle step BEFORE evaluation |
| to_step | integer | Cycle step AFTER (= from_step if not applied) |
| advance | boolean | The AI said advance? |
| confidence | float | 0.0-1.0 |
| applied | boolean | Was the suggestion actually applied? |
| fallback_used | boolean | True iff JSON parse failed |
| reason | string | AI's human-readable explanation |
| evaluated_at | datetime | |

## MethodSwitch

| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | Primary key |
| project_id | string (UUID) | FK → LearningProject |
| from_method | enum `LearningMethod` | |
| to_method | enum `LearningMethod` | |
| reason | string | Why the user accepted the switch |
| switched_at | datetime | |

## Curriculum, LearningTopic, Lesson

| Curriculum | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK |
| title, description, language | string, string\|null, string | |

| LearningTopic | Type | Notes |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| parent_id | UUID \| null | Self-FK for tree |
| title, description, order_index | | |

| Lesson | Type | Notes |
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
```

The wire form is the lowercase string value (e.g.
`"deductive"`, not `"DEDUCTIVE"`).
