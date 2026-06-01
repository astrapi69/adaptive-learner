<!-- Translation: AI-generated, pending native review -->

# プラグインエンドポイント

各プラグインのルートは`/api/plugins/{plugin-name}/`以下にマウントされます。

## Assessmentプラグイン

```
GET /api/plugins/assessment/questions?lang=en
```

リクエストされた言語に`text`が解決された12問パックを返します。各回答はメソッドごとの重みを持ちます。

```json
[
  {
    "id": "q01",
    "type": "multi",
    "text": "How do you approach a new topic?",
    "answers": [
      {
        "id": "a",
        "text": "I read the rules and theory first.",
        "weights": {"deductive": 1.0}
      },
      ...
    ]
  },
  ...
]
```

```
POST /api/plugins/assessment/evaluate
```

ボディ:

```json
{
  "project_id": "p1",
  "answers": [
    {"question_id": "q01", "answer_ids": ["a", "b"]},
    {"question_id": "q02", "answer_id": "c"},
    ...
  ]
}
```

単一選択（`answer_id: string`）と複数選択（`answer_ids: string[]`）の両方の形式を受け付けます。作成されたLearningProfileを返します。

```json
{
  "id": "pr1",
  "user_id": "abc-123",
  "project_id": "p1",
  "deductive": 0.4167,
  "inductive": 0.1833,
  "error_based": 0.0833,
  "dialogic": 0.0833,
  "contextual": 0.0833,
  "ai_adaptive": 0.1500,
  "assessed_at": "2026-05-19T12:00:00+00:00",
  "version": 1,
  "dominant_method": "deductive"
}
```

```
GET /api/plugins/assessment/profile/{project_id}
```

プロジェクトの最新のLearningProfileを返します。

## Sessionプラグイン

```
POST /api/plugins/session/start
```

ボディ:

```json
{
  "project_id": "p1",
  "method": "deductive",
  "cycle_step": 1,
  "lang": "en"
}
```

`method`、`cycle_step`、`lang`はオプションです。作成されたセッション + 構成されたシステムプロンプトを返します。

```json
{
  "session": {
    "id": "s1",
    "project_id": "p1",
    "method": "deductive",
    "started_at": "2026-05-19T12:00:00+00:00",
    "ended_at": null,
    "cycle_step": 1,
    "status": "active"
  },
  "system_prompt": "You are a deductive learning companion. ..."
}
```

```
POST /api/plugins/session/{session_id}/message
```

ボディ:

```json
{"role": "user", "content": "I'd like to start with the present tense."}
```

サーバーはユーザーメッセージを保存し、`ai_complete`を発火し、アシスタントの返信を永続化し、ステップ評価器を実行して、複合結果を返します。

```json
{
  "user_message": {"id": "m1", "session_id": "s1", "role": "user", "content": "...", "created_at": "..."},
  "assistant_message": {"id": "m2", "session_id": "s1", "role": "assistant", "content": "...", "created_at": "..."},
  "ai_error": null,
  "session": {"...": "cycle_step進行後のセッション行"},
  "step_evaluation": {
    "advance": true,
    "confidence": 0.85,
    "reason": "Learner clearly grasped the input.",
    "suggested_step": 2,
    "fallback_used": false,
    "applied": true,
    "from_step": 1
  }
}
```

```
POST /api/plugins/session/{session_id}/rate
```

ボディ:

```json
{
  "understanding": 4,
  "stress": 2,
  "method_fit": 5,
  "notes": "Felt productive."
}
```

SessionRating行を永続化します。行を返します。

```
POST /api/plugins/session/{session_id}/end
```

セッションをクローズします。`on_session_complete`を発火します（trackingプラグインがProgressCommitを書き込む）。返却:

```json
{"session": {"...": "status='completed'とended_atが設定されたセッション"}}
```

```
GET /api/plugins/session/switch-recommendation/{session_id}
```

返却:

```json
{"recommended": false, "to_method": null, "reason": null}
```

停滞が検出された場合:

```json
{"recommended": true, "to_method": "dialogic", "reason": "Three sessions of flat understanding + high stress."}
```

```
POST /api/plugins/session/{session_id}/switch
```

ボディ:

```json
{"to_method": "dialogic", "reason": "Felt right."}
```

`session.method`を更新し、MethodSwitch監査行を書き込み、更新されたセッションを返します。

## Trackingプラグイン

```
GET /api/plugins/tracking/progress/{project_id}
```

名前空間化されたサマリーを返します。`tracking`スライスにアグリゲーターの出力が含まれます。

