<!-- Translation: AI-generated, pending native review -->

# レッスンコンテンツの作成

このガイドでは、Adaptive Learnerのコンテンツローダー向けに新しいレッスンセットを作成する手順を説明します。個人使用または公開コンテンツプールへの貢献として言語やトピックのセットを公開したい方は、レッスンを作成する前にこのガイドを最初から最後まで読んでください。

## コンテンツセットとは

**コンテンツセット**は、ユーザーがセットブラウザページ（`/content`）からダウンロードできるバージョン管理されたレッスンのバンドルです。コンテンツローダープラグイン（v1.27.0搭載）が両方のストレージモードで、発見、ダウンロード、キャッシュ、バージョン調整を処理します。

セットは3つの層を持ちます。

1. **ルートマニフェスト**（`manifest.yaml`）— リポジトリが提供するすべてのセットをリストします。セットブラウザがソースカタログのレンダリングに使用します。
2. **セットマニフェスト**（`sets/{set-id}/manifest.yaml`）— ルートマニフェストの兄弟にあたり、この特定のセット内のレッスンファイルをリストします。
3. **レッスンファイル**（`sets/{set-id}/lessons/NN-slug.json`）— レッスン1つにつき1つのJSONファイル。ダウンロードのたびにスキーマv1.0に対してバリデーションされます。

Adaptive Learnerに同梱されているパイロットセットは、別のコンテンツリポジトリ[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)（兄弟として`../adaptive-learner-content`にクローンされ、`frontend/scripts/copy-bundled-content.mjs`でビルドにバンドルされます）に置かれており、コピーの良いテンプレートとなっています。

## 言語ペア（v1.44.0）

すべてのコンテンツセットは、教える言語の**ペア**を宣言します。

- **`target_language`** — 学習者が**学ぶ**言語（例: `fr`）。
- **`source_language`** — 学習者が**すでに話す**言語。カードの**`back`**フィールド、**`notes`**、**理論**テキストが書かれる言語（例: `de`）。

これが「英語話者向けフランス語」と「ドイツ語話者向けフランス語」を*別のセット*にする理由です。ターゲット（`fr`）は同じですが、ソース（`en`対`de`）が異なり、説明の言語が異なります。学習者は自分が話す言語（アプリの言語、さらにSettings → Learningでオプトインした追加の言語）に一致する`source_language`を持つセットのみを見ることができます。

セットIDはペアを`{target}-{level}-from-{source}`（例: `fr-a1-from-de`）としてエンコードし、各セットはソース言語ディレクトリを指す**`path`**（`sets/de/fr-a1`）を宣言します。セットには**`title`**（ソース言語での学習者向けタイトル）と**`title_native`**（ターゲット言語でのセカンダリラベル）も含まれます。

両方のコードは2文字のISO 639-1でなければならず、`source_language`は`target_language`と異なる必要があります。これらのフィールドのない旧バージョン（v1.2以前）のセットも読み込まれます。旧`language`キーは`target_language`として受け入れられ、`source_language`はデフォルトで`en`になります。

## ファイルシステムのレイアウト

ツリーはSOURCE言語、次にtarget+levelで整理されています。

```
my-content-repo/
  manifest.yaml               # ルート: すべてのセットをリスト（path + pairを含む）
  sets/
    de/                       # ソース言語: ドイツ語
      fr-a1/                  # ターゲットフランス語、レベルA1  -> id fr-a1-from-de
        manifest.yaml         # セット: レッスンをリスト
        lessons/
          01-begruessung.json
          ...
        assets/               # オプションの画像 / 音声
    en/                       # ソース言語: 英語
      fr-a1/                  # -> id fr-a1-from-en
        ...
```

## マニフェスト形式

両方のマニフェストファイル（ルート + セット）は同じ`schema_version: '1.0'`の形式を使用します。必須フィールド:

```yaml
schema_version: '1.0'
name: My English B1 set
description: >-
  オプションの詳細説明。
sets:
  - id: language-en-b1        # スラッグセーフ、ユニーク
    title: English B1 (Intermediate)
    language: en              # BCP-47 (例: en, fr, zh-Hans)
    level: B1                 # 言語はCEFR、その他は自由形式
    version: '1.0.0'          # セマバー — セットリリースごとにバンプ
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      オプションのセットレベルの説明。
    tags:
      - intermediate
      - business
metadata:
  author: Your Name
  license: CC-BY-SA-4.0       # または任意のライセンス
```

