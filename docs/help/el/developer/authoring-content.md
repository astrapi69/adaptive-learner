# Δημιουργία περιεχομένου μαθημάτων

Αυτός ο οδηγός δείχνει πώς να δημιουργήσεις ένα νέο σύνολο
μαθημάτων για το content-loader του Adaptive Learner. Όποιος θέλει
να δημοσιεύσει ένα σύνολο γλώσσας ή θέματος — για προσωπική χρήση
ή ως συνεισφορά στο δημόσιο pool περιεχομένου — πρέπει να διαβάσει
αυτό από την αρχή ως το τέλος πριν γράψει οποιοδήποτε μάθημα.

## Τι είναι ένα content set

Ένα **content set** είναι μια εκδοχοποιημένη δέσμη μαθημάτων που
ένας χρήστης μπορεί να κατεβάσει από τη σελίδα Set Browser
(`/content`). Το plugin Content-Loader (αποστέλλεται στο v1.27.0)
χειρίζεται την ανακάλυψη, λήψη, αποθήκευση και συμφωνία εκδόσεων
και στις δύο λειτουργίες αποθήκευσης.

Ένα set έχει τρία επίπεδα:

1. **Root manifest** (`manifest.yaml`) — καταχωρεί κάθε set που
   αποστέλλει το repo. Χρησιμοποιείται από το Set Browser για
   απόδοση του καταλόγου πηγής.
2. **Set manifest** (`sets/{set-id}/manifest.yaml`) — αδελφό του
   root manifest, καταχωρεί τα αρχεία μαθημάτων μέσα σε αυτό το
   συγκεκριμένο set.
3. **Αρχεία μαθημάτων** (`sets/{set-id}/lessons/NN-slug.json`) —
   ένα αρχείο JSON ανά μάθημα, επικυρωμένο έναντι σχήματος v1.0
   σε κάθε λήψη.

