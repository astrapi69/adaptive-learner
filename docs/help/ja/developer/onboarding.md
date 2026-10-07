<!-- Translation: AI-generated, pending native review -->

# オンボーディング: 最初のバグ修正

新しいコントリビューター向けの、実践的なステップバイステップの
ウォークスルーです。システムが*何であるか*を説明する
[アーキテクチャ](architecture.md)や[セットアップ](setup.md)の
ページとは異なり、このページは最初のバグ修正を、新しいクローンから
マージされたプルリクエストまで、端から端まで*実際に行う*手順を案内します。

## 1. 開発環境をセットアップする

前提条件: **Python 3.12**（バックエンドの制約は`~3.12`）、
**Node 24+**（Vite 8が必要とする）、**Poetry**、**Bun**、
そして**GNU Make**。

```bash
# Clone
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Install everything: Poetry backend + plugin path-deps + Bun frontend
make install

# Establish a green baseline before you change anything
make test

# Run the app (backend on :18001, frontend on :15174)
make dev
```

フロントエンドの開発サーバーは**http://localhost:15174**で、
バックエンドは**http://localhost:18001**で動作します。どちらのポートも
`ADAPTIVE_LEARNER_FRONTEND_PORT` / `ADAPTIVE_LEARNER_PORT`で
上書きできます。Ctrl-Cを1回押すと両方が停止します。

`make install`が失敗する場合、よくある原因はPoetryが間違ったPythonを
選んでいることです。`backend/`で`poetry env use python3.12`を実行し、
再インストールしてください。設定チェーン全体（シークレット、AIキー、
必須の`ADAPTIVE_LEARNER_SECRET_KEY`）については[セットアップ](setup.md)を
参照してください。

## 2. バグを見つける

issueが作業キューです。すべての修正には**まず**issueが必要です
（`GITHUB-ISSUE-PFLICHT`）。

```bash
# Open bug issues
gh issue list --label bug --state open
```

またはGitHub上で:
<https://github.com/astrapi69/adaptive-learner/issues?q=is%3Aissue+is%3Aopen+label%3Abug>

最初は小さなものを選んでください。`good first issue`や、手間の少ない
`bug`を探しましょう。見つけたバグのissueが存在しない場合は、**コードに
触れる前にissueを作成**し、途中で発見した新しいバグについては
*別の*issueを作成してください。

## 3. issueを理解する

- 説明を読み、ローカルでバグを再現します。
- どのストレージモードで発生するかを記録します。Adaptive Learnerは
  **デュアルストレージ**（API/SQLite *と* Dexie/IndexedDB）を備えています。
  バグは一方のモード、もう一方のモード、または両方に存在する可能性が
  あります。[ストレージレイヤー](storage-layer.md)を参照してください。
- 再現できない場合は、推測せずにissueで質問してください。

## 4. ブランチを作成する

Adaptive Learnerは**gitflow**を使用します。`develop`がアクティブな
ブランチで、`main`はリリースのみを保持します。`develop`*から*
ブランチを切り、PRは`develop`*に対して*開いてください。

```bash
git checkout develop
git pull origin develop
git checkout -b fix/short-description
```

ブランチの命名:

| プレフィックス | 用途 |
|---|---|
| `fix/...` | バグ修正 |
| `feature/...` | 新機能 |
| `refactor/...` | リファクタリング |
| `docs/...` | ドキュメント |
| `chore/...` | ツール / 雑務 |

## 5. バグを修正する

コードを見つけるためのヒント:

```bash
# Search by an error string / symbol (use ripgrep)
rg "the error message" frontend/src backend/app
```

- フロントエンドのエラー: ブラウザのDevToolsコンソールを開きます。
- `cd frontend && bunx vitest --watch <file>`で、編集中にテストの
  フィードバックをリアルタイムで得られます（vitestは常にリポジトリの
  ルートではなく`frontend/`から実行してください）。