セットマニフェストはさらにすべてのレッスンファイルをリストします。

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

コンテンツローダーはマニフェストの順序で`metadata.lessons`を処理します。ディレクトリ内のファイル順序は重要ではなく、マニフェストの順序のみが重要です。

## レッスンスキーマ（v1.0）

各レッスンは1つのJSONファイルです。トップレベルの形式:

```json
{
  "id": "01-greetings",
  "title": "Greetings",
  "description": "オプションの1〜2文の概要。",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### カード

カードは最小の学習単位で、通常は単一の用語や概念です。各カードには安定したid（演習から参照される）と表面/裏面のペアがあります。

```json
{
  "id": "art-le",
  "front": "le",
  "back": "the (masculine singular)",
  "notes": "子音で始まる男性名詞の前に使用。**le chat**、**le livre**。",
  "tags": ["article", "definite"]
}
```

Notesはマークダウンをサポートします。発音のヒント、フォールスフレンドの警告、不規則形のアラート — 長期的な定着に役立つものに使用してください。タグはSRSフィルタリングを駆動します。

### ステップ

レッスンはステップのシーケンスで、各ステップはTHEORY（マークダウンブロック）またはEXERCISE（4つの演習タイプのうちの1つ）です。

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Why articles matter",
  "body": "# Articles in French\n\nEvery French noun has a gender..."
}
```

または演習の場合:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Match greetings",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "各挨拶をその翻訳に一致させてください。",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hello"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## 演習タイプリファレンス

### matching

ドラッグペア演習。レンダラーは表示前にシャッフルします。

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "各フランス語名詞をその冠詞と一致させてください。",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

各ペアは正確に2つのキーを持つ必要があります: `left` + `right`。

### picture_choice

画像付き多肢選択。2枚以上の画像で、正解は1つだけ。

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "夕方の挨拶はどちらですか?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "オプションのマークダウンヒント（要求時に表示）。",
  "distractors": ["Bonjour"]
}
```

注意: `is_correct`はJSON booleanではなく**文字列**の`"true"`です。

`src`が存在しないアセットを指している場合、レンダラーは`label`テキストにフォールバックします — picture-choice演習は画像アセットがなくても機能します。

### free_text

答えをタイプ。レンダラーはまず完全一致を試み、次にLevenshtein許容フォールバックを試みます。

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "フランス語で「ありがとう」を何と言いますか?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Mで始まります。",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]`は誤答後に表示される正規の答えです。大文字・小文字と句読点をカバーするために3つ以上のバリアントを含めてください。レンダラーは空白を正規化します。

### word_tiles

タイルを順番に並べます。レンダラーは表示前にシャッフルします。

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "並べ替え: 私は猫を見る。",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "英語と同じ語順。"
}
```

複数の語順が正解の場合は`accept_orderings`を追加します。

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

各順序はタイルインデックスの順列です。

### cloze（Phase 52 / v1.35.0 — スキーマ1.1）

文中に見えやすい`___`マーカーを使った穴埋め問題。各`___`は`blanks[]`の1つのエントリに対応します（左から右へのマッピング; ローダーは`sentence.count("___") == len(blanks)`を強制します）。

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "不定冠詞を入れてください。",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "男性不定冠詞",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un*は男性不定冠詞です。"
}
```

**レンダリングモード** — 演習ごとに`cloze_mode`で設定します。

- `"type"`（省略時のデフォルト）: 空白ごとに`<input>`。free_textが使用するのと同じNFC + Levenshtein-≤-1マッチャーでバリデーションされるため、著者はセマンティックなバリアントのみを列挙する必要があります（タイポは不要）。
- `"select"`: 空白ごとに`<select>`。オプションは`accept[0]` + 演習の`distractors`から、安定したシードで空白ごとにシャッフルされます。**`distractors`が空でないことが必須** — スキーマバリデーターは`distractors`のない`cloze_mode: "select"`演習を拒否します。

**マルチブランクcloze**がサポートされています: 文中のすべての`___`が順番に`blanks`の次のエントリにマッピングされます。各空白には独自のhint + placeholder + acceptリストを持てます。要素レベルのSRSは空白ごとに1つのElementAttemptをファンアウトするため、空白Aを流暢に埋めながら空白Bを一貫して間違える学習者に対してもきめ細かいマスタリー追跡が機能します。

