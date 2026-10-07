# Ένταξη: η πρώτη σου διόρθωση bug

Μια πρακτική περιήγηση βήμα προς βήμα για νέους συνεισφέροντες. Σε
αντίθεση με τις σελίδες [Αρχιτεκτονική](architecture.md) και
[Ρύθμιση ανάπτυξης](setup.md) (που εξηγούν *τι* είναι το σύστημα), αυτή η
σελίδα σε καθοδηγεί να *κάνεις* την πρώτη σου διόρθωση bug από την αρχή ως
το τέλος - από ένα φρέσκο clone ως ένα συγχωνευμένο pull request.

## 1. Στήσε το περιβάλλον ανάπτυξης

Προαπαιτούμενα: **Python 3.12** (ο περιορισμός του backend είναι `~3.12`),
**Node 24+** (απαιτείται από το Vite 8), **Poetry**, **Bun**
και **GNU Make**.

```bash
# Clone
git clone https://github.com/astrapi69/adaptive-learner.git
cd adaptive-learner

# Install everything: Poetry backend + plugin path-deps + Bun frontend
make install

# Establish a green baseline before you change anything
make test

# Run the app (backend on :18001, frontend on :15174)
make dev
```

Ο dev server του frontend τρέχει στο **http://localhost:15174**, το
backend στο **http://localhost:18001**. Και οι δύο θύρες αλλάζουν μέσω
`ADAPTIVE_LEARNER_FRONTEND_PORT` / `ADAPTIVE_LEARNER_PORT`. Πάτησε
Ctrl-C μία φορά για να σταματήσουν και τα δύο.

Αν το `make install` αποτύχει, ο συνήθης ένοχος είναι ότι το Poetry
επιλέγει λάθος Python - τρέξε `poetry env use python3.12` στο `backend/`
και εγκατάστησε ξανά. Για την πλήρη αλυσίδα ρυθμίσεων (secrets, κλειδιά
ΤΝ, το υποχρεωτικό `ADAPTIVE_LEARNER_SECRET_KEY`) δες τη
[Ρύθμιση ανάπτυξης](setup.md).

## 2. Βρες ένα bug

Τα issues είναι η ουρά εργασίας. Κάθε διόρθωση χρειάζεται **πρώτα** ένα
issue (`GITHUB-ISSUE-PFLICHT`).

```bash
# Open bug issues
gh issue list --label bug --state open
```

Ή στο GitHub:
<https://github.com/astrapi69/adaptive-learner/issues?q=is%3Aissue+is%3Aopen+label%3Abug>

Διάλεξε κάτι μικρό για αρχή - ψάξε για `good first issue` ή ένα `bug`
μικρής προσπάθειας. Αν δεν υπάρχει issue για το bug που βρήκες,
**δημιούργησε ένα πριν αγγίξεις κώδικα** - και άνοιξε *ξεχωριστό* issue
για κάθε νέο bug που ανακαλύπτεις στην πορεία.

## 3. Κατανόησε το issue

- Διάβασε την περιγραφή και αναπαράγαγε το bug τοπικά.
- Σημείωσε σε ποιον τρόπο αποθήκευσης εμφανίζεται. Το Adaptive Learner
  διαθέτει **διπλή αποθήκευση** (API/SQLite *και* Dexie/IndexedDB)· ένα
  bug μπορεί να υπάρχει στον έναν τρόπο, στον άλλον ή και στους δύο. Δες
  το [Επίπεδο αποθήκευσης](storage-layer.md).
- Αν δεν μπορείς να το αναπαραγάγεις, ρώτα στο issue αντί να μαντεύεις.

## 4. Δημιούργησε έναν κλάδο

Το Adaptive Learner χρησιμοποιεί **gitflow**: το `develop` είναι ο ενεργός
κλάδος· το `main` κρατά μόνο releases. Δημιούργησε κλάδο *από* το
`develop` και άνοιξε το PR σου *προς* το `develop`.

```bash
git checkout develop
git pull origin develop
git checkout -b fix/short-description
```

Ονομασία κλάδων:

| Πρόθεμα | Για |
|---|---|
| `fix/...` | διορθώσεις bug |
| `feature/...` | νέες λειτουργίες |
| `refactor/...` | refactors |
| `docs/...` | τεκμηρίωση |
| `chore/...` | εργαλεία / συντήρηση |

## 5. Διόρθωσε το bug

Συμβουλές για να βρεις τον κώδικα:

```bash
# Search by an error string / symbol (use ripgrep)
rg "the error message" frontend/src backend/app
```

- Σφάλματα frontend: άνοιξε την κονσόλα των DevTools του browser.
- Το `cd frontend && bunx vitest --watch <file>` δίνει ζωντανή
  ανατροφοδότηση τεστ όσο επεξεργάζεσαι (τρέχε πάντα το vitest από το
  `frontend/`, όχι από τη ρίζα του repo).
