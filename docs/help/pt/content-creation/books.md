# Recomendações de livros (`books.yaml`)

Um repositório de conteúdo pode fornecer **livros recomendados**
por domínio. O Navegador de Conteúdo mostra-os como literatura
complementar quando vês um conjunto desse domínio. Isto é opcional,
não é um conjunto de lições, e não precisa de backend — funciona
em ambos os modos de armazenamento.

---

## Onde fica o ficheiro

Coloca um ficheiro `books.yaml` no **diretório raiz** do repo de
conteúdo. Não é processado pela validação de lições (não é um
conjunto de conteúdo), mas lido separadamente pela aplicação.

---

## Formato

O ficheiro mapeia um **domínio** para uma lista de livros:

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

| Campo | Obrigatório | Significado |
|---|---|---|
| `title` | sim | Título do livro. |
| `author` | sim | Autor(es). |
| `subtitle` | não | Subtítulo. |
| `isbn` | não | ISBN-10 ou ISBN-13. |
| `asin` | não | Identificador da Amazon. |
| `url` | não | Link para o livro. |
| `language` | não | Código de idioma do livro (p. ex. `de`). |
| `pages` | não | Número de páginas. |
| `year` | não | Ano de publicação. |
| `description` | não | Breve descrição. |
| `tags` | não | Lista de palavras-chave. |

A chave sob `domains:` (p. ex. `ai`, `psychology`) é o **domínio**
ao qual os livros são atribuídos — o mesmo domínio que os teus
conjuntos de conteúdo usam.

---

## Páginas relacionadas

- [Navegador de Conteúdo](../features/content-browser.md) — onde as recomendações aparecem
- [Criar lições — Visão geral](overview.md)
