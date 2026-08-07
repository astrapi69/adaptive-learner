# レッスンコンテンツを作成する

このガイドは、Adaptive Learner のコンテンツローダー向けに新しい
レッスンセットをどう用意するかを、ステップごとに説明します。
言語またはテーマのセットを作りたい人 - 自分用でも、公開
コンテンツプールへの寄稿としてでも - は、最初のレッスンの前に
一度通して読んでおくべきです。

## コンテンツセットとは

**コンテンツセット**は、ユーザーがセットブラウザのページ
（`/content`）からダウンロードできる、バージョン管理された
レッスンの束です。コンテンツローダープラグイン（v1.27.0）が、
両方のストレージモードで発見、ダウンロード、キャッシュ、
バージョンの突き合わせを担います。

セットには 3 つの層があります。

1. **ルートマニフェスト**（`manifest.yaml`）- リポジトリの各
   セットを列挙します。セットブラウザがソースカタログのために
   読み込みます。
2. **セットマニフェスト**（`sets/{set-id}/manifest.yaml`）-
   ルートマニフェストの兄弟で、その具体的なセットのレッスン
   ファイルを列挙します。
3. **レッスンファイル**（`sets/{set-id}/lessons/NN-slug.json`）-
   レッスンごとに 1 つの JSON ファイル。ダウンロードのたびに
   レッスンスキーマに対して検証されます（下記の
   *スキーマは唯一の信頼できる情報源* を参照）。

