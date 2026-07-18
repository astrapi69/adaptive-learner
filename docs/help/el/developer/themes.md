# Σύστημα Theme

Η Φάση 58 (v1.41.0) αντικατέστησε το παλιό ζεύγος φωτεινό/σκοτεινό με
ένα σύστημα από έξι κλασικά themes σε μία μόνο διάσταση `data-theme`,
συν μια επιλογή `auto`, που ακολουθεί το λειτουργικό σύστημα. Η Φάση 63
(v1.63.0) πρόσθεσε έξι **προτεινόμενα presets WCAG-AA**, ώστε ο picker
να φέρει συνολικά **12 themes**.

## Προτεινόμενα presets (Φάση 63 / v1.63.0)

Ο picker στις Ρυθμίσεις → Εμφάνιση ξεκινά με μια **υποκαρτέλα
Προτεινόμενα**:

- **Φωτεινά:** `catppuccin-latte`, `supabase`, `graphite`
- **Σκοτεινά:** `catppuccin-mocha`, `soft-pop`, `amethyst-haze`

Δημιουργήθηκαν από presets tweakcn μέσω
`scripts/generate_preset_themes.py` ως πλήρη themes 44 token, με
**υπολογιστικά επιβαλλόμενο WCAG AA** (`contrast.test.ts` σε όλα τα 12
themes). Τα κλασικά έξι (`light`, `dark`, `ocean`, `forest`,
`high-contrast`, `sepia`) παραμένουν αμετάβλητα.

## Τρόπος λειτουργίας

- Τα **κανονικά χρωματικά tokens** βρίσκονται στο
  `frontend/src/styles/themes/theme-<id>.css`, ένα μπλοκ ανά τιμή
  `data-theme` (`light`, `dark`, `ocean`, `forest`, `high-contrast`,
  `sepia`). Κάθε αρχείο ορίζει το **πλήρες** σημασιολογικό σύνολο token
  - δεν υπάρχει πέρασμα στο φωτεινό.
- Τα **tokens ανεξάρτητα από theme** (αποστάσεις, ακτίνα, γραμματοσειρές,
  η παλέτα μεθόδων της μάρκας) και τα **Legacy-Aliase** (`--bg`,
  `--surface`, `--fg`, `--danger`, ...) βρίσκονται στο
  `styles/global.css :root`. Τα aliases επιλύονται *μέσω* των κανονικών
  tokens και ακολουθούν έτσι αυτόματα το ενεργό theme.
- Τα αρχεία theme εισάγονται στο `main.tsx`, **πρώτα το φωτεινό**, ώστε
  το ενεργό theme να κερδίζει την ισοπαλία ειδικότητας έναντι του `:root`.
- Το `frontend/src/lib/themes.ts` είναι το μητρώο: `THEMES`, οι τύποι
  `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)` για την
  αντιστοίχιση `auto` και τα δείγματα χρώματος προεπισκόπησης.
- Το `frontend/src/hooks/useTheme.ts` κατέχει το εφαρμοσμένο attribute
  `data-theme` και αποθηκεύει την επιλογή στο `adaptive-learner.theme`
  (μεταφέρει εφάπαξ το παλιό κλειδί `adaptive-learner-theme`).
- Το `index.html` περιέχει ένα μικρό inline-script, που εφαρμόζει το
  αποθηκευμένο theme **πριν το πρώτο paint** (χωρίς τρεμόπαιγμα).
  Αντικατοπτρίζει την επίλυση του hook· κράτα τα δύο συγχρονισμένα.
- Τα διαγράμματα (Recharts) δεν μπορούν να διαβάσουν μεταβλητές CSS σε
  attributes SVG, γι' αυτό τα `lib/chartTheme.ts` + `useChartTheme`
  διαβάζουν τις υπολογισμένες τιμές token και τις ξαναδιαβάζουν σε αλλαγή
  `data-theme`.

## Σύνολο token (οριζόμενο από κάθε theme)

