<!-- Translation: AI-generated, pending native review -->

# データモデル

`backend/app/models/__init__.py`内の**25個のSQLAlchemyモデル**と、それらのワイヤーシェイプのPydanticスキーマ。同期サーフェスには28個のテーブルが含まれます（25モデル + 3つの関連テーブル: `project_subjects`、`project_tags`、`user_badges`）。

v0.7.0の元の14モデルは以下で詳しく説明します。それ以降に追加された11モデル（Phase 12+のインポート、Phase 22のサブジェクト/タグ、Phase 29-30のゲーミフィケーション + anki、Phase 32のnotebooklm）は下部に名前 + テーブルで一覧表示されています。すべてのモデルのすべてのフィールドについては`/openapi.json`のOpenAPIスペックを参照してください。

## User

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| name | string | 必須 |
| email | string \| null | 設定時は一意、オプション |
| language | string | デフォルト`"de"` |
| created_at | datetime（ISO 8601） | 自動設定 |
| updated_at | datetime（ISO 8601） | 自動更新 |

リレーションシップ: `projects`、`curriculums`、`profiles`、`settings`（1:1）。

## UserSettings

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| user_id | string（UUID） | FK → User、一意 |
| language | string | デフォルト`"de"` |
| active_provider | enum `AIProvider` | `anthropic` / `openai` / `gemini`、デフォルト`anthropic` |
| api_key_anthropic | string \| null | Fernet暗号化; バックエンドのみ |
| api_key_openai | string \| null | Fernet暗号化; バックエンドのみ |
| api_key_gemini | string \| null | Fernet暗号化; バックエンドのみ |
| model_override_anthropic | string \| null | デフォルト`null`（プラグインデフォルトを使用） |
| model_override_openai | string \| null | デフォルト`null` |
| model_override_gemini | string \| null | デフォルト`null` |

ワイヤースキーマ（`UserSettingsOut`）は3つの`api_key_*`フィールドを`has_<provider>_key: bool`ブール値に置き換えます。平文はクライアントに送信されません。v1.20.0 / Phase 34以降、ワイヤースキーマには`key_source_<provider>: ApiKeySource`（列挙型: `env | secrets_yaml | settings | none`）も含まれており、リゾルバーが選択したレイヤーを報告します。

## LearningProject

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| user_id | string（UUID） | FK → User |
| topic | string | 最大500文字 |
| goal | string | テキスト、無制限 |
| timeframe | string | 最大100文字 |
| daily_minutes | integer | 必須 |
| current_problem | string \| null | テキスト、オプション |
| active | boolean | デフォルト`true` |
| created_at | datetime | |
| updated_at | datetime | |

## LearningProfile

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| user_id | string（UUID） | FK → User |
| project_id | string（UUID） | FK → LearningProject |
| deductive | float | 0.0-1.0 |
| inductive | float | 0.0-1.0 |
| error_based | float | 0.0-1.0 |
| dialogic | float | 0.0-1.0 |
| contextual | float | 0.0-1.0 |
| ai_adaptive | float | 0.0-1.0 |
| assessed_at | datetime | |
| version | integer | 再評価時にバンプ |

ワイヤースキーマは`dominant_method`（6つの重みのargmax、アルファベット順タイブレーク、計算プロパティ）を追加します。

## LearningSession

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| project_id | string（UUID） | FK → LearningProject |
| method | enum `LearningMethod` | 6つのうちの1つ |
| started_at | datetime | 作成時に自動設定 |
| ended_at | datetime \| null | `/end`で設定 |
| cycle_step | integer | 1-7、デフォルト1 |
| status | enum `SessionStatus` | `active` / `completed` / `abandoned` |

## SessionMessage

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| session_id | string（UUID） | FK → LearningSession |
| role | enum `MessageRole` | `user` / `assistant` / `system` |
| content | string | テキスト、無制限 |
| created_at | datetime | |

## SessionRating

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| session_id | string（UUID） | FK → LearningSession |
| understanding | integer | 1-5 |
| stress | integer | 1-5 |
| method_fit | integer | 1-5 |
| notes | string \| null | オプション |
| created_at | datetime | |

