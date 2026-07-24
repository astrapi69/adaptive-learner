<!-- Translation: AI-generated, pending native review -->

# プラグインの作成

プラグインはコアに手を加えることなくAdaptiveLearnerを拡張します。プラグインシステムは[PluginForge](https://github.com/astrapi69/pluginforge)（[pluggy](https://pluggy.readthedocs.io/)のラッパー）を使用します。各プラグインはエントリーポイントを介して登録された独立したPoetryパッケージです。

このチュートリアルでは、ルートを追加して1つのフックをリッスンする「hello-world」プラグインの作成を説明します。

## 1. ディレクトリのスキャフォールディング

```bash
mkdir -p plugins/adaptive-learner-plugin-hello/adaptive_learner_hello
mkdir -p plugins/adaptive-learner-plugin-hello/tests
cd plugins/adaptive-learner-plugin-hello
```

## 2. pyproject.toml

```toml
[tool.poetry]
name = "adaptive-learner-plugin-hello"
version = "1.0.0"
description = "Adaptive Learner: hello-worldプラグイン"
authors = ["Your Name"]
license = "MIT"

[tool.poetry.dependencies]
python = "^3.11"
pluginforge = "^0.10.0"
fastapi = "^0.136.0"

[project.entry-points."adaptive_learner.plugins"]
hello = "adaptive_learner_hello.plugin:HelloPlugin"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

エントリーポイント名（ここでは`hello`）はプラグインレジストリがプラグインを追跡するために使用します。クラスパス（`adaptive_learner_hello.plugin:HelloPlugin`）はプラグインクラスへのPythonインポートパスです。

## 3. plugin.py

```python
from pluginforge import BasePlugin, hookimpl
from typing import Any

class HelloPlugin(BasePlugin):
    name = "hello"
    version = "1.0.0"
    # pluginforge ^0.10.0のアイデンティティゲーティング。
    # ホストのPluginManager（``app_id="adaptive_learner"``を渡す）が
    # プラグインをこのアプリ向けとして認識できるよう、
    # これを"adaptive_learner"に設定します。v0.9.0の変更でこれが
    # ハードフィルターになりました - これのないプラグインは
    # 発見時に拒否されます。
    target_application = "adaptive_learner"
    depends_on: list[str] = []

    @hookimpl
    def on_session_complete(
        self, session: dict[str, Any], rating: dict[str, Any]
    ) -> None:
        print(f"Hello! セッション {session['id']} が終了しました。")
```

`BasePlugin`はPluginForgeのベースクラスです。`@hookimpl`デコレーターは、`backend/app/hookspecs.py`で指定されたフックを実装するメソッドをマークします。

## 4. routes.py

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api/plugins/hello", tags=["hello"])

@router.get("/greet")
def greet() -> dict:
    return {"message": "helloプラグインからこんにちは!"}
```

## 5. plugin.pyでルートを登録する

```python
from fastapi import FastAPI
from .routes import router

class HelloPlugin(BasePlugin):
    ...

    def mount_routes(self, app: FastAPI) -> None:
        app.include_router(router)
```

プラグインマネージャーは、`mount_routes()`を定義するすべてのプラグインに対して、コアアプリが初期化された後に`mount_routes()`を呼び出します。

## 6. テスト

```python
# tests/test_plugin.py
from adaptive_learner_hello.plugin import HelloPlugin

def test_hello_plugin_has_name():
    plugin = HelloPlugin()
    assert plugin.name == "hello"
```

## 7. インストール + アクティベート

`backend/pyproject.toml`にプラグインをパス依存関係として追加します:

```toml
[tool.poetry.dependencies]
...
adaptive-learner-plugin-hello = {path = "../plugins/adaptive-learner-plugin-hello", develop = true}
```

次に:

```bash
cd backend && poetry lock && poetry install
make dev
curl http://localhost:18001/api/plugins/hello/greet
```

## 10のフックスペック

すべてのフック仕様は`backend/app/hookspecs.py`にあります:

1. `get_assessment_questions(lang: str)` - 質問パックを返します。
2. `calculate_profile(answers: list)` - メソッドの重みを計算します（firstresult）。
3. `create_session_prompt(...)` - システムプロンプトを構成します（firstresult）。
4. `ai_complete(messages, model, api_key, max_tokens)` - AIを同期的に呼び出します（firstresult、プロバイダーはモデルプレフィックスでルーティング）。
5. `ai_complete_async(...)` - 並列サイクル境界評価のための非同期バリアント（v1.5.0以降、firstresult）。
6. `ai_complete_stream(...)` - SSE経由でテキストデルタを生成するストリーミングバリアント（v1.6.0以降、firstresult）。
7. `recommend_method_switch(history, profile)` - 切り替えの推奨またはNoneを返します。
8. `on_session_complete(session, rating)` - ブロードキャストの副作用; ゲーミフィケーション + トラッキングがリッスン。
9. `get_progress_summary(project_id, db)` - ダッシュボードサマリーの1つの名前空間スライスを返します。
10. `get_tool_recommendations(profile, lang)` - ランク付けされたツールを返します。

[フックスペックリファレンス全文](../api/hooks.md)

## firstresultセマンティクス

`firstresult=True`でマークされたフックは、Non-None値を返す最初のプラグインで停止します。「ちょうど1つのプラグインがこれを処理すべき」というケースに有用です - `ai_complete`のように、一致するプロバイダーのプラグインがテキストを返し、他はNoneを返します。

`firstresult=True`のないフックはすべてのプラグインで実行されます（リストモード）。呼び出し元は結果のリストを受け取り、何をするか（マージ、優先、など）を決定します。