- **Styling: μόνο utility classes του Tailwind**, χωρίς inline στυλ
  χρωμάτων και χωρίς νέους κανόνες στο `global.css`. Τα χρώματα περνούν
  από design tokens (μεταβλητές CSS) - δες το [Σύστημα Theme](themes.md).
- **Και οι δύο τρόποι αποθήκευσης πρέπει να συνεχίσουν να λειτουργούν.**
  Μια λειτουργία που κυκλοφορεί σε λειτουργία API χωρίς διαδρομή Dexie (ή
  χωρίς ευγενικό μήνυμα «μη διαθέσιμο σε λειτουργία browser») μπλοκάρει
  το release.

## 6. Γράψε ένα τεστ παλινδρόμησης

Κάθε διόρθωση χρειάζεται τουλάχιστον ένα τεστ που αποτυγχάνει πριν από
την αλλαγή και περνάει μετά από αυτήν.

```bash
# Frontend (Vitest) - run from frontend/
cd frontend && bunx vitest run src/path/to/file.test.ts

# Backend (pytest)
cd backend && poetry run pytest tests/path/ -v

# A single plugin
make test-plugin-gamification
```

Για αλλαγές που αγγίζουν το backup υπάρχει επιπλέον πύλη: ένας
πραγματικός κύκλος Export → Import στο `make dev` με πραγματικά δεδομένα
(το `BACKUP-AKZEPTANZTEST`). Τα unit tests μόνα τους δεν δικαιολογούν
ποτέ ένα merge που αφορά το backup.

## 7. Τρέξε ολόκληρη την πύλη τοπικά

```bash
make test            # backend + plugins + frontend Vitest
make check-types     # mypy + tsc --noEmit
make test-dexie-smoke  # GH-Pages-shape build, every route, no backend
cd frontend && bun run build
```

Όλα πρέπει να είναι πράσινα πριν ανοίξεις PR.

## 8. Commit και push

