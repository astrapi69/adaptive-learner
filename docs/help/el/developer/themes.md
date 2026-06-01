# Σύστημα θεμάτων

Η Phase 58 (v1.41.0) αντικατέστησε το παλαιό ζεύγος light/dark
με σύστημα έξι θεμάτων σε μία διάσταση `data-theme`, συν επιλογή
`auto` που ακολουθεί το λειτουργικό σύστημα.

## Πώς λειτουργεί

- **Κανονικά tokens χρωμάτων** βρίσκονται στο
  `frontend/src/styles/themes/theme-<id>.css`, ένα μπλοκ ανά
  τιμή `data-theme` (`light`, `dark`, `ocean`, `forest`,
  `high-contrast`, `sepia`). Κάθε αρχείο ορίζει το **πλήρες**
  σύνολο semantic tokens - χωρίς fallthrough μέσω light.
- **Tokens αγνωστικά θέματος** (spacing, radius, γραμματοσειρές,
  η παλέτα μεθόδου brand) και οι **legacy aliases** (`--bg`,
  `--surface`, `--fg`, `--danger`, ...) βρίσκονται στο
  `styles/global.css :root`. Τα aliases επιλύονται *μέσω* των
  κανονικών tokens, οπότε παλαιότεροι κανόνες ακολουθούν αυτόματα
  το ενεργό θέμα.
- Τα αρχεία θεμάτων εισάγονται από το `main.tsx`, **light πρώτα**,
  ώστε το ενεργό θέμα να κερδίζει τη σύγκρουση ίσης specificity
  έναντι `:root`.
- Το `frontend/src/lib/themes.ts` είναι το μητρώο: `THEMES`, οι
  τύποι `ThemeId` / `ThemeChoice`, `resolveTheme(choice, prefersDark)`
  για την αντιστοίχιση `auto`, και τα swatches της κάρτας
  προεπισκόπησης.
- Το `frontend/src/hooks/useTheme.ts` κατέχει το εφαρμοσμένο
  attribute `data-theme` και αποθηκεύει την επιλογή στο
  `adaptive-learner.theme` (μεταναστεύει το κλειδί
  `adaptive-learner-theme` πριν από τη 58E μία φορά).
- Το `index.html` φέρει ένα μικρό inline script που εφαρμόζει το
  αποθηκευμένο θέμα **πριν από την πρώτη απόδοση** (χωρίς flash).
  Αντικατοπτρίζει την επίλυση του hook· κράτα τα δύο συγχρονισμένα.
- Τα charts (Recharts) δεν μπορούν να διαβάσουν CSS variables σε
  SVG attributes, οπότε `lib/chartTheme.ts` + `useChartTheme`
  διαβάζουν τις υπολογισμένες τιμές tokens και ξαναδιαβάζουν κατά
  την αλλαγή `data-theme`.

## Σύνολο tokens (ορίζεται από κάθε θέμα)

Backgrounds (`--bg-primary/secondary/surface/elevated/overlay`),
text (`--fg-primary/secondary/muted/inverse`), borders
(`--border-primary/subtle/accent`), interactive
(`--interactive-bg/hover/active/disabled`), accent
(`--accent`, `-hover`, `-fg`, `-subtle`, `-rgb`), ζεύγη status
(`--success/-bg`, `--error/-bg`, `--warning/-bg`, `--info/-bg`),
ανατροφοδότηση άσκησης (`--exercise-correct/-wrong/-selected/-matched`),
`--star`, σειρές chart (`--chart-1..6`), και σκιές
(`--shadow-card/-elevated/-md`).

Το `styles/themes/themes.test.ts` αποτυγχάνει αν κάποιο θέμα
λείπει ένα από αυτά ή προσθέτει επιπλέον· το `styles/contrast.test.ts`
επαληθεύει WCAG 2.1 AA σε όλα τα έξι θέματα.

## Πώς να προστεθεί νέο θέμα

1. **Αντέγραψε** ένα υπάρχον αρχείο, π.χ.
   `cp theme-dark.css theme-midnight.css`, και άλλαξε τον selector
   σε `[data-theme="midnight"]`. Κράτα **κάθε** token - άλλαξε
   μόνο τις τιμές. Μην προσθέτεις εδώ component styles.
2. **Καταχώρισέ το** στο `lib/themes.ts`: πρόσθεσε εγγραφή
   `ThemeMeta` στο `THEMES` (id, αγγλική `label`, `family`
   light|dark και `swatch` για την προεπισκόπηση Ρυθμίσεων) και
   πρόσθεσε το id στην ένωση `ThemeId`.
3. **Εισήγαγέ το** στο `main.tsx` μετά το `theme-light.css` (η
   σειρά έχει σημασία μόνο σε σχέση με το light).
4. **Επίτρεψέ το στη φρουρά pre-paint**: πρόσθεσε το id στον πίνακα
   `valid` στο inline `<script>` στο `index.html`.
5. **i18n**: πρόσθεσε `ui.themes.midnight` σε όλους τους οκτώ
   καταλόγους στο `backend/config/i18n/*.yaml`, στη συνέχεια τρέξε
   `make sync-i18n`.
6. **Επαλήθευσε**: `npx vitest run src/styles/themes src/styles/contrast`
   - οι καρφίτσες πληρότητας + αντίθεσης πρέπει να παραμένουν πράσινες
   (διόρθωσε τιμές μέχρι η αντίθεση να περάσει AA στο νέο θέμα).

Αυτό είναι — το ThemePicker, το script pre-paint, τα charts και
κάθε component αναλαμβάνουν αυτόματα το νέο θέμα επειδή όλα
διαβάζουν τα κανονικά tokens.

## Κανόνες

- **Χωρίς σκληρά κωδικοποιημένα χρώματα** στα components. Το
  `styles/no-hardcoded-colors.test.ts` το επιβάλλει για styles
  `.tsx` (τεκμηριωμένη whitelist καλύπτει resolvers chart,
  διακοσμητικά confetti και χρώματα δεδομένων).
- **Κάθε θέμα ορίζει κάθε token.** Χωρίς κενά `inherit`-από-light -
  αυτό ήταν το σφάλμα ελέγχου F1 (undefined tokens που αποδίδουν
  light hex σε dark mode).
- **Η εναλλαγή θέματος είναι άμεση** - εναλλαγή `data-theme`,
  ποτέ επαναφόρτωση.
