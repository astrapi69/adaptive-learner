<!-- Translation: AI-generated, pending native review -->

# ストレージレイヤー

v0.7.0のストレージレイヤー（`frontend/src/storage/`）は、フロントエンドに単一の契約の背後に2つの交換可能なバックエンドを提供します。この契約はPhase 7〜34を経て22の名前空間に拡大しています。

## IStorageService

`frontend/src/storage/types.ts`はすべてのストレージ実装が満たすインターフェースを定義します。`api/client.ts`の`api.*`名前空間を1:1でミラーリングしています。

```typescript
export interface IStorageService {
  readonly mode: StorageMode;
  health(): Promise<HealthInfo>;
  // Core
  i18n: II18nNamespace;
  users: IUsersNamespace;
  projects: IProjectsNamespace;
  settings: ISettingsNamespace;   // get/set including key_source_*
  assessment: IAssessmentNamespace;
  session: ISessionNamespace;     // includes streamMessage()
  tracking: ITrackingNamespace;
  tools: IToolsNamespace;
  curricula: ICurriculaNamespace;
  topics: ITopicsNamespace;
  lessons: ILessonsNamespace;
  plugins: IPluginsNamespace;
  system: ISystemNamespace;
  // Phase 12+
  backup: IBackupNamespace;
  export: IExportNamespace;
  imports: IImportsNamespace;
  // Phase 22 — taxonomy
  subjects: ISubjectsNamespace;
  tags: ITagsNamespace;
  projectTaxonomy: IProjectTaxonomyNamespace;
  // Phase 29-32 — gamification + exports
  gamification: IGamificationNamespace;
  anki: IAnkiNamespace;
  notebooklm: INotebookLmNamespace;
  pronunciation: IPronunciationNamespace;
}
```

すべてのページは`getStorage()`ファクトリを通じて`IStorageService`を利用します。ページは`api/client.ts`やDexieデータベースを直接インポートしません。

## ApiStorage

`storage/api-storage.ts`は`api.*`への薄いパススルーです。すべてのメソッドが1:1で委譲します。動作はv0.6.0と同一です。

## DexieStorage

`storage/dexie-storage.ts`はDexie 4.4.2を通じてすべてをIndexedDBに永続化します。`storage/db.ts`のスキーマはSQLAlchemyの25モデルすべてを1:1でミラーリングし、4つの関連テーブル（`project_subjects` / `project_tags` / など）も含みます。

`storage/`以下のサブモジュールがポートされたロジックを担います。

| モジュール | 役割 |
|---|---|
| `assessment.ts` | 12問パック + プロファイル計算機 |
| `prompts.ts` | 42セルのシステムプロンプトマトリクス |
| `step-evaluator.ts` | デュアルプロンプトのステップ評価ポート |
| `session-flow.ts` | start + messageのオーケストレーション |
| `tracking.ts` | アグリゲーター + buildCommitFromSession |
| `tools.ts` | rankTools + buildSpacedRecommendations |
| `ai-providers.ts` | Anthropic/OpenAI/Gemini HTTPクライアント |

バンドルデータは`frontend/src/data/`に格納されます。

- `assessment-questions.json` — バックエンドの`QUESTIONS`リストからそのままエクスポート（12問 × 4回答 × 5言語）。
- `session-prompts.json` — バックエンドの`_PROMPTS`辞書からそのままエクスポート（6メソッド × 7ステップ × 2言語）。

## 3番目のストレージバックエンドの追加

任意の永続化レイヤー（Supabase、Firestore、カスタムREST APIなど）で`IStorageService`を実装します。`storage/index.ts`のファクトリに登録します。

```typescript
if (mode === "supabase") {
  cachedStorage = supabaseStorage;
}
```

`StorageMode`型にモードを追加します。

```typescript
export type StorageMode = "api" | "dexie" | "supabase";
```

Settings UIのストレージモードセクションに配線します。他のファイルは変更不要です。ページは引き続き`getStorage()`を通じてアクセスします。

## ブラウザ直接AIコール

`storage/ai-providers.ts`は3つのプロバイダークライアントを実装しています。

- **Anthropic** — `anthropic-dangerous-direct-browser-access: true`ヘッダーを付けて`https://api.anthropic.com/v1/messages`にPOST。これはAnthropicのブラウザ呼び出し元向けの明示的なオプトインです。このヘッダーがないとCORSが拒否します。
- **OpenAI** — `Authorization: Bearer ${apiKey}`を付けて`https://api.openai.com/v1/chat/completions`にPOST。CORSはデフォルトで開放されています。
- **Gemini** — `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`にPOST。クエリパラメーター認証で、systemフィールドなし。systemメッセージは最初のユーザーターンに折り込まれます。

3つすべてがエラーを`ApiError(status, "Provider: detail")`に正規化するため、既存のフロントエンドトースト / GitHub Issue UXが分岐なしにレンダリングできます。

## Dexieモードでなぜ平文のAPIキーなのか？

DexieモードではユーザーのAPIキーはIndexedDBに平文で格納されます（`UserSettings.api_key_{provider}`）。許容できる脅威モデル:

- データはユーザー自身のデバイスから外に出ません。
- AIプロバイダーのみがキーを見るネットワークエンドポイントです。
- IndexedDBでの暗号化には、セッションごとのパスワードプロンプト（UX的に不親切）か、アプリにバンドルされた固定キー（攻撃者がバンドルを持っているのでセキュリティ上の見せかけ）が必要になります。

サーバーモードの動作は異なります。APIキーはFernet暗号化で保存されます（`ADAPTIVE_LEARNER_SECRET_KEY`）。ApiStorageは平文を見ません。

v1.20.0 / Phase 34以降、両モードともプロバイダーごとのソース属性（`UserSettings.key_source_anthropic | openai | gemini`）を公開し、UIが「Key from: secrets.yaml」/「environment」/「Settings」とレンダリングできるようにしています。Dexieモードではブラウザのサンドボックスにはファイルシステムアクセスがないため、ソースは`settings`または`none`に縮退します（`secrets.yaml`はデスクトップ / サーバーモードの概念です）。

## モード解決

`storage/index.ts`は次の順序でモードを解決します。

1. `localStorage["adaptive-learner.storage_mode"]` — Settingsでのユーザー選択。
2. `VITE_STORAGE_MODE` — ビルド時のデフォルト（GH Pagesでは`"dexie"`に設定）。
3. フォールバック: `"api"`。

結果はページのライフタイム中キャッシュされます。テストコードは`_resetStorageCacheForTests()`でリセットできます。
