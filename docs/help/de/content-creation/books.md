# Buchempfehlungen (`books.yaml`)

Ein Content-Repository kann pro Domäne **empfohlene Bücher**
mitliefern. Der Content Browser zeigt sie als weiterführende
Literatur an, wenn du einen Satz dieser Domäne ansiehst. Das ist
optional, kein Lektionssatz, und braucht kein Backend - es
funktioniert in beiden Speichermodi.

---

## Wo die Datei liegt

Lege eine Datei `books.yaml` in das **Wurzelverzeichnis** des
Content-Repos. Sie wird nicht von der Lektions-Validierung
verarbeitet (sie ist kein Content-Set), sondern separat von der
App gelesen.

---

## Format

Die Datei bildet eine **Domäne** auf eine Liste von Büchern ab:

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

### Felder

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `title` | ja | Buchtitel. |
| `author` | ja | Autor:in(nen). |
| `subtitle` | nein | Untertitel. |
| `isbn` | nein | ISBN-10 oder ISBN-13. |
| `asin` | nein | Amazon-Kennung. |
| `url` | nein | Link zum Buch. |
| `language` | nein | Sprachcode des Buchs (z. B. `de`). |
| `pages` | nein | Seitenzahl. |
| `year` | nein | Erscheinungsjahr. |
| `description` | nein | Kurzbeschreibung. |
| `tags` | nein | Liste von Schlagworten. |

Der Schlüssel unter `domains:` (z. B. `ai`, `psychology`) ist die
**Domäne**, der die Bücher zugeordnet werden - dieselbe Domäne,
die deine Content-Sets verwenden.

---

## Verwandte Seiten

- [Content Browser](../features/content-browser.md) - wo die Empfehlungen erscheinen
- [Lektionen erstellen - Überblick](overview.md)