Τα pilot sets που αποστέλλονται με το Adaptive Learner βρίσκονται στο
ξεχωριστό content repo [`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(κλωνοποιημένο ως αδελφό `../adaptive-learner-content` και
ενσωματωμένο στο build από `frontend/scripts/copy-bundled-content.mjs`)
και είναι καλά πρότυπα για αντιγραφή.

## Ζεύγη γλωσσών (v1.44.0)

Κάθε content set δηλώνει το ζεύγος γλωσσών που διδάσκει:

- **`target_language`** — τι ΜΑΘΑΙΝΕΙ ο μαθητής (π.χ. `fr`).
- **`source_language`** — τι ΜΙΛΑΕΙ ήδη ο μαθητής, δηλαδή η
  γλώσσα στην οποία είναι γραμμένα τα πεδία **`back`** καρτών,
  τα **`notes`** και τα κείμενα **theory** (π.χ. `de`).

Αυτό κάνει τα "Γαλλικά για Αγγλόφωνους" ένα *διαφορετικό* set
από τα "Γαλλικά για Γερμανόφωνους": ίδιος στόχος (`fr`), διαφορετική
πηγή (`en` έναντι `de`), διαφορετική γλώσσα εξήγησης. Ένας μαθητής
βλέπει μόνο sets των οποίων το `source_language` ταιριάζει με γλώσσα
που μιλά (η γλώσσα εφαρμογής του, συν οποιαδήποτε επιπλέον
επιλεχθεί από Ρυθμίσεις → Μάθηση).

Τα ids συνόλου κωδικοποιούν το ζεύγος ως `{target}-{level}-from-{source}`
(π.χ. `fr-a1-from-de`), και κάθε set δηλώνει **`path`** που δείχνει
στον κατάλογο source-language (`sets/de/fr-a1`). Ένα set φέρει επίσης
**`title`** (στη γλώσσα πηγής, τι διαβάζει ο μαθητής) και
**`title_native`** (στη γλώσσα στόχου, εμφανίζεται ως δευτερεύουσα
ετικέτα).

Και οι δύο κωδικοί πρέπει να είναι 2-γράμματοι ISO 639-1, και το
`source_language` πρέπει να διαφέρει από το `target_language`. Τα
pre-v1.2 sets χωρίς αυτά τα πεδία φορτώνουν ακόμα: το παλαιό κλειδί
`language` γίνεται αποδεκτό ως `target_language` και το `source_language`
προεπιλέγει σε `en`.

## Διάταξη filesystem

Το δέντρο οργανώνεται κατά γλώσσα ΠΗΓΗΣ, έπειτα στόχος+επίπεδο:

```
my-content-repo/
  manifest.yaml               # root: καταχωρεί κάθε set (με path + ζεύγος)
  sets/
    de/                       # γλώσσα πηγής: Γερμανικά
      fr-a1/                  # στόχος Γαλλικά, επίπεδο A1  -> id fr-a1-from-de
        manifest.yaml         # set: καταχωρεί τα μαθήματα
        lessons/
          01-begruessung.json
          ...
        assets/               # προαιρετικές εικόνες / ήχος
    en/                       # γλώσσα πηγής: Αγγλικά
      fr-a1/                  # -> id fr-a1-from-en
        ...
```

## Μορφή manifest

Και τα δύο αρχεία manifest (root + set) χρησιμοποιούν το ίδιο
σχήμα `schema_version: '1.0'`. Υποχρεωτικά πεδία:

```yaml
schema_version: '1.0'
name: My English B1 set
description: >-
  Προαιρετική εκτενής περιγραφή.
sets:
  - id: language-en-b1        # slug-safe, μοναδικό
    title: English B1 (Intermediate)
    language: en              # BCP-47 (π.χ. en, fr, zh-Hans)
    level: B1                 # CEFR για γλώσσες, ελεύθερη μορφή αλλιώς
    version: '1.0.0'          # semver — αυξάνεται ανά έκδοση set
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Προαιρετική περιγραφή επιπέδου set.
    tags:
      - intermediate
      - business
metadata:
  author: Your Name
  license: CC-BY-SA-4.0       # ή οτιδήποτε
```

Το set manifest αναφέρει επιπλέον κάθε αρχείο μαθήματος:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

Ο Content-Loader διατρέχει `metadata.lessons` με σειρά· η σειρά
αρχείων στον κατάλογο δεν έχει σημασία, μόνο η σειρά manifest.

## Σχήμα μαθήματος (v1.0)

Κάθε μάθημα είναι ένα αρχείο JSON. Μορφή κορυφαίου επιπέδου:

```json
{
  "id": "01-greetings",
  "title": "Greetings",
  "description": "Προαιρετική σύνοψη 1-2 προτάσεων.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Κάρτες

Μια κάρτα είναι η μικρότερη μαθήσιμη μονάδα — συνήθως ένας μεμονωμένος
όρος ή έννοια. Κάθε κάρτα έχει σταθερό id (αναφέρεται από ασκήσεις)
και ζεύγος μπρος/πίσω:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "the (masculine singular)",
  "notes": "Used before consonant-starting masculine nouns. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

Τα notes υποστηρίζουν Markdown. Χρησιμοποίησέ τα για συμβουλές
προφοράς, προειδοποιήσεις false-friend, ειδοποιήσεις ακανόνιστων
μορφών — οτιδήποτε βοηθά τη μακροπρόθεσμη διατήρηση. Οι ετικέτες
οδηγούν το φιλτράρισμα SRS.

### Βήματα

Ένα μάθημα είναι μια ακολουθία βημάτων, το καθένα THEORY (μπλοκ
Markdown) ή EXERCISE (ένας από τους τέσσερις τύπους άσκησης):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Why articles matter",
  "body": "# Articles in French\n\nEvery French noun has a gender..."
}
```

Ή άσκηση:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Match greetings",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Match each greeting to its translation.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hello"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Αναφορά τύπων άσκησης

### matching

Άσκηση drag-pair. Ο renderer ανακατεύει πριν από την εμφάνιση.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Match each French noun with its article.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Κάθε ζεύγος πρέπει να έχει ακριβώς δύο κλειδιά: `left` + `right`.

### picture_choice

Πολλαπλής επιλογής με εικόνες. ≥ 2 εικόνες, ακριβώς μία σημειωμένη
ως σωστή.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Which is the evening greeting?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Προαιρετική υπόδειξη Markdown εμφανίζεται κατ' απαίτηση.",
  "distractors": ["Bonjour"]
}
```

Σημείωση: το `is_correct` είναι **string** `"true"`, όχι boolean JSON.

Αν το `src` δείχνει σε asset που δεν υπάρχει, ο renderer χρησιμοποιεί
ως εναλλακτική το κείμενο `label` — οι ασκήσεις picture-choice
λειτουργούν ακόμα και χωρίς assets εικόνων.

### free_text

Πληκτρολόγηση απάντησης. Ο renderer κάνει πρώτα exact-match,
έπειτα Levenshtein-ανεκτική εναλλακτική.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "How do you say 'Thank you' in French?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "It starts with M.",
  "distractors": ["Bonjour", "Salut"]
}
```

Το `accept[0]` είναι η κανονική απάντηση που εμφανίζεται μετά από
λανθασμένη απόπειρα. Συμπέριλαβε ≥ 3 παραλλαγές για να καλύψεις
πεζά/κεφαλαία και στίξη· ο renderer ομαλοποιεί τα κενά.

### word_tiles

Τακτοποίηση πλακιδίων κατά σειρά. Ο renderer ανακατεύει πριν από
την εμφάνιση.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Arrange: I see a cat.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Same word order as English."
}
```

