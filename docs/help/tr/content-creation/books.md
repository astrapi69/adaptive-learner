# Kitap önerileri (`books.yaml`)

Bir İçerik Repository'si, alan başına **önerilen kitaplar**
getirebilir. İçerik Tarayıcısı, bu alana ait bir seti
görüntülediğinde bunları ileri okuma olarak gösterir. Bu isteğe
bağlıdır, bir ders seti değildir ve bir arka uca ihtiyaç duymaz -
her iki depolama modunda da çalışır.

---

## Dosyanın yeri

İçerik reposunun **kök dizinine** bir `books.yaml` dosyası koy. Bu
dosya ders doğrulaması tarafından işlenmez (bir İçerik Seti
değildir), bunun yerine uygulama tarafından ayrıca okunur.

---

## Format

Dosya bir **alanı** bir kitap listesine eşler:

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

### Alanlar

| Alan | Zorunlu | Anlamı |
|---|---|---|
| `title` | evet | Kitap başlığı. |
| `author` | evet | Yazar(lar). |
| `subtitle` | hayır | Alt başlık. |
| `isbn` | hayır | ISBN-10 veya ISBN-13. |
| `asin` | hayır | Amazon kimliği. |
| `url` | hayır | Kitaba bağlantı. |
| `language` | hayır | Kitabın dil kodu (örn. `de`). |
| `pages` | hayır | Sayfa sayısı. |
| `year` | hayır | Yayın yılı. |
| `description` | hayır | Kısa açıklama. |
| `tags` | hayır | Anahtar kelime listesi. |

`domains:` altındaki anahtar (örn. `ai`, `psychology`), kitapların
atandığı **alandır** - İçerik Setlerinin kullandığı aynı alan.

---

## İlgili sayfalar

- [İçerik Tarayıcısı](../features/content-browser.md) - önerilerin göründüğü yer
- [Ders oluşturma - Genel bakış](overview.md)
