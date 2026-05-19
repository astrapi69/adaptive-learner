# Datenmodelle

Die 14 SQLAlchemy-Models in `backend/app/models/__init__.py`,
mit ihren Wire-Shape-Pydantic-Schemas.

## User

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| name | string | Pflicht |
| email | string \| null | Unique, wenn gesetzt; optional |
| language | string | Standard `"de"` |
| created_at | datetime (ISO 8601) | Auto-gesetzt |
| updated_at | datetime (ISO 8601) | Auto-aktualisiert |

Beziehungen: `projects`, `curriculums`, `profiles`,
`settings` (1:1).

## UserSettings

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| user_id | string (UUID) | FK → User, unique |
| language | string | Standard `"de"` |
| active_provider | enum `AIProvider` | `anthropic` / `openai` / `gemini`, Standard `anthropic` |
| api_key_anthropic | string \| null | Fernet-verschlüsselt; nur Backend |
| api_key_openai | string \| null | Fernet-verschlüsselt; nur Backend |
| api_key_gemini | string \| null | Fernet-verschlüsselt; nur Backend |
| model_override_anthropic | string \| null | Standard `null` (Plugin-Default) |
| model_override_openai | string \| null | Standard `null` |
| model_override_gemini | string \| null | Standard `null` |

Das Wire-Schema (`UserSettingsOut`) ersetzt die drei
`api_key_*`-Felder mit `has_<provider>_key: bool`-Booleans —
Klartext fließt nie zurück zum Client.

## LearningProject

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| user_id | string (UUID) | FK → User |
| topic | string | max 500 Zeichen |
| goal | string | Text, unbegrenzt |
| timeframe | string | max 100 Zeichen |
| daily_minutes | integer | Pflicht |
| current_problem | string \| null | Text, optional |
| active | boolean | Standard `true` |
| created_at | datetime | |
| updated_at | datetime | |

## LearningProfile

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| user_id | string (UUID) | FK → User |
| project_id | string (UUID) | FK → LearningProject |
| deductive | float | 0.0-1.0 |
| inductive | float | 0.0-1.0 |
| error_based | float | 0.0-1.0 |
| dialogic | float | 0.0-1.0 |
| contextual | float | 0.0-1.0 |
| ai_adaptive | float | 0.0-1.0 |
| assessed_at | datetime | |
| version | integer | Bumpt bei Neuauswertung |

Wire-Schema ergänzt `dominant_method` (berechnete Property,
argmax über die 6 Gewichte, alphabetischer Tie-Break).

## LearningSession

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| project_id | string (UUID) | FK → LearningProject |
| method | enum `LearningMethod` | Eine der sechs |
| started_at | datetime | Auto-gesetzt bei Create |
| ended_at | datetime \| null | Bei `/end` gesetzt |
| cycle_step | integer | 1-7, Standard 1 |
| status | enum `SessionStatus` | `active` / `completed` / `abandoned` |

## SessionMessage

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| session_id | string (UUID) | FK → LearningSession |
| role | enum `MessageRole` | `user` / `assistant` / `system` |
| content | string | Text, unbegrenzt |
| created_at | datetime | |

## SessionRating

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| session_id | string (UUID) | FK → LearningSession |
| understanding | integer | 1-5 |
| stress | integer | 1-5 |
| method_fit | integer | 1-5 |
| notes | string \| null | Optional |
| created_at | datetime | |

## SessionNote

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| session_id | string (UUID) | FK → LearningSession |
| content | string | Pflicht |
| created_at | datetime | |

Wird von der v0.7.0-UI noch nicht genutzt; reserviert für ein
Inline-Notizblock-Feature in einer späteren Phase.

## ProgressCommit

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| project_id | string (UUID) | FK → LearningProject |
| session_id | string (UUID) | FK → LearningSession |
| method | enum `LearningMethod` | |
| understanding | float | 0.0-1.0 (skaliert aus 1-5) |
| stress | float | 0.0-1.0 |
| error_rate | float | 0.0-1.0, derzeit immer 0.0 |
| duration_minutes | integer | aus ended_at - started_at berechnet |
| committed_at | datetime | |

Geschrieben vom `on_session_complete`-Hookimpl des Tracking-
Plugins, wenn eine Session mit Bewertung beendet wird.

## StepEvaluation

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| session_id | string (UUID) | FK → LearningSession |
| from_step | integer | Zyklus-Schritt VOR Auswertung |
| to_step | integer | Schritt NACH (= from_step wenn nicht angewendet) |
| advance | boolean | Die KI sagte advance? |
| confidence | float | 0.0-1.0 |
| applied | boolean | Wurde der Vorschlag tatsächlich angewendet? |
| fallback_used | boolean | True genau dann, wenn JSON-Parse fehlschlug |
| reason | string | Menschenlesbare Begründung der KI |
| evaluated_at | datetime | |

## MethodSwitch

| Feld | Typ | Hinweise |
|---|---|---|
| id | string (UUID) | Primary Key |
| project_id | string (UUID) | FK → LearningProject |
| from_method | enum `LearningMethod` | |
| to_method | enum `LearningMethod` | |
| reason | string | Warum der User den Wechsel akzeptierte |
| switched_at | datetime | |

## Curriculum, LearningTopic, Lesson

| Curriculum | Typ | Hinweise |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK |
| title, description, language | string, string\|null, string | |

| LearningTopic | Typ | Hinweise |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| parent_id | UUID \| null | Self-FK für Baum |
| title, description, order_index | | |

| Lesson | Typ | Hinweise |
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

Die Wire-Form ist der lowercase-String-Value (z.B.
`"deductive"`, nicht `"DEDUCTIVE"`).
