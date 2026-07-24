# 書籍の推薦（`books.yaml`）

コンテンツリポジトリは、ドメインごとに**推薦書籍**を同梱できます。
コンテンツブラウザは、そのドメインのセットを表示しているときに、
それらを参考文献として表示します。これはオプションであり、
レッスンセットではなく、バックエンドを必要としません。両方の
ストレージモードで動作します。

---

## ファイルの場所

`books.yaml` というファイルをコンテンツリポジトリの
**ルートディレクトリ**に置きます。これはレッスン検証では処理
されず（コンテンツセットではないため）、アプリによって別途
読み込まれます。

---

## 形式

このファイルは**ドメイン**を書籍のリストにマッピングします。

```yaml
domains:
  ai:
    books:
      - title: "KI für Einsteiger: Prompts gestalten ohne Programmierkenntnisse"
        subtitle: "Entfessle die Kraft der KI, ganz ohne Technik-Vorkenntnisse"
        author: "Asterios Raptis"
        isbn: "979-8317093280"
        asin: "B0F43H6T2M"
        url: "https://www.amazon.de/dp/B0F43H6T2M/"
        language: "de"
        pages: 158
        year: 2025
        description: "Der praxisnahe Einstieg in KI und Prompt Engineering."
        tags: ["ki", "prompt-engineering", "einsteiger"]
  psychology:
    books:
      - title: "Psychologie"
        author: "Philip Zimbardo, Robert Johnson, Vivian McCann"
        isbn: "978-3868943238"
        url: "https://www.amazon.de/dp/3868943234/"
```

### フィールド

| フィールド | 必須 | 意味 |
|---|---|---|
| `title` | はい | 書籍のタイトル。 |
| `author` | はい | 著者。 |
| `subtitle` | いいえ | サブタイトル。 |
| `isbn` | いいえ | ISBN-10 または ISBN-13。 |
| `asin` | いいえ | Amazon の識別子。 |
| `url` | いいえ | 書籍へのリンク。 |
| `language` | いいえ | 書籍の言語コード（例：`de`）。 |
| `pages` | いいえ | ページ数。 |
| `year` | いいえ | 出版年。 |
| `description` | いいえ | 短い説明。 |
| `tags` | いいえ | キーワードのリスト。 |

`domains:` の下のキー（例：`ai`、`psychology`）は、書籍が割り当て
られる**ドメイン**です。これはコンテンツセットが使用するものと
同じドメインです。

---

## 関連ページ

- [コンテンツブラウザ](../features/content-browser.md) - 推薦が表示される場所
- [レッスンを作成する - 概要](overview.md)