Adaptive Learner に同梱されるセットは、別のコンテンツ
リポジトリ
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
にあり（兄弟チェックアウト `../adaptive-learner-content` として
チェックアウトされ、`frontend/scripts/copy-bundled-content.mjs` を
介して GitHub Pages ビルドにオフラインで同梱されます）、
テンプレートとして適しています。ライブラリの現在のサイズ
（レッスン / セット / ドメインの数、セットごとの表、アクティブな
ドメイン）は、プロジェクトの [`README.md`](https://github.com/astrapi69/adaptive-learner#readme)
にある CONTENT-STATS ブロックです。そのブロックが唯一の信頼できる
情報源であり、新鮮なコンテンツチェックアウトから生成されるので、
このガイドでは数字を重複させません。

## スキーマは唯一の信頼できる情報源（EXP-039）

レッスン/演習フォーマットには**唯一の正準的な定義**があります。
それは npm パッケージ
[learn-content-engine](https://github.com/astrapi69/learn-content-engine)
が出荷するレッスン JSON Schema です（公開リリースごとに不変）。
このアプリの中では、コンテンツローダープラグインの**構造的な**
Pydantic 層（`adaptive_learner_content_loader.schema`）は、その
ミラーから**再生成**されます
（`scripts/generate_pydantic_models.py`）。手書きされるのは、
意味的なフィールド横断バリデーターだけです。`make sync-schema` は
ミラーを更新して派生アーティファクトを再出力し、バイトパリティ
ゲートが `schema/*.json` とピン留めされたエンジンリリースの一致を
証明します。かつてドリフトしていた場所は、もうドリフトできません。

- `schema/lesson.schema.json`（+ 兄弟ファイル）：機械可読の
  JSON Schema（Draft 2020-12）。レッスンの `.json` からトップ
  レベルの `"$schema"` キーで参照すると、IDE の自動補完と
  インライン検証が得られます。
- `schema/quality-rules.json`：共有の品質最低ライン（例：演習数、
  free-text の許容回答数）。クライアント側のコンテンツ
  バリデーターがこれを使うので、手で維持される 2 つ目のコピーは
  ありません。
- フロントエンドの TypeScript レッスン型と MkDocs ページ
  [レッスンフォーマットリファレンス](lesson-format-reference.md) も
  生成されます（**手で編集しない**）。エンジンのミラーに従うので、
  再ピン後はジェネレーターを再実行してください。

ドリフトゲート（`make sync-schema-check`、`release-test` の一部、
さらに `make test` 内の
`backend/tests/test_lesson_schema_drift.py`）は、生成された
アーティファクトがピン留めされたエンジンミラーから乖離すると
失敗します。チェーンを閉じるのは、アプリ対エンジンのバイト
パリティゲートです：`make engine-parity-check`
（`scripts/check_engine_schema_parity.py`）、オフラインピンの
`engine-schema-parity.test.ts`、そしてピン整合テストの
`engine-pin.test.ts`（`frontend/package.json` の依存関係 ==
`schema/engine-version.txt`）。コンテンツリポジトリは（この
リポジトリではなく）**ピン留めされたエンジンリリース**をミラー
し、自分たちの CI でそのミラーに対して検証します。

**フォーマット変更の手順（スキーマの権威はエンジンにある）：**
レッスンフォーマットの変更はエンジンで始まるか、エンジンで承認
されます。まずエンジンの PR + npm リリース。次にこのアプリが
エンジンのピン（`frontend/package.json` +
`schema/engine-version.txt`）を上げて `make sync-schema` を再実行
し、これがミラーを更新して構造的な Pydantic 層を再生成します。
手で書くのは新しい意味的バリデーターだけです。その後、コンテンツ
リポジトリが `engine-version.txt` のピンを更新します。ミラーへの
手編集（や古いピン）はバイトパリティゲートを赤にします。忘れられた
ステップは可視化され、サイレントなドリフトは起きません。

## 言語ペア（v1.44.0）

すべてのコンテンツセットは、それが教える言語の**ペア**を宣言
します。

- **`target_language`** - 学習者が**学ぶ**もの（例：`fr`）。
- **`source_language`** - 学習者がすでに**話す**もの。つまり、
  カードの **`back`** フィールド、**`notes`**、**理論**テキストが
  書かれる言語（例：`de`）。

まさにこれが、「英語話者向けフランス語」を「ドイツ語話者向け
フランス語」とは*別の*セットにします。ターゲット（`fr`）は
同じでも、ソース言語（`en` か `de` か）が異なり、説明の言語が
異なります。学習者は、その `source_language` が自分の話す言語の
1 つ（アプリ言語に加え、設定 → 学習 でのオプションの追加言語）に
一致するセットだけを見ます。

セット ID はペアを `{target}-{level}-from-{source}` として
エンコードし（例：`fr-a1-from-de`）、各セットはそのソース言語の
ディレクトリを指す **`path`**（`sets/de/fr-a1`）を宣言します。
セットはさらに **`title`**（ソース言語で、学習者が読むもの）と
**`title_native`**（ターゲット言語で、サブタイトルとして）を
持ちます。

両方のコードは ISO 639-1（2 文字）でなければならず、
`source_language` は `target_language` と異なる必要があります。
これらのフィールドを持たない v1.2 以前のセットも引き続き
読み込まれます。古い `language` キーは `target_language` として
受け入れられ、`source_language` は `en` にフォールバックします。

## ディレクトリレイアウト

ツリーはソース言語、次にターゲット+レベルで構成されます。

```
my-content-repo/
  manifest.yaml               # Root: lists every set (with path + pair)
  sets/
    de/                       # Source language: German
      fr-a1/                  # Target French, level A1  -> ID fr-a1-from-de
        manifest.yaml         # Set: lists the lessons
        lessons/
          01-begruessung.json
          ...
        assets/               # optional images / audio
    en/                       # Source language: English
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

### 検索インデックス（`search-index.json`）

コンテンツの発見と検索（*Discover* サーフェス）は、リポジトリの
ルートに公開される軽量な `search-index.json`（約 4 KB、
メタデータのみ - カードの内容は含まない）によって駆動されます。
公式コンテンツリポジトリはこれを提供し、アプリは設定された各
リポジトリのインデックスをクライアント側で取得します（CORS
セーフ、localStorage に 24 時間の stale-while-revalidate TTL で
キャッシュ）。これにより学習者は、ダウンロードする前にセットを
見つけられます。各エントリはそのセットの `id`、`name`、
`description`、`source_language` / `target_language`、`level`、
`domain`、`lesson_count`、`card_count`、`tags`、`ai_validated`
フラグ、`trust_level`、オプションの併読 `book`、そして
`updated_at` タイムスタンプを掲げます。セットマニフェストと同期を
保ってください。公式リポジトリへの PR がこれを再生成します。

## マニフェスト形式

マニフェストのフィールドスキーマ（リポジトリのセットを列挙する
ルート `manifest.yaml` と、その必須・オプションの全フィールド）は、
エンジンのリファレンスにあります：
[learn-content-engine, Manifest format](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md#manifest-format)。
フィールドの一覧はここでは意図的に繰り返しません。エンジンの厳格な
スキーマ（未知のフィールドは拒否される）が各マニフェストを検証し、
エンジンのリファレンスがその唯一の正式な記述です。言語ペアの
フィールド（`target_language` / `source_language`）は
「言語ペア」セクションで説明されているとおりに作成してください。
v1.2 以前の `language` エイリアスも引き続き読み込まれますが、
新しいセットでは推奨されません。

オプションのフィールド **`visibility`**（エンジン 0.14.0 以降、
指定がなければ `visible`）は、コンシューマーアプリ向けの
**表示ヒント**です。`visibility: hidden` は、そのセットを学習者に
見せないようアプリに求めます - エンジン検証のためにリポジトリに
残す必要があるものの、学習コンテンツではないリファレンス／適合
フィクスチャのためのものです。アプリは非表示のセットをブラウズと
*Discover* のサーフェスから除外します（すでにキャッシュされて
いてもです）。エンジンは引き続きそれらを検証します。アプリ側で
維持する非表示セットのリストはもうありません。

覚えておくべきアプリ固有のローダーの挙動：

- セットマニフェストは各レッスンファイルを `metadata.lessons` の
  下に列挙し、コンテンツローダーはそのリストを**与えられた順序で**
  反復します。ディスク上のファイル名は無関係で、マニフェストの
  順序だけが重要です。

  ```yaml
  metadata:
    lessons:
      - 01-intro.json
      - 02-articles.json
      - ...
  ```

## レッスンスキーマ

各レッスンは単一の JSON ファイルです。トップレベルのメタデータ
（`id`、`title`、`description`、`estimated_minutes`）、**カード**の
リスト（最小の学習可能な単位 - 安定した id、front/back のペア、
Markdown の `notes`、SRS 用の `tags`）、および**ステップ**の
リストで、各ステップは THEORY ステップ（Markdown の `body`、
オプションで `example_url` リンクまたはインラインの `examples`）か
EXERCISE ステップ（ちょうど 1 つの演習）のいずれかです。

完全でフィールドごとのフォーマットリファレンス - すべての
フィールド、すべての演習タイプ、すべての cloze モードを、エンジンの
テストスイートで検証された JSON 例とともに - は、**エンジンの
リファレンス**にあります。

- [learn-content-engine - `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)
  - 著者やサードパーティのバリデーター向けの、正準的な
  レッスンフォーマットリファレンス（アプリのチェックアウト不要）
- 各エンジンリリースに同梱される機械可読のスキーマ：
  `import schema from "learn-content-engine/schema/lesson.schema.json"`
- アプリ内の対応版：生成された
  [レッスンフォーマットリファレンス](lesson-format-reference.md)

エンジンに同梱されるスキーマは、このリポジトリで生成される
`schema/lesson.schema.json` とバイト単位で同一です（`make
engine-parity-check` により強制）。したがって「エンジンに対して
検証される」と「アプリで検証される」は同じ主張です。

## どの学習目標にどの演習タイプ

演習タイプは、多様性ではなく**学習目標**で選んでください。単語
ごとの完全一致採点 - 文全体の `word_tiles` や、全文の `free_text` -
は、**自由な産出**では失敗します。1 つの概念は多くの正しい
言い方で表現できるので、内容的に正しい学習者が単語ごとに不正解と
マークされてしまいます。それが、作成されたレッスンが生み出しうる
最もやる気をそぐ瞬間です。代わりに、タイプを目標に合わせて
ください。

| 学習目標 | 適したタイプ |
|---|---|
| 答えが 1 つの事実 | `cloze`（空欄） |
| 概念を認識する | 多肢選択（`select` モードの `cloze`）/ `matching` |
| 概念を定義する | キーとなる用語を空欄にした `cloze` |
| 自由な説明 / 転移 / 比較 | 完全一致のタイプはまだない - 今のところ `cloze` / 多肢選択を使う。自己評価は計画中 |
| 語順が一意に定まる文（言語学習） | `word_tiles` |

経験則：`word_tiles` は語順が本当に一意な文（翻訳ドリル）にのみ
使い、定義や事実は `cloze`（または `cloze` の `select` モードによる
多肢選択）として作成します。自由形式の定義を `word_tiles` や全文の
`free_text` に決して入れないでください - それに対する公平な完全
一致採点は存在しません。完全な分析：EXP-041
（`docs/explorations/EXP-041-aufgabentyp-eignung-und-faire-bewertung.md`）を
参照。

## 演習タイプカタログ（状態）

すべての演習タイプの 1 つのリファレンス：何が出荷されているか、
新しいタイプなしで何が表現可能か、何が候補か、何が意図的に除外
されているか。正準的なモデルは仕様先行では拡張**されません** -
タイプはそのレンダラーとともにのみ出荷されます（`SUPPORTED_EXERCISE_TYPES`
レジストリは `ExerciseType` 列挙型と等しくなければならず、パリティ
テストがそれを強制します。v1.4-preview / `picture_choice` の事例から
得た教訓です）。新しいタイプは、具体的なコンテンツの需要に応じて
[新しい演習タイプの追加](adding-exercise-type.md) のレシピを介して
追加されます。

### 実装済み（`ExerciseType` 列挙型）

| タイプ | 何のため（学習目標、EXP-041） | 注記 |
|------|-----------------------------------|------|
| `matching` | 概念を認識 / ペアにする | ドラッグペア、≥ 3 ペア。 |
| `picture_choice` | 実際の**画像**から認識する | ≥ 2 枚の画像、正解はちょうど 1 つ。テキスト MC には使わない。 |
| `free_text` | 短い事実形の答えを産出する | 完全一致、次に Levenshtein ≤ 1。 |
| `word_tiles` | 一意な語順（言語） | タイルはシャッフルされる。バリアントは `accept_orderings`。 |
| `cloze`（`type`） | 答えが 1 つの事実 | 空欄ごとに 1 つの `<input>`。 |
| `cloze`（`select`） | 単一の多肢選択（レガシーの手段） | タップ可能なボタンとして描画（#1342）。`accept[0]` が正解 + `distractors`。 |
| `cloze`（`multiselect`） | 「当てはまるものをすべて選択」（レガシーの手段） | `accept`（すべて正解）+ `distractors` に対する完全一致セット（#1195）。 |
| `multiple_choice` | **ネイティブなテキスト多肢選択**（スキーマ v1.6、#1525） | `options`（`{text, correct?}`、テキストは一意）+ `multiple`。単一 = 正解ちょうど 1 つ。複数 = 完全一致セット、部分点なし。 |

スキーマ v1.6 以降、ネイティブな `multiple_choice` タイプがあります。
これは `cloze` の `select`/`multiselect` という手段（EXP-036 §4.3、
#890）と**共存**します - 既存の cloze ベースの MC は有効なまま、
何も非推奨になりません。新しいテキスト MC のコンテンツには
`multiple_choice` を優先してください。正解はオプションごとのフラグ
なので、accept/distractors を重複なく保つという落とし穴は起こり
得ません。「マルチプルチョイスの作成」の節を参照。

### 拡張ティア（`ext:` 名前空間）

閉じたコア列挙型を超えて、`ext:<vendor>-<name>` 名前空間の演習
タイプがあります。それらはコアスキーマにとって構造的に不透明です。
それらを使うレッスンは `requires_extensions` でそれらを宣言し、
ペイロードは登録された拡張によって検証され、コアスキーマによっては
決して検証されません。この仕組みはエンジンのリファレンス
[learn-content-engine - `docs/extensions.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/extensions.md)
で説明されています。アプリは 5 つの拡張タイプを採用しています
（`ExerciseDispatcher` の `SUPPORTED_EXT_EXERCISE_TYPES`。パリティ
ゲートがディスパッチャーとロードガードを同期させるので、読み込め
るものはすべて描画できます）。

| タイプ | 何のため | ペイロード（`ext_payload`） | 採用 |
|------|----------|-------------------------|---------|
| `ext:al-categorization` | 用語をグループに分ける | `categories: [{name, items[]}]`、少なくとも 2 つのバケット | #1591（最初の拡張タイプ、棚卸し #1579） |
| `ext:al-error-correction` | 誤りのあるテキストを訂正する | `tokens[]` + `error_index` + `accept[]` | #1593 |
| `ext:al-reading-comprehension` | 読解（文章 + 設問） | `passage` + `questions[]`（各設問は `multiple_choice` / `free_text` のサブ設問） | #1603 |
| `ext:al-graded-quiz` | 採点付きクイズ | `questions[]`（各設問に `points`）+ オプションの `pass_threshold` | #1616。デモのリファレンスセットは Discover / マイコンテンツから隠されている（#1702） |
| `ext:al-dictation` | 音声のディクテーション（聞いてから書き取る） | `audio`（`assets/` のクリップ、またはエディタのアップロードで埋め込まれたデータ URI、#1911）+ `accept[]`（寛容な書き起こしマッチング） | #1881（5 番目の採用） |

**2 つの作成パス。** 拡張演習は、(a) コンテンツリポジトリの JSON
として直接（正準的なパス。エンジンのリファレンスで説明）、または
(b) アプリ内で作成できます。レッスンクリエイターは**拡張作成
ウィザード**（#1852）を得ました。ステップ 1 の *Advanced exercise
types* テンプレートから到達でき、5 つのタイプすべて（#1859
categorization + error-correction、#1865 reading-comprehension +
graded-quiz、#1887 dictation）をカバーします。ディクテーションは、
一般化された `requires_extensions` ゲートの背後で、ステップ 3 の
コア演習タイプピッカーからも到達できます（#1895）。どちらのパスも
同じレッスン JSON を出力し、`requires_extensions` を設定します
（バージョン付き、例：`ext:al-dictation@1`）。

#### 拡張タイプごとの例

各ブロックは、レッスンの `.json` に現れる演習オブジェクトです。
タイプ固有のデータは `ext_payload` の下にあります。正準的な
フィールドリファレンスはエンジンの `docs/extensions.md` です。

```json
{
  "type": "ext:al-categorization",
  "prompt": "Sort each word into fruit or vegetable.",
  "ext_payload": {
    "categories": [
      {"name": "Fruit", "items": ["apple", "banana"]},
      {"name": "Vegetable", "items": ["carrot", "potato"]}
    ]
  }
}
```

```json
{
  "type": "ext:al-error-correction",
  "prompt": "One word is wrong. Correct it.",
  "ext_payload": {
    "tokens": ["The", "two", "child", "are", "playing"],
    "error_index": 2,
    "accept": ["children"]
  }
}
```

```json
{
  "type": "ext:al-reading-comprehension",
  "prompt": "Read the text and answer.",
  "ext_payload": {
    "passage": "Marie is sitting in a café. She orders a coffee and reads a book.",
    "questions": [
      {
        "prompt": "Where is Marie?",
        "type": "multiple_choice",
        "options": [
          {"text": "In a café", "correct": true},
          {"text": "At home"},
          {"text": "At the station"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-graded-quiz",
  "prompt": "Greetings quiz.",
  "ext_payload": {
    "pass_threshold": 60,
    "questions": [
      {
        "prompt": "How do you say 'hello' in French?",
        "type": "multiple_choice",
        "points": 1,
        "options": [
          {"text": "Bonjour", "correct": true},
          {"text": "Merci"},
          {"text": "Au revoir"}
        ]
      }
    ]
  }
}
```

```json
{
  "type": "ext:al-dictation",
  "prompt": "Listen and type what you hear.",
  "ext_payload": {
    "audio": "assets/audio/comment-ca-va.mp3",
    "accept": ["Comment ça va ?", "Comment ca va"]
  }
}
```

### レッスンウィザードでの利用可否

プレイ可能（レンダラーが存在する）、生成可能（AI ミックスが
生み出せる）、手動追加可能（ステップ 3 で手で 1 つ追加・編集する）は、
3 つの異なることです。6 つのコアタイプはすべてプレイ可能かつ生成
可能です。create-lesson ウィザードのタイプピッカー
（`ExerciseGenerator.tsx` の `ALL_TYPES`）は各コアタイプを提供し、
ステップ 3 の各演習はインラインで編集・並べ替え可能で、手動の
**+ Add exercise** ボタンがあります（#1849、#1853）。

| タイプ | プレイ可能 | 生成可能（AI ミックス） | 手動追加可能（ステップ 3） |
|------|----------|----------------------|---------------------------|
| `matching` | はい | はい | はい |
| `free_text` | はい | はい | はい |
| `cloze` | はい | はい | はい |
| `word_tiles` | はい | はい | はい |
| `picture_choice` | はい | はい | はい |
| `multiple_choice` | はい | はい（#1853。単一/複数モードのコントロール #1888） | はい |
| `ext:al-dictation` | はい | いいえ | はい。コアピッカー（#1895）または拡張ウィザード（#1887）から |
| `ext:al-categorization` | はい | いいえ | 拡張ウィザードから（#1859） |
| `ext:al-error-correction` | はい | いいえ | 拡張ウィザードから（#1859） |
| `ext:al-reading-comprehension` | はい | いいえ | 拡張ウィザードから（#1865） |
| `ext:al-graded-quiz` | はい | いいえ | 拡張ウィザードから（#1865） |

ディクテーション以外の 4 つの拡張タイプは、拡張ウィザードで
（またはコンテンツリポジトリの JSON として）作成され、コアの AI
生成に混ぜられることはありません。

**リッスンファーストはモードであってタイプではありません。** #1687
（決定 #1600、オプション A）以降、`free_text` と `matching` の演習は
音声先行の要素（まず聞いてから答える）を持てます。演習のタイプは
変わりません。同じ決定のオプション B、ディクテーションタイプは、
`ext:al-dictation` 拡張として出荷されました（#1881）。上記の拡張
ティアで文書化されています。

### 作成ツールとしてのレッスンクリエイター

アプリ内のレッスンクリエイター（`/create-lesson`）は、AI 生成ボタン
だけでなく、完全な作成サーフェスです。

- **ステップ 3 の各演習はその場で編集可能。** 生成または追加された
  各演習はインラインエディタで開きます（6 つのコアタイプすべて、
  加えて拡張エディタ）。ドラッグで並べ替え、削除、またはミックス
  全体を再生成できます（#1845）。
- **手で演習を追加。** **+ Add exercise** ボタンはタイプを選び、空の
  演習をインラインエディタに直接追加するので、AI 生成なしで作成
  できます（#1849、#1853）。ピッカーは 6 つのコアタイプに加えて
  ディクテーションを列挙します（#1895）。
- **例文が生成を駆動する。** カード（ステップ 2）はオプションの
  **例文**を持てます。それが、そのカードの `cloze` と `word_tiles`
  の生成を可能にし（cloze では、空欄にできるようにカードの front の
  用語を文に含める必要があります）、カード画像が `picture_choice`
  を可能にします。それらがない場合、それらのタイプは静かにスキップ
  され、ステップ 3 が、選ばれたどのタイプが何も生み出さなかったかを
  説明します（#1847、#1848）。
- **生成されるプロンプトは UI 言語に従う。** 演習の指示テンプレートは
  生成時にローカライズされるので（#1857）、ドイツ語 UI の著者は
  英語のデフォルトではなくドイツ語のプロンプトを得ます。古い
  レッスンを開いて編集すると、レガシーの英語デフォルトと依然として
  バイト単位で同一の演習プロンプトは、機会的に UI 言語のテンプレート
  に移行されます（編集状態のみ。保存した場合のみ永続化）（#1861）。

### 新しいタイプなしで表現可能（タイプではなく慣習）

| 概念 | 方法 |
|---------|-----|
| True/False、Yes/No | 2 択の `multiple_choice`（または 2 択の `cloze` `select`） |
| ドロップダウン / ラジオ / チェックボックス | `multiple_choice` / cloze select の表現 - 別々のタイプではない |

### 必要なら計画（候補 - 確約ではない）

| 候補 | 近いもの | いつ |
|-----------|------|------|
| 順序付け / 並べ替え | `word_tiles` | 具体的なコンテンツ需要があってはじめて、レシピを介して。 |
| 数値フィールド（数値比較） | `free_text` | 具体的なコンテンツ需要があってはじめて、レシピを介して。 |

### 意図的に除外

| 除外 | なぜ（1 行） |
|----------|----------------|
| 小論文 / 長文 / 描画 / 数式 / ピアレビュー / 自由な自己評価 | 二値の SRS 採点ができない。自己評価は延期（#1268）。 |
| 音声 / 動画 / ファイルアップロード | ストレージ + インフラ。オフラインファーストと衝突する。唯一の例外：演習エディタがデータ URI としてレッスンに埋め込む、短いディクテーションの音声クリップ。 |
| ホットスポット / シミュレーション / 神経衰弱 / クロスワード | SRS 上の価値なしに構築コストがかかる（もしやるとしても後の別の決定）。 |
| マトリクス / リッカート / スライダー | 学習タイプではなく調査タイプ。 |
| 日付 / 時刻ピッカー | 学習タイプではなくフォームタイプ。 |

## 演習タイプのリファレンス

タイプごとのフィールドリファレンス - `matching`、`picture_choice`、
`free_text`、`word_tiles`、`multiple_choice`、そして `type` /
`select` / `multiselect` モードを持つ `cloze`：必須フィールド、
JSON 例、意味的な規則（cloze の `___` マーカー == `blanks`、
`card_ids` の参照整合性、multiselect の accept/distractor の
非重複、picture-choice の正解ちょうど 1 つ）- は、エンジンの
リファレンスにあります：
[learn-content-engine - `docs/lesson-format.md`](https://github.com/astrapi69/learn-content-engine/blob/main/docs/lesson-format.md)。
そこにある各 JSON 例はエンジンのテストスイートで抽出・検証される
ので、リファレンスは腐りません。アプリ固有の作成慣習は以下に
残します。

### マルチプルチョイスの作成

**推奨（スキーマ v1.6+、#1525）：ネイティブな `multiple_choice`
タイプ。** 各オプションが自分の `correct` フラグを持つため、互いに
重複しないよう保つ別々の accept/distractors リストはありません。
`multiple: false`（デフォルト）は単一選択（正解はちょうど 1 つ）、
`multiple: true` は「当てはまるものをすべて選択」（完全一致セット
採点、部分点なし）です：

```json
{
  "id": "ex-capital",
  "type": "multiple_choice",
  "prompt": "What is the capital of France?",
  "card_ids": ["card-paris"],
  "options": [
    {"text": "Paris", "correct": true},
    {"text": "Berlin"},
    {"text": "Madrid"},
    {"text": "Rome"}
  ]
}
```

**レガシーの手段（引き続き完全に有効 - 共存であり、何も非推奨に
なりません）：** v1.6 より前、テキスト MC は `cloze` の `select`
モードとして作成していました（EXP-036 §4.3、#890）。単一解答の
質問は空欄 1 つの cloze です。`sentence`（`___` で終わる）が質問、
空欄の `accept[0]` が正解のオプション、`distractors` が誤りの
オプションです。例：
`"sentence": "The capital of France is ___."`、
`"blanks": [{"accept": ["Paris"]}]`、`"cloze_mode": "select"`、
`"distractors": ["Berlin", "Madrid", "Rome"]`。

質問全体を `prompt` に置き、素の `"sentence": "___"` を使うことも
できます。レンダラーは正解 + ディストラクターからなる `<select>` を
表示し、選択を採点し、フィードバックを出して SRS に反映します：

```json
{
  "id": "ex-hook-state",
  "type": "cloze",
  "prompt": "Which hook manages local state in a function component?",
  "card_ids": ["card-usestate"],
  "sentence": "___",
  "blanks": [{"accept": ["useState"]}],
  "cloze_mode": "select",
  "distractors": ["useEffect", "useContext", "useRef"]
}
```

> **テキストのマルチプルチョイスを `picture_choice` として決して
> 作成しないでください。** このタイプは実際の画像アセット専用です。
> テキストの選択肢ではプレースホルダーのタイルが描画され、使える
> コントロールにはなりません（参照：
> astrapi69/adaptive-learner-content-test#10）。テキスト MC は
> `multiple_choice`（推奨）または `cloze` の `select` モードです、
> 上記のとおり。

**「当てはまるものをすべて選択」**（正解が 2 つ以上。例：運転
免許試験の問題）は `cloze_mode: "multiselect"` を使います：

```json
{
  "type": "cloze",
  "cloze_mode": "multiselect",
  "sentence": "Which cities are in Germany?",
  "accept": ["Berlin", "Hamburg"],
  "distractors": ["Vienna", "Zurich"]
}
```

**1 つの cloze に複数の空欄**もサポートされます。文中の各 `___` は、
順に `blanks` の次のエントリへマッピングされます。各空欄は独自の
hint + placeholder + accept リストを持てます。要素 SRS は空欄ごとに
1 つの ElementAttempt にファンアウトするので、空欄 A は流暢に埋める
が空欄 B を常に間違える人は、空欄単位のマスタリー追跡を得ます。

**カードのトークンロール（Phase 52I / v1.35.0）** - オプションの
カードメタデータで、cloze ジェネレーターが実行時（復習セッション +
レッスン終了時の訂正ラウンド）に意味的に意味のある空欄を選べる
ようにします。

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "eine Katze",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

ロールの閉じた列挙型：`article` / `verb` / `noun` / `adjective` /
`preposition` / `gender_marker` / `tense_marker`。ロールの追加は
マイナーなスキーマバージョンのバンプです。インラインで拡張しない
でください。

## 非ラテン系文字：翻字の慣習

ターゲット言語が非ラテン系文字（日本語、中国語、韓国語、ギリシャ
語、ヒンディー語 ...）を使うセットのための拘束力ある規則。
コンテンツリポジトリで確立され適用されています - 先例：
[content#90](https://github.com/astrapi69/adaptive-learner-content/issues/90)、
[content#91](https://github.com/astrapi69/adaptive-learner-content/issues/91)。
残ったギャップの一掃：
[content#106](https://github.com/astrapi69/adaptive-learner-content/issues/106)、
[content#107](https://github.com/astrapi69/adaptive-learner-content/issues/107)。

**1. 方向の規則。** 翻字は、ソース言語がラテン系文字を書く場合の
非ラテン系の**ターゲット**言語にのみ用います（de→ja、de→zh、
de→ko ...）。ラテン系文字のターゲットを持つ非ラテン系の**ソース**
言語（hi→en、el→fr）には翻字は付きません - 学習者はすでに自分の
文字を読めます。

**2. 形式。** 原文の直後に丸括弧：こんにちは (konnichiwa)。理論
ステップでは常に。オプションやプロンプトでは、無害な場合のみ
（裏切り禁止の規則を参照）。

**3. 裏切り禁止の規則（核心）。** 翻字は決して解答を漏らしては
なりません。文字読解タスク、声調認識、`word_tiles` のタイル、
cloze の文脈は、問われる要素については翻字**なし**のままにします。
意味のタスクには付けます。迷ったら付けないでください。

- 肯定例（意味マッチング、content#91）：マッチングペア
  `{"left": "妈 (mā)", "right": "Mama / Mutter"}` - 問われる知識は
  意味なので、読みの補助は何も裏切りません。
- 否定例（文字読解、content#91）：`ko-a1/01-hangul-lesen` の文字
  読解演習は翻字なしのままです。ローマ字化が答えそのものだから
  です（文字 → 音）。プロンプト内の `가 (ga)` は学習者に解答を
  手渡してしまいます。

**4. 言語ごとの標準ローマ字化、セット内で一貫して：**日本語は
ヘボン式、中国語は声調記号**付き**の拼音、韓国語は文化観光部
2000 年式、ギリシャ語/ヒンディー語は一般的な簡略翻字。1 つの
セット内でシステムを決して混在させないでください。

**5. タイピングタスク**（`free_text` / cloze の `type` モード）：
`accept[0]` は正準的なローマ字形。加えて、一般的なバリアントも
受け入れます - 日本語：訓令式の綴り（si/ti/tu/hu/zi、例：
`konnichiwa` の隣に `konnitiwa`）。中国語：声調なし拼音
（`nǐ hǎo` の隣に `nihao`）。韓国語：広く使われる別形（例：
`annyeong haseyo`）。記憶のフック：**演習は学習者のキーボードで
決して失敗してはならない。** 先例（IME のブロッカー、content#107）：
가 だけを受け入れる cloze は、韓国語 IME なしでは解けませんでした -
ローマ字の `ga` も受け入れる必要がありました。

どのタイプがどの学習目標を担うか：上記の「演習タイプカタログ（状態）」を参照。

## 演習の方向（v1.46.0 / EXP-018）

すべての演習は、学習者がカードをどちらの方向で練習するかを示す
オプションのフィールド `direction` を受け入れます。

- `target_to_source`（デフォルト）- 受容的：ターゲット言語が
  示され、ソース言語が認識される（より易しい）。
- `source_to_target` - 生産的：ソース言語が示され、ターゲット
  言語が産出される（より難しい）。
- `both` / `random` - 試行ごとの具体的な方向の選択を、
  レンダラー／適応型ジェネレーターに委ねます。

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

このフィールドは追加的です。スキーマはバージョン 1.2 のままで、
`direction` のないレッスンは以前とまったく同じ（受容的）に
振る舞います。SRS は方向ごとにマスタリーを追跡します。受容的に
マスターしたカードは、まだ生産的にはマスターされていません。
cloze 演習は文脈に依存し、`direction` を無視します。難易度の
段階的進行のためには、初期のレッスンを受容的に保ち、後の
レッスンで `source_to_target` を導入します（同梱のパイロット
コンテンツがまさにそうしています）。

### 適応型レッスンジェネレーター向けのアノテーション（v1.36.0+）

Phase 53 の適応型レッスンジェネレーター
（`/adaptive-lesson/:setId`、F-114）は、既存の演習を組み替えて、
学習者の特定の弱点を狙って対処します。ジェネレーターは追加の
アノテーションなしでも機能しますが、2 つのフィールドが大幅に
それを賢くします。

1. **カード上のより広い `token_roles` のカバレッジ。**
   ジェネレーターは `token_roles` を使って次のことを行います。
   - 間違いから cloze バリアントを生成する際に、意味的に妥当な
     空欄を選ぶ（v1.35.0 で既に）
   - 間違いを `article_gender` / `verb_conjugation` として分類し、
     ダッシュボードの「練習の重点」チップに使う（53E）
   - 元の演習が間違っていたとき、同じ要素をテストする
     代替演習を見つける（53D のバリエーションロジック - その
     カードに合致する `token_roles` エントリを持つ候補を
     見つけます）

   独自の文法単位を教える各カード（冠詞、活用した動詞形、性を
   持つ名詞）に `token_roles` エントリを追加してください。
   コストはカードごとに JSON エントリ 1 つ。見返りは、はるかに
   豊かな適応生成です。

2. **`tags: ["article", "masculine"]` のようなカードタグ**は、
   `token_roles` がない場合のフォールバックとして、間違い
   分類器に読まれます。`token_roles` の代わりにはなりません -
   安価で中途半端なアノテーションです。

まだ必要としていないもの（将来のスキーマバンプに延期）：

- 異なるレッスンのカード間の `related_cards` 相互参照
- 演習ごとの難易度評価（ジェネレーターは現在、難易度を
  `exercise.type` から推定します）
- 代替の cloze 文脈として解析可能な、`notes` 内のカードごとの
  例文（cloze ジェネレーターは `front` のみを使います）

経験則：文法トークンを教える各カードに `token_roles` を追加して
ください。これが、適応システムにとって最も効果の大きい著作
習慣です。

## アセット（セットが同梱する画像）- v1.37.0+

picture-choice 演習とカードのカバー画像は、2 つのソースから
来ます。
1. **著者のアセットファイル**。セットマニフェストで宣言され、
   レッスン JSON の隣に同梱されます。
2. **プレースホルダー SVG**。アセットが存在しない場合に実行時に
   生成されます（色語のためのカラータイル、数字のための大きな
   数字、それ以外すべてのためのアバタースタイル）。

アセットなしでセットを公開しても、picture-choice は引き続き
機能します。プレースホルダー SVG ジェネレーターが色 + 数字を
自動的にカバーし、それ以外すべてについては決定論的なアバターに
フォールバックします。

### ディレクトリレイアウト

セットのディレクトリ内で、アセットは `assets/` の下に置きます。

```
sets/
  language-fr-a1/
    manifest.yaml
    lessons/
      01-greetings.json
      02-numbers.json
      ...
    assets/
      img/
        chat.png
        chien.png
        oiseau.png
```

### マニフェストでの宣言

各アセットは、ダウンローダーが何を取得すべきかを知るために、
セットマニフェストで宣言する必要があります。

```yaml
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 10
    assets:
      - path: img/chat.png
        size_kb: 45
      - path: img/chien.png
        size_kb: 38
```

`path` はセットの `assets/` ディレクトリからの相対パスです
（レッスン JSON からではありません）。レッスン JSON 内では、
picture-choice 演習は `assets/` プレフィックスを**付けて**
アセットを参照します。

```json
{
  "type": "picture_choice",
  "prompt": "Welches ist 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Katze", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Hund"}
  ]
}
```

フロントエンドは、アセットリゾルバを呼び出すときに `assets/`
プレフィックスを自動的に除去するので、レッスン JSON は著者に
とって直感的な形のままです。

### サイズ + 形式の制限

- **アセットごとの上限**：500 KiB。マニフェストバリデーターは、
  宣言された `size_kb` がこの上限を超えるアセットを拒否します。
  ダウンローダーも、実際のバイトサイズが宣言を 10% 超える
  アセットを拒否します - マニフェストを正直に保ちます。
- **セットごとのソフト上限**：合計 10 MiB。バリデーターは警告
  しますが、拒否はしません。
- **受け入れられる形式**：`.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`。GIF（アニメーションコンテンツは気を散らす）も BMP
  （圧縮なし）も不可。写真には WebP を推奨します - 同等の品質で
  PNG よりはるかに小さい。アイコン + 図には SVG を推奨します -
  きれいにスケールし + 極小のファイルサイズです。

### サイズの推奨

picture-choice タイルは、デスクトップで最大 150x150 px、モバイルで
100x100 px にレンダリングされます（`object-fit: contain`）。
300x300 px のソース画像が、不要なデータ量なしに Retina 画面で
最良の結果をもたらします。150 KiB を超える PNG が、半分のサイズの
よく圧縮された WebP より見栄えが良くなることはまずありません。

### 実行時プレースホルダーで十分な場合

著者の画像が学習上の利得をもたらさないほど、実行時
プレースホルダーが優れている 3 種類のレッスン：

- **色のレッスン**（`rouge` / `rojo` / `rot` / `red`）：
  プレースホルダージェネレーターは、色名に合った色付きの hex
  タイルを生成します。著者のタイルは冗長です。
- **数字のレッスン**（`7` / `42` / `1492`）：プレースホルダーは
  数字を大きく + 中央に表示します。著者の画像は、非アラビア
  数字体系の場合のみ意味があります。
- 明白な視覚的表現を持たない**抽象概念**（`patience`、
  `liberté`）：アバタープレースホルダーは、議論を呼ぶアイコンの
  選択を強いることなく、明確な視覚的アンカーを提供します。

それ以外すべて（動物、物、食べ物、場所、体の部位）については、
著者の画像が認識 + 記憶を測定可能なほど助けます。

## 品質チェックリスト

新しいレッスンの PR の前に確認してください。

- [ ] レッスンごとに**3〜5 個の理論ステップ** + **8〜12 個の演習**
- [ ] **少なくとも 3 種類の演習タイプ**が含まれる（matching、picture-choice、free-text、word-tiles、cloze - cloze は v1.35.0 以降）
- [ ] **理論ステップはステップごとに 200 語以下**
- [ ] **free-text 演習**：≥ 3 個の accept バリアント + ≥ 3 個の distractor
- [ ] **word-tiles**：演習ごとに ≥ 3 個のタイル
- [ ] **estimated_minutes**：10〜15（理想化せず、現実的に）
- [ ] **distractor は間違いだが妥当**であること - 意味的に関連し、決してランダムではない
- [ ] **カードの notes** が本当の付加価値を提供する（発音、フォールスフレンド、例外フラグ）
- [ ] **段階的な構造**：後の概念が同じセット内の前の概念の上に積み上がる
- [ ] **文化的な正確さ**：実際の言語使用であり、教科書の決まり文句だけではない
- [ ] **スキーマ検証**：レッスンが `dict_to_lesson()` できれいに読み込まれる（ローカルでのテストを参照）
- [ ] **カード ID の整合性**：各 `exercise.card_ids[i]` がレッスンの `cards[]` に存在する
- [ ] **言語ペア**：`target_language` + `source_language` が設定されている（ISO 639-1、相異なる）、`title_native` が存在する

## 検証（2 つの層、v1.44.0）

コンテンツは、**同じ**チェックを行う 2 つの検証層によって守られ
ます。

1. **アプリ内、共有の前。** *マイレッスン → コミュニティに提供*を
   通じて共有すると、まずルールベースのチェックが（常に、AI なしで）
   実行されます。これは下記の**最低基準**を強制します。それを
   下回るセットは共有できません。それに合格し、かつ AI キーが
   設定されている場合、学習者は**オプション**で補完的な AI
   チェック（翻訳の正確さ、distractor の妥当性、文法、レベル、
   文化的な配慮、自然さ）を開始できます。AI のステップは決して
   自動ではなく、明示的な同意を必要とし（レッスンコンテンツが
   設定済みのプロバイダーに送信されます）、共有を決してブロック
   しません - ルールベースのチェックが関門です。
2. **コンテンツリポジトリの CI で。** `astrapi69/adaptive-learner-content`
   へのプルリクエストは、独自の `scripts/validate_content.py`
   （ベンダー化された、エンジンにピン留めされたスキーマミラーに
   対する構造 + 品質最低基準）に加えて、エンジン適合ゲート
   （各レッスンに対する `learn-content-engine` の `validate()`）を
   実行するので、手動の PR が関門を回避することはありません。

**品質の最低基準（ハードな関門）：** レッスンごとに ≥ 5 個の
演習、≥ 2 種類の演習タイプ、≥ 1 個の理論ステップ、free-text は
≥ 2 個の正解 + distractor、matching は ≥ 3 ペア、picture-choice は
distractor 付き、空のカードの表面・裏面なし、そして（非ラテン系の
ソース文字の場合）カードの裏面がソース文字で書かれていること。
これらは最低基準であり、目標ではありません - 上のチェックリストは
それ以上を求めます。

### セット全体の AI コンテンツチェック（オプション）

共有時のチェックに加えて、ダウンロード済みのセットは *Check with
AI* を通じてセット全体でレビューできます。これは完全にオプション
であり、学習者が設定した**プロバイダー + モデル**（Anthropic /
OpenAI / Gemini）を使います。カードはバッチでそのプロバイダーに
レビューのため送信されます。フローはコスト見積もりを表示し、
プログレスバー + キャンセル付きで実行し、ブラウザにキャッシュされ
**Markdown** としてエクスポートできる**カードごとのレポート**
（どのプロバイダー + モデルがチェックを実行したかを記録する行付き）
を生成します。レポートが合格すると、セットはコンテンツハッシュ +
署名で裏付けられた**「AI チェック済み」バッジ**を獲得するので、
後でカードを編集すると、セットが再チェックされるまでバッジが
無効化されます。AI チェックは決して関門ではありません - 助言的な
出所証明であって、公開の要件ではありません。

## ローカルでのテスト

コンテンツローダーのスキーマバリデーターは `make test` の一部
として実行されます。1 つのレッスンを手動で検証するには：

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} - {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

コンテンツリポジトリのすべてのレッスンを一度に検証するには -
コンテンツリポジトリのバリデーター（その CI が PR のたびに実行
するのと同じスクリプト）を使います。

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

これは `sets/{source}/{target-level}/` の下の各セットを見つけ、
スキーマに加えて品質の最低基準（≥5 個の演習、≥2 種類の演習
タイプ、≥1 個の理論ステップ、free-text の accept + distractor、
matching のペア、空のカードなし、カード ID の整合性）を検査します。
新しいレッスンは自動的に検出されます - テストの変更は不要です。

## PR ワークフロー

セットが完成したら：

1. メインリポジトリに対して PR を開く（アプリに同梱される
   べきセットの場合）、または
2. あなたの GitHub アカウントの下に独自のコンテンツリポジトリを
   作り、コンテンツローダーを
   `backend/config/plugins/content-loader.yaml`（`default_sources`
   の下）で設定します。

コンテンツローダーは、任意の公開 GitHub リポジトリをソースとして
サポートします。プライベートリポジトリには、3 層のキー管理
（`~/.config/adaptive_learner/secrets.yaml`）を通じて設定される
パーソナルアクセストークンが必要です。

## よくあるつまずき

**カード ID の参照**：演習の各 `card_ids` エントリは、レッスンの
`cards[]` に存在しなければなりません。演習をレッスン間でコピー
して、対応するカードを一緒に持っていくのを忘れると、検証が
失敗します。

**slug 安全な ID**：すべての ID（レッスン、カード、ステップ、
演習）は `^[a-z0-9]+(-[a-z0-9]+)*$` に一致しなければなりません。
アンダースコア、アポストロフィ、大文字、先頭／末尾のハイフンは
不可です。

**`is_correct: "true"`**：これは JSON のブール値ではなく文字列
です。スキーマは picture_choice のフィールドが内部的に
dict[str, str] としてモデル化されているため、明示的に `"true"` を
要求します。

**余分なフィールド**：各モデルは `extra="forbid"` です。文書化
されていないフィールドは、レッスン全体の拒否につながります。
文書化されたフィールドに従ってください。

**理論の body**：理論ステップは空でない `body` フィールド
（Markdown）を必要とします。演習ステップは `body` を持っては
いけません - 代わりに演習の `prompt` を使ってください。

## リファレンス：同梱セット

Adaptive Learner は、いくつかのドメインにまたがる相当なライブラリ
（言語、プログラミング、心理学、AI、テクノロジー - ライブの数と
完全なセットごとの表については README の CONTENT-STATS ブロックを
参照）を同梱しています。`adaptive-learner-content` リポジトリ内の
良い正準的リファレンスをいくつか挙げます。

- `sets/en/fr-a1/` - 英語話者向けフランス語 A1。
  `sets/de/fr-a1/` はドイツ語ソースの対応版です。
- `sets/en/es-a1/` + `sets/de/es-a1/` - スペイン語 A1（ソース言語
  ごとに 1 つ）。
- `sets/de/` の下の「Python - Grundlagen」セットは、
  `domain: programming` の例（ドイツ語ソース == ターゲット）で、
  非言語のリファレンスとして有用です。

すべてこのガイドで説明した規則に従っています。完全なレッスンを
1 つ通読することが、構造を体得する最速の方法です。

---

## コミュニティ参加への道（v1.42.0）

> **スクリーンショット付きのステップバイステップの解説：**
> [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f)
> （Medium）は、最初のカードから完成したレッスンの共有まで、アプリ内の
> レッスンクリエイターをはじめから終わりまで案内します。

レッスンをゼロから手作業で作る必要はありません。何かを寄稿する
最も手早い方法は、**アプリ内でレッスンを作成して共有する**こと
です。

1. チャットをインポートして分析し、その後**オフラインレッスン
   として保存**します（または適応型レッスンを終えて**この
   レッスンを保存しますか？**）。レッスンはセットブラウザの
   **マイレッスン**の下に現れます。
2. 「マイレッスン」で**コンテンツセットとしてエクスポート**を
   クリックすると、コンテンツセットを `.zip` としてダウンロード
   できます（マニフェスト + レッスン）。エクスポートにはレッスン
   コンテンツのみが含まれます - 進捗も、間違い履歴も、個人的な
   ものも含まれません。
3. **コミュニティに提供**をクリックすると、コンテンツリポジトリに
   事前入力された**プルリクエスト**が開きます - レッスン JSON が
   ツリーの正しいパスにコミットされ、`.zip` の添付は不要です。
4. リポジトリの CI が PR を自動的に検証します。メンテナーが
   レッスンを審査し、マニフェスト（id、title、language、level、
   tags）を上記の規則に合わせ、`sets/` の下にマージします。
   マージ後は、誰でもセットブラウザからダウンロードできます。

これがソーシャルな道です。審査は**手作業**で（メンテナーが
すべての追加をキュレーションし、自動公開されるものは何も
ありません）、全体の流れは GitHub だけで済みます。生成された
レッスンはすでにスキーマに対して検証されているので、寄稿された
レッスンはたいてい、マニフェストの少しの仕上げだけで済みます。

## 共有アシスタント、バリエーション、著者クレジット（Phase 64）

**マイレッスン**からレッスンを共有すると、GitHub に直接飛ぶ
代わりに、4 ステップのアシスタントが開きます。

1. **プレビュー + 配置。** アプリは、レッスンがツリー内のどこに
   落ち着くか（`sets/{ソース}/{ターゲット}-{レベル}/`）と、自動
   採番されたファイル名（`{nn}-{slug}.json`、既存のレッスンの次の
   番号）を正確に計算します。まったく新しいペア + レベルには
   *「新しいセットです！あなたが最初です。」*が表示されます。
2. **重複チェック。** レッスンは、そのパスに既に存在する
   レッスンと比較されます（カードと演習の重なり - 助言的で、決して
   ブロックしません）。似たものが存在する場合は、次のことが
   できます。
   - **バリエーションとして共有** - レッスンに
     `variation_of: "{original_id}"` と、オプションの
     `variation_note`（「あなたのバージョンはどこが違いますか？」）が
     マークされます。
   - **新しい演習のみを提案**（ほぼ重複の場合）- アシスタントは、
     オリジナルに欠けている演習だけを、対応するカードとともに、
     補完バリエーションとして抽出します。
3. **品質サマリー。** ルールベースのバリデーターの所見（加えて
   オプションの AI チェック）。警告は表示されますが、決して
   ブロックしません。
4. **共有 + お祝い。** ワンクリックで GitHub のプルリクエストが
   開き（小さなレッスンはファイルエディタ、大きなレッスンは
   アップロードページ）、アプリが小さなお祝いで感謝します。

### バリエーションとクレジットのフィールド（スキーマ 1.3、すべてオプション）

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Mehr Übungen zur Angleichung",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

4 つすべてが追加的でオプションです。それらのないレッスンは以前と
まったく同じに振る舞います。`contributed_by` は、著者が共有時に
クレジットを有効化した場合に設定されます（次回のためにローカルに
記憶される*「あなたの名前（オプション）」*フィールド）。存在する
場合、ビューアはタイトルの下に*「{name} による提供」*という控えめな
行を表示し、プルリクエストのテキストはそのメタデータテーブルに
著者を列挙します。

### 寄稿履歴とギャップ

共有されたレッスンはローカルに記憶され（アカウント不要）、
**マイ寄稿**の下にカウンターと、5 つのレッスンを共有すると
*コミュニティ寄稿者*の称号が付きます。セットブラウザはさらに
**欠けているレッスン**を表示します - 既存のペアの次の CEFR
レベルへの、あるいはあるソース言語には存在するが別のソース言語
では欠けているターゲット言語への、励みになる提案です
（「手伝えますか？」）。

---

## 関連ページ

- [レッスンを作成する - 概要](../content-creation/overview.md) - 入門 + アプリ内のレッスンクリエイター
- [書籍の推薦](../content-creation/books.md) - ドメインごとの `books.yaml` を管理する
- [複数のコンテンツリポジトリ](../features/content-repos.md) - 自分のリポジトリを接続する
- [Create a lesson in the app, step by step](https://medium.com/@asterios-raptis/create-a-lesson-in-the-app-step-by-step-dadd6927829f) - スクリーンショット付きの外部 Medium 解説
