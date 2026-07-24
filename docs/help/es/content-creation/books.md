# Recomendaciones de libros (`books.yaml`)

Un repositorio de contenido puede incluir **libros recomendados**
por dominio. El explorador de contenido los muestra como
literatura complementaria cuando consultas un conjunto de ese
dominio. Es opcional, no es un conjunto de lecciones, y no
necesita backend: funciona en ambos modos de almacenamiento.

---

## Dónde se ubica el archivo

Coloca un archivo `books.yaml` en el **directorio raíz** del repo
de contenido. No lo procesa la validación de lecciones (no es un
conjunto de contenido), sino que la app lo lee por separado.

---

## Formato

El archivo asigna un **dominio** a una lista de libros:

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

### Campos

| Campo | Obligatorio | Significado |
|---|---|---|
| `title` | sí | Título del libro. |
| `author` | sí | Autor/es. |
| `subtitle` | no | Subtítulo. |
| `isbn` | no | ISBN-10 o ISBN-13. |
| `asin` | no | Identificador de Amazon. |
| `url` | no | Enlace al libro. |
| `language` | no | Código de idioma del libro (p. ej. `de`). |
| `pages` | no | Número de páginas. |
| `year` | no | Año de publicación. |
| `description` | no | Descripción breve. |
| `tags` | no | Lista de palabras clave. |

La clave bajo `domains:` (p. ej. `ai`, `psychology`) es el
**dominio** al que se asignan los libros, el mismo dominio que
usan tus conjuntos de contenido.

---

## Páginas relacionadas

- [Explorador de contenido](../features/content-browser.md) - dónde aparecen las recomendaciones
- [Crear lecciones - Visión general](overview.md)
