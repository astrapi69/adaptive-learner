<!-- Translation: AI-generated, pending native review -->

# アーキテクチャ

Adaptive Learnerは4層のプラグイン駆動型アプリケーションです。

```
┌─────────────────────────────────────────────────────────────┐
│ フロントエンド     React 19 + TypeScript 6 + Vite 8 +       │
│                    Vitest 4 + Dexie 4 (IndexedDB) + TipTap  │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ /api/*
┌─────────────────────────────────────────────────────────────┐
│ バックエンド       FastAPI ^0.136 + SQLAlchemy ^2.0 +       │
│                    Pydantic v2 + Alembic + Fernet           │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ hookspecs
┌─────────────────────────────────────────────────────────────┐
│ PluginForge        ^0.10.0 (外部PyPI; target_applicationに  │
│                    よるアイデンティティゲート)              │
└─────────────────────────────────────────────────────────────┘
                            ↑↓ entry_points
┌─────────────────────────────────────────────────────────────┐
│ プラグイン         plugins/配下の10パッケージ               │
│                    (ai-{anthropic,openai,gemini}, assessment,│
│                    session, tracking, tools, gamification,  │
│                    anki, notebooklm)                        │
└─────────────────────────────────────────────────────────────┘
```

新機能は**常にプラグインに属します**。ただし、コアに触れるもの（ユーザー / プロジェクト / 設定 / カリキュラム / トピック / レッスン / バックアップ / 同期 / システム / インポート）は除きます。

## デュアルストレージ（v0.7.0）

フロントエンドには、バッキングストアを選択する単一の接合点があります: `getStorage(): IStorageService`。2つの実装が1つのコントラクトを満たします。

- **`apiStorage`**（デフォルト）: FastAPIバックエンドと通信する`api/client.ts`の薄いラッパー。
- **`dexieStorage`**（ローカルファースト）: 25のSQLAlchemyモデルをすべてミラーリングする完全なIndexedDBスタック。AI呼び出しは`storage/ai-providers.ts`経由でブラウザから直接実行されます。

`IStorageService`は22個の名前空間を公開します（users、projects、settings、assessment、ストリーミング付きsession、tracking、tools、curricula、topics、lessons、plugins、system、backup、export、subjects、tags、projectTaxonomy、imports、gamification、anki、pronunciation、notebooklm）。両方のバッキングがすべてのメソッドを実装しています。

ファクトリーは`localStorage["adaptive-learner.storage_mode"]`、次に`VITE_STORAGE_MODE`（GH PagesビルドによってセットされるもM）、最後にデフォルトの`api`の順で読み取ります。モードの切り替えはライブスワップではありません: Settingsページが選択を保存し、再読み込みが必要である旨のトーストを表示します。

## 3層シークレット（v1.20.0 / Phase 34）

```
env変数           > secrets.yaml         > Fernet DBカラム
ADAPTIVE_LEARNER_*    ~/.config/...yaml      api_key_<provider>
```

すべてのAI呼び出しは`services/settings.resolve_api_key`経由でチェーンを確認します。

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`環境変数。
2. `~/.config/adaptive_learner/secrets.yaml`の`ai.<provider>.api_key`。
3. Fernet復号化済みDBカラム。
4. `None` - AI呼び出しがUIにエラーを表示します。

ソースの帰属は`UserSettingsOut.key_source_*`（列挙型: `env` / `secrets_yaml` / `settings` / `none`）に記録されます。ソースがenvまたはsecrets_yamlの場合、Settings UIはSave / Removeを無効にします。

同じチェーンがプロバイダーごとの`default_model`オーバーライドにも適用されます。Phase 34の設計では`secrets.yaml`がUIオーバーライドより優先されます（パワーユーザー向けにファイル設定がUIより優先されます）。

## プラグイン構造

```
plugins/adaptive-learner-plugin-<name>/
  adaptive_learner_<name>/
    plugin.py     # <Name>Plugin(BasePlugin)、フックの実装
    routes.py     # FastAPIルーター（サービス関数に委譲）
    <module>.py   # ビジネスロジック
  tests/
    test_*.py     # pytestテスト
  pyproject.toml  # エントリーポイント: [project.entry-points."adaptive_learner.plugins"]
