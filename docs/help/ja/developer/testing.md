<!-- Translation: AI-generated, pending native review -->

# テスト

AdaptiveLearnerのテスト規律は、すべての変更に対して`make test`によって強制されます。戦略はピラミッド形式です。ベースにユニットテスト、中間に統合テスト、頂点にE2Eスモークテストが位置します。

## テスト数

| レイヤー | ツール |
|---|---|
| バックエンドユニット + 統合 | pytest ^9 |
| プラグインテスト（全プラグイン） | pytest ^9 |
| フロントエンドユニット + 統合 | Vitest 4 |
| E2Eスモーク | Playwright |
| Dexieモードのリリースゲート | Playwright |

テスト数はリリースごとに増えていきます。同期がずれてしまう数値の重複を避けるため、このページには合計をハードコードしません。テスト数とカバレッジの唯一の正準かつ常に最新のソースは`docs/audits/current-coverage.md`です。プラグインは、assessment、AIプロバイダー（anthropic / openai / gemini / perplexity）、session、tracking、tools、gamification、anki、notebooklm、learning-repo、content-loader、missionsです。

## バックエンドpytest

```bash
make test-backend      # バックエンドの全テスト
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

テストは`backend/tests/`に格納されています。`conftest.py`のフィクスチャが、テストごとにフレッシュなインメモリSQLite DB、`TestClient`、モック化されたプラグインマネージャーを提供します。テスト分離は厳格で、`app.*`のインポート前に`ADAPTIVE_LEARNER_TEST=1`が設定されます。

## プラグインテスト

各プラグインは独自の`tests/`ディレクトリを持ちます。

```bash
make test-plugins              # すべて
make test-plugin-session       # 1つだけ
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

プラグインテストはFastAPIアプリをロードしません。プラグインのモジュールを単独でテストします。フック発火をテストする際は`pluggy.PluginManager`をモックしてください。

## フロントエンドVitest

```bash
make test-frontend                # frontend/ から Vitest を実行
cd frontend && bunx vitest         # watchモード
cd frontend && bunx vitest run src/storage/  # 1つのディレクトリ
```

テストはソースの隣に配置されます: `Component.tsx`の隣に`Component.test.tsx`。環境はhappy-dom; React 19 + RTL。

## モックパターン

**AIプロバイダー**: `global.fetch`をモックし、URL、ヘッダー、ボディをアサートします。

```typescript
beforeEach(() => {
  global.fetch = vi.fn(async (input, init) => {
    calls.push({url, method, body});
    return new Response(JSON.stringify({content: [{type: "text", text: "hi"}]}), {status: 200});
  });
});
```

**fake-indexeddb**: すべてのDexieテストファイルの先頭に記述します。

```typescript
import "fake-indexeddb/auto";

beforeEach(async () => {
  await _resetDbForTests();
  const {IDBFactory} = await import("fake-indexeddb");
  (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});
```

各テストはフレッシュなインメモリIndexedDBを取得します。リークはありません。

**api/client.tsのモック**（レガシーページ）:

```typescript
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {...actual, api: {...actual.api, users: {...actual.api.users, get: apiGetMock}}};
});
```

ページは`getStorage()`をインポートし、それがApiStorageに委譲し、さらに`api.*`に委譲します。モックは`api.*`レイヤーで割り込み、ストレージスタックを通じて発火します。

## Playwright E2E

