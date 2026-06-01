<!-- Translation: AI-generated, pending native review -->

# Veri modelleri

`backend/app/models/__init__.py` içindeki **25 SQLAlchemy modeli**,
Pydantic şemalarıyla tel şekilleriyle birlikte. Eşitleme yüzeyi
28 tablo içerir (25 model + 3 ilişki tablosu: `project_subjects`,
`project_tags`, `user_badges`).

v0.7.0'dan itibaren olan ilk 14 model aşağıda ayrıntılı olarak
belgelenmiştir; o tarihten bu yana eklenen 11 tanesi (Aşama 12+
içe aktarmalar, Aşama 22 konular/etiketler, Aşama 29-30 oyunlaştırma
+ anki, Aşama 32 notebooklm) en altta ad + tablo olarak listelenmiştir.
Her modelin tam alanı için `/api/openapi.json` adresindeki OpenAPI
spesifikasyonuna bakın.

## User

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| name | string | Gerekli |
| email | string \| null | Ayarlandığında benzersiz, isteğe bağlı |
| language | string | Varsayılan `"de"` |
| created_at | datetime (ISO 8601) | Otomatik ayarlanır |
| updated_at | datetime (ISO 8601) | Otomatik güncellenir |

İlişkiler: `projects`, `curriculums`, `profiles`,
`settings` (1:1).

## UserSettings

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| user_id | string (UUID) | FK → User, benzersiz |
| language | string | Varsayılan `"de"` |
| active_provider | enum `AIProvider` | `anthropic` / `openai` / `gemini`, varsayılan `anthropic` |
| api_key_anthropic | string \| null | Fernet şifreli; yalnızca arka uç |
| api_key_openai | string \| null | Fernet şifreli; yalnızca arka uç |
| api_key_gemini | string \| null | Fernet şifreli; yalnızca arka uç |
| model_override_anthropic | string \| null | Varsayılan `null` (eklenti varsayılanını kullan) |
| model_override_openai | string \| null | Varsayılan `null` |
| model_override_gemini | string \| null | Varsayılan `null` |

Tel şema (`UserSettingsOut`), üç `api_key_*` alanını
`has_<provider>_key: bool` boolean'larıyla değiştirir —
düz metin hiçbir zaman istemciye geri gitmez. v1.20.0 / Aşama 34'ten
itibaren, tel şema ayrıca çözümleyicinin hangi katmanı seçtiğini
bildiren `key_source_<provider>: ApiKeySource` enum'unu taşır
(enum: `env | secrets_yaml | settings | none`).

## LearningProject

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| user_id | string (UUID) | FK → User |
| topic | string | Maks 500 karakter |
| goal | string | Metin, sınırsız |
| timeframe | string | Maks 100 karakter |
| daily_minutes | integer | Gerekli |
| current_problem | string \| null | Metin, isteğe bağlı |
| active | boolean | Varsayılan `true` |
| created_at | datetime | |
| updated_at | datetime | |

## LearningProfile

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| user_id | string (UUID) | FK → User |
| project_id | string (UUID) | FK → LearningProject |
| deductive | float | 0.0-1.0 |
| inductive | float | 0.0-1.0 |
| error_based | float | 0.0-1.0 |
| dialogic | float | 0.0-1.0 |
| contextual | float | 0.0-1.0 |
| ai_adaptive | float | 0.0-1.0 |
| assessed_at | datetime | |
| version | integer | Yeniden değerlendirmede artar |

Tel şema, `dominant_method` ekler (hesaplanmış özellik, 6 ağırlık
üzerinde argmax, alfabetik bağ kırma).

## LearningSession

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| project_id | string (UUID) | FK → LearningProject |
| method | enum `LearningMethod` | Altısından biri |
| started_at | datetime | Oluşturmada otomatik ayarlanır |
| ended_at | datetime \| null | `/end`'de ayarlanır |
| cycle_step | integer | 1-7, varsayılan 1 |
| status | enum `SessionStatus` | `active` / `completed` / `abandoned` |

## SessionMessage

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| session_id | string (UUID) | FK → LearningSession |
| role | enum `MessageRole` | `user` / `assistant` / `system` |
| content | string | Metin, sınırsız |
| created_at | datetime | |

## SessionRating

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| session_id | string (UUID) | FK → LearningSession |
| understanding | integer | 1-5 |
| stress | integer | 1-5 |
| method_fit | integer | 1-5 |
| notes | string \| null | İsteğe bağlı |
| created_at | datetime | |