**カードのトークンロール（Phase 52I / v1.35.0）** — カード上のオプションメタデータで、ランタイムclozeジェネレーター（レビューセッション + レッスン終了後の修正ラウンド）が意味的に意味のある空白をターゲットにできます。

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "a cat",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

閉じた列挙型のロール: `article` / `verb` / `noun` / `adjective` / `preposition` / `gender_marker` / `tense_marker`。ロールの追加はマイナーなschema_versionバンプが必要です — インプレースで拡張しないでください。

## 演習の方向（v1.46.0 / EXP-018）

すべての演習は、学習者がカードをどちらの方向から練習するかを示すオプションの`direction`フィールドを受け入れます。

- `target_to_source`（デフォルト）— 受容的: 学習者にターゲット言語を見せ、ソース言語を認識する（より簡単）。
- `source_to_target` — 生産的: 学習者にソース言語を見せ、ターゲットを産出する（より難しい）。
- `both` / `random` — レンダラー / アダプティブジェネレーターが試行ごとに具体的な方向を選択する。

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

このフィールドは追加的です — スキーマはバージョン1.2のまま残り、`direction`のないレッスンは以前と同様に動作します（受容的）。SRSは方向ごとにマスタリーを追跡するため、受容的にマスターしたカードはまだ生産的にマスターされていません。Cloze演習はコンテキスト内にあり、`direction`を無視します。難易度の段階的な上昇のため、初期のレッスンを受容的に保ち、後のレッスンで`source_to_target`を導入してください（バンドルされたパイロットコンテンツはまさにこれを行っています）。

### アダプティブレッスンジェネレーターに役立つアノテーション（v1.36.0以降）

Phase 53のアダプティブレッスンジェネレーター（`/adaptive-lesson/:setId`、F-114）は、著者が作成した演習を組み合わせて学習者の特定の弱点を練習させます。ジェネレーターは追加のアノテーションなしでも動作しますが、2つのフィールドがあると大幅にスマートになります。

1. **カードの`token_roles`のカバレッジを広げる。** ジェネレーターは`token_roles`を使用して:
   - エラーからclozeバリアントを生成する際に意味的に意味のある空白を選択します（v1.35.0でカバー済み）
   - エラーをダッシュボードの「フォーカスエリア」チップの`article_gender` / `verb_conjugation`として分類します（53E）
   - 元の答えを間違えた場合に同じ要素をテストするALTERNATIVE演習を見つけます（53Dのバリエーションロジック — 一致する`token_roles`エントリを持つカードの候補を見つけます）

   離散した文法単位を教えるすべてのカード — 冠詞、活用した動詞形、性別のある名詞 — に`token_roles`エントリを追加してください。コストはカードごとに1つの追加JSONエントリで、見返りははるかに豊かなアダプティブ生成です。

2. **カードレベルの文法タグ（`tags: ["article", "masculine"]`など）** は、`token_roles`がない場合のフォールバックとしてエラー分類器によって読み取られます。`token_roles`の代替ではなく、低コストの部分的なアノテーションです。

まだ必要ないもの（将来のスキーマバンプに延期）:

- 異なるレッスンのカード間の`related_cards`相互参照
- 演習ごとの難易度評価（ジェネレーターは今日`exercise.type`から難易度を推定します）
- カードごとの`notes`内の例文（代替clozeコンテキストとして解析可能なもの。clozeジェネレーターは`front`のみを使用します）

迷ったときは: 文法トークンを教えるすべてのカードに`token_roles`を追加してください。これがアダプティブシステムにとって最も効果的な単一の著作習慣です。

## アセット（セットにバンドルされた画像）— v1.37.0以降

picture-choice演習とカードのカバー画像は以下のいずれかから取得されます。

1. **著者が作成したアセットファイル**。セットレベルのマニフェストで宣言され、レッスンJSONと一緒に同梱されます。
2. **プレースホルダーSVG**。アセットが存在しない場合にランタイムが生成します（色ラベルのカラースウォッチ、数字の大きな数字、その他すべてのアバタースタイル）。

アセットのないセットを公開しても、picture-choiceは引き続き動作します — プレースホルダーSVGジェネレーターが色+数字を自動的に処理し、それ以外はすべて決定論的なアバターにフォールバックします。

