# Modèles de données

Les **25 modèles SQLAlchemy** dans
`backend/app/models/__init__.py`, avec leurs schémas Pydantic
correspondants pour la communication réseau. La surface de
synchronisation comprend 28 tables (les 25 modèles + 3 tables
d'association : `project_subjects`, `project_tags`, `user_badges`).

Les 14 modèles d'origine issus de v0.7.0 sont documentés en
détail ci-dessous ; les 11 ajoutés depuis (imports Phase 12,
sujets/tags Phase 22, gamification + anki Phases 29-30,
notebooklm Phase 32) sont listés à la fin par nom + table. Voir
la spec OpenAPI sur `/api/openapi.json` pour chaque champ de
chaque modèle.

## User

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| name | string | Requis |
| email | string \| null | Unique si défini, optionnel |
| language | string | Défaut `"fr"` |
| created_at | datetime (ISO 8601) | Défini automatiquement |
| updated_at | datetime (ISO 8601) | Mis à jour automatiquement |

Relations : `projects`, `curriculums`, `profiles`,
`settings` (1:1).

## UserSettings

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| user_id | string (UUID) | FK → User, unique |
| language | string | Défaut `"fr"` |
| active_provider | enum `AIProvider` | `anthropic` / `openai` / `gemini`, défaut `anthropic` |
| api_key_anthropic | string \| null | Chiffré Fernet ; backend uniquement |
| api_key_openai | string \| null | Chiffré Fernet ; backend uniquement |
| api_key_gemini | string \| null | Chiffré Fernet ; backend uniquement |
| model_override_anthropic | string \| null | Défaut `null` (utilise le défaut du plugin) |
| model_override_openai | string \| null | Défaut `null` |
| model_override_gemini | string \| null | Défaut `null` |

Le schéma réseau (`UserSettingsOut`) remplace les trois champs
`api_key_*` par des booléens `has_<provider>_key: bool` - le
texte clair ne revient jamais vers le client. Depuis v1.20.0 /
Phase 34, le schéma réseau porte également
`key_source_<provider>: ApiKeySource` (enum :
`env | secrets_yaml | settings | none`) indiquant quelle couche
le résolveur a choisie.

## LearningProject

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| user_id | string (UUID) | FK → User |
| topic | string | Max 500 caractères |
| goal | string | Texte, illimité |
| timeframe | string | Max 100 caractères |
| daily_minutes | integer | Requis |
| current_problem | string \| null | Texte, optionnel |
| active | boolean | Défaut `true` |
| created_at | datetime | |
| updated_at | datetime | |

## LearningProfile

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| user_id | string (UUID) | FK → User |
| project_id | string (UUID) | FK → LearningProject |
| deductive | float | 0.0-1.0 |
| inductive | float | 0.0-1.0 |
| error_based | float | 0.0-1.0 |
| dialogic | float | 0.0-1.0 |
| contextual | float | 0.0-1.0 |
| ai_adaptive | float | 0.0-1.0 |
| assessed_at | datetime | |
| version | integer | Incrémenté à chaque réévaluation |

Le schéma réseau ajoute `dominant_method` (propriété calculée,
argmax sur les 6 poids, tri alphabétique en cas d'égalité).

## LearningSession

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| project_id | string (UUID) | FK → LearningProject |
| method | enum `LearningMethod` | Une des six méthodes |
| started_at | datetime | Défini automatiquement à la création |
| ended_at | datetime \| null | Défini à `/end` |
| cycle_step | integer | 1-7, défaut 1 |
| status | enum `SessionStatus` | `active` / `completed` / `abandoned` |

## SessionMessage

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| session_id | string (UUID) | FK → LearningSession |
| role | enum `MessageRole` | `user` / `assistant` / `system` |
| content | string | Texte, illimité |
| created_at | datetime | |

## SessionRating

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| session_id | string (UUID) | FK → LearningSession |
| understanding | integer | 1-5 |
| stress | integer | 1-5 |
| method_fit | integer | 1-5 |
| notes | string \| null | Optionnel |
| created_at | datetime | |

## SessionNote

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| session_id | string (UUID) | FK → LearningSession |
| content | string | Requis |
| created_at | datetime | |

Actuellement inutilisé par l'interface v0.7.0 ; réservé pour une
fonctionnalité de bloc-notes intégré dans une future phase.

## ProgressCommit

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| project_id | string (UUID) | FK → LearningProject |
| session_id | string (UUID) | FK → LearningSession |
| method | enum `LearningMethod` | |
| understanding | float | 0.0-1.0 (remis à l'échelle depuis 1-5) |
| stress | float | 0.0-1.0 |
| error_rate | float | 0.0-1.0, actuellement toujours 0.0 |
| duration_minutes | integer | Calculé depuis ended_at - started_at |
| committed_at | datetime | |

Écrit par le `on_session_complete` hookimpl du plugin tracking
quand une session est terminée avec une note.

## StepEvaluation

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| session_id | string (UUID) | FK → LearningSession |
| from_step | integer | Étape du cycle AVANT évaluation |
| to_step | integer | Étape du cycle APRÈS (= from_step si non appliqué) |
| advance | boolean | L'IA a dit d'avancer ? |
| confidence | float | 0.0-1.0 |
| applied | boolean | La suggestion a-t-elle été appliquée ? |
| fallback_used | boolean | True si l'analyse JSON a échoué |
| reason | string | Explication lisible de l'IA |
| evaluated_at | datetime | |

## MethodSwitch

| Champ | Type | Notes |
|---|---|---|
| id | string (UUID) | Clé primaire |
| project_id | string (UUID) | FK → LearningProject |
| from_method | enum `LearningMethod` | |
| to_method | enum `LearningMethod` | |
| reason | string | Pourquoi l'utilisateur a accepté le changement |
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
| parent_id | UUID \| null | Auto-FK pour l'arborescence |
| title, description, order_index | | |

| Lesson | Type | Notes |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| title, content, order_index | | |

## Énumérations

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

# Depuis v1.20.0 / Phase 34
class ApiKeySource(str, Enum):
    ENV = "env"
    SECRETS_YAML = "secrets_yaml"
    SETTINGS = "settings"
    NONE = "none"

# Depuis v0.9.0 / Phase 12
class ImportedConversationSource(str, Enum):
    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    GEMINI = "gemini"
    MANUAL = "manual"
    UNKNOWN = "unknown"
```

La forme réseau est la valeur string en minuscules (ex.
`"deductive"`, pas `"DEDUCTIVE"`).

## Modèles ajoutés depuis la base v0.7.0 (11)

| Modèle | Table | Depuis | Rôle |
|---|---|---|---|
| ImportedConversation | imported_conversations | v0.9.0 | Un chat importé (source, titre, JSON analysis_result) |
| ImportedMessage | imported_messages | v0.9.0 | Un tour dans un chat importé |
| Subject | subjects | v1.9.0 | Nœud de taxonomie hiérarchique global |
| Tag | tags | v1.9.0 | Étiquette libre par utilisateur |
| ProjectSubject | project_subjects | v1.9.0 | M:N (LearningProject, Subject) |
| ProjectTag | project_tags | v1.9.0 | M:N (LearningProject, Tag) |
| UserXP | user_xp | v1.16.0 | Singleton XP + niveau par utilisateur |
| Badge | badges | v1.16.0 | Catalogue de badges (initialisé depuis YAML) |
| UserBadge | user_badges | v1.16.0 | Enregistrement de badge obtenu (append-only) |
| UserStreak | user_streaks | v1.16.0 | État de série + gels + mode week-end |
| AnkiCardSuggestion | anki_card_suggestions | v1.17.0 | Candidat de flashcard extrait par IA |
| StudyQuestion | study_questions | v1.19.0 | Question de rappel actif générée par IA |