## SessionNote

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| session_id | string (UUID) | FK → LearningSession |
| content | string | Gerekli |
| created_at | datetime | |

v0.7.0 arayüzü tarafından şu anda kullanılmıyor; gelecekteki
bir aşamada satır içi not defteri özelliği için ayrılmış.

## ProgressCommit

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| project_id | string (UUID) | FK → LearningProject |
| session_id | string (UUID) | FK → LearningSession |
| method | enum `LearningMethod` | |
| understanding | float | 0.0-1.0 (1-5'ten yeniden ölçeklendirilmiş) |
| stress | float | 0.0-1.0 |
| error_rate | float | 0.0-1.0, şu anda her zaman 0.0 |
| duration_minutes | integer | ended_at - started_at'dan hesaplanır |
| committed_at | datetime | |

Bir oturum puanlamayla sonlandırıldığında takip eklentisinin
`on_session_complete` hookimpl'i tarafından yazılır.

## StepEvaluation

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| session_id | string (UUID) | FK → LearningSession |
| from_step | integer | Değerlendirmeden ÖNCE döngü adımı |
| to_step | integer | Değerlendirmeden SONRA (uygulanmadıysa = from_step) |
| advance | boolean | AI ilerlemeyi söyledi mi? |
| confidence | float | 0.0-1.0 |
| applied | boolean | Öneri gerçekten uygulandı mı? |
| fallback_used | boolean | JSON ayrıştırması başarısız olursa True |
| reason | string | AI'nin insan tarafından okunabilir açıklaması |
| evaluated_at | datetime | |

## MethodSwitch

| Alan | Tür | Notlar |
|---|---|---|
| id | string (UUID) | Birincil anahtar |
| project_id | string (UUID) | FK → LearningProject |
| from_method | enum `LearningMethod` | |
| to_method | enum `LearningMethod` | |
| reason | string | Kullanıcının geçişi neden kabul ettiği |
| switched_at | datetime | |

## Curriculum, LearningTopic, Lesson

| Curriculum | Tür | Notlar |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK |
| title, description, language | string, string\|null, string | |

| LearningTopic | Tür | Notlar |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| parent_id | UUID \| null | Ağaç için öz-FK |
| title, description, order_index | | |

| Lesson | Tür | Notlar |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| title, content, order_index | | |

## Enum'lar

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

# v1.20.0 / Aşama 34'ten itibaren
class ApiKeySource(str, Enum):
    ENV = "env"
    SECRETS_YAML = "secrets_yaml"
    SETTINGS = "settings"
    NONE = "none"

# v0.9.0 / Aşama 12'den itibaren
class ImportedConversationSource(str, Enum):
    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    GEMINI = "gemini"
    MANUAL = "manual"
    UNKNOWN = "unknown"
```

Tel formu, küçük harf dize değeridir (örn. `"deductive"`,
`"DEDUCTIVE"` değil).

## v0.7.0 temelinden bu yana eklenen modeller (11)

| Model | Tablo | Sürümden itibaren | Amaç |
|---|---|---|---|
| ImportedConversation | imported_conversations | v0.9.0 | İçe aktarılan tek bir sohbet (kaynak, başlık, analysis_result JSON) |
| ImportedMessage | imported_messages | v0.9.0 | İçe aktarılan sohbette tek bir dönüş |
| Subject | subjects | v1.9.0 | Global hiyerarşik taksonomi düğümü |
| Tag | tags | v1.9.0 | Kullanıcı başına serbest metin etiketi |
| ProjectSubject | project_subjects | v1.9.0 | M:N (LearningProject, Subject) |
| ProjectTag | project_tags | v1.9.0 | M:N (LearningProject, Tag) |
| UserXP | user_xp | v1.16.0 | Kullanıcı başına XP + seviye tekil |
| Badge | badges | v1.16.0 | Rozet kataloğu (YAML'dan tohumlanmış) |
| UserBadge | user_badges | v1.16.0 | Kazanılmış rozet kaydı (yalnızca ekleme) |
| UserStreak | user_streaks | v1.16.0 | Seri durumu + dondurma + hafta sonu modu |
| AnkiCardSuggestion | anki_card_suggestions | v1.17.0 | AI tarafından çıkarılan kart adayı |
| StudyQuestion | study_questions | v1.19.0 | AI tarafından oluşturulan etkin hatırlama sorusu |