Φόντα (`--bg-primary/secondary/surface/elevated/overlay`), κείμενο
(`--fg-primary/secondary/muted/inverse`), περιγράμματα
(`--border-primary/subtle/accent`), διαδραστικά
(`--interactive-bg/hover/active/disabled`), τονισμός (`--accent`,
`-hover`, `-fg`, `-subtle`, `-rgb`), ζεύγη κατάστασης (`--success/-bg`,
`--error/-bg`, `--warning/-bg`, `--info/-bg`), ανατροφοδότηση ασκήσεων
(`--exercise-correct/-wrong/-selected/-matched`), `--star`, σειρές
διαγραμμάτων (`--chart-1..6`) και σκιές
(`--shadow-card/-elevated/-md`).

Το `styles/themes/themes.test.ts` αποτυγχάνει, αν σε ένα theme λείπει
κάποιο από αυτά τα tokens ή έχει ένα επιπλέον· το
`styles/contrast.test.ts` ελέγχει το WCAG 2.1 AA σε όλα τα 12 themes.
Η πλήρης αναφορά token βρίσκεται στο
[Αρχιτεκτονική Design-Token](../architecture/design-tokens.md).

## Προσθήκη ενός νέου theme

1. **Αντίγραψε** ένα υπάρχον αρχείο, π.χ.
   `cp theme-dark.css theme-midnight.css`, και άλλαξε τον selector σε
   `[data-theme="midnight"]`. Κράτα **κάθε** token - άλλαξε μόνο τις
   τιμές. Κανένα στυλ component εδώ.
2. **Καταχώρισέ** το στο `lib/themes.ts`: πρόσθεσε στο `THEMES` μια
   καταχώρηση `ThemeMeta` (id, αγγλικό `label`, `family` light|dark και
   ένα `swatch` για την προεπισκόπηση των Ρυθμίσεων) και πρόσθεσε το id
   στην ένωση `ThemeId`.
3. **Εισήγαγέ** το στο `main.tsx` μετά το `theme-light.css` (η σειρά
   μετρά μόνο σε σχέση με το φωτεινό).
4. **Επίτρεψέ το στον Pre-Paint-Guard**: πρόσθεσε το id στον πίνακα
   `valid` στο inline `<script>` του `index.html`.
5. **i18n**: πρόσθεσε το `ui.themes.midnight` σε όλους τους οκτώ
   καταλόγους στο `backend/config/i18n/*.yaml` και εκτέλεσε
   `make sync-i18n`.
6. **Έλεγξε**: `bunx vitest run src/styles/themes src/styles/contrast` -
   τα pins πληρότητας και αντίθεσης πρέπει να παραμείνουν πράσινα
   (προσάρμοσε τις τιμές, μέχρι η αντίθεση στο νέο theme να πληροί το
   AA).

Αυτό ήταν - ο ThemePicker, το Pre-Paint-Skript, τα διαγράμματα και κάθε
component αναλαμβάνουν το νέο theme αυτόματα, επειδή όλα διαβάζουν τα
κανονικά tokens.

## Κανόνες

- **Κανένα σταθερά κωδικοποιημένο χρώμα** σε components. Το
  `styles/no-hardcoded-colors.test.ts` το επιβάλλει για τα στυλ `.tsx`
  (μια τεκμηριωμένη allowlist καλύπτει resolvers διαγραμμάτων,
  διακοσμητικό κονφετί και χρώματα δεδομένων).
- **Κάθε theme ορίζει κάθε token.** Καμία κενότητα με κληρονομικότητα από
  το φωτεινό - αυτό ήταν το σφάλμα του ελέγχου F1 (μη ορισμένα tokens,
  που έδειχναν φωτεινό hex στο σκοτεινό mode).
- **Η αλλαγή theme είναι ακαριαία** - μια ανταλλαγή `data-theme`, ποτέ
  μια επαναφόρτωση.