### ディレクトリレイアウト

セットのディレクトリ内で、アセットは`assets/`以下に置きます。

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

### マニフェストの宣言

各アセットは、ダウンローダーが何をフェッチするかを知るためにセットレベルの`manifest.yaml`で宣言する必要があります。

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

`path`はセットの`assets/`ディレクトリからの相対パスです（レッスンJSONからではありません）。レッスンJSON内で、picture-choice演習は`assets/`プレフィックスを**付けて**アセットを参照します。

```json
{
  "type": "picture_choice",
  "prompt": "'chat'はどれですか?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Cat", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Dog"}
  ]
}
```

フロントエンドはアセットリゾルバーを呼び出すときに`assets/`プレフィックスを自動的に除去するため、レッスンJSONは著者が期待する直感的な形式を保ちます。

### サイズ + 形式の制限

- **アセットごとの上限**: 500 KiB。マニフェストバリデーターは宣言された`size_kb`がこれを超えるアセットを拒否します。ダウンローダーも実際のバイト長が宣言された`size_kb`を10%以上超えるアセットを拒否します — マニフェストの正確さを保ちます。
- **セットごとのソフト上限**: 合計アセット10 MiB。バリデーターは警告しますが拒否はしません。
- **受け入れ可能な形式**: `.png` / `.jpg` / `.jpeg` / `.webp` / `.svg`。GIF（アニメーションコンテンツは注意散漫）とBMP（圧縮なし）は不可。写真にはWebPを推奨 — 同等の品質でPNGよりはるかに小さい。アイコン+ダイアグラムにはSVGを推奨 — きれいにスケールし + ファイルサイズが小さい。

### サイズ推奨

picture-choiceタイルはデスクトップで最大150x150 px、モバイルで100x100 px（`object-fit: contain`）にレンダリングされます。300x300 pxのソース画像が、膨らまずにRetinaスクリーンで最良の結果をもたらします。150 KiBを超えるPNGは、半分のサイズの適切に圧縮されたWebPより見た目が良くなることはほとんどありません。

### 著者が作成した画像をスキップする — ランタイムプレースホルダーに任せる

ランタイムプレースホルダーが十分に機能し、著者が作成した画像が学習価値を追加しない3種類のレッスン:

- **色レッスン**（`rouge` / `rojo` / `rot` / `red`）: プレースホルダージェネレーターが色名にキーイングされたソリッドヘックスウォッチを生成します。著者が作成したウォッチは冗長です。
- **数字レッスン**（`7` / `42` / `1492`）: プレースホルダーが数字を大きく中央に表示します。著者が作成した画像はアラビア数字以外の数字体系にのみ重要です。
- **明確なビジュアル表現のない抽象概念**（`patience`、`liberté`）: アバタープレースホルダーが、論争のあるアイコン選択を強いることなくクリーンなビジュアルアンカーを提供します。

それ以外のすべて（動物、物体、食べ物、場所、体の部位）では、著者が作成した画像が認識と想起を大幅に助けます。

## 品質チェックリスト

新しいレッスンのPRを開く前に確認してください。

- [ ] レッスンごとに**3〜5の理論ステップ** + **8〜12の演習**
- [ ] **少なくとも3種類の演習タイプ**を含む（matching、picture-choice、free-text、word-tiles、またはcloze — clozeはv1.35.0以降）
- [ ] **理論ステップは1つあたり200語以下**
- [ ] **free-text演習**: ≥ 3つのacceptバリアント + ≥ 3つのdistractors
- [ ] **word-tiles**: 演習ごとに≥ 3つのタイル
- [ ] **estimated_minutes**: 10〜15（現実的で、理想的ではなく）
- [ ] **Distractorsは間違っているが、もっともらしいもの** — 意味的に関連していて、ランダムではない
- [ ] **カードのnotes**は実際の価値を持つ（発音、フォールスフレンド、例外フラグ）
- [ ] **段階的な構造**: 後の概念は同じセット内の前の概念の上に構築される
- [ ] **文化的正確性**: 実際の使用例で、教科書限定のフレーズではない
- [ ] **スキーマバリデーション**: レッスンが`dict_to_lesson()`で正常に読み込まれる（ローカルテストを参照）
- [ ] **カードIDの整合性**: すべての`exercise.card_ids[i]`がレッスンの`cards[]`に存在する
- [ ] **言語ペア**: `target_language` + `source_language`が設定されている（ISO 639-1、異なるもの）、`title_native`が存在する

