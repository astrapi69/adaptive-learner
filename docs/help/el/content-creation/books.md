# Προτάσεις βιβλίων (`books.yaml`)

Ένα Content-Repository μπορεί να παρέχει ανά τομέα **προτεινόμενα
βιβλία**. Ο Content Browser τα εμφανίζει ως περαιτέρω βιβλιογραφία,
όταν βλέπεις ένα σύνολο αυτού του τομέα. Είναι προαιρετικό, δεν
είναι σύνολο μαθημάτων και δεν χρειάζεται backend — λειτουργεί και
στους δύο τρόπους αποθήκευσης.

---

## Πού βρίσκεται το αρχείο

Τοποθέτησε ένα αρχείο `books.yaml` στον **ριζικό κατάλογο** του
Content-Repo. Δεν επεξεργάζεται από την επικύρωση μαθημάτων (δεν
είναι Content-Set), αλλά διαβάζεται ξεχωριστά από την εφαρμογή.

---

## Μορφή

Το αρχείο αντιστοιχίζει έναν **τομέα** σε μια λίστα βιβλίων:

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

### Πεδία

| Πεδίο | Υποχρεωτικό | Σημασία |
|---|---|---|
| `title` | ναι | Τίτλος βιβλίου. |
| `author` | ναι | Συγγραφέας/-είς. |
| `subtitle` | όχι | Υπότιτλος. |
| `isbn` | όχι | ISBN-10 ή ISBN-13. |
| `asin` | όχι | Αναγνωριστικό Amazon. |
| `url` | όχι | Σύνδεσμος προς το βιβλίο. |
| `language` | όχι | Κωδικός γλώσσας του βιβλίου (π.χ. `de`). |
| `pages` | όχι | Αριθμός σελίδων. |
| `year` | όχι | Έτος έκδοσης. |
| `description` | όχι | Σύντομη περιγραφή. |
| `tags` | όχι | Λίστα από λέξεις-κλειδιά. |

Το κλειδί κάτω από το `domains:` (π.χ. `ai`, `psychology`) είναι ο
**τομέας**, στον οποίο αντιστοιχίζονται τα βιβλία — ο ίδιος τομέας
που χρησιμοποιούν τα Content-Sets σου.

---

## Σχετικές σελίδες

- [Content Browser](../features/content-browser.md) — πού εμφανίζονται οι προτάσεις
- [Δημιουργία μαθημάτων — Επισκόπηση](overview.md)
