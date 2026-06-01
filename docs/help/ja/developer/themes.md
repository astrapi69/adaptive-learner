<!-- Translation: AI-generated, pending native review -->

# テーマシステム

Phase 58（v1.41.0）では、旧来のライト/ダークペアが、単一の`data-theme`ディメンションに基づく6テーマシステムと、OSに追随する`auto`選択に置き換えられました。

## 仕組み

- **カノニカルカラートークン**は`frontend/src/styles/themes/theme-<id>.css`に格納されており、`data-theme`値（`light`、`dark`、`ocean`、`forest`、`high-contrast`、`sepia`）ごとに1ブロックあります。各ファイルは**完全な**セマンティックトークンセットを定義します。ライトへのフォールスルーはありません。
- **テーマに依存しないトークン**（スペーシング、ラジウス、フォント、ブランドメソッドパレット）と**レガシーエイリアス**（`--bg`、`--surface`、`--fg`、`--danger`など）は`styles/global.css :root`に格納されています。エイリアスはカノニカルトークンを*経由して*解決されるため、古いルールもアクティブなテーマに自動的に追従します。
- テーマファイルは`main.tsx`からインポートされ、**ライトが最初に**配置されるため、アクティブなテーマが`:root`との等特異性の競合に勝ちます。
- `frontend/src/lib/themes.ts`はレジストリです: `THEMES`、`ThemeId` / `ThemeChoice`型、`auto`マッピング用の`resolveTheme(choice, prefersDark)`、およびプレビューカードのスウォッチ。
- `frontend/src/hooks/useTheme.ts`は適用される`data-theme`属性を管理し、選択を`adaptive-learner.theme`として永続化します（Phase 58E以前の`adaptive-learner-theme`キーを一度移行）。
- `index.html`には**最初のペイント前**にテーマを適用する小さなインラインスクリプトがあります（フラッシュなし）。これはフックの解決をミラーリングしています。両者を同期させ続けてください。
- Rechartsチャートは SVG属性でCSS変数を読み取れないため、`lib/chartTheme.ts` + `useChartTheme`が計算されたトークン値を読み取り、`data-theme`変更時に再読み込みします。

## トークンセット（すべてのテーマで定義）

背景（`--bg-primary/secondary/surface/elevated/overlay`）、テキスト（`--fg-primary/secondary/muted/inverse`）、ボーダー（`--border-primary/subtle/accent`）、インタラクティブ（`--interactive-bg/hover/active/disabled`）、アクセント（`--accent`、`-hover`、`-fg`、`-subtle`、`-rgb`）、ステータスペア（`--success/-bg`、`--error/-bg`、`--warning/-bg`、`--info/-bg`）、エクササイズフィードバック（`--exercise-correct/-wrong/-selected/-matched`）、`--star`、チャートシリーズ（`--chart-1..6`）、シャドウ（`--shadow-card/-elevated/-md`）。

`styles/themes/themes.test.ts`は、いずれかのテーマがこれらのいずれかを欠いたり余分なものを追加した場合に失敗します。`styles/contrast.test.ts`は6テーマすべてでWCAG 2.1 AAをアサートします。

## 新しいテーマの追加方法

1. **コピー**: 既存のファイルをコピーします（例: `cp theme-dark.css theme-midnight.css`）。セレクターを`[data-theme="midnight"]`に変更します。**すべての**トークンを保持し、値だけを変更します。コンポーネントスタイルはここに追加しないでください。
2. **登録**: `lib/themes.ts`に登録します。`THEMES`に`ThemeMeta`エントリ（id、英語の`label`、`family` light|dark、Settings プレビュー用の`swatch`）を追加し、`ThemeId`ユニオンにidを追加します。
3. **インポート**: `theme-light.css`の後の`main.tsx`でインポートします（ライトとの相対的な順序のみが重要）。
4. **プレペイントガードを許可**: `index.html`のインライン`<script>`の`valid`配列にidを追加します。
5. **i18n**: `backend/config/i18n/*.yaml`の8つのカタログすべてに`ui.themes.midnight`を追加し、その後`make sync-i18n`を実行します。
6. **検証**: `npx vitest run src/styles/themes src/styles/contrast` — 完全性 + コントラストのピンがグリーンのままである必要があります（新しいテーマでコントラストがAAをパスするまで値を修正してください）。

以上です。ThemePicker、プレペイントスクリプト、チャート、すべてのコンポーネントは、カノニカルトークンを読み取るため、新しいテーマを自動的に認識します。

## ルール

- **コンポーネントにハードコードされた色を使わない**。`styles/no-hardcoded-colors.test.ts`が`.tsx`スタイルに対してこれを強制します（チャートリゾルバー、装飾的な紙吹雪、データカラーは文書化されたアローリストでカバー）。
- **すべてのテーマがすべてのトークンを定義する**。`inherit`-from-lightのギャップはなし。これがF1の監査バグ（未定義のトークンがダークモードでライトの16進数をレンダリング）でした。
- **テーマの切り替えは即時**。`data-theme`の入れ替えであり、リロードは不要です。