## バリデーション（2層、v1.44.0）

コンテンツは同じチェックを実行する2つのバリデーション層によって制御されます。

1. **アプリ内、共有前。** 学習者が*My Lessons → Share with Community*を通じてレッスンを共有する場合、最初にルールベースのチェックが実行されます（常に、AIは不要）。以下の**最小値**を強制します; いずれかを下回るセットは共有できません。合格し、かつAIキーが設定されている場合、学習者はオプションで補足的なAIレビュー（翻訳精度、distractor的確さ、文法、レベル適合性、文化的感受性、自然さ）をオプトインできます。AIステップは自動ではなく、明示的な同意が必要です（レッスンコンテンツが設定されたプロバイダーに送信されます）、そして共有をブロックしません — ルールベースの合格がゲートです。
2. **コンテンツリポジトリのCI。** `astrapi69/adaptive-learner-content`へのプルリクエストは`scripts/validate_content.py`（`docs/ci/adaptive-learner-content/`にミラーされています）を実行し、同じルールですべてのセットを再チェックするため、手動のPRがゲートをバイパスできません。

**品質最小値（ハードゲート）:** レッスンごとに≥ 5つの演習、≥ 2種類の演習タイプ、≥ 1つの理論ステップ、free-text ≥ 2つの正解 + distractors、matching ≥ 3ペア、picture-choice distractors、空のカード表面/裏面なし、（非ラテン文字ソーススクリプトの場合）ソーススクリプトでのカード裏面。これらは最小値であり、目標ではありません — 上記のチェックリストはより多くを求めています。

## ローカルテスト

