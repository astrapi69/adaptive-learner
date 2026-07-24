<!-- Translation: AI-generated, pending native review -->

# AI統合

Adaptive Learnerは、すべての学習会話において1往復あたり最大**3回**のAI呼び出しを行います。ストリーミングレスポンス、ステップ評価器、（ステップ7のみ）トピック遷移評価器です。3つのプロバイダーが標準搭載されており、新しいプロバイダーは`ai_complete*`フックファミリーを通じて追加できます。

## ai_completeフック

```python
# backend/app/hookspecs.py
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """アシスタントのテキストを返します。このプラグインが``model``を処理しない場合はNoneを返します。"""
```

`firstresult=True`は、pluggyが最初のNone以外の戻り値で処理を停止することを意味します。各プロバイダープラグインは`model`のプレフィックスを確認し、そのモデルを所有している場合にアシスタントのテキストを返します。

```python
@hookimpl
def ai_complete(
    self, messages, model, api_key, max_tokens
) -> str | None:
    if not model.startswith("claude-"):
        return None
    # ... Anthropic APIを呼び出し、テキストを返す ...
```

3つのプラグインが同梱されています: `ai-anthropic`（claude-*）、`ai-openai`（gpt-*）、`ai-gemini`（gemini-*）。

## 非同期とストリーミングのバリアント

```python
@hookspec(firstresult=True)
async def ai_complete_async(messages, model, api_key, max_tokens) -> str:
    """待機可能な非同期版。ai_completeと同じ形式。v1.5.0以降。"""

@hookspec(firstresult=True)
def ai_complete_stream(messages, model, api_key, max_tokens):
    """テキストデルタの非同期イテレータを返します。v1.6.0以降。"""
```

`ai_complete_async`は、ステップ6→7のサイクル境界でセッションルートが使用し、ステップ評価とトピック遷移を`asyncio.gather`で同時並行に実行します（`app.yaml`の`async_evaluation: true`）。

`ai_complete_stream`は、`start` / `chunk` / `done`イベントを送出するストリーミングSSEエンドポイント`POST /api/plugins/session/{id}/message/stream`を動作させます。

## プロバイダー選択ロジック（v1.20.0）

