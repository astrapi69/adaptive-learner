# レッスンコンテンツを作成する

このガイドは、Adaptive Learner のコンテンツローダー向けに新しい
レッスンセットをどう用意するかを、ステップごとに説明します。
言語またはテーマのセットを作りたい人 — 自分用でも、公開
コンテンツプールへの寄稿としてでも — は、最初のレッスンの前に
一度通して読んでおくべきです。

## コンテンツセットとは

**コンテンツセット**は、ユーザーがセットブラウザのページ
（`/content`）からダウンロードできる、バージョン管理された
レッスンの束です。コンテンツローダープラグイン（v1.27.0）が、
両方のストレージモードで発見、ダウンロード、キャッシュ、
バージョンの突き合わせを担います。

セットには 3 つの層があります。

1. **ルートマニフェスト**（`manifest.yaml`）— リポジトリの各
   セットを列挙します。セットブラウザがソースカタログのために
   読み込みます。
2. **セットマニフェスト**（`sets/{set-id}/manifest.yaml`）—
   ルートマニフェストの兄弟で、その具体的なセットのレッスン
   ファイルを列挙します。
3. **レッスンファイル**（`sets/{set-id}/lessons/NN-slug.json`）—
   レッスンごとに 1 つの JSON ファイル。ダウンロードのたびに
   スキーマ v1.0 に対して検証されます。

Adaptive Learner に同梱されるパイロットセットは、別のコンテンツ
リポジトリ
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
にあり（兄弟チェックアウト `../adaptive-learner-content` として
チェックアウトされ、ビルドが `frontend/scripts/copy-bundled-content.mjs`
を介して同梱します）、テンプレートとして適しています。

## 言語ペア（v1.44.0）

すべてのコンテンツセットは、それが教える言語の**ペア**を宣言
します。

- **`target_language`** — 学習者が**学ぶ**もの（例：`fr`）。
- **`source_language`** — 学習者がすでに**話す**もの。つまり、
  カードの **`back`** フィールド、**`notes`**、**理論**テキストが
  書かれる言語（例：`de`）。

まさにこれが、「英語話者向けフランス語」を「ドイツ語話者向け
フランス語」とは*別の*セットにします。ターゲット（`fr`）は
同じでも、ソース言語（`en` か `de` か）が異なり、説明の言語が
異なります。学習者は、その `source_language` が自分の話す言語の
1 つ（アプリ言語に加え、設定 → 学習 でのオプションの追加言語）に
一致するセットだけを見ます。

セット ID はペアを `{ターゲット}-{レベル}-from-{ソース}` として
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
mein-content-repo/
  manifest.yaml               # ルート: 各セットを列挙 (path + ペア付き)
  sets/
    de/                       # ソース言語: ドイツ語
      fr-a1/                  # ターゲット フランス語、レベル A1  -> ID fr-a1-from-de
        manifest.yaml         # セット: レッスンを列挙
        lessons/
          01-begruessung.json
          ...
        assets/               # オプションの画像 / 音声
    en/                       # ソース言語: 英語
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

## マニフェスト形式

両方のマニフェストファイル（ルート + セット）は、
`schema_version: '1.0'` を持つ同じ形式を使います。必須
フィールド：

```yaml
schema_version: '1.0'
name: Mein Englisch-B1-Set
description: >-
  Optionale Langbeschreibung.
sets:
  - id: language-en-b1        # slug-sicher, eindeutig
    title: Englisch B1 (Fortgeschrittene)
    language: en              # BCP-47 (z.B. en, fr, zh-Hans)
    level: B1                 # CEFR für Sprachen, frei für andere Domänen
    version: '1.0.0'          # Semver — pro Set-Release erhöht
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Optionale Set-Beschreibung.
    tags:
      - intermediate
      - business
metadata:
  author: Dein Name
  license: CC-BY-SA-4.0       # oder die Lizenz deiner Wahl
```

セットマニフェストは、さらに各レッスンファイルを列挙します。

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

コンテンツローダーは `metadata.lessons` を与えられた順序で
反復します。ディスク上のファイル名は無関係で、マニフェストの
順序だけが重要です。

## レッスンスキーマ（v1.0）

各レッスンは単一の JSON ファイルです。トップレベルの構造：

