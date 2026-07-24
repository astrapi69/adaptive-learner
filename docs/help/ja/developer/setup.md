<!-- Translation: AI-generated, pending native review -->

# 開発環境のセットアップ

## 前提条件

- **Python 3.12+**（バックエンドは3.11でも動作しますが、プラグインのテストは3.12で行います）。
- **Node 24+**（Vite 8が必要）。古いNodeバージョンはビルドステップで`crypto.hash is not a function`というエラーで失敗します。
- **Poetry**（Python依存関係管理のため）。インストール: `curl -sSL https://install.python-poetry.org | python3 -`
- **Bun** 1.3+（フロントエンドのパッケージマネージャー、#1492）。
- **GNU Make**（オーケストレーションターゲットのため）。MakefileはSOTであり、すべてのCIコマンドはそこに記載されています。

## クローン + インストール

```bash
git clone git@github.com:astrapi69/adaptive-learner.git
cd adaptive-learner
make install
```

`make install`は以下を実行します。

1. `cd backend && poetry install` - バックエンド + プラグインのパス依存関係。
2. `cd frontend && bun install` - フロントエンドの依存関係（Node 24）。
3. `plugins/`内のすべてのプラグインをバックエンドのvenvにパス依存関係としてインストール（`develop = true`により編集が即時反映）。

`make install`が失敗する場合、最も多い原因はPoetryが誤ったPythonを選択することです。`backend/`（および深く入った場合は各プラグイン）で`poetry env use python3.12`を実行して再インストールしてください。

## 設定

バックエンドは3層のチェーンから設定を読み取ります（優先度が高いものが優先されます）。

1. **環境変数**（`ADAPTIVE_LEARNER_*`プレフィックス付き）。
2. **ユーザーシークレット**（`~/.config/adaptive_learner/secrets.yaml`）- 最初の起動時にコメント付きテンプレートとして自動生成（POSIXでは`chmod 0600`が適用）; gitにはコミットされません。
3. **デフォルト**（`backend/config/app.yaml`内）。

さらにプロバイダーごとのAIキー解決が上乗せされます: **env > secrets.yaml > Fernet暗号化DBカラム**（Settings UIで設定）。`UserSettingsOut`の`key_source_*`フィールドとしてUIに公開されます。

必須のシークレットは`ADAPTIVE_LEARNER_SECRET_KEY`です。FernetでユーザーのAPIキーを保存時に暗号化するために使用します。`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`で生成します。設定できる場所は3つあります（優先度が高いものが優先）: `ADAPTIVE_LEARNER_SECRET_KEY`環境変数、`secrets.yaml`の`secret_key:`、または開発用の一時キーとして`make dev-secret`。キーが未設定の場合、アプリは起動時にハードフェイルします（サイレントデフォルト生成という落とし穴はありません）。詳細は[docs/configuration.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md)を参照してください。

## 実行

```bash
make dev
```

ポート18001でバックエンドを、ポート15174でフロントエンドを並行して起動します。バックエンドはuvicornの`--reload`でホットリロードに対応し、フロントエンドはViteの開発サーバーです。Ctrl-Cを一度押すと両方が停止します。

バックグラウンドモード:

```bash
make dev-bg   # バックエンド + フロントエンドをバックグラウンドで起動
make dev-down # 停止
```

## テスト

```bash
make test                 # バックエンド + プラグイン + フロントエンドVitest
make test-backend         # バックエンドpytestのみ
make test-frontend        # フロントエンドVitestのみ
make test-coverage        # オプションのカバレッジ実行（低速）
```

E2Eテスト:

```bash
cd e2e && npx playwright test
```

v1.20.0では16個のスモークスペックファイル: ランディング、オンボーディング + アセスメント、セッション（3チャンクSSE）、カリキュラム、設定、モバイルビューポート、同期ペアリング、バックアップラウンドトリップ、マルチサイクルオートループ、インポート + 分析、MDエクスポート、サブジェクト/タグフィルター、リッチテキストノート、モデルピッカー。

## リント + フォーマット

```bash
cd backend && poetry run ruff check .       # Pythonリント
cd backend && poetry run ruff format .      # Pythonフォーマット
cd frontend && bunx tsc --noEmit             # TypeScriptチェック
cd frontend && bun run lint                 # ESLint
cd frontend && bun run format               # Prettier
```

pre-commitフックにより、すべてのコミット時にruff + フォーマッターのチェックが強制されます。

```bash
cd backend && poetry run pre-commit install
```

## ドキュメント

```bash
make docs-install   # 一回限り、docs/にMkDocsのvenvをインストール
make docs-serve     # localhost:8000でドキュメントをホットリロードで提供
make docs-build     # 静的サイトをsite/にビルド
```

docsのvenvはバックエンドとは別です。MkDocsはmkdocs-material + mkdocs-static-i18nを含む独自の`docs/pyproject.toml`を持ちます。

## よくある問題

- **`make dev`が「port already in use」でクラッシュする**: 別のAdaptiveLearnerインスタンスがまだ実行中です。`make dev-down`または`pkill -f uvicorn`を実行してください。
- **「duplicate column name」でテストが失敗する**: Alembicのマイグレーションがスキーマを変更しています。`backend/adaptive_learner.db`を削除して再実行してください。
- **`bun run build`がNode 18で失敗する**: Node 24にアップグレードしてください。Vite 8が必要です。
