# Recommandations de livres (`books.yaml`)

Un dépôt de contenu peut fournir des **livres recommandés** par
domaine. Le navigateur de contenu les affiche comme lectures
complémentaires lorsque tu consultes un ensemble de ce domaine.
C'est optionnel, ce n'est pas un ensemble de leçons, et cela ne
nécessite aucun backend — cela fonctionne dans les deux modes de
stockage.

---

## Où se trouve le fichier

Place un fichier `books.yaml` dans le **répertoire racine** du
dépôt de contenu. Il n'est pas traité par la validation des leçons
(ce n'est pas un ensemble de contenu), mais lu séparément par
l'application.

---

## Format

Le fichier associe un **domaine** à une liste de livres :

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

### Champs

| Champ | Obligatoire | Signification |
|---|---|---|
| `title` | oui | Titre du livre. |
| `author` | oui | Auteur(s). |
| `subtitle` | non | Sous-titre. |
| `isbn` | non | ISBN-10 ou ISBN-13. |
| `asin` | non | Identifiant Amazon. |
| `url` | non | Lien vers le livre. |
| `language` | non | Code de langue du livre (p. ex. `de`). |
| `pages` | non | Nombre de pages. |
| `year` | non | Année de parution. |
| `description` | non | Brève description. |
| `tags` | non | Liste de mots-clés. |

La clé sous `domains:` (p. ex. `ai`, `psychology`) est le
**domaine** auquel les livres sont associés — le même domaine que
celui qu'utilisent tes ensembles de contenu.

---

## Pages connexes

- [Navigateur de contenu](../features/content-browser.md) — où les recommandations apparaissent
- [Créer des leçons — aperçu](overview.md)