```json
{
  "id": "01-greetings",
  "title": "Begrüßungen",
  "description": "Optionale 1-2-Satz-Zusammenfassung.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Cards

カードは最小の学習可能な単位で、通常は単一の用語または概念
です。各カードは安定した id（演習から参照される）と front/back の
ペアを持ちます。

```json
{
  "id": "art-le",
  "front": "le",
  "back": "der (männlich Singular)",
  "notes": "Vor konsonantenanfangenden männlichen Substantiven. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

`notes` は Markdown を受け入れます。発音の規則、フォールス
フレンドの警告、例外の注意 — 長期記憶を改善するもの — に使い
ます。`tags` は SRS のフィルタリングを制御します。

### Steps

レッスンはステップごとのシーケンスで、各ステップは THEORY
（Markdown ブロック）または EXERCISE（4 つの演習タイプのうちの
1 つ）のいずれかです。

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Warum Artikel wichtig sind",
  "body": "# Artikel im Französischen\n\nJedes französische Nomen hat ein Geschlecht..."
}
```

理論ステップは、オプションで**例リンク**を持てます（スキーマ
v1.4、追加的 — 既存のレッスンはそれなしでも有効なままです）。
存在する場合、ビューアはその下に例を開くボタンをレンダリング
します。

```json
{
  "id": "intro",
  "type": "theory",
  "body": "Die Korrelation misst den Zusammenhang...",
  "example_url": "https://example.com/correlation-visualizer",
  "example_label": "Interaktive Visualisierung"
}
```

- `example_url`（オプション）：`http(s)` の URL でなければなり
  ません。
- `example_label`（オプション）：リンクのテキスト。空の場合は
  ローカライズされた「例を見る」になります。

または演習：

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Begrüßungen zuordnen",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Ordne jede Begrüßung ihrer Übersetzung zu.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hallo"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## 演習タイプのリファレンス

### matching

ドラッグペアの演習。レンダラーは表示前にシャッフルします。

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Ordne jedem französischen Nomen seinen Artikel zu.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

各ペアはちょうど 2 つのキーを持たなければなりません：`left` +
`right`。

### picture_choice

画像付きの多肢選択。画像 2 枚以上、ちょうど 1 枚を正解として
マークします。

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Welche Begrüßung passt zum Abend?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optionaler Markdown-Tipp auf Knopfdruck.",
  "distractors": ["Bonjour"]
}
```

重要：`is_correct` は JSON のブール値ではなく、**文字列**の
`"true"` です。

`src` のパスが存在しないファイルを指す場合、レンダラーは
`label` にフォールバックします。つまり picture_choice は
イラストのアセットがなくても機能します。

### free_text

答えを入力します。レンダラーはまず完全一致を試み、次に
Levenshtein 寛容のマッチングを行います。

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "Wie sagt man 'Danke' auf Französisch?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Beginnt mit M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` は、誤答時に表示される正規の答えです。大文字・
小文字 + 句読点をカバーするために 3 つ以上のバリアントを列挙
してください。空白はレンダラーが正規化します。

### word_tiles

タイルを正しい順序に並べます。レンダラーは表示前に
シャッフルします。

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Bring die Kacheln in die Reihenfolge: Ich sehe eine Katze.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Gleiche Wortreihenfolge wie im Deutschen."
}
```

複数の語順が正しい場合は、`accept_orderings` を追加します。

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

各順序はタイルのインデックスの順列です。

### cloze（Phase 52 / v1.35.0 — スキーマ 1.1）

文中に見える `___` マーカーを使った穴埋め。各 `___` は
`blanks[]` の 1 つのエントリに対応します（左から右への
マッピング。ローダーは `sentence.count("___") == len(blanks)` を
検査します）。

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Setze den unbestimmten Artikel ein.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "männlicher unbestimmter Artikel",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* ist der männliche unbestimmte Artikel."
}
```

**レンダリングモード** — 演習ごとに `cloze_mode` で設定します。

- `"type"`（設定しない場合のデフォルト）：空欄ごとに 1 つの
  `<input>`。free-text と同じ NFC + Levenshtein ≤ 1 のマッチャーで
  検証されるので、著者は意味的なバリアントだけを列挙すれば
  よく、タイプミスは不要です。
- `"select"`：空欄ごとに 1 つの `<select>`。選択肢は演習の
  `accept[0]` + `distractors` から、空欄ごとに安定したシードで
  シャッフルされます。**空でない `distractors` が必須**です —
  スキーマバリデーターは、それなしの `cloze_mode: "select"` を
  拒否します。

**1 つの cloze に複数の空欄**もサポートされます。文中の各 `___`
は、順に `blanks` の次のエントリへマッピングされます。各空欄は
独自の hint + placeholder + accept リストを持てます。要素 SRS は
空欄ごとに 1 つの ElementAttempt にファンアウトするので、空欄 A は
流暢に埋めるが空欄 B を常に間違える人は、空欄単位のマスタリー
追跡を得ます。

**カードのトークンロール（Phase 52I / v1.35.0）** — オプションの
カードメタデータで、cloze ジェネレーターが実行時（復習セッション
+ レッスン終了時の訂正ラウンド）に意味的に意味のある空欄を
選べるようにします。

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

## 演習の方向（v1.46.0 / EXP-018）

すべての演習は、学習者がカードをどちらの方向で練習するかを示す
オプションのフィールド `direction` を受け入れます。

- `target_to_source`（デフォルト）— 受容的：ターゲット言語が
  示され、ソース言語が認識される（より易しい）。
- `source_to_target` — 生産的：ソース言語が示され、ターゲット
  言語が産出される（より難しい）。