セッションルートの`_resolve_active_key()`は`services/settings.resolve_api_key(db, user_id, provider)`を呼び出し、3層チェーンを順に確認します。

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`環境変数。
2. `~/.config/adaptive_learner/secrets.yaml`の`ai.<provider>.api_key`。
3. Fernet復号化済みの`UserSettings.api_key_<provider>`。
4. `None` - UIに`ai_error`を表示します。

`resolve_default_model(db, user_id, provider)`も同じチェーンでモデルオーバーライドを確認します（env > yaml > UIオーバーライド > `DEFAULT_MODELS[provider]`）。

その後、解決済みの値で`ai_complete*`が実行されます。一致するプロバイダーのプラグインがテキストを返し、それ以外はNoneを返します（firstresultは最初のヒットで停止します）。

## デュアルプロンプトアーキテクチャ（v0.5.0）とオートループ（v1.4.0）

`user`ロールの`POST /api/plugins/session/{id}/message`は、最大3回のAI呼び出しを行います。

1. **学習返答** - `ai_complete_stream`経由でストリーミング。システムプロンプトは42セルマトリックスの`build_prompt(project, profile, method, cycle_step, lang)`で構成されます。`max_tokens=1024`。SSEが`start` / `chunk` / `done`イベントを送出します。
2. **ステップ評価器** - 別のシステムプロンプト（`EVALUATION_SYSTEM_PROMPT`）で、AIに交換内容を読み、JSON判定（`advance`、`confidence`、`reason`、`suggested_step`）を出力するよう指示します。`max_tokens=256`。評価器の判定が`cycle_step`の進行を制御します（`confidence ≥ 0.6`が条件）。
3. **トピック遷移** - ステップ7のみ。3回目のAI呼び出しがトピックが統合されたかどうかを判断し、新しいサブトピックで新しいサイクルを開始するかを決定します。セッションごとに最大`max_cycles=5`。

評価器がパースできないJSONを返した場合、決定論的な+1フォールバックが実行され（7を上限）、`fallback_used=True`が記録されます。

サイクル境界（ステップ6→7）では、`asyncio.gather`でステップ評価とトピック遷移が同時実行されます（〜T₂の待ち時間節約）。メッセージレスポンスの`timings`ブロックに返されます（`learning_ms`、`evaluation_ms`、`topic_transition_ms`、`total_ms`、`parallel_saved_ms`）。

## 42セルプロンプトマトリックス

`plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`は、`dict[method, dict[step, dict[lang, str]]]` - 6つのメソッド、7つのステップ、2つの言語、84セルを保持します。各セルは1〜2文でAIの役割とステップのタスクを設定します。コンテキストブロック（「学習プロジェクト: 'X' | 目標: 'Y'. プロファイルヒント: …」）が構成時に追加されます。

Dexieモードでは、プロンプトは`frontend/src/data/session-prompts.json`にそのままエクスポートされ、`frontend/src/storage/prompts.ts`で読み込まれます。同じテキスト、同じコンテキストブロック形式 - ドリフトは発生しません。

## 新しいプロバイダーの追加

1. `plugins/adaptive-learner-plugin-ai-newprovider/`を作成します。
2. `ai_complete`フックimplを実装します: モデルプレフィックスを確認し、プロバイダーのHTTP APIを呼び出し、テキストを返します。
3. `ai_orchestration.py`の`DEFAULT_MODELS`にプロバイダーのプレフィックスと安価なデフォルトモデルを追加します。
4. `app/schemas/__init__.py`の`AIProvider`列挙型にプロバイダー名を追加します。
5. `frontend/src/lib/constants.ts`の`AI_PROVIDERS`に追加します。
6. Dexieモードとの対応のため: `frontend/src/storage/ai-providers.ts`にクライアントを追加し、`aiComplete()`からルーティングします。

各プロバイダープラグインは、そのフックimplとプロバイダー呼び出しを独立してテストします - テンプレートは`plugins/adaptive-learner-plugin-ai-anthropic/tests/`を参照してください（プロバイダーのHTTP呼び出しはモックされています）。

## ブラウザ直接呼び出し（Dexieモード）

Dexieモードでは、AI呼び出しはプラグインシステムを通じません。`storage/ai-providers.ts`が直接HTTPリクエストを行います。AnthropicはCORSプリフライトをクリアするために`anthropic-dangerous-direct-browser-access: true`ヘッダーが必要です。OpenAIとGeminiはブラウザからの直接呼び出しをデフォルトで受け入れます。

デュアルプロンプトのロジックはどちらのモードでも同じです - `storage/session-flow.ts`が`aiComplete()`を2回呼び出し、バックエンドと同じ方法で評価器のJSONを解析します。

## 信頼度のしきい値

`backend/config/app.yaml`の`session.step_evaluation.confidence_threshold`（デフォルト0.6）は、実際の（フォールバックでない）評価器の判定がサイクルステップを実際に進めるかどうかを制御します。より保守的にするには高く設定し、より積極的にするには低く設定します。フォールバック判定（解析失敗）は、しきい値に関わらず常に+1の進行を適用します。

Dexieポートは`storage/session-flow.ts`にハードコードされた0.6でこれを反映しています。将来のフェーズでSettings UIに公開される予定です。

## その他のAI機能（読み取り専用の概要）

いくつかのセッション以外の機能も、同じAIプロバイダープラグインを`ai_complete*`経由で使用します。

- **会話アナライザー**（Phase 12 / v0.9.0以降） - `frontend/src/chat_import/analysis.ts`がインポートされたトランスクリプトを16Kバイト単位で2メッセージのオーバーラップとともにチャンク処理し、チャンクごとに`ai_complete`を実行して結果をマージします。トピック / 弱点 / error_patterns / recommended_method / vocabulary（v1.20.0以降）を抽出します。寛容なJSONパーサーがHaikuクラスの不正な動作（フェンス付き出力、前文の散文）を処理します。
- **Anki抽出**（Phase 30 / v1.17.0） - `plugins/.../anki/card_extraction.py`がセッションや会話からフラッシュカード候補を抽出します。`analysis_result.vocabulary`が入力されている場合、語彙パスはAIなしでクライアントサイドで実行されます。
- **NotebookLM学習質問とガイド**（Phase 32 / v1.19.0） - `plugins/.../notebooklm/question_generator.py` + `study_guide.py`; 寛容なJSONパーサー; ユーザーが編集した質問は再生成をスキップします。
- **発音判定**（Phase 31 / v1.18.0） - `plugins/.../pronunciation.py`がターゲットフレーズを生成し、学習者の音声の類似性を判定します（適格性はLanguagesサブジェクト分類によって制限されます）。