コンテンツローダーのスキーマバリデーターは`make test`の一部として実行されます。1つのレッスンを手動でバリデーションするには:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} cards, {len(lesson.steps)} steps')
"
```

コンテンツリポジトリ内のすべてのレッスンを一度にバリデーションするには、コンテンツリポジトリ独自のバリデーター（CIがすべてのPRで実行するのと同じスクリプト）を使用します:

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

`sets/{source}/{target-level}/`以下のすべてのセットを発見し、スキーマと品質最小値（≥5演習、≥2演習タイプ、≥1理論ステップ、free-textのaccepts + distractors、matchingのペア、空のカードなし、カードIDの整合性）をチェックします。新しいレッスンを追加すると自動的に検出されます — テストを編集する必要はありません。

## PRワークフロー

セットの準備ができたら:

1. メインのadaptive-learnerリポジトリに対してPRを開きます（アプリに同梱するセットの場合）、または
2. GitHubアカウントの下に独自のコンテンツリポジトリを作成し、`backend/config/plugins/content-loader.yaml`（`default_sources`下）からコンテンツローダーがそこを指すように設定します。

コンテンツローダーはすべての公開GitHubリポジトリをソースとしてサポートします。プライベートリポジトリは3層キーチェーン（`~/.config/adaptive_learner/secrets.yaml`）経由で設定された個人アクセストークンが必要です。

## よくある落とし穴

**カードID参照**: 演習のすべての`card_ids`エントリはレッスンの`cards[]`に存在する必要があります。演習をレッスン間でコピーし、カードのコピーを忘れると、バリデーションが失敗します。

**スラッグセーフID**: すべてのID（レッスン、カード、ステップ、演習）は`^[a-z0-9]+(-[a-z0-9]+)*$`と一致する必要があります。アンダースコア、アポストロフィ、大文字、先頭/末尾のハイフンは使用できません。

**`is_correct: "true"`**: JSONのbooleanではなく文字列です。スキーマはpicture-choiceフィールドがすべてdict[str, str]であるため、特に`"true"`を要求します。

**余分なフィールド**: すべてのモデルは`extra="forbid"`です。スキーマが知らないフィールドを追加すると、レッスン全体が拒否されます。ドキュメント化されたフィールドのみを使用してください。

**理論のbody**: 理論ステップには空でない`body`フィールド（マークダウン）が必要です。演習ステップは`body`を持てません — 代わりに演習の`prompt`を使用してください。

## リファレンス: パイロットセット

Adaptive Learnerに同梱されている2つのセットが正規リファレンスです。

- `sets/en/fr-a1/` — 英語話者向けフランス語A1（10レッスン、合計約2時間）; `sets/de/fr-a1/`はドイツ語ソースのパイロット。
- `sets/en/es-a1/` + `sets/de/es-a1/` — スペイン語A1（各ソース15レッスン）、`adaptive-learner-content`リポジトリ内。

両方ともこのガイドに記載されている規則に従っています。自分のレッスンを作成する前に1つのフルレッスンを最初から最後まで読むことが、構造を内面化する最速の方法です。

---

## コミュニティコントリビューションパスウェイ（v1.42.0）

レッスンをゼロから手作業で作成する必要はありません。貢献の最も速い方法は、**アプリでレッスンを作成して共有する**ことです。

1. チャットをインポートして分析し、**Save as Offline Lesson**（またはアダプティブレッスンを終了して**Save this lesson?**）します。レッスンはセットブラウザの**My Lessons**の下に表示されます。
2. My Lessonsから**Export as set**をクリックしてコンテンツセット`.zip`（マニフェスト + レッスン）をダウンロードします。エクスポートにはレッスンコンテンツのみが含まれます — 進捗、エラー履歴、個人情報はありません。
3. **Share with Community**をクリックしてコンテンツリポジトリに事前入力されたGitHubイシューを開きます。エクスポートした`.zip`を添付します。
4. メンテナーがレッスンをレビューし、マニフェスト（id、title、language、level、tags）を上記の規則に合わせて整え、`sets/`下に追加します。マージされると、誰でもセットブラウザからダウンロードできるようになります。

これはソーシャルパスです: レビューは**手動**です（メンテナーがすべての追加をキュレーションします — 自動公開はありません）、フロー全体はGitHubのみで済みます。生成されたレッスンはすでにスキーマに対してバリデーションされているため、貢献されたレッスンは通常、公開前にマニフェストの整理のみが必要です。

## 共有ウィザード、バリエーション、著者クレジット（Phase 64）

**My Lessons**からレッスンを共有すると、GitHubに直接移動するのではなく、4ステップのウィザードが開きます。

1. **プレビュー + 配置。** アプリはレッスンがツリー内のどこに置かれるか（`sets/{source}/{target}-{level}/`）と自動採番されたファイル名（`{nn}-{slug}.json`、既存のレッスンの次の番号）を正確に計算します。まったく新しいペア + レベルには*「新しいセットです！あなたが最初です。」*が表示されます。
2. **重複チェック。** レッスンはカードの重複と演習の重複によって、そのツリーパスにすでにあるレッスンと比較されます（参考情報 — ブロックはしません）。似たものが存在する場合は:
   - **バリエーションとして共有** — レッスンには`variation_of: "{original_id}"`とオプションの`variation_note`（「あなたのバージョンはどこが違いますか?」）がタグ付けされます。
   - **新しい演習のみを提案する**（ほぼ重複の場合）— ウィザードはオリジナルに不足している演習のみと、それらが参照するカードを補足バリエーションとして抽出します。
3. **品質サマリー。** ルールベースバリデーターの所見（オプションのAIレビューも含む）; 警告は表示されますがブロックしません。
4. **共有 + お祝い。** ワンクリックでGitHub PR/イシューが開き、アプリが小さなお祝いで感謝します。

### バリエーション + クレジットフィールド（スキーマ1.3、すべてオプション）

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "一致のより多くの演習",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

4つすべてが追加的でオプションです; それらのないレッスンは以前と同様に動作します。`contributed_by`は著者が共有時にクレジットをオプトインする際に設定されます（次回のために記憶される*「あなたの名前（オプション）」*フィールド）。存在する場合、ビューアーはタイトルの下にミュートされた*「{name}による貢献」*行を表示し、GitHubイシューにはそのメタデータテーブルに著者がリストされます。

### コントリビューション履歴とギャップ

共有されたレッスンはローカルに記憶されます（アカウント不要）。**My Contributions**に共有数のカウンターと5回の共有で*Community Contributor*認定が表示されます。セットブラウザは**Missing Lessons**も表示します — 既存のペアの次のCEFRレベルへの励みになる提案、または一方のソース言語向けには存在するが別のソース言語では欠けているターゲット（「手伝えますか?」）。