- **スタイリング: Tailwindのユーティリティクラスのみ**。色のインライン
  スタイルも、`global.css`への新しいルールも禁止です。色はデザイン
  トークン（CSS変数）を通します。[テーマシステム](themes.md)を参照してください。
- **両方のストレージモードが動作し続けなければなりません。** Dexieの
  パス（または「ブラウザモードでは利用できません」という丁寧な
  メッセージ）なしにAPIモードで出荷される機能は、リリースブロッカーです。

## 6. リグレッションテストを書く

すべての修正には、変更前に失敗し変更後に成功するテストが少なくとも
1つ必要です。

```bash
# Frontend (Vitest) - run from frontend/
cd frontend && bunx vitest run src/path/to/file.test.ts

# Backend (pytest)
cd backend && poetry run pytest tests/path/ -v

# A single plugin
make test-plugin-gamification
```

バックアップに関わる変更には追加のゲートがあります: 実データを使った、
`make dev`での実際のエクスポート → インポートのラウンドトリップ
（`BACKUP-AKZEPTANZTEST`）です。ユニットテストだけでは、バックアップの
マージを正当化することは決してできません。

## 7. 完全なゲートをローカルで実行する

```bash
make test            # backend + plugins + frontend Vitest
make check-types     # mypy + tsc --noEmit
make test-dexie-smoke  # GH-Pages-shape build, every route, no backend
cd frontend && bun run build
```

PRを開く前に、すべてがグリーンでなければなりません。

## 8. コミットしてプッシュする