```

- プラグインクラスは`BasePlugin`（pluginforge）を継承します。
- ビジネスロジックは独自のモジュールに置き、routes.pyには置きません。
- routes.pyには委譲するFastAPIエンドポイントのみを含みます。
- フックスペックは`backend/app/hookspecs.py`に記述します。
- プラグインの依存関係はクラス属性として: `depends_on = ["session"]`。
- すべてのプラグインは無料（MIT）。ライセンスインフラは存在しますが休止中（`LICENSING_ENABLED = False`）。

## フック（`backend/app/hookspecs.py`の8スペック）

| フック | タイミング | ファーストリザルト? |
|---|---|---|
| `get_assessment_questions(lang)` | 評価ページ読み込み | yes |
| `calculate_profile(answers)` | 評価送信 | yes |
| `create_session_prompt(...)` | 各チャットターン | yes |
| `ai_complete(messages, model, api_key, max_tokens)` | 標準AI呼び出し | yes（プロバイダーはモデルプレフィックスでルーティング） |
| `ai_complete_async(...)` | 並列サイクル境界評価（v1.5.0） | yes |
| `ai_complete_stream(...)` | ストリーミングセッション返答（v1.6.0） | yes |
| `recommend_method_switch(...)` | ダッシュボード + セッション | yes |
| `on_session_complete(session, rating)` | セッション終了 | broadcast |
| `get_progress_summary(project_id)` | ダッシュボードウィジェット | broadcast |
| `get_tool_recommendations(profile, lang)` | ダッシュボードツール | broadcast |

## データフロー

```
UI (React) → IStorageService
            → （APIモード）FastAPIルーター → サービス → SQLAlchemy → SQLite
            → （Dexieモード）Dexieテーブル → IndexedDB
            ↓
            AIオーケストレーター → resolve_api_key (env > yaml > DB)
                            → pluginforge → プロバイダープラグインのai_complete*
                            → Anthropic / OpenAI / Gemini SDK
```

一方向です。ルーターからDBに直接アクセスしません（サービスがSQLAlchemyの作業を担います）。バックエンドにフロントエンドのコードはありません。

## エラー処理

```
フロントエンド       ApiError (status + detail) → ユーザーへのトースト
APIクライアント      HTTPエラー → ApiErrorに変換
ルーター             薄い層で何もキャッチしない。グローバル例外ハンドラーがマッピング。
サービス             AdaptiveLearnerErrorのサブクラスをスロー
プラグイン           PluginError(plugin_name, message)をスロー
外部                ExternalServiceError(service, message)でプロバイダーSDKを扱う
```

サービスは`HTTPException`を**絶対にスローしません**; ルーターは何も**キャッチしません**。`main.py`のグローバル例外ハンドラーがドメインエラーをHTTPステータスコードにマッピングします。完全なパターンは`.claude/rules/code-hygiene.md`を参照してください。

## 永続化

- バックエンド: SQLAlchemy + SQLite。Alembicマイグレーションは`backend/migrations/versions/`。
- 同期サーフェス: 28テーブル（v1.19.0ベースライン）。追記専用の履歴行（sessions、messages、ratings、progress commits、step evaluations、method switches、imported conversations、imported messages、anki cards、study questions）とミュータブルな設定+カリキュラム行。
- バックアップ形式: JSON; APIキーはエクスポート時に除去; リストアはマージ。
- テスト分離: 本番データディレクトリには`.adaptive-learner-production`マーカーがあり、テストがそれを検出した場合、`pytest.exit(returncode=2)`で実行が中断されます。

## テーマ

5テーマ（Classic、Cool Modern、Nord、Notebook、Studio）× ライト/ダーク = 10バリアント。全体的にCSS変数を使用し、Tailwindは使用しません。カスタムプロパティは`frontend/src/styles/global.css`に記述します。新しいUI要素は変数セットを**必ず**使用してください。

## モバイル / PWA

`@media (max-width: 768px)`が正規のモバイル切り替え点（ハンバーガードロワー、44×44タッチターゲット、スタックレイアウト）です。`@media (max-width: 360px)`は極狭画面のセーフネットです。デスクトップスタイル（≥769px）は変更なし。

サービスワーカー（Workbox via vite-plugin-pwa）: GET `/api/`にNetworkFirstで4秒タイムアウト、24時間LRU、60エントリ上限。`/api/`へのミューテーションはNetworkOnlyです。
