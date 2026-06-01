<!-- Translation: AI-generated, pending native review -->

# コアエンドポイント

プラグインによって登録されないエンドポイント: ユーザー、プロジェクト、設定、i18n、ヘルス。

## ヘルス

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

## i18nカタログ

```
GET /api/i18n/{lang}
```

リクエストされた言語の完全なネストされたカタログを返します。`{lang}`が登録されていない場合はENにフォールバックします。

```json
{
  "common": {"save": "Save", "cancel": "Cancel"},
  "settings": {"title": "Settings", "section_language": "Language", ...},
  ...
}
```

## ユーザー

```
POST /api/users
```

ボディ:

```json
{"name": "Asterios", "email": "ar@example.com", "language": "de"}
```

レスポンス (201):

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

ユーザーを返します。見つからない場合は404。

```
PATCH /api/users/{user_id}
```

ボディ: `{name, email, language}`の任意のサブセット。更新された行を返します。

## プロジェクト（ユーザースコープ）

```
GET /api/users/{user_id}/projects
POST /api/users/{user_id}/projects
```

POSTボディ:

```json
{
  "topic": "Spanish grammar",
  "goal": "Pass B2 exam",
  "timeframe": "6 weeks",
  "daily_minutes": 30,
  "current_problem": "Tenses",
  "active": true
}
```

レスポンス (201):

```json
{
  "id": "p1",
  "user_id": "abc-123",
  "topic": "Spanish grammar",
  "goal": "Pass B2 exam",
  "timeframe": "6 weeks",
  "daily_minutes": 30,
  "current_problem": "Tenses",
  "active": true,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

## プロジェクト（直接）

```
GET /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

PATCHボディ: `{topic, goal, timeframe, daily_minutes, current_problem, active}`の任意のサブセット。更新された行を返します。

## 設定

```
GET /api/settings/{user_id}
```

APIキーフィールドを**ブール値 + ソース列挙型**として含むUserSettingsを返します（バックエンドは平文のキーを返しません）。

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

`key_source_*`の値: `env`（環境変数が設定されておりyamlと値が異なる）、`secrets_yaml`（yamlと一致するか、envがyamlから補完）、`settings`（Fernet DBカラム）、`none`。

```
PATCH /api/settings/{user_id}
```

ボディ: `{active_provider, language, model_override_anthropic, model_override_openai, model_override_gemini}`の任意のサブセット。空文字列はオーバーライドをクリアします。フィールドを省略するとそのまま保持されます。

## APIキー

```
POST /api/settings/{user_id}/api-key
```

ボディ:

```json
{"provider": "anthropic", "key": "sk-ant-..."}
```

Fernetで暗号化して保存します。`has_<provider>_key: true`を含む更新されたUserSettingsを返します。

```
DELETE /api/settings/{user_id}/api-key/{provider}
```

キーをクリアします。`has_<provider>_key: false`を含む更新されたUserSettingsを返します。

## カリキュラム

```
GET /api/users/{user_id}/curricula
POST /api/users/{user_id}/curricula
GET /api/curricula/{curriculum_id}
PATCH /api/curricula/{curriculum_id}
DELETE /api/curricula/{curriculum_id}
```

カリキュラムのPOSTボディ:

```json
{"title": "Spanish", "description": "Grammar + vocab", "language": "de"}
```

```
GET /api/curricula/{curriculum_id}/topics
POST /api/curricula/{curriculum_id}/topics
GET /api/topics/{topic_id}
PATCH /api/topics/{topic_id}
DELETE /api/topics/{topic_id}
```

トピックのPOSTボディ:

```json
{"title": "Subjunctive", "description": null, "parent_id": null, "order_index": 0}
```

```
GET /api/curricula/{curriculum_id}/lessons
POST /api/curricula/{curriculum_id}/lessons
GET /api/lessons/{lesson_id}
PATCH /api/lessons/{lesson_id}
DELETE /api/lessons/{lesson_id}
```

レッスンのPOSTボディ:

```json
{"title": "Past subjunctive", "content": "# Past subjunctive...", "order_index": 0}
```
