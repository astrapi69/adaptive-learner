<!-- Translation: AI-generated, pending native review -->

# Modelos de dados

Os **25 modelos SQLAlchemy** em
`backend/app/models/__init__.py`, com os seus esquemas
Pydantic na forma de transferência. A superfície de
sincronização inclui 28 tabelas (os 25 modelos + 3 tabelas
de associação: `project_subjects`, `project_tags`,
`user_badges`).

Os 14 modelos originais do v0.7.0 estão documentados em
detalhe abaixo; os 11 adicionados desde então (importações
Phase 12+, assuntos/etiquetas Phase 22, gamificação + anki
Phase 29-30, notebooklm Phase 32) são listados no final por
nome + tabela. Consulte a especificação OpenAPI em
`/api/openapi.json` para todos os campos de todos os
modelos.

## User

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| name | string | Obrigatório |
| email | string \| null | Único quando definido, opcional |
| language | string | Padrão `"de"` |
| created_at | datetime (ISO 8601) | Definido automaticamente |
| updated_at | datetime (ISO 8601) | Atualizado automaticamente |

Relações: `projects`, `curriculums`, `profiles`,
`settings` (1:1).

## UserSettings

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| user_id | string (UUID) | FK → User, único |
| language | string | Padrão `"de"` |
| active_provider | enum `AIProvider` | `anthropic` / `openai` / `gemini`, padrão `anthropic` |
| api_key_anthropic | string \| null | Encriptado com Fernet; apenas backend |
| api_key_openai | string \| null | Encriptado com Fernet; apenas backend |
| api_key_gemini | string \| null | Encriptado com Fernet; apenas backend |
| model_override_anthropic | string \| null | Padrão `null` (usar padrão do plugin) |
| model_override_openai | string \| null | Padrão `null` |
| model_override_gemini | string \| null | Padrão `null` |

O esquema de transferência (`UserSettingsOut`) substitui os
três campos `api_key_*` por booleanos `has_<provider>_key:
bool` - texto simples nunca viaja de volta ao cliente.
Desde v1.20.0 / Phase 34, o esquema de transferência também
transporta `key_source_<provider>: ApiKeySource` (enum:
`env | secrets_yaml | settings | none`) que indica qual
camada o resolvedor escolheu.

## LearningProject

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| user_id | string (UUID) | FK → User |
| topic | string | Máx. 500 caracteres |
| goal | string | Texto, ilimitado |
| timeframe | string | Máx. 100 caracteres |
| daily_minutes | integer | Obrigatório |
| current_problem | string \| null | Texto, opcional |
| active | boolean | Padrão `true` |
| created_at | datetime | |
| updated_at | datetime | |

## LearningProfile

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| user_id | string (UUID) | FK → User |
| project_id | string (UUID) | FK → LearningProject |
| deductive | float | 0.0-1.0 |
| inductive | float | 0.0-1.0 |
| error_based | float | 0.0-1.0 |
| dialogic | float | 0.0-1.0 |
| contextual | float | 0.0-1.0 |
| ai_adaptive | float | 0.0-1.0 |
| assessed_at | datetime | |
| version | integer | Incrementa na reavaliação |

O esquema de transferência adiciona `dominant_method`
(propriedade calculada, argmax sobre os 6 pesos,
desempate alfabético).

## LearningSession

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| project_id | string (UUID) | FK → LearningProject |
| method | enum `LearningMethod` | Um dos seis |
| started_at | datetime | Definido automaticamente na criação |
| ended_at | datetime \| null | Definido em `/end` |
| cycle_step | integer | 1-7, padrão 1 |
| status | enum `SessionStatus` | `active` / `completed` / `abandoned` |

## SessionMessage

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| session_id | string (UUID) | FK → LearningSession |
| role | enum `MessageRole` | `user` / `assistant` / `system` |
| content | string | Texto, ilimitado |
| created_at | datetime | |

