<!-- Translation: AI-generated, pending native review -->

# デプロイメント

4つのデプロイメントモードが利用できます。

| モード | 場所 | バックエンド | AI呼び出し | キーソース |
|---|---|---|---|---|
| ローカル開発 | `make dev` | FastAPIが:18001で稼働 | サーバーサイド | env / secrets.yaml / DB |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | なし（Dexie） | ブラウザ直接 | DB（IndexedDB） |
| デスクトップランチャー | PyInstallerバイナリ（Dockerベース） | Dockerコンテナ内のFastAPI | サーバーサイド | `.env`（自動生成）/ Settings UI |
| Docker | Docker Composeセルフホスト | コンテナ内FastAPI | サーバーサイド | env / Settings UI |

## ローカル開発

```bash
make dev
```

ポート18001でバックエンド（FastAPI + uvicorn `--reload`）を、ポート15174でフロントエンド（Vite devサーバー）を並行して起動します。Ctrl-Cを一度押すと両方が停止します。

フロントエンドのViteプロキシが`/api/*`をバックエンドに転送するため、フロントエンドは常に`/api`をベースURLとして使用します - ローカル開発ではCORS設定は不要です。

バックグラウンドモードの場合:

```bash
make dev-bg     # デタッチ
make dev-down   # 停止
```

## GitHub Pages（Dexieのみ）

`.github/workflows/deploy-gh-pages.yml`は以下の設定でフロントエンドをビルドします。

- `VITE_BASE="/adaptive-learner/"` - すべてのアセットURLにリポジトリごとのPagesパスのプレフィックスを付けます。
- `VITE_STORAGE_MODE="dexie"` - DexieStorageをデフォルトモードとして固定します。
- `VITE_API_BASE=""` - 指向するバックエンドはありません。

ワークフローは`main`へのすべてのプッシュおよび手動ディスパッチで実行されます。ビルド後に`dist/index.html`を`dist/404.html`にコピーしてSPAルーターのフォールバックとし、`actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`を使用して公開します。

サイトのURLは`https://astrapi69.github.io/adaptive-learner/`です。カスタムドメインのユーザーは`CNAME`ファイルをドメイン名と共に`frontend/public/`に追加します; GitHubのドメイン対応Pagesルーティングが残りを処理します。

## Docker Compose（フルスタック）

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml`は**単一のサービス`app`**を含みます（#2058
以降は1コンテナ構成 - nginxも独立したフロントエンドコンテナも
ありません）。

- **FastAPI（Python 3.12イメージ）**がビルド済みフロントエンドの
  staticsと`/api/*`の両方を、内部ポート
  `${ADAPTIVE_LEARNER_BACKEND_PORT:-8000}`で提供します。
- ホストに公開されるのは
  `${ADAPTIVE_LEARNER_BIND_ADDRESS:-127.0.0.1}:${ADAPTIVE_LEARNER_PUBLIC_PORT:-8501}`
  です - 既定はloopbackです。
- コンテナの再ビルドを越えて生き残る**名前付きボリューム
  `adaptive-learner-data`**（`/app/data`）。

`install.sh`と`install.ps1`はエンドユーザー向けのcurl-pipeインストーラーです - タグ付きリリースのtarballをプルし、`ADAPTIVE_LEARNER_SECRET_KEY`を設定し、`docker compose up`を実行します。

インストーラーはリリース時に`install.sh.template` / `install.ps1.template`と`backend/pyproject.toml`のバージョン（`scripts/sync_versions.py`を参照）から再生成されます。生成されたファイルを直接編集しないでください。

## 本番環境の設定

本番環境で重要な4つのこと:

1. **`ADAPTIVE_LEARNER_SECRET_KEY`**: 安定したFernetキーでなければなりません。一度生成して安全な場所に保管します（HashiCorp Vault、AWS Secrets Manager、シールされた`.env`）。これを失うと、暗号化されたすべてのAPIキーが読めなくなります。未設定の場合、アプリは起動時にハードフェイルします（サイレントデフォルトなし）。
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: 許可されたオリジンのカンマ区切りリスト。デフォルトは寛容です; 本番環境では絞り込んでください。
3. **`ADAPTIVE_LEARNER_DEBUG`**: 本番環境では未設定 / falseのままにしてください。デバッグモードはエラーレスポンスにスタックトレースを公開します。
4. **`ADAPTIVE_LEARNER_BIND_ADDRESS`**: 既定は `127.0.0.1` で、公開ポートにはホスト自身からしか到達できません。アプリには認証がないため、`0.0.0.0` へのバインドは意図的な場合のみ、かつ信頼できるネットワーク内か独自の認証レイヤー（basic auth 付きリバースプロキシ、VPN）の背後でのみ行ってください。

コンテナの場合、env変数が慣用的な注入チャネルです。`~/.config/adaptive_learner/secrets.yaml`オーバーレイはデスクトップ / ランチャー用です; 複数のenv変数よりも1つの設定ファイルを好む場合は、コンテナにバインドマウントすることもできます。

## デスクトップランチャー

`launcher/`はPyInstallerベースの1バイナリのデスクトップランチャーです。組み込みサーバーではなく、公開されている`docker-app-launcher`エンジンの薄いラッパーで、`launcher/launcher.json`で設定されます。配布される設定は**イメージモード**（`deployment_mode: "image"`）で動作します。ランチャーはビルド済みで検証済みのリリースイメージ（`ghcr.io/astrapi69/adaptive-learner:<バージョン>`、埋め込まれたアプリバージョンに固定）をプルし、Dockerコンテナとして起動し（既定は`http://localhost:8501`）、データボリューム`adaptive-learner-data`を`/app/data`にマウントしてから、ユーザーのデフォルトブラウザを開きます。ローカルでは何もビルドされず、ソースのダウンロードも展開も行われません。

完全な3層設定チェーン（プロジェクトYAML < ユーザーオーバーレイ < env変数）は`docs/configuration.md`に記載されています。

## ランチャー（クロスOSデスクトップ）

`launcher/`はPyInstallerベースの1バイナリインストーラーです。GitHub Actionsはリリースごとに3つのバイナリをビルドします。

- `launcher-linux.yml` → `adaptive-learner-launcher-linux`
- `launcher-macos.yml` → `adaptive-learner-launcher-macos`
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

各ランチャーはバージョン（`__version__`リテラル + スペックファイルによってビルド時に書き込まれる`_build_info.py`）を埋め込みます。エンジンはさらにGitHub Releases APIに対するバックグラウンドの更新チェックを実行します（`launcher.json`の`update_check_enabled`で有効化）。エラー時は静かに失敗し、ランチャーを決してブロックしません。

ランチャーは意図的に主要な配布チャネルではありません（Dockerがそれです）。「ダブルクリックでインストール」という体験を望むユーザーのために存在しています。

## CI/CDアーキテクチャ

各ワークフローは独立して実行されます; 共有状態はありません。

| ワークフロー | トリガー | 実行内容 |
|---|---|---|
| `ci.yml` | push、pull_request | テスト + lint + tsc |
| `coverage.yml` | mainへのpush | カバレッジHTML + xml |
| `release-gate.yml` | タグpush | バージョンピンのドリフトチェック |
| `deploy-gh-pages.yml` | mainへのpush、ディスパッチ | GH Pagesビルド + デプロイ |
| `launcher-{linux,macos,windows}.yml` | release: created | ビルド + ランチャーバイナリの添付 |
| `docs.yml` | mainへのpush | MkDocsビルド（現在は非アクティブ - サイトはGH Pagesワークフローから） |