Αν πολλές σειρές λέξεων είναι σωστές, πρόσθεσε `accept_orderings`:

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Κάθε διάταξη είναι μια μετάθεση των δεικτών πλακιδίων.

### cloze (Phase 52 / v1.35.0 — σχήμα 1.1)

Συμπλήρωση κενού με ορατά `___` markers στην πρόταση.
Κάθε `___` αντιστοιχεί σε μία εγγραφή στο `blanks[]` (αντιστοίχηση
αριστερά-δεξιά· ο loader επιβάλλει `sentence.count("___") ==
len(blanks)`).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Fill in the indefinite article.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "masculine indefinite article",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* is the masculine indefinite article."
}
```

**Λειτουργίες απόδοσης** — ορίζονται ανά άσκηση μέσω `cloze_mode`:

- `"type"` (προεπιλογή αν παραλειφθεί): `<input>` ανά κενό.
  Επικυρώνεται με τον ίδιο NFC + Levenshtein-≤-1 matcher που
  χρησιμοποιεί το free_text.
- `"select"`: `<select>` ανά κενό. Επιλογές από `accept[0]` +
  τους `distractors` της άσκησης, ανακατεμένες ανά κενό με
  σταθερό seed. **Απαιτεί μη κενά `distractors`** — ο
  validator σχήματος απορρίπτει ασκήσεις `cloze_mode: "select"`
  χωρίς αυτά.

**Multi-blank cloze** υποστηρίζεται: κάθε `___` στην πρόταση
αντιστοιχεί στην επόμενη εγγραφή `blanks`, κατά σειρά. Κάθε κενό
μπορεί να έχει δική του hint + placeholder + accept list. Το SRS
επίπεδο στοιχείων διακλαδώνει ένα ElementAttempt ανά κενό, οπότε
ένας μαθητής που γεμίζει άπταιστα το κενό A αλλά χάνει συστηματικά
το κενό B παίρνει παρακολούθηση mastery ανά κενό.

**Token-roles σε κάρτες (Phase 52I / v1.35.0)** — προαιρετικά
metadata σε κάρτα που επιτρέπουν στον runtime cloze generator
(συνεδρίες επανάληψης + ο γύρος διόρθωσης τέλους μαθήματος) να
στοχεύει σημασιολογικά-σημαντικό κενό:

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

Κλειστό enum ρόλων: `article` / `verb` / `noun` / `adjective`
/ `preposition` / `gender_marker` / `tense_marker`. Η προσθήκη
ρόλου είναι μια ανύψωση minor schema_version — μην επεκτείνεις
στο ίδιο σχήμα.

## Κατεύθυνση άσκησης (v1.46.0 / EXP-018)

Κάθε άσκηση δέχεται ένα προαιρετικό πεδίο `direction` που λέει
από ποια πλευρά εξασκεί τον μαθητή:

- `target_to_source` (προεπιλογή) — ΠΑΘΗΤΙΚΗ: ο μαθητής βλέπει
  τη γλώσσα στόχου και αναγνωρίζει τη γλώσσα πηγής (πιο εύκολο).
- `source_to_target` — ΕΝΕΡΓΗΤΙΚΗ: ο μαθητής βλέπει τη γλώσσα
  πηγής και παράγει τη γλώσσα στόχου (πιο δύσκολο).
- `both` / `random` — αφήστε τον renderer / adaptive generator
  να επιλέξει συγκεκριμένη κατεύθυνση ανά απόπειρα.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

Το πεδίο είναι προσθετικό — το σχήμα παραμένει στην έκδοση 1.2
και τα μαθήματα χωρίς `direction` συμπεριφέρονται ακριβώς όπως
πριν (παθητικά). Το SRS παρακολουθεί mastery ανά κατεύθυνση, οπότε
μια κάρτα που έχει κατακτηθεί παθητικά δεν είναι ακόμα κατακτημένη
ενεργητικά. Οι ασκήσεις cloze είναι in-context και αγνοούν
`direction`. Για προοδευτική δυσκολία, κράτα τα πρώτα μαθήματα
παθητικά και εισήγαγε `source_to_target` σε επόμενα (το ενσωματωμένο
pilot content κάνει ακριβώς αυτό).

### Annotations που βοηθούν τον adaptive lesson generator (v1.36.0+)

Ο adaptive lesson generator Phase 53 (`/adaptive-lesson/:setId`,
F-114) ανακαθορίζει τις συντεταγμένες ασκήσεις για να εξασκεί τις
συγκεκριμένες αδυναμίες του μαθητή. Ο generator λειτουργεί χωρίς
επιπλέον annotations, αλλά δύο πεδία τον κάνουν ουσιαστικά
πιο έξυπνο:

1. **Ευρύτερη κάλυψη `token_roles` σε κάρτες.** Ο generator
   χρησιμοποιεί `token_roles` για:
   - Επιλογή σημασιολογικά-σημαντικών κενών κατά τη δημιουργία
     cloze παραλλαγών από σφάλματα
   - Ταξινόμηση σφαλμάτων ως `article_gender` / `verb_conjugation`
     για τα chips "Focus areas" του Ταμπλό (53E)
   - Εύρεση ΕΝΑΛΛΑΚΤΙΚΩΝ ασκήσεων που δοκιμάζουν το ίδιο στοιχείο
     όταν ο χρήστης έκανε λάθος στην αρχική (53D variation
     logic)

   Πρόσθεσε εγγραφή `token_roles` σε ΚΑΘΕ κάρτα που διδάσκει
   μια διακριτή γραμματική μονάδα — άρθρα, συζυγιακοί τύποι
   ρημάτων, ουσιαστικά γένους. Το κόστος είναι μία επιπλέον
   εγγραφή JSON ανά κάρτα· η απόδοση είναι πολύ πλουσιότερη
   προσαρμοστική δημιουργία.

2. **Γραμματικές ετικέτες επιπέδου κάρτας** (`tags: ["article",
   "masculine"]` κ.λπ.) διαβάζονται από τον ταξινομητή σφαλμάτων
   ως εναλλακτική όταν απουσιάζει το `token_roles`. Δεν
   αντικαθιστούν το `token_roles` — είναι annotation χαμηλής
   προσπάθειας ως ενδιάμεσο βήμα.

## Assets (εικόνες συσκευασμένες με set) — v1.37.0+

Ασκήσεις picture-choice και εικόνες εξωφύλλου κάρτας έρχονται
είτε από:

1. **Authored asset αρχεία**, δηλωμένα στο manifest επιπέδου set
   και αποστελλόμενα μαζί με τα JSON μαθήματος
2. **Placeholder SVGs**, δημιουργούμενα από το runtime όταν δεν
   υπάρχει asset (χρωματικές ταμπέλες για ετικέτες χρωμάτων,
   μεγάλα αριθμητικά για ψηφία, avatar-style για όλα τα άλλα)

Αν δημοσιεύσεις set χωρίς assets, το picture-choice λειτουργεί
ακόμα — ο generator placeholder SVG χειρίζεται αυτόματα χρώματα +
αριθμούς.

### Διάταξη καταλόγου

Μέσα στον κατάλογο ενός set, τα assets βρίσκονται στο `assets/`:

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

### Δήλωση manifest

Κάθε asset πρέπει να δηλώνεται στο `manifest.yaml` επιπέδου set
ώστε ο downloader να ξέρει τι να κατεβάσει:

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

Το `path` είναι σχετικό με τον κατάλογο `assets/` του set (ΌΧΙ
με το JSON μαθήματος). Μέσα σε JSON μαθήματος, οι ασκήσεις
picture-choice αναφέρουν assets ΜΕ το πρόθεμα `assets/`:

```json
{
  "type": "picture_choice",
  "prompt": "Which one is 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Cat", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Dog"}
  ]
}
```

Το frontend αφαιρεί αυτόματα το πρόθεμα `assets/` κατά την κλήση
του asset resolver, οπότε το JSON μαθήματος κρατά τη διαισθητική
μορφή που αναμένουν οι συγγραφείς.

### Όρια μεγέθους + μορφής

- **Όριο ανά asset**: 500 KiB. Ο manifest validator απορρίπτει
  assets των οποίων το δηλωμένο `size_kb` υπερβαίνει αυτό.
- **Soft cap ανά set**: 10 MiB συνολικά assets. Ο validator
  προειδοποιεί αλλά δεν απορρίπτει.
- **Αποδεκτές μορφές**: `.png` / `.jpg` / `.jpeg` / `.webp`
  / `.svg`. Χωρίς GIF (το animated content αποσπά) και χωρίς
  BMP (χωρίς συμπίεση). Για φωτογραφίες, προτίμησε WebP.
  Για εικόνες + διαγράμματα, προτίμησε SVG.

### Συστάσεις μεγέθους

Τα tiles picture-choice αποδίδονται σε μέγ. 150x150 px στο
desktop, 100x100 px στο κινητό (`object-fit: contain`). Εικόνες
πηγής 300x300 px δίνουν το καλύτερο αποτέλεσμα σε retina
οθόνες χωρίς φούσκωμα.

## Λίστα ελέγχου ποιότητας

Πριν ανοίξεις PR για νέο μάθημα, επαλήθευσε:

- [ ] **3-5 βήματα theory** + **8-12 ασκήσεις** ανά μάθημα
- [ ] **Τουλάχιστον 3 τύποι άσκησης** (matching, picture-choice, free-text, word-tiles ή cloze)
- [ ] **Βήματα theory ≤ 200 λέξεων** το καθένα
- [ ] **Ασκήσεις free-text**: ≥ 3 αποδεκτές παραλλαγές + ≥ 3 distractors
- [ ] **Word-tiles**: ≥ 3 πλακίδια ανά άσκηση
- [ ] **estimated_minutes**: 10-15 (ρεαλιστικό)
- [ ] **Distractors λανθασμένα-αλλά-πιθανά** — σημασιολογικά συγγενή, ποτέ τυχαία
- [ ] **Σημειώσεις κάρτας** με πραγματική αξία (προφορά, false-friend, εξαίρεση)
- [ ] **Προοδευτική δομή**: έννοιες βασίζονται στις προηγούμενες
- [ ] **Πολιτισμική ακρίβεια**: χρήση πραγματικού κόσμου
- [ ] **Επικύρωση σχήματος**: το μάθημα φορτώνει μέσω `dict_to_lesson()`
- [ ] **Ακεραιότητα card-id**: κάθε `exercise.card_ids[i]` υπάρχει στο `cards[]`
- [ ] **Ζεύγος γλωσσών**: `target_language` + `source_language` ορισμένα (ISO 639-1, διαφορετικά), `title_native` παρόν

## Επικύρωση (δύο επίπεδα, v1.44.0)

Το περιεχόμενο ελέγχεται από δύο επίπεδα επικύρωσης:

1. **In-app, πριν από κοινοποίηση.** Όταν ένας μαθητής μοιράζεται
   μάθημα μέσω *Τα Μαθήματά μου → Κοινοποίηση στην Κοινότητα*,
   εκτελείται πρώτα ένας rule-based έλεγχος. Επιβάλλει τα
   **ελάχιστα** παρακάτω· ένα set κάτω από οποιοδήποτε από αυτά
   δεν μπορεί να κοινοποιηθεί. Αν περάσει ΚΑΙ υπάρχει
   διαμορφωμένο AI key, ο μαθητής μπορεί να επιλέξει προαιρετική
   αναθεώρηση ΤΝ. Το βήμα ΤΝ δεν είναι αυτόματο και ποτέ δεν
   μπλοκάρει την κοινοποίηση.
2. **Στο CI του content repo.** Ένα pull request στο
   `astrapi69/adaptive-learner-content` τρέχει
   `scripts/validate_content.py` που επαναελέγχει κάθε set με
   τους ίδιους κανόνες.

**Ελάχιστα ποιότητας (σκληρή πύλη):** ≥ 5 ασκήσεις ανά μάθημα,
≥ 2 τύποι άσκησης, ≥ 1 βήμα theory, free-text ≥ 2 αποδεκτές
απαντήσεις + distractors, matching ≥ 3 ζεύγη, distractors
picture-choice, χωρίς κενά front/back κάρτας.

## Τοπική δοκιμή

Ο schema validator του Content-Loader τρέχει ως μέρος του
`make test`. Για επικύρωση ενός μαθήματος μεμονωμένα:

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

Για επικύρωση κάθε μαθήματος σε content repo με μία εντολή:

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

## Ροή εργασίας PR

Μόλις το set σου είναι έτοιμο:

1. Άνοιξε PR έναντι του κύριου adaptive-learner repo (για sets
   που πρέπει να αποσταλούν με την εφαρμογή), Ή
2. Δημιούργησε το δικό σου content repo στον GitHub λογαριασμό
   σου και ορίσε το Content-Loader να δείχνει εκεί από
   `backend/config/plugins/content-loader.yaml` (κάτω από
   `default_sources`).

Ο Content-Loader υποστηρίζει οποιοδήποτε δημόσιο GitHub repo
ως πηγή. Τα private repos απαιτούν personal access token
διαμορφωμένο μέσω της τριεπίπεδης αλυσίδας κλειδιών.

## Συνηθισμένες παγίδες

**Αναφορές card-id**: κάθε εγγραφή `card_ids` σε άσκηση πρέπει
να υπάρχει στο `cards[]` του μαθήματος. Αν αντιγράψεις άσκηση
μεταξύ μαθημάτων και ξεχάσεις να αντιγράψεις την κάρτα, η
επικύρωση αποτυγχάνει.

**Slug-safe ids**: όλα τα ids (μάθημα, κάρτα, βήμα, άσκηση) πρέπει
να ταιριάζουν `^[a-z0-9]+(-[a-z0-9]+)*$`. Χωρίς υπογράμμιση,
χωρίς apostrophes, χωρίς κεφαλαία γράμματα.

**`is_correct: "true"`**: είναι string, όχι boolean JSON. Το σχήμα
απαιτεί ρητά `"true"`.

**Επιπλέον πεδία**: κάθε μοντέλο έχει `extra="forbid"`. Η προσθήκη
πεδίου που δεν γνωρίζει το σχήμα απορρίπτει ολόκληρο το μάθημα.

**Theory body**: τα βήματα theory απαιτούν μη κενό πεδίο `body`
(Markdown). Τα βήματα άσκησης δεν πρέπει να φέρουν `body` —
χρησιμοποίησε αντ' αυτού το `prompt` της άσκησης.

---

## Κοινοτική συνεισφορά (v1.42.0)

Δεν χρειάζεται να δημιουργείς μαθήματα από το μηδέν. Ο γρηγορότερος
τρόπος να συνεισφέρεις είναι να **δημιουργήσεις μάθημα στην εφαρμογή
και να το μοιραστείς**:

1. Εισήγαγε συνομιλία, ανάλυσέ τη και **Αποθήκευσε ως Offline Μάθημα**
   (ή ολοκλήρωσε προσαρμοστικό μάθημα και **Αποθήκευσε αυτό το μάθημα;**).
   Το μάθημα εμφανίζεται κάτω από **Τα Μαθήματά μου** στο Set Browser.
2. Από τα Τα Μαθήματά μου, κλικ **Εξαγωγή ως set** για να κατεβάσεις
   content-set `.zip` (manifest + μαθήματα).
3. Κλικ **Κοινοποίηση στην Κοινότητα** για να ανοίξεις προ-συμπληρωμένο
   GitHub issue στο content repo.
4. Ένας maintainer αναθεωρεί το μάθημα, τακτοποιεί το manifest και
   το προσθέτει στο `sets/`. Μόλις συγχωνευτεί, όλοι μπορούν να το
   κατεβάσουν από το Set Browser.
