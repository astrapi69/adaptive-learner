<!-- Translation: AI-generated, pending native review -->

# フックスペック

10個のフックスペックは`backend/app/hookspecs.py`に格納されています。各フックスペックは呼び出し規約を定義します。プラグインは`@hookimpl`で実装します。3つはAIコールのバリアント（sync / async / stream）で、v1.5.0とv1.6.0で段階的に追加されました。残りはv0.2.0以降変わっていません。

## get_assessment_questions

```python
@hookspec
def get_assessment_questions(lang: str) -> list[dict] | None:
    """リクエストされた言語の問題パックを返します。

    実装プラグイン: assessmentプラグイン。
    モード: list（firstresultではない）。ルートは現在最初のプラグインの
    結果を使用します。将来の「複数の問題パック」機能により、プロバイダーが
    名前付きパックを登録できるようになる可能性があります。
    """
```

返却の形式:

```python
[
  {
    "id": "q01",
    "type": "single" | "multi",
    "text": "...",
    "answers": [
      {"id": "a", "text": "...", "weights": {"deductive": 1.0}},
      ...
    ]
  },
  ...
]
```

## calculate_profile

```python
@hookspec(firstresult=True)
def calculate_profile(answers: list[dict]) -> dict[str, float]:
    """生の回答を6メソッドプロファイルに集計します。

    実装プラグイン: assessmentプラグイン。
    firstresult: 正確に1つのプラグインがプロファイルを計算します。
    """
```

入力`answers`の形式:

```python
[
  {"question_id": "q01", "answer_ids": ["a", "b"]},  # multi
  {"question_id": "q02", "answer_id": "c"},          # single
  ...
]
```

返却: 6つのメソッドキーを持つ`dict[method, float]`。

## create_session_prompt

```python
@hookspec(firstresult=True)
def create_session_prompt(
    project: dict,
    profile: dict,
    method: str,
    step: int,
    lang: str,
) -> str:
    """1つの（method, step, lang）セルのシステムプロンプトを構成します。

    実装プラグイン: sessionプラグイン。
    firstresult: 正確に1つのプラグインがプロンプトを構成します。
    """
```

返却: `system`ロールメッセージとして送信する準備ができた文字列。sessionプラグインの実装は42セルの`_PROMPTS`辞書から読み取り、コンテキストブロックを追加します。

## ai_complete

```python
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """AIプロバイダーを呼び出し、アシスタントのテキストを返します。

    実装プラグイン: ai-anthropic、ai-openai、ai-gemini。
    firstresult: マッチするプロバイダープラグインがテキストを返します。
    他はNoneを返します。
    """
```

各プロバイダープラグインは`model`プレフィックス（`claude-*`、`gpt-*`、`gemini-*`）を確認し、そのモデルを所有している場合はアシスタントのテキストを返します。マッチしないプラグインはNoneを返し、firstresultが次のプラグインにフォールスルーします。

`messages`の形式（OpenAIスタイル）:

```python
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."},
  {"role": "user", "content": "..."},
]
```

プロバイダープラグインはこの形式をそれぞれのAPIに正規化します（Anthropicは`system`を分離; Geminiは折り込む）。

## ai_complete_async（v1.5.0+）

```python
@hookspec(firstresult=True)
async def ai_complete_async(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str:
    """ai_completeの非同期バリアント。

    実装プラグイン: ai-anthropic、ai-openai、ai-gemini。
    ステップ6 -> 7のサイクル境界で使用されるため、ステップ評価 +
    トピック遷移がasyncio.gatherで並列に発火します
    （約T_2のレイテンシを節約）。
    """
```

オーケストレーターヘルパー`call_ai_complete_async`はこのフックを優先します。実装されていない場合、`asyncio.to_thread`でラップされた`ai_complete`にフォールバックします。

## ai_complete_stream（v1.6.0+）

```python
@hookspec(firstresult=True)
def ai_complete_stream(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> AsyncIterator[str]:
    """テキストデルタの非同期イテレーターを返します。

    実装プラグイン: ai-anthropic、ai-openai、ai-gemini（各プロバイダー
    SDKのネイティブ非同期ストリーミングを使用）。
    ``POST /api/plugins/session/{id}/message/stream``（SSE: ``start`` /
    ``chunk`` / ``done``イベントを発行）を動作させます。
    """
```

## recommend_method_switch

```python
@hookspec
def recommend_method_switch(
    history: list[dict],
    profile: dict,
) -> dict | None:
    """切り替えの推奨またはNoneを返します。

    実装プラグイン: sessionプラグイン。
    モード: list。プラグインは個別の推奨を返します。
    将来のアービターが最も信頼度の高いnon-Noneを選択します。
    """
```

返却の形式:

```python
{
  "recommended": True,
  "to_method": "dialogic",
  "reason": "Three sessions of stagnant understanding.",
  "confidence": 0.75,  # optional
}
```

切り替えが不要な場合は`None`（または`{"recommended": False}`）を返します。

## on_session_complete

```python
@hookspec
def on_session_complete(
    session: dict,
    rating: dict,
) -> None:
    """副作用フック: セッション終了時に発火します。

    実装プラグイン: trackingプラグイン（ProgressCommitを書き込む）。
    モード: list。各サブスクライバーが実行されます。エラーはキャッチされて
    ログに記録されますが、セッション終了はロールバックされません。
    """
```

このフックのエラーは伝播させてはなりません。`backend/app/main.py`の`_fire_on_session_complete`ラッパーがキャッチしてログに記録します。

## get_progress_summary

```python
@hookspec
def get_progress_summary(
    project_id: str,
    db: Session,
) -> dict | None:
    """進捗サマリーの1つの名前空間スライスを返します。

    実装プラグイン: trackingプラグイン（「tracking」名前空間スライスを返す）。
    モード: list。スライスはルートで浅くマージされます。
    """
```

各プラグインは一意の名前空間でキー付けされた辞書を返します。trackingプラグインは`{"tracking": {...}, "step_evaluation": {...}}`を返します。将来の停滞検出プラグインは`{"stagnation": {...}}`などを返せます。

## get_tool_recommendations

```python
@hookspec
def get_tool_recommendations(
    profile: dict,
    lang: str,
    limit: int = 5,
) -> list[dict] | None:
    """ランク付けされた外部ツール推奨を返します。

    実装プラグイン: toolsプラグイン。
    モード: list。ルートは現在最初のプラグインの結果を使用します。
    将来のマルチソースリコメンダーはマージできます。
    """
```

返却の形式:

```python
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "...",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

## firstresultとlistモード

| フックスペック | モード | 理由 |
|---|---|---|
| get_assessment_questions | list（実質firstresult） | 現在は1パック; 将来は名前付きパックを登録できる |
| calculate_profile | firstresult | 正確に1つのアルゴリズム |
| create_session_prompt | firstresult | 正確に1つのプロンプト構成者 |
| ai_complete | firstresult | マッチするプロバイダーが呼び出しを担う |
| recommend_method_switch | list | 複数のプラグインが提案できる |
| on_session_complete | list | 副作用がファンアウトする |
| get_progress_summary | list | 名前空間スライスがマージされる |
| get_tool_recommendations | list（実質firstresult） | 現在は1ソース |

現在firstresultとして動作しているlistモードは意図的なものです。契約はマルチプラグイン拡張に開かれていますが、v0.7.0の実装では最初のものだけを使用します。