## SessionRating

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| session_id | string (UUID) | FK → LearningSession |
| understanding | integer | 1-5 |
| stress | integer | 1-5 |
| method_fit | integer | 1-5 |
| notes | string \| null | Opcional |
| created_at | datetime | |

## SessionNote

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| session_id | string (UUID) | FK → LearningSession |
| content | string | Obrigatório |
| created_at | datetime | |

Atualmente não utilizado pela interface do v0.7.0; reservado
para uma funcionalidade de bloco de notas incorporado numa
fase futura.

## ProgressCommit

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| project_id | string (UUID) | FK → LearningProject |
| session_id | string (UUID) | FK → LearningSession |
| method | enum `LearningMethod` | |
| understanding | float | 0.0-1.0 (reescalado de 1-5) |
| stress | float | 0.0-1.0 |
| error_rate | float | 0.0-1.0, atualmente sempre 0.0 |
| duration_minutes | integer | Calculado a partir de ended_at - started_at |
| committed_at | datetime | |

Escrito pelo hookimpl `on_session_complete` do plugin tracking
quando uma sessão é encerrada com uma classificação.

## StepEvaluation

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| session_id | string (UUID) | FK → LearningSession |
| from_step | integer | Passo do ciclo ANTES da avaliação |
| to_step | integer | Passo do ciclo APÓS (= from_step se não aplicado) |
| advance | boolean | A IA disse para avançar? |
| confidence | float | 0.0-1.0 |
| applied | boolean | A sugestão foi realmente aplicada? |
| fallback_used | boolean | True se a análise JSON falhou |
| reason | string | Explicação legível da IA |
| evaluated_at | datetime | |

## MethodSwitch

| Campo | Tipo | Notas |
|---|---|---|
| id | string (UUID) | Chave primária |
| project_id | string (UUID) | FK → LearningProject |
| from_method | enum `LearningMethod` | |
| to_method | enum `LearningMethod` | |
| reason | string | Porque o utilizador aceitou a mudança |
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
| parent_id | UUID \| null | Auto-FK para árvore |
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

# Desde v1.20.0 / Phase 34
class ApiKeySource(str, Enum):
    ENV = "env"
    SECRETS_YAML = "secrets_yaml"
    SETTINGS = "settings"
    NONE = "none"

# Desde v0.9.0 / Phase 12
class ImportedConversationSource(str, Enum):
    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    GEMINI = "gemini"
    MANUAL = "manual"
    UNKNOWN = "unknown"
```

A forma de transferência é o valor de string em minúsculas
(por exemplo, `"deductive"`, não `"DEDUCTIVE"`).

## Modelos adicionados desde a linha de base v0.7.0 (11)

| Modelo | Tabela | Desde | Finalidade |
|---|---|---|---|
| ImportedConversation | imported_conversations | v0.9.0 | Uma conversa importada (fonte, título, JSON analysis_result) |
| ImportedMessage | imported_messages | v0.9.0 | Um turno numa conversa importada |
| Subject | subjects | v1.9.0 | Nó de taxonomia hierárquica global |
| Tag | tags | v1.9.0 | Etiqueta de texto livre por utilizador |
| ProjectSubject | project_subjects | v1.9.0 | M:N (LearningProject, Subject) |
| ProjectTag | project_tags | v1.9.0 | M:N (LearningProject, Tag) |
| UserXP | user_xp | v1.16.0 | XP + nível singleton por utilizador |
| Badge | badges | v1.16.0 | Catálogo de emblemas (semeado a partir de YAML) |
| UserBadge | user_badges | v1.16.0 | Registo de emblema obtido (apenas anexar) |
| UserStreak | user_streaks | v1.16.0 | Estado de sequência + congelamentos + modo fim de semana |
| AnkiCardSuggestion | anki_card_suggestions | v1.17.0 | Candidato a cartão de flashcard extraído por IA |
| StudyQuestion | study_questions | v1.19.0 | Pergunta de recordação ativa gerada por IA |
