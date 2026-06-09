# Book recommendations (`books.yaml`)

A content repository can ship **recommended books** per domain.
The Content Browser shows them as further reading when you look at
a set in that domain. This is optional, not a lesson set, and
needs no backend — it works in both storage modes.

---

## Where the file lives

Place a `books.yaml` file in the **root directory** of the content
repo. It is not processed by the lesson validation (it is not a
content set) but read separately by the app.

---

## Format

The file maps a **domain** to a list of books:

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

### Fields

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Book title. |
| `author` | yes | Author(s). |
| `subtitle` | no | Subtitle. |
| `isbn` | no | ISBN-10 or ISBN-13. |
| `asin` | no | Amazon identifier. |
| `url` | no | Link to the book. |
| `language` | no | Language code of the book (e.g. `de`). |
| `pages` | no | Page count. |
| `year` | no | Year of publication. |
| `description` | no | Short description. |
| `tags` | no | List of keywords. |

The key under `domains:` (e.g. `ai`, `psychology`) is the
**domain** the books are assigned to — the same domain your
content sets use.

---

## Related pages

- [Content Browser](../features/content-browser.md) — where the recommendations appear
- [Creating lessons — overview](overview.md)