```json
{
  "tracking": {
    "total_sessions": 7,
    "total_minutes": 195,
    "streak_days": 3,
    "sessions_per_method": {"deductive": 4, "inductive": 2, "dialogic": 1},
    "method_distribution": [...],
    "recent_understanding": [0.6, 0.8, 0.8, 0.8, 1.0],
    "recent_stress": [0.4, 0.4, 0.2, 0.2, 0.2],
    "mean_understanding": 0.8,
    "mean_stress": 0.3,
    "recent_sessions": [...]
  },
  "step_evaluation": {
    "total_evaluations": 28,
    "average_confidence": 0.78,
    "advance_count": 21,
    "repeat_count": 5,
    "backward_count": 2,
    "fallback_count": 1,
    "evaluations_per_step": {"1": 7, "2": 6, ...},
    "time_seconds_per_step": {"1": 180.5, ...}
  }
}
```

```
GET /api/plugins/tracking/commits/{project_id}
```

プロジェクトのすべてのProgressCommit行を時系列順に返します。

## Toolsプラグイン

```
GET /api/plugins/tools/recommendations/{project_id}?lang=en
```

プロジェクトのプロファイルへの関連性でランク付けされた5つのカタログツールを返します。

```json
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "Spaced-repetition flashcards - great for cementing rules and error-corrections long-term.",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

```
GET /api/plugins/tools/spaced/{project_id}?lang=en
```

最近性に基づく間隔反復アクションカードを返します。

```json
[
  {
    "id": "sr-deductive-first",
    "method": "deductive",
    "interval_days": 1,
    "action": "session",
    "title": "First practice in deduction.",
    "urgency": 0.5
  },
  ...
]
```

## Sessionプラグイン — ストリーミング + 発音（v1.6.0+、v1.18.0+）

```
POST /api/plugins/session/{id}/message/stream  (SSE)
```

`/message`と同じボディ形式; 3種類のSSEイベントを発行:

- `start` — ペイロード`{user_message}`（ユーザーターンが永続化された）。
- `chunk` — ペイロード`{delta}`（AIプロバイダーのストリームから到着する1つ以上のテキストチャンク）。
- `done` — ペイロードは同期的な`/message`レスポンスと同一: アシスタントメッセージ + cycle_step + タイミング + オプションのサイクル遷移カード。

```
GET  /api/plugins/session/pronunciation/eligibility/{project_id}
POST /api/plugins/session/pronunciation/phrase
POST /api/plugins/session/pronunciation/judge
```

発音の適格性はプロジェクトのサブジェクト分類によってゲートされます（Languages / Sprachenルートを探して祖先をたどる）。judgeエンドポイントは`{matches, score, feedback, missed_sounds}`を返します。

## Gamificationプラグイン（v1.16.0+）

```
GET  /api/plugins/gamification/xp/{user_id}
POST /api/plugins/gamification/xp/{user_id}/award
POST /api/plugins/gamification/xp/{user_id}/award-assessment
POST /api/plugins/gamification/xp/{user_id}/award-import
GET  /api/plugins/gamification/badges
GET  /api/plugins/gamification/badges/{user_id}
POST /api/plugins/gamification/badges/{user_id}/evaluate
GET  /api/plugins/gamification/streak/{user_id}
GET  /api/plugins/gamification/streak/{user_id}/heatmap
POST /api/plugins/gamification/streak/{user_id}/weekend-mode
POST /api/plugins/gamification/reset/{user_id}
```

`/streak/{user_id}/heatmap`は直近365日の`[{date, count}, ...]`を返します（[7, 730]にクランプ）。リセットエンドポイントはダブル確認後に`user_xp` + `user_badges` + `user_streaks`行を消去します。

## Ankiプラグイン（v1.17.0+）

```
GET    /api/plugins/anki/cards/{user_id}
POST   /api/plugins/anki/cards
PATCH  /api/plugins/anki/cards/{id}
DELETE /api/plugins/anki/cards/{id}
POST   /api/plugins/anki/cards/extract/session/{id}
POST   /api/plugins/anki/cards/extract/conversation/{id}
POST   /api/plugins/anki/cards/mark-exported
```

AI抽出はユーザーが起動します。会話抽出パスは`analysis_result.vocabulary`も読み取り（v1.20.0以降）、分析がすでに語彙配列を入力している場合は追加のAIコールなしでクローズカードを生成します。

## NotebookLMプラグイン（v1.19.0+）

```
GET    /api/plugins/notebooklm/questions/{user_id}
POST   /api/plugins/notebooklm/questions
PATCH  /api/plugins/notebooklm/questions/{id}
DELETE /api/plugins/notebooklm/questions/{id}
POST   /api/plugins/notebooklm/generate-from-session/{id}
POST   /api/plugins/notebooklm/generate-from-project/{id}
POST   /api/plugins/notebooklm/study-guide/{project_id}
```

`/study-guide/{project_id}`は`text/markdown`を返します（コンテンツを約30K文字にクリッピングする大きなAIコール1回）。ユーザーの編集は`edited=True`にフリップし、AI再実行がそれらをスキップします。

## プラグインディスカバリー

```
GET /api/plugins/manifests
GET /api/plugins/health
GET /api/plugins/errors
```

各エンドポイントはプラグイン名でキー付けされたマップを返します。Settings > Plugins UIのアクティベーション状態 + ロードエラーの可視化に使用されます。
