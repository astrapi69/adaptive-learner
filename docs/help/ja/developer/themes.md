# テーマシステム

Phase 58（v1.41.0）は、旧来のライト／ダークのペアを、単一の
`data-theme` ディメンション上の 6 つのクラシックテーマから
なるシステムに置き換え、加えて OS に追随する `auto` 選択を
導入しました。Phase 63（v1.63.0）は、**推奨される WCAG AA
プリセット**を 6 つ追加し、ピッカー全体で**12 テーマ**を
扱うようになりました。

## 推奨プリセット（Phase 63 / v1.63.0）

設定 → 表示 のピッカーは、**推奨**サブタブが先頭に来ます。

- **ライト：** `catppuccin-latte`、`supabase`、`graphite`
- **ダーク：** `catppuccin-mocha`、`soft-pop`、`amethyst-haze`

これらは tweakcn のプリセットから
`scripts/generate_preset_themes.py` によって完全な 44 トークンの
テーマとして生成され、**計算的に強制された WCAG AA**
（12 テーマすべてにわたる `contrast.test.ts`）を備えています。
クラシックな 6 つ（`light`、`dark`、`ocean`、`forest`、
`high-contrast`、`sepia`）は変更されていません。

## 仕組み

- **正規のカラートークン**は
  `frontend/src/styles/themes/theme-<id>.css` にあり、
  `data-theme` の値（`light`、`dark`、`ocean`、`forest`、
  `high-contrast`、`sepia`）ごとに 1 ブロックです。各ファイルは
  **完全な**セマンティックトークンセットを定義します。ライトへの
  フォールスルーはありません。
- **テーマに依存しないトークン**（間隔、角丸、フォント、ブランドの
  メソッドパレット）と**レガシーエイリアス**（`--bg`、`--surface`、
  `--fg`、`--danger` など）は `styles/global.css :root` にあります。
  エイリアスは正規トークンを*経由して*解決されるため、古い
  ルールも自動的にアクティブなテーマに追従します。
- テーマファイルは `main.tsx` でインポートされ、**ライトが先頭**に
  来るので、アクティブなテーマが `:root` に対する特異性の引き分けに
  勝ちます。
- `frontend/src/lib/themes.ts` はレジストリです。`THEMES`、型
  `ThemeId` / `ThemeChoice`、`auto` のマッピング用の
  `resolveTheme(choice, prefersDark)`、そしてプレビューの
  スウォッチです。
- `frontend/src/hooks/useTheme.ts` は適用される `data-theme` 属性を
  所有し、選択を `adaptive-learner.theme` として永続化します
  （古い `adaptive-learner-theme` キーを一度だけ移行します）。
- `index.html` には、保存されたテーマを**最初のペイントの前**に
  適用する小さなインラインスクリプトがあります（ちらつきなし）。
  これはフックの解決をミラーリングしています。両者を同期させて
  おいてください。
- チャート（Recharts）は CSS 変数を SVG 属性で読めないため、
  `lib/chartTheme.ts` + `useChartTheme` が計算済みのトークン値を
  読み取り、`data-theme` の変更時に再読み込みします。

## トークンセット（すべてのテーマが定義する）

背景（`--bg-primary/secondary/surface/elevated/overlay`）、
テキスト（`--fg-primary/secondary/muted/inverse`）、ボーダー
（`--border-primary/subtle/accent`）、インタラクティブ
（`--interactive-bg/hover/active/disabled`）、アクセント
（`--accent`、`-hover`、`-fg`、`-subtle`、`-rgb`）、ステータスの
ペア（`--success/-bg`、`--error/-bg`、`--warning/-bg`、
`--info/-bg`）、演習フィードバック
（`--exercise-correct/-wrong/-selected/-matched`）、`--star`、
チャートシリーズ（`--chart-1..6`）、シャドウ
（`--shadow-card/-elevated/-md`）。

`styles/themes/themes.test.ts` は、あるテーマがこれらのトークンの
いずれかを欠くか、余分なものを持つと失敗します。
`styles/contrast.test.ts` は 12 テーマすべてにわたって WCAG 2.1
AA を検査します。完全なトークンリファレンスは
[デザイントークン・アーキテクチャ](../architecture/design-tokens.md)に
あります。

## 新しいテーマを追加する

1. 既存のファイルを**コピー**します。例：
   `cp theme-dark.css theme-midnight.css`。セレクタを
   `[data-theme="midnight"]` に変更します。**すべての**トークンを
   保持し、値だけを変更します。ここにコンポーネントのスタイルは
   書きません。
2. `lib/themes.ts` に**登録**します。`THEMES` に `ThemeMeta`
   エントリ（id、英語の `label`、`family` light|dark、設定の
   プレビュー用の `swatch`）を追加し、`ThemeId` の union に id を
   加えます。
3. `main.tsx` で `theme-light.css` の後に**インポート**します
   （順序はライトに対する相対位置だけが重要です）。
4. **プリペイントガードで許可**します。`index.html` のインライン
   `<script>` 内の `valid` 配列に id を加えます。
5. **i18n**：`backend/config/i18n/*.yaml` の 8 つすべての
   カタログに `ui.themes.midnight` を追加し、`make sync-i18n` を
   実行します。
6. **検査**：`bunx vitest run src/styles/themes src/styles/contrast` —
   完全性とコントラストのピンがグリーンのままでなければなりません
   （新しいテーマでコントラストが AA を満たすまで値を調整します）。

これで完了です。ThemePicker、プリペイントスクリプト、チャート、
そしてすべてのコンポーネントは、いずれも正規トークンを読むので、
新しいテーマを自動的に取り込みます。

## 規則

- コンポーネントに**色をハードコードしない**こと。
  `styles/no-hardcoded-colors.test.ts` が `.tsx` のスタイルに
  ついてこれを強制します（文書化された許可リストがチャートの
  リゾルバ、装飾的な紙吹雪、データの色をカバーします）。
- **すべてのテーマがすべてのトークンを定義する。** ライトからの
  継承によるギャップはありません。これが F1 監査のバグ
  （ダークモードで明るい hex を表示した未定義のトークン）でした。
- **テーマの切り替えは即座**です。`data-theme` の入れ替えであり、
  再読み込みは決して行いません。