```bash
cd e2e && npx playwright test
cd e2e && npx playwright test --ui   # インタラクティブ
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

スモークスペックは重要なユーザーパスをカバーしています。

- ランディングの言語ピッカー + オンボーディングフォーム
- アセスメント12問 + レーダーレンダリング
- セッション開始 + 終了 + レーティング
- Settings言語 + APIキー
- カリキュラム作成
- モバイルビューポート（iPhone SE、iPhone 14、Pixel 7、iPad）

スペックは`data-testid`セレクターのみを使用します。壊れやすいCSSセレクターは使用しません。スモークスペックは`make test`のパスには含まれていません。独自のポートで独自のサーバーを起動するため、実行中のアプリは不要です。実行中の`make dev`には影響しません。

## カバレッジ

```bash
make test-coverage   # オプション; 低速 + 熱負荷が高い
```

カバレッジはレポートであり、マージゲートではないため、PRでは実行されません。`coverage.yml`ワークフローは毎晩（および手動ディスパッチで）実行されます。アーティファクトをダウンロードするには:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

各プラグインには独自のアーティファクト`<プラグインディレクトリ>-coverage`があります。たとえば`gh run download --name adaptive-learner-plugin-session-coverage`です。新しいプラグインもワークフローを変更せずに対象になります。

`.claude/rules/quality-checks.md`のターゲット:

- サービス + ビジネスロジック: 最低95%
- APIエンドポイント: 最低90%
- ロジックを持つフロントエンドコンポーネント: 最低85%
- フック + ユーティリティ: 最低95%

全体: プロジェクト全体で85〜95%。

## pre-commit

```bash
cd backend && poetry run pre-commit install
```

フックは`.pre-commit-config.yaml`に一覧があります。たとえば ruff check（自動修正）と ruff format、空白・YAML・JSON・マージコンフリクトのチェック、フロントエンドの ESLint、ドキュメントのチェック（ウムラウト代替表記のラチェット、ドキュメント参照）、そして`plugin-lock-paired-with-pyproject`（ブロッキング）です。後者は`pyproject.toml`または`poetry.lock`が関係するプラグインごとに`poetry check --lock`を実行し、ロックの作成後に依存関係が変わっていれば失敗します。CIのpre-commitジョブでも全ファイルに対して実行されます。このジョブでは`eslint`フックはスキップされます（フロントエンドテストのジョブが依存関係をインストールした状態でESLintを実行します）。Prettierはフックではありません。`bun run format:check`はフロントエンドテストのジョブで実行され、#3270の一度きりの再フォーマットまではブロックしません。

## CI

CIは2つの層に分かれます。正しさのゲートはすべてのPRで実行され（マージには合格が必須です）、コストの高いスイートや警告のみのスイートはナイトシフトとリリース時に実行されます。

`.github/workflows/ci.yml`は`develop` / `main`へのプッシュとすべてのPRで実行されます（Python 3.12）。

1. バックエンドテスト（pytest）
2. プラグインテスト（`make test-plugins`、バックエンドのvenv経由ですべて）
3. フロントエンド: `tsc --noEmit`、ESLint（`--max-warnings 0`）、循環依存チェック、Stylelint、Vitest、`vite build`、`bun audit --audit-level=high`（高・重大の検出でブロック）。修正版がなく開発用の依存関係にしか届かない勧告は、`frontend/audit-ignore.txt`にIDで除外します。1行に1つのIDを書き、その上のコメントに理由と削除の条件を書きます。`make check-security`も同じリストを読み、`security-scan.yml`はフィルターなしのままです。
4. すべてのファイルに対するpre-commitフック
5. バックエンドのruff + mypy + pip-audit
6. ドキュメントのドリフト検証（`verify_docs.py` + mkdocs-navの同期）

**Test Impact Analysis (#615):** PRでは影響を受けるテストのみが実行されます - `vitest run --changed origin/<base>`と`pytest --testmon`。`develop` / `main`へのプッシュ、ナイトリー実行、リリース実行では常にフルスイートが実行されます。フルスイートへのフォールバックは自動です（ベース参照を解決できない場合、またはtestmonのキャッシュミス）。

さらに、いくつかのPRゲートは独自のワークフローにあります。

- `complexity-check.yml` - 複雑度ラチェットゲート（`make check-complexity-gate`、Pythonにはradon、TSにはESLintの複雑度ルール）。これはベースラインラチェットです。`.complexity-baseline`に対して新規または悪化した違反がある場合にのみ失敗するため、既存の負債の一掃を強制することなく、新しい複雑度をブロックします。警告のみの完全な複雑度レポートはナイトリーで実行されます。同じジョブでフォルダーサイズガード（`.dirsize-baseline`に対する`scripts/check-folder-size.sh`）も実行されます。ローカルでは`make check-folder-size`、または`make ci`の一部として実行します。
- `cohesion-check.yml` - ファイルサイズガード（`.filesize-whitelist`に対するゲート）に加えて、2つのクラス名ゲート: 死んだCSSクラス名（`.dead-classnames-baseline`に対する`check-dead-classnames.py`）と**未スタイルclassNameゲート**（`--unstyled`、`.unstyled-classnames-baseline`に対するラチェット） - トークンがすべて死んでいる`className`はPRをブロックします。
- `visual-baseline-gate.yml` - 視覚的にクリティカルなパス（レッスンコンポーネント、演習レンダラー、テーマ/CSSファイル）を変更するPRは、影響を受けるベースラインスクリーンショットを同じPRで持ち込まなければなりません。証明可能に無害な変更にはエスケープラベル`visual-baselines-unaffected`を使います。
- `testid-reference-gate.yml` - E2Eスペックが静的に参照する`data-testid`を（ユーザーの目に付きやすいサーフェスで）、スペックに触れずに削除または改名するPRは、このゲートで失敗します（`make check-testid-refs`）。エスケープラベルは`testid-refs-unaffected`。
- `docker-build-smoke.yml` - 本番Composeイメージ（ランチャー/install.shのパス）のビルドのみのスモーク。PRではパスフィルター付き、加えて`release/**`、週次、手動ディスパッチで実行。ローカルでは`make docker-build-smoke`。
- `dexie-smoke.yml` - DexieモードのE2Eゲート。関係するすべてのプルリクエストで実行され（`scripts/dexie_smoke_affected.py`が判定し、`Dexie smoke (required)`ジョブは常に結果を報告します）、加えて毎日、`release/**`、手動ディスパッチでも実行されます。ローカルでは`make test-dexie-smoke`。
- `backup-e2e.yml` - バックアップのパス（たとえば`frontend/src/storage/backup/`、Dexieのストア、バックエンドのバックアップサービス。一覧はワークフローにあります）に触れるPRで実行され、すべてのバックアップテーブルのラウンドトリップを含め、各`e2e/dexie/backup-*.spec.ts`を実行します。

**ナイトシフト / リリース（PRでは実行されない）:**

- `coverage.yml` - カバレッジレポート（毎日 + 手動ディスパッチ）
- `security-scan.yml` - pip-audit / bun audit / bandit（週次 + `release/**` + 手動ディスパッチ。警告のみ）
- `content-stats.yml` - フレッシュなコンテンツリポジトリのチェックアウトに対するコンテンツ統計ドリフトの検査（毎日 + 手動ディスパッチ）
- `mutation-frontend.yml` - Strykerミューテーションテスト（リポジトリ変数`ENABLE_NIGHTLY_MUTATION`の背後でのナイトリー + 手動ディスパッチ。実行がジョブのタイムアウトに収まるよう、1回の実行でファイルの1スライスをミューテートします）。バックエンドのミューテーションテストはmutmutを使用します
- `webkit-gate.yml` - 実WebKitエンジンのレイアウトゲート（Chromiumのゲートには構造的に見えないiOS/Safariのバグクラス）。リポジトリ変数`ENABLE_NIGHTLY_WEBKIT`の背後で毎日、`release/**`では常に、手動ディスパッチでも実行されます
- `visual-regression.yml` - ビジュアルベースラインのマトリクス（毎日 + 手動ディスパッチ。`update_baselines=true`はベースラインをCIで再レンダリングし、アーティファクトとしてアップロードします）
- `visual-baseline-sync.yml` - サービスワークフロー: ベースラインをCIでレンダリングし、コミットとしてPRブランチにプッシュします（ラベル`refresh-visual-baselines`、またはPR番号を指定した手動ディスパッチ） - マージ前の画像レビューは引き続き必須です
- `smoke-nightly.yml` - モバイルビューポートのスモークのナイトリー実行。検出結果は1つの追跡issueにまとめられます
- `unused-catalog-keys.yml` - 準備期間（`frontend/src/i18n/unused-catalog-keys.ts`の`AGE_DAYS`）より古い、利用箇所のないカタログキーのナイトリーレポート。1つの追跡issueにまとめられ、各キーは候補として削除前に1つずつ確認します

`.github/workflows/release-gate.yml`はタグプッシュ時に実行されます。バージョンピンがバージョンを持つすべてのファイルにわたって同期されていること（ドリフトなし）、プラグインのロックファイルが一致していること、再生成されるアーティファクトが最新であることを検証します。