## SessionNote

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| session_id | string（UUID） | FK → LearningSession |
| content | string | 必須 |
| created_at | datetime | |

現在v0.7.0のUIでは未使用; 将来フェーズのインラインメモ帳機能のために予約。

## ProgressCommit

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| project_id | string（UUID） | FK → LearningProject |
| session_id | string（UUID） | FK → LearningSession |
| method | enum `LearningMethod` | |
| understanding | float | 0.0-1.0（1-5からリスケール） |
| stress | float | 0.0-1.0 |
| error_rate | float | 0.0-1.0、現在は常に0.0 |
| duration_minutes | integer | ended_at - started_atから計算 |
| committed_at | datetime | |

trackingプラグインの`on_session_complete`フックimplがセッションがレーティング付きで終了した際に書き込みます。

## StepEvaluation

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| session_id | string（UUID） | FK → LearningSession |
| from_step | integer | 評価前のサイクルステップ |
| to_step | integer | 評価後（適用されない場合はfrom_stepと同じ） |
| advance | boolean | AIが進む必要があると言ったか？ |
| confidence | float | 0.0-1.0 |
| applied | boolean | 提案は実際に適用されたか？ |
| fallback_used | boolean | JSONパースが失敗した場合はTrue |
| reason | string | AIの人間が読める説明 |
| evaluated_at | datetime | |

## MethodSwitch

| フィールド | 型 | 備考 |
|---|---|---|
| id | string（UUID） | 主キー |
| project_id | string（UUID） | FK → LearningProject |
| from_method | enum `LearningMethod` | |
| to_method | enum `LearningMethod` | |
| reason | string | ユーザーが切り替えを受け入れた理由 |
| switched_at | datetime | |

## Curriculum、LearningTopic、Lesson

| Curriculum | 型 | 備考 |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK |
| title, description, language | string, string\|null, string | |

| LearningTopic | 型 | 備考 |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| parent_id | UUID \| null | ツリーのための自己FK |
| title, description, order_index | | |

| Lesson | 型 | 備考 |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| title, content, order_index | | |

## 列挙型

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

# v1.20.0 / Phase 34以降
class ApiKeySource(str, Enum):
    ENV = "env"
    SECRETS_YAML = "secrets_yaml"
    SETTINGS = "settings"
    NONE = "none"

# v0.9.0 / Phase 12以降
class ImportedConversationSource(str, Enum):
    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    GEMINI = "gemini"
    MANUAL = "manual"
    UNKNOWN = "unknown"
```

ワイヤーフォームは小文字の文字列値です（例: `"deductive"`、`"DEDUCTIVE"`ではない）。

## v0.7.0ベースライン以降に追加されたモデル（11個）

| モデル | テーブル | バージョン | 目的 |
|---|---|---|---|
| ImportedConversation | imported_conversations | v0.9.0 | インポートされたチャット1件（ソース、タイトル、analysis_result JSON） |
| ImportedMessage | imported_messages | v0.9.0 | インポートされたチャットの1ターン |
| Subject | subjects | v1.9.0 | グローバル階層分類ノード |
| Tag | tags | v1.9.0 | ユーザーごとのフリーテキストラベル |
| ProjectSubject | project_subjects | v1.9.0 | M:N（LearningProject、Subject） |
| ProjectTag | project_tags | v1.9.0 | M:N（LearningProject、Tag） |
| UserXP | user_xp | v1.16.0 | ユーザーごとのXP + レベルシングルトン |
| Badge | badges | v1.16.0 | バッジカタログ（YAMLからシード） |
| UserBadge | user_badges | v1.16.0 | 獲得バッジレコード（追加のみ） |
| UserStreak | user_streaks | v1.16.0 | ストリーク状態 + フリーズ + 週末モード |
| AnkiCardSuggestion | anki_card_suggestions | v1.17.0 | AI抽出フラッシュカード候補 |
| StudyQuestion | study_questions | v1.19.0 | AI生成アクティブリコール問題 |
