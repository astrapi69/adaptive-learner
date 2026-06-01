<!-- Translation: AI-generated, pending native review -->

# API概要

AdaptiveLearnerのバックエンドはFastAPI REST APIを公開しています。サーバーモードではフロントエンドがそれと通信し、ローカル（Dexie）モードではAPIに到達できません。同じ操作がブラウザ内で実行されます。

## ベースURL

- **ローカル開発**: `http://localhost:18001/api`
- **Docker本番環境**: デプロイメントごとに設定（例: `https://yourdomain.com/api`）
- **GH Pages**: 該当なし（Dexieモード）

フロントエンドはビルド時に`VITE_API_BASE`からベースURLを解決します。デフォルトは`/api`で、Vite開発サーバーのプロキシが透過的に転送します。

## 認証

v1.20.0にはリクエストごとの認証はありません。システムはブラウザごとのシングルユーザーです。`user_id`は`localStorage`に格納され、URLパス（`/users/{user_id}/...`）で渡されます。

AIプロバイダーキーは3層のチェーンを通じて解決されます（`services.settings.resolve_api_key`）。

1. `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`環境変数。
2. `~/.config/adaptive_learner/secrets.yaml`内の`ai.<provider>.api_key`。
3. Fernet暗号化された`UserSettings.api_key_<provider>`カラム（Settings UIで設定; 平文でフロントエンドに返されることはない）。
4. `None` — AIコールはUIにエラーを表示します。

`UserSettingsOut.key_source_*`（列挙型`env | secrets_yaml | settings | none`）は、Settings UIのソースバッジのために、プロバイダーごとにアクティブキーを解決したレイヤーを報告します。

将来のマルチユーザー / マルチテナントフェーズで認証が追加されます。現在は、ネットワークに公開する場合、デプロイメントは独自の認証レイヤー（HTTPベーシック認証を持つリバースプロキシ、Tailscale、VPNなど）の背後に配置する必要があります。

## レスポンス形式

成功したレスポンスはエンベロープなしでデータオブジェクトを直接返します。

```json
{
  "id": "abc-123",
  "topic": "Spanish grammar",
  "active": true
}
```

リストはJSON配列を返します。

```json
[
  {"id": "p1", "topic": "Spanish"},
  {"id": "p2", "topic": "Calculus"}
]
```

HTTPステータスコード:

| コード | 意味 |
|---|---|
| 200 | OK（読み取り） |
| 201 | Created（POST） |
| 204 | No Content（DELETE） |
| 400 | バリデーションエラー（Pydantic） |
| 404 | Not found |
| 409 | Conflict（まれ） |
| 422 | Pydanticバリデーションエラー（FastAPIデフォルト） |
| 500 | サーバーエラー |
| 502 | 外部サービス到達不能（AIプロバイダー） |

## エラー形式

エラーは単一の`detail`フィールドを返します。

```json
{"detail": "Project abc-123 not found"}
```

Pydanticバリデーションエラーは構造化されたリストを返します。

```json
{
  "detail": [
    {"loc": ["body", "daily_minutes"], "msg": "value is not a valid integer", "type": "type_error.integer"}
  ]
}
```

デバッグモード（`ADAPTIVE_LEARNER_DEBUG=true`）では、レスポンスに`traceback`フィールドも含まれます。本番環境ではデバッグをオフのままにしてください。

フロントエンドの`ApiError`クラスは両方の形式を消費します。正確なパーサーについては`frontend/src/api/client.ts`を参照してください。

## エンドポイントグループ

| グループ | プレフィックス | 機能 |
|---|---|---|
| Health + i18n | `/health`, `/i18n/{lang}` | アプリのヘルス + UI文字列 |
| Users | `/users` | ユーザーCRUD + ネストされたプロジェクト |
| Projects | `/projects` | プロジェクトスコープの読み取り / 更新 |
| Settings | `/settings/{user_id}` | UserSettings + APIキー + key_source + 利用可能なモデル |
| System | `/system/info` | バージョン、パス、依存関係のバージョン |
| Backup | `/backup/export`, `/backup/import`, `/backup/stats` | JSONスナップショット + 復元 |
| Export | `/export/{progress,session,curriculum}` | MD + PDFレポート |
| Sync | `/sync/...` | プッシュ、プル、解決、ペアリング |
| Imports | `/users/{user_id}/imports` | チャット履歴インポート + アナライザー |
| Subjects + tags | `/subjects`, `/users/{id}/tags`, `/projects/{id}/{subjects,tags}` | グローバル分類 + ユーザーごとのタグ |
| Assessment plugin | `/plugins/assessment/...` | 問題、評価、プロファイル |
| Session plugin | `/plugins/session/...` | 開始、メッセージ + ストリーム、レーティング、終了、切り替え、発音 |
| Tracking plugin | `/plugins/tracking/...` | 進捗 + コミット |
| Tools plugin | `/plugins/tools/...` | 推奨 + スペーシング |
| Gamification plugin | `/plugins/gamification/...` | XP、バッジ、ストリーク、リセット |
| Anki plugin | `/plugins/anki/...` | カードCRUD + AI抽出 + エクスポートマーク |
| NotebookLM plugin | `/plugins/notebooklm/...` | 学習問題 + スタディガイド |
| Curriculum | `/users/{user_id}/curricula`, `/curricula/{id}` | カリキュラム + トピック + レッスンCRUD |
| Plugin discovery | `/plugins/manifests`, `/plugins/health`, `/plugins/errors` | 登録内容 |

完全なメソッドリストとリクエスト / レスポンスの例については[コアエンドポイント](core-endpoints.md)と[プラグインエンドポイント](plugin-endpoints.md)を参照してください。

## OpenAPI / Swagger

FastAPIはPydanticスキーマからOpenAPI 3.1スペックを自動生成します。開発モードでは:

- **Swagger UI**: `http://localhost:18001/api/docs`
- **Redoc**: `http://localhost:18001/api/redoc`
- **生のOpenAPI JSON**: `http://localhost:18001/api/openapi.json`

これらはすべてのエンドポイントの正確なシェイプの権威あるリファレンスです。ここのMarkdownページは読みやすさのためのキュレーションされたサブセットです。

## ページネーション

v1.20.0ではエンドポイントはページネーションを行いません。データセットはシングルユーザーで小さく、最大のリスト（プロジェクトごとのセッション）は数百件であり、数千件ではありません。データシェイプが成長した場合、将来のフェーズでカーソルベースのページネーションが追加されます。

## バージョニング

APIにはURLのバージョンプレフィックスがありません。破壊的変更はsemver-majorの境界で行われます。CHANGELOGに変更内容が記載されます。
