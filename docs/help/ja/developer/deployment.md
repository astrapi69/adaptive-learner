<!-- Translation: AI-generated, pending native review -->

# デプロイメント

v1.20.0では4つのデプロイメントモードが利用できます。

| モード | 場所 | バックエンド | AI呼び出し | キーソース |
|---|---|---|---|---|
| ローカル開発 | `make dev` | FastAPIが:18001で稼働 | サーバーサイド | env / secrets.yaml / DB |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | なし（Dexie） | ブラウザ直接 | DB（IndexedDB） |
| デスクトップランチャー | PyInstallerバイナリ | FastAPIをローカルで起動 | サーバーサイド | secrets.yaml（自動作成）/ Settings UI |
| Docker | Docker Composeセルフホスト | コンテナ内FastAPI | サーバーサイド | env / Settings UI |

## ローカル開発

```bash
make dev
```

ポート18001でバックエンド（FastAPI + uvicorn `--reload`）を、ポート15174でフロントエンド（Vite devサーバー）を並行して起動します。Ctrl-Cを一度押すと両方が停止します。

フロントエンドのViteプロキシが`/api/*`をバックエンドに転送するため、フロントエンドは常に`/api`をベースURLとして使用します — ローカル開発ではCORS設定は不要です。

バックグラウンドモードの場合:

```bash
make dev-bg     # デタッチ
make dev-down   # 停止
```

## GitHub Pages（Dexieのみ）

`.github/workflows/deploy-gh-pages.yml`は以下の設定でフロントエンドをビルドします。

- `VITE_BASE="/adaptive-learner/"` — すべてのアセットURLにリポジトリごとのPagesパスのプレフィックスを付けます。
- `VITE_STORAGE_MODE="dexie"` — DexieStorageをデフォルトモードとして固定します。
- `VITE_API_BASE=""` — 指向するバックエンドはありません。

ワークフローは`main`へのすべてのプッシュおよび手動ディスパッチで実行されます。ビルド後に`dist/index.html`を`dist/404.html`にコピーしてSPAルーターのフォールバックとし、`actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`を使用して公開します。

サイトのURLは`https://astrapi69.github.io/adaptive-learner/`です。カスタムドメインのユーザーは`CNAME`ファイルをドメイン名と共に`frontend/public/`に追加します; GitHubのドメイン対応Pagesルーティングが残りを処理します。

## Docker Compose（フルスタック）

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

`docker-compose.prod.yml`には以下が含まれます。

- **backend**（Python 3.12イメージのFastAPI）、ポート7880を公開。
- **nginx**サイドカーがビルドされたフロントエンド（`frontend/dist/`）を配信し、`/api/*`をバックエンドにプロキシします。
- コンテナの再起動を越えて生き残る**SQLiteボリューム**。

`install.sh`と`install.ps1`はエンドユーザー向けのcurl-pipeインストーラーです — タグ付きリリースのtarballをプルし、`ADAPTIVE_LEARNER_SECRET_KEY`を設定し、`docker compose up`を実行します。

インストーラーはリリース時に`install.sh.template` / `install.ps1.template`と`backend/pyproject.toml`のバージョン（`scripts/sync_versions.py`を参照）から再生成されます。生成されたファイルを直接編集しないでください。

## 本番環境の設定

本番環境で重要な3つのこと:

1. **`ADAPTIVE_LEARNER_SECRET_KEY`**: 安定したFernetキーでなければなりません。一度生成して安全な場所に保管します（HashiCorp Vault、AWS Secrets Manager、シールされた`.env`）。これを失うと、暗号化されたすべてのAPIキーが読めなくなります。未設定の場合、アプリは起動時にハードフェイルします（サイレントデフォルトなし）。
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: 許可されたオリジンのカンマ区切りリスト。デフォルトは寛容です; 本番環境では絞り込んでください。
3. **`ADAPTIVE_LEARNER_DEBUG`**: 本番環境では未設定 / falseのままにしてください。デバッグモードはエラーレスポンスにスタックトレースを公開します。

コンテナの場合、env変数が慣用的な注入チャネルです。`~/.config/adaptive_learner/secrets.yaml`オーバーレイはデスクトップ / ランチャー用です; 複数のenv変数よりも1つの設定ファイルを好む場合は、コンテナにバインドマウントすることもできます。

## デスクトップランチャー

`launcher/`以下のPyInstallerバイナリは`http://localhost:7880`でローカルのFastAPIを起動し、ユーザーのデフォルトブラウザを開きます。最初の起動時に、ランチャーはコメント付きテンプレートとして`~/.config/adaptive-learner/secrets.yaml`を作成し、POSIXで`chmod 0600`を適用するため、ユーザーはSettings UIに触れることなくAPIキーをそこに追加できます。

完全な3層設定チェーン（プロジェクトYAML < ユーザーオーバーレイ < env変数）は`docs/configuration.md`に記載されています。

## ランチャー（クロスOSデスクトップ）

`launcher/`はPyInstallerベースの1バイナリインストーラーです。GitHub Actionsはリリースごとに3つのバイナリをビルドします。

- `launcher-linux.yml` → `adaptive-learner-launcher-linux`
- `launcher-macos.yml` → `adaptive-learner-launcher-macos`
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

各ランチャーはバージョン（`__version__`リテラル + スペックファイルによってビルド時に書き込まれる`_build_info.py`）を埋め込み、一致するタグ付きリリースのtarballをフェッチして展開し、バックエンドを起動し、ユーザーのブラウザでフロントエンドを開きます。

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
| `docs.yml` | mainへのpush | MkDocsビルド（現在は非アクティブ — サイトはGH Pagesワークフローから） |
