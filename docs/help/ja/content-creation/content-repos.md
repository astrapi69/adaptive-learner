<!-- Translation: AI-generated, pending native review -->

# コンテンツリポジトリ - 自分のリポジトリを公開する

Adaptive Learner には公式のコンテンツライブラリが付属していますが、
コンテンツの仕組みはオープンです。GitHub で
**独自のコンテンツリポジトリ**を運用し、アプリで接続して、ほかの
学習者に提供できます。このページは概要です。完全な手順は
**[コンテンツリポジトリガイド](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**
にあります。

---

## コンテンツリポジトリとは

コンテンツリポジトリは、Adaptive Learner 形式の**コンテンツセット**を
収めた GitHub リポジトリです。セットは、1 つの言語ペアとレベル
（例：「ドイツ語話者向けスペイン語 A1」）、または 1 つの知識ドメイン
（例：「Python の基礎」）のためのレッスンの集まりです。

公式ライブラリとすべてのユーザーリポジトリは**同じ形式**を使います。
別個の「公式」スキーマはありません。リポジトリが検証に合格した
時点で、それは第一級のコンテンツソースになります。独自のサーバーは
一切必要ありません。コンテンツリポジトリは、Git リポジトリ内の
ファイルにすぎません。

---

## 前提条件

- **GitHub リポジトリ**（公開。リポジトリごとのトークンを使えば
  非公開も可能です）。
- セットを一覧にしたルートの **`manifest.yaml`**。
- **レッスン形式**のレッスン。
- 公開前にローカルで検証するための、PyYAML を備えた Python 3。

正式な形式のリファレンスは、公式コンテンツリポジトリにあります。

- [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

---

## ディレクトリレイアウト

コンテンツリポジトリは固定のツリーに従います。ソース言語（説明が
書かれている言語）が最上位のフォルダで、ターゲット言語とレベルが
その次のフォルダになります。

```
my-content-repo/
  manifest.yaml                  # root manifest: lists every set
  sets/
    de/                          # source language (German speakers)
      es-a1/                     # target language + level (Spanish A1)
        manifest.yaml            # set manifest: lists the lessons
        lessons/
          01-greetings.json      # one JSON file per lesson (NN-slug.json)
        assets/                  # optional: images / audio
  scripts/validate_content.py    # the validator (from the starter kit)
```

---

## ローカルで検証する

```bash
pip install pyyaml
python3 scripts/validate_content.py
```

すべてのセットが合格すると終了コード 0、そうでなければファイルごとの
レポートとともに 1 を返します。スキーマ、ディレクトリ構造、品質の
最低基準（レッスンごとに少なくとも 5 つの演習、2 種類の演習タイプ、
1 つの理論ステップ、空でないカードフィールドなど）を検査します。

---

## アプリにはどのように掲載されますか？

リポジトリの検証が通ると、学習者はそれを
**設定 > データ > コンテンツリポジトリ**で接続します。URL を
貼り付けると、アプリはルートマニフェストを取得し、技術的に検証し、
セットを同期してキャッシュします。その後、セットはソースバッジと
ともに**コンテンツブラウザ**に表示されます。リポジトリは、
`/add-repo` リンクと QR コードで共有することもできます。

リポジトリがアプリ内の**おすすめのリポジトリ**セクションに載るのは、
プロジェクトチームがキュレーションする `recommended-repos.json` を
通じてだけです。これが公式な推薦（トラスト 3）の経路です。

---

## トラストレベル

トラストレベルは、そのコンテンツがどれだけ精査されているかを
学習者に伝えます。これは出所とレビューに関するものであり、品質の
評価ではありません。

| レベル | 名前 | 意味 |
|-------|------|---------|
| **1** | 確認済み | スキーマが正しく、品質の最低基準を満たしている。同期時に自動で判定。内容は個別にはレビューされていない。 |
| **2** | 検証済み | コミュニティが寄稿し、メンテナーが内容の正確さをレビューしたもの。 |
| **3** | 公式 | プロジェクトチームがキュレーションし、品質を保証したもの。 |

トラスト 2 以上では、技術的な最低基準を超えるものが求められます：
正確な翻訳、正しい冠詞／性、完全なアクセント記号、適切な難易度の
進行、もっともらしい誤答選択肢、そして文化的な正確さです。
オプションのアプリ内 **AI レビュー**は、作成者が共有前にこうした
問題に気づくのを助けます（EXP-033 を参照）。これは助言にとどまり、
共有をブロックすることは決してありません。

---

## コースとウェブサイトの相互性（EXP-029）

レッスンとドメインには**関連メディア**（動画、ポッドキャスト、記事、
書籍、コース、ウェブサイト）を付けられます。商用メディアの基準は
**価格ではなく相互性**です。無料のメディアは常に許可されます。
商用のコース／ウェブサイトは、提供者がリンクを返している場合、
独自のコンテンツリポジトリを運用している場合、または文書化された
パートナーシップがある場合にのみ許可されます。これにより、
コンテンツの作成者は広告主ではなく、エコシステムのパートナーに
なります。詳細は `docs/explorations/EXP-029-media-reciprocity.md`
にあります。

---

## テンプレートとしてのスターターキット

最も手早い始め方は、すぐに使えるスターターリポジトリ
**[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test)**
です。`docs/`、ドメインごとのテンプレート、完全な例のレッスン
（インセプション効果）、実行可能な例のセット、`books.yaml`、
バリデーターが含まれています。フォークして、例のレッスンを自分の
ものに置き換え、ルートの `manifest.yaml` に登録し、検証してから、
アプリでリポジトリを接続します。

---

## 関連項目

- **[コンテンツリポジトリガイドの全文](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/CONTENT-REPO-GUIDE.md)**
- [レッスンを作成する - 概要](overview.md)
- [書籍の推薦](books.md)
