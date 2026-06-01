<!-- Translation: AI-generated, pending native review -->

# テスト

AdaptiveLearnerのテスト規律は、すべての変更に対して`make test`によって強制されます。戦略はピラミッド形式です。ベースにユニットテスト、中間に統合テスト、頂点にE2Eスモークテストが位置します。

## テスト数（v1.20.0）

| レイヤー | 件数 | ツール |
|---|---|---|
| バックエンドユニット + 統合 | 786 | pytest ^9 |
| プラグインテスト（10プラグイン） | 615 | pytest ^9 |
| フロントエンドユニット + 統合 | 1233 | Vitest 4 |
| E2Eスモーク | 16スペックファイル | Playwright |
| **合計（`make test`）** | **2634** | |

プラグイン内訳: assessment 110 + ai-anthropic 34 + ai-openai 31 + ai-gemini 33 + session 215 + tracking 64 + tools 58 + gamification 23 + anki 20 + notebooklm 27。

## バックエンドpytest

```bash
make test-backend      # 786テスト、約35秒
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
make test-frontend                # 387テスト、約2秒
cd frontend && npx vitest         # watchモード
cd frontend && npx vitest run src/storage/  # 1つのディレクトリ
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

スペックは`data-testid`セレクターのみを使用します。壊れやすいCSSセレクターは使用しません。スモークスペックは`make test`のパスには含まれていません。実行中のアプリが必要です（先に`make dev-bg`を実行）。

## カバレッジ

```bash
make test-coverage   # オプション; 低速 + 熱負荷が高い
```

カバレッジはmainへのすべてのプッシュについてCIで実行されます。アーティファクトをダウンロードするには:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

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

フック: ruff check（自動修正）、ruff format、末尾の空白、ファイル末尾の修正、check-yaml、check-merge-conflict。バックエンドのみ。フロントエンドのリントはpre-commitではなく、CI時に実行されます。

## CI

`.github/workflows/ci.yml`はmainへのすべてのプッシュとすべてのPRで実行されます。

1. バックエンドテスト（Python 3.12 + 3.13マトリクス）
2. プラグインテスト（プラグインごとに1ジョブ; マトリクス戦略）
3. フロントエンドVitest + tsc + lint
4. ruff check + format-check

`.github/workflows/release-gate.yml`はタグプッシュ時に実行されます: バージョンピンが同期されていること（12ファイル全体でドリフトなし）、プラグインのロックファイルが一致すること、再生成されたアーティファクトが最新であることを検証します。