[Conventional Commits](https://www.conventionalcommits.org/)。マージ時に
自動でクローズされるよう、クローズキーワードでissueを参照してください。

```bash
git add -A
git commit -m "fix(area): short description

Longer description of what the problem was and how it was fixed.

Closes #123"

git push -u origin fix/short-description
```

コミットは**アトミック**に保ってください。各コミットはツリーを
グリーンのまま残します（`make test`が成功する）。分割すると途中の状態が
レッドになる場合は、ソースの変更とそのテストの変更を同じコミットに
まとめてください。

## 9. プルリクエストを開く

```bash
gh pr create --base develop \
  --title "fix(area): short description" \
  --body "Closes #123

## What changed
- ...

## Tests
- ..."
```

常に**`develop`**を対象にし、`main`は決して対象にしないでください
（`main`はリリースブランチです）。アンブレラ/エピックのサブissueの場合は、
*サブissue*を`Closes #<sub-issue>`で引用し、追跡のために
`Refs #<umbrella>`も加えてください。

## 10. CIを待つ

CIはすべてのPRで正しさのゲートを実行します:

- フロントエンドのテスト（Vitest） + バックエンド / プラグインのテスト（pytest）
- TypeScript（`tsc --noEmit`） + mypy + ruff + ESLint
- pre-commitフック
- 複雑度ゲート（ベースラインラチェット。新しい関数は循環的複雑度の
  しきい値未満に収める必要があります）
- フォルダーサイズ + ファイルサイズのガード（巨大ファイル / 巨大フォルダーの防止）
- i18nパリティ（`backend/config/i18n/`配下のすべてのカタログが
  すべてのキーを定義していること）
- デザイントークンのガード（ハードコードされた色 / 固定パレットの
  ユーティリティの禁止）
- ドキュメントドリフト検証ツール

より重いチェック（DexieモードのE2E、カバレッジ、ミューテーション
テスト、セキュリティスキャン、コンテンツ統計のドリフト）は、すべてのPRでは
なく、夜間とリリース時に実行されます。そのため、グリーンのPRは`develop`が
グリーンであることの証明にはなりません。

ゲート、特に**ラチェット**（複雑度、ファイルサイズ、フォルダーサイズなど）に
ブロックされたときは、それが間違っていると考える前に
[ゲート、ラチェット、ブランチ保護](gates-and-ratchets.md)を
読んでください。各ゲートが何であるか、ラチェットにブロックされたときに
何をすべきか、そしてプッシュ前に`make ci`でゲートをローカル実行する
方法を説明しています。

## 11. レビューとマージ

レビューを待ちます（メンテナー権限があればセルフマージします）。PRは
`develop`に**スカッシュマージ**されるため、ブランチのコミットは
トランク上の1つのクリーンなコミットにまとめられます。

---

## プロジェクトルール（短縮版）

| ルール | 意味 |
|---|---|
| `GITHUB-ISSUE-PFLICHT` | すべての修正/機能にはまずissueが必要 |
| Tailwindのみ | `global.css`への追加なし、色のインラインスタイルなし |
| デザイントークン | 色はCSS変数経由、16進リテラルは使わない |
| Dexieモードのパリティ | すべてがDexie*と*APIモードで動作する |
| ライブラリ優先 | ネイティブAPI > フレームワーク > ライブラリ > 自作コード |
| Conventional Commits | `fix()`、`feat()`、`refactor()`、`docs()`、... |
| i18n | すべてのUI文字列をすべての`backend/config/i18n/`カタログに |
| 44pxのタッチターゲット | モバイルに適したインタラクティブ要素 |
| PRごとに1つの関心事 | 各PRは1つのまとまった変更を扱う |
| ブランチ保護 | `develop`は最新のブランチ + グリーンのチェックが必要（管理者にも適用） |

ルール一式: [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules)。

## よく使うコマンド

```bash
make dev               # start backend + frontend
make test              # all tests (backend + plugins + Vitest)
make test-dexie-smoke  # Dexie-mode release gate (no backend)
make check-types       # mypy + tsc --noEmit
make check-complexity-gate   # complexity ratchet
make check-folder-size       # god-folder guard
make sync-i18n         # regenerate frontend i18n from backend YAML
make sync-versions     # propagate the canonical version
cd frontend && bun run build   # build the frontend
```

`make help`はすべてのターゲットを一覧表示します。ビルドコマンドの
正しい情報源は
[Makefile](https://github.com/astrapi69/adaptive-learner/blob/develop/Makefile)
です。

## 1画面でわかるアーキテクチャ

```
frontend/src/
  api/          FastAPI client (the only place fetch() lives)
  components/   UI components, grouped by concern (dashboard/, lesson/, ...)
  features/     feature-strategy gating (useFeatureAvailable)
  hooks/        React hooks
  lib/          business logic, grouped by domain (lesson/, srs/, ai/, ...)
  pages/        route components (+ content/, dashboard/, lesson/ subdirs)
  shared/       app-independent reusable components
  storage/      dual storage: getStorage() -> IStorageService
  styles/       design tokens + per-theme CSS

backend/app/
  routers/      thin FastAPI endpoints (delegate to services)
  services/     business logic (no FastAPI imports)
  repositories/ data layer (Session-free contracts)
  models/       SQLAlchemy models (single-file domain model)
  hookspecs.py  the 10 plugin hooks

plugins/        PluginForge plugins (one package each; the
                catalogue lives in CLAUDE.md)
```

詳細: [アーキテクチャ](architecture.md)。

## どこにある？

| 内容 | 場所 |
|---|---|
| プロジェクトルール | [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules) |
| アーキテクチャ | [アーキテクチャ](architecture.md) |
| ゲート、ラチェット、ブランチ保護 | [ゲート、ラチェット、ブランチ保護](gates-and-ratchets.md) |
| ストレージレイヤー | [ストレージレイヤー](storage-layer.md) |
| プラグインシステム | [プラグインガイド](plugin-guide.md) |
| AI統合 | [AI統合](ai-integration.md) |
| テスト | [テスト](testing.md) |
| リリースワークフロー | [リリースワークフロー](release.md) |
| レッスンコンテンツの形式 | [レッスンコンテンツのオーサリング](authoring-content.md) |
| i18n | [i18n](i18n.md) |
| デプロイ | [デプロイ](deployment.md) |
| ロードマップ | [`docs/ROADMAP.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/ROADMAP.md) |