- `both` / `random` — 試行ごとの具体的な方向の選択を、
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
     代替演習を見つける（53D のバリエーションロジック — その
     カードに合致する `token_roles` エントリを持つ候補を
     見つけます）

   独自の文法単位を教える各カード（冠詞、活用した動詞形、性を
   持つ名詞）に `token_roles` エントリを追加してください。
   コストはカードごとに JSON エントリ 1 つ。見返りは、はるかに
   豊かな適応生成です。

2. **`tags: ["article", "masculine"]` のようなカードタグ**は、
   `token_roles` がない場合のフォールバックとして、間違い
   分類器に読まれます。`token_roles` の代わりにはなりません —
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

## アセット（セットが同梱する画像）— v1.37.0+

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
  アセットを拒否します — マニフェストを正直に保ちます。
- **セットごとのソフト上限**：合計 10 MiB。バリデーターは警告
  しますが、拒否はしません。
- **受け入れられる形式**：`.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`。GIF（アニメーションコンテンツは気を散らす）も BMP
  （圧縮なし）も不可。写真には WebP を推奨します — 同等の品質で
  PNG よりはるかに小さい。アイコン + 図には SVG を推奨します —
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
- [ ] **少なくとも 3 種類の演習タイプ**が含まれる（matching、picture-choice、free-text、word-tiles、cloze — cloze は v1.35.0 以降）
- [ ] **理論ステップはステップごとに 200 語以下**
- [ ] **free-text 演習**：≥ 3 個の accept バリアント + ≥ 3 個の distractor
- [ ] **word-tiles**：演習ごとに ≥ 3 個のタイル
- [ ] **estimated_minutes**：10〜15（理想化せず、現実的に）
- [ ] **distractor は間違いだが妥当**であること — 意味的に関連し、決してランダムではない
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
   しません — ルールベースのチェックが関門です。
2. **コンテンツリポジトリの CI で。** `astrapi69/adaptive-learner-content`
   へのプルリクエストは `scripts/validate_content.py`
   （`docs/ci/adaptive-learner-content/` の下にミラーされています）を
   実行し、同じ規則で各セットを検査するので、手動の PR が関門を
   回避することはありません。

**品質の最低基準（ハードな関門）：** レッスンごとに ≥ 5 個の
演習、≥ 2 種類の演習タイプ、≥ 1 個の理論ステップ、free-text は
≥ 2 個の正解 + distractor、matching は ≥ 3 ペア、picture-choice は
distractor 付き、空のカードの表面・裏面なし、そして（非ラテン系の
ソース文字の場合）カードの裏面がソース文字で書かれていること。
これらは最低基準であり、目標ではありません — 上のチェックリストは
それ以上を求めます。

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
print(f'OK: {lesson.id} — {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

コンテンツリポジトリのすべてのレッスンを一度に検証するには —
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
新しいレッスンは自動的に検出されます — テストの変更は不要です。

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
いけません — 代わりに演習の `prompt` を使ってください。

## リファレンス：パイロットセット

Adaptive Learner に同梱される 2 つのセットが、正規のリファレンス
です。

- `sets/en/fr-a1/` — 英語話者向けフランス語 A1（10 レッスン、
  約 2 時間）。`sets/de/fr-a1/` はドイツ語話者向けのパイロット
  セットです。
- `sets/en/es-a1/` + `sets/de/es-a1/` — スペイン語 A1（ソース言語
  ごとに 15 レッスン）、`adaptive-learner-content` リポジトリ内。

両方ともこのガイドで説明した規則に従っています。完全なレッスンを
1 つ通読することが、構造を体得する最速の方法です。

---

## コミュニティ参加への道（v1.42.0）

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
   コンテンツのみが含まれます — 進捗も、間違い履歴も、個人的な
   ものも含まれません。
3. **コミュニティに提供**をクリックすると、コンテンツリポジトリに
   事前入力された**プルリクエスト**が開きます — レッスン JSON が
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
   レッスンと比較されます（カードと演習の重なり — 助言的で、決して
   ブロックしません）。似たものが存在する場合は、次のことが
   できます。
   - **バリエーションとして共有** — レッスンに
     `variation_of: "{original_id}"` と、オプションの
     `variation_note`（「あなたのバージョンはどこが違いますか？」）が
     マークされます。
   - **新しい演習のみを提案**（ほぼ重複の場合）— アシスタントは、
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
**欠けているレッスン**を表示します — 既存のペアの次の CEFR
レベルへの、あるいはあるソース言語には存在するが別のソース言語
では欠けているターゲット言語への、励みになる提案です
（「手伝えますか？」）。

---

## 関連ページ

- [レッスンを作成する — 概要](../content-creation/overview.md) — 入門 + アプリ内のレッスンクリエイター
- [書籍の推薦](../content-creation/books.md) — ドメインごとの `books.yaml` を管理する
- [複数のコンテンツリポジトリ](../features/content-repos.md) — 自分のリポジトリを接続する