[Conventional Commits](https://www.conventionalcommits.org/). Αναφέρσου
στο issue με λέξη-κλειδί κλεισίματος ώστε το merge να το κλείσει αυτόματα.

```bash
git add -A
git commit -m "fix(area): short description

Longer description of what the problem was and how it was fixed.

Closes #123"

git push -u origin fix/short-description
```

Κράτα τα commits **ατομικά** - κάθε commit αφήνει το δέντρο πράσινο
(το `make test` περνάει). Συνδύασε μια αλλαγή πηγαίου κώδικα με την αλλαγή
του τεστ της στο ίδιο commit όταν ο διαχωρισμός τους θα δημιουργούσε
κόκκινη ενδιάμεση κατάσταση.

## 9. Άνοιξε ένα pull request

```bash
gh pr create --base develop \
  --title "fix(area): short description" \
  --body "Closes #123

## What changed
- ...

## Tests
- ..."
```

Στόχευε πάντα το **`develop`**, ποτέ το `main` (το `main` είναι ο κλάδος
των releases). Για ένα sub-issue ενός umbrella/epic, ανέφερε το
*sub-issue* με `Closes #<sub-issue>`, συν `Refs #<umbrella>` για
ιχνηλασιμότητα.

## 10. Περίμενε το CI

Το CI τρέχει τις πύλες ορθότητας σε κάθε PR:

- Frontend tests (Vitest) + Backend / plugin tests (pytest)
- TypeScript (`tsc --noEmit`) + mypy + ruff + ESLint
- Pre-commit hooks
- Πύλη πολυπλοκότητας (baseline ratchet - οι νέες συναρτήσεις πρέπει να
  μένουν κάτω από το όριο κυκλωματικής πολυπλοκότητας)
- Φύλακες μεγέθους φακέλων + αρχείων (αποτροπή god-file / god-folder)
- Ισοτιμία i18n (κάθε κατάλογος κάτω από το `backend/config/i18n/` πρέπει
  να ορίζει κάθε κλειδί)
- Φύλακας design tokens (χωρίς hardcoded χρώματα / utilities σταθερής
  παλέτας)
- Docs-drift verifier

Οι βαρύτεροι έλεγχοι (Dexie-mode E2E, coverage, mutation testing,
security scan, content-stats drift) τρέχουν νυχτερινά + στο release, όχι
σε κάθε PR. Ένα πράσινο PR δεν αποδεικνύει λοιπόν ότι το `develop` είναι
πράσινο.

Όταν μια πύλη σε μπλοκάρει - ιδίως ένα **ratchet** (πολυπλοκότητα,
μέγεθος αρχείου, μέγεθος φακέλου, ...) - διάβασε τις
[Πύλες, ratchets και προστασία κλάδων](gates-and-ratchets.md)
πριν υποθέσεις ότι κάνει λάθος. Εξηγεί τι είναι κάθε πύλη, τι κάνεις όταν
σε μπλοκάρει ένα ratchet, και πώς τρέχεις τις πύλες τοπικά με
`make ci` πριν κάνεις push.

## 11. Έλεγχος και merge

Περίμενε τον έλεγχο (ή κάνε merge μόνος σου αν έχεις δικαιώματα maintainer).
Τα PR γίνονται **squash-merge** στο `develop`, οπότε τα commits του κλάδου
σου συμπτύσσονται σε ένα καθαρό commit στον κορμό.

---

## Κανόνες του έργου (σύντομη εκδοχή)

| Κανόνας | Σημασία |
|---|---|
| `GITHUB-ISSUE-PFLICHT` | κάθε διόρθωση/λειτουργία χρειάζεται πρώτα issue |
| Μόνο Tailwind | χωρίς προσθήκες στο `global.css`, χωρίς inline στυλ χρωμάτων |
| Design tokens | χρώματα μέσω μεταβλητών CSS, ποτέ hex literals |
| Ισοτιμία Dexie-mode | όλα λειτουργούν σε Dexie *και* σε API mode |
| Πρώτα βιβλιοθήκη | native API > framework > βιβλιοθήκη > δικός κώδικας |
| Conventional Commits | `fix()`, `feat()`, `refactor()`, `docs()`, ... |
| i18n | όλα τα κείμενα UI σε κάθε κατάλογο `backend/config/i18n/` |
| Στόχοι αφής 44px | διαδραστικά στοιχεία φιλικά προς κινητά |
| Ένα θέμα ανά PR | κάθε PR φέρει μία ενιαία, συνεκτική αλλαγή |
| Προστασία κλάδων | το `develop` θέλει ενημερωμένο κλάδο + πράσινους ελέγχους (δεσμεύει και τους admins) |

Πλήρες σύνολο κανόνων: [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules).

## Συνήθεις εντολές

```bash
make dev               # start backend + frontend
make test              # all tests (backend + plugins + Vitest)
make test-dexie-smoke  # Dexie-mode release gate (no backend)
make check-types       # mypy + tsc --noEmit
make check-complexity-gate   # complexity ratchet
make check-folder-size       # god-folder guard
make sync-i18n         # regenerate frontend i18n from backend YAML
make sync-versions     # propagate the canonical version
cd frontend && bun run build   # build the frontend
```

Το `make help` παραθέτει κάθε target· το
[Makefile](https://github.com/astrapi69/adaptive-learner/blob/develop/Makefile)
είναι η πηγή αλήθειας για τις εντολές build.

## Η αρχιτεκτονική σε μία οθόνη

```
frontend/src/
  api/          FastAPI client (the only place fetch() lives)
  components/   UI components, grouped by concern (dashboard/, lesson/, ...)
  features/     feature-strategy gating (useFeatureAvailable)
  hooks/        React hooks
  lib/          business logic, grouped by domain (lesson/, srs/, ai/, ...)
  pages/        route components (+ content/, dashboard/, lesson/ subdirs)
  shared/       app-independent reusable components
  storage/      dual storage: getStorage() -> IStorageService
  styles/       design tokens + per-theme CSS

backend/app/
  routers/      thin FastAPI endpoints (delegate to services)
  services/     business logic (no FastAPI imports)
  repositories/ data layer (Session-free contracts)
  models/       SQLAlchemy models (single-file domain model)
  hookspecs.py  the 10 plugin hooks

plugins/        PluginForge plugins (one package each; the
                catalogue lives in CLAUDE.md)
```

Λεπτομέρειες: [Αρχιτεκτονική](architecture.md).

## Πού βρίσκω...;

| Τι | Πού |
|---|---|
| Κανόνες του έργου | [`.claude/rules/`](https://github.com/astrapi69/adaptive-learner/tree/develop/.claude/rules) |
| Αρχιτεκτονική | [Αρχιτεκτονική](architecture.md) |
| Πύλες, ratchets, προστασία κλάδων | [Πύλες, ratchets και προστασία κλάδων](gates-and-ratchets.md) |
| Επίπεδο αποθήκευσης | [Επίπεδο αποθήκευσης](storage-layer.md) |
| Σύστημα plugin | [Δημιουργία plugin](plugin-guide.md) |
| Ενσωμάτωση ΤΝ | [Ενσωμάτωση ΤΝ](ai-integration.md) |
| Δοκιμές | [Δοκιμές](testing.md) |
| Ροή εργασίας release | [Ροή εργασίας release](release.md) |
| Μορφή περιεχομένου μαθημάτων | [Δημιουργία περιεχομένου μαθημάτων](authoring-content.md) |
| i18n | [Διεθνοποίηση](i18n.md) |
| Ανάπτυξη | [Ανάπτυξη](deployment.md) |
| Roadmap | [`docs/ROADMAP.md`](https://github.com/astrapi69/adaptive-learner/blob/develop/docs/ROADMAP.md) |
