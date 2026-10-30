# Δοκιμές

Η πειθαρχία δοκιμών του AdaptiveLearner επιβάλλεται από το
`make test` σε κάθε αλλαγή. Η στρατηγική είναι πυραμίδα: unit
στη βάση, integration στη μέση, E2E smoke στην κορυφή.

## Αριθμός δοκιμών

| Επίπεδο | Εργαλείο |
|---|---|
| Backend unit + integration | pytest ^9 |
| Plugin tests (όλα τα plugins) | pytest ^9 |
| Frontend unit + integration | Vitest 4 |
| E2E smoke | Playwright |
| Πύλη έκδοσης σε λειτουργία Dexie | Playwright |

Οι αριθμοί αυξάνονται σε κάθε έκδοση. Για να μην υπάρχουν διπλοί
αριθμοί που αποσυγχρονίζονται, αυτή η σελίδα ΔΕΝ γράφει σύνολο.
Το `docs/audits/current-coverage.md` είναι η μοναδική κανονική και
πάντα επίκαιρη πηγή για αριθμούς δοκιμών και κάλυψη. Τα plugins
είναι assessment, οι πάροχοι ΤΝ (anthropic / openai / gemini /
perplexity), session, tracking, tools, gamification, anki,
notebooklm, learning-repo, content-loader και missions.

## Backend pytest

```bash
make test-backend      # όλα τα tests του backend
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

Τα τεστ βρίσκονται στο `backend/tests/`. Τα fixtures στο
`conftest.py` παρέχουν νέα in-memory SQLite DB ανά τεστ, το
`TestClient` και έναν mocked plugin manager. Η απομόνωση τεστ
είναι αυστηρή - το `ADAPTIVE_LEARNER_TEST=1` ορίζεται πριν από
οποιαδήποτε εισαγωγή `app.*`.

## Plugin tests

Κάθε plugin έχει τον δικό του κατάλογο `tests/`:

```bash
make test-plugins              # όλα τα 7
make test-plugin-session       # μόνο ένα
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Τα plugin tests δεν φορτώνουν την εφαρμογή FastAPI - ασκούν τα
modules του plugin σε απομόνωση. Χρησιμοποίησε mock στον
`pluggy.PluginManager` κατά τη δοκιμή εκτέλεσης hooks.

## Frontend Vitest

```bash
make test-frontend                # τρέχει το Vitest από το frontend/
cd frontend && bunx vitest         # watch mode
cd frontend && bunx vitest run src/storage/  # ένας κατάλογος
```

Τα τεστ βρίσκονται δίπλα στον πηγαίο κώδικα: `Component.test.tsx`
δίπλα στο `Component.tsx`. Το happy-dom είναι το περιβάλλον·
React 19 + RTL.

## Πρότυπα mock

**Πάροχοι ΤΝ**: mock στο `global.fetch` και assert στο URL,
headers, body:

```typescript
beforeEach(() => {
  global.fetch = vi.fn(async (input, init) => {
    calls.push({url, method, body});
    return new Response(JSON.stringify({content: [{type: "text", text: "hi"}]}), {status: 200});
  });
});
```

**fake-indexeddb**: στην κορυφή κάθε αρχείου Dexie test:

```typescript
import "fake-indexeddb/auto";

beforeEach(async () => {
  await _resetDbForTests();
  const {IDBFactory} = await import("fake-indexeddb");
  (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});
```

Κάθε τεστ παίρνει φρέσκο in-memory IndexedDB - χωρίς διαρροές.

**Mock api/client.ts** (παλαιότερες σελίδες):

```typescript
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {...actual, api: {...actual.api, users: {...actual.api.users, get: apiGetMock}}};
});
```

Η σελίδα εισάγει `getStorage()`, που αναθέτει σε ApiStorage, που
αναθέτει σε `api.*`. Το mock κόβει στο επίπεδο `api.*` και
εκτελείται ακόμα μέσω της στοίβας storage.

## Playwright E2E

```bash
cd e2e && npx playwright test
cd e2e && npx playwright test --ui   # διαδραστικό
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

Τα smoke specs καλύπτουν τις κρίσιμες διαδρομές χρήστη:

- Επιλογέας γλώσσας landing + φόρμα onboarding
- Αξιολόγηση 12 ερωτήσεις + render radar
- Εκκίνηση + τέλος + βαθμολόγηση συνεδρίας
- Γλώσσα Ρυθμίσεων + API key
- Δημιουργία Curriculum
- Mobile viewports (iPhone SE, iPhone 14, Pixel 7, iPad)

Τα specs χρησιμοποιούν μόνο selectors `data-testid` - χωρίς
εύθραυστα CSS selectors. Τα smoke specs ΔΕΝ βρίσκονται στη
διαδρομή `make test`· ξεκινούν δικούς τους servers σε δικές
τους θύρες και δεν χρειάζονται τρέχουσα εφαρμογή. Ένα τρέχον
`make dev` μένει ανέγγιχτο.

## Κάλυψη

```bash
make test-coverage   # opt-in· αργό + θερμικά επιβαρυντικό
```

Η κάλυψη είναι αναφορά, όχι πύλη merge, οπότε δεν τρέχει σε PRs. Το
workflow `coverage.yml` τρέχει κάθε νύχτα (και κατόπιν dispatch)·
κατέβασε τα artifacts:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Κάθε plugin έχει δικό του artifact `<plugin-dir>-coverage`, για
παράδειγμα
`gh run download --name adaptive-learner-plugin-session-coverage`· ένα
νέο plugin καλύπτεται χωρίς αλλαγή του workflow.

Στόχοι ανά `.claude/rules/quality-checks.md`:

- Services + business logic: ελάχ. 95%
- API endpoints: ελάχ. 90%
- Frontend components με λογική: ελάχ. 85%
- Hooks + utilities: ελάχ. 95%

Συνολικά: 85-95% σε επίπεδο έργου.

## Pre-commit

```bash
cd backend && poetry run pre-commit install
```

Τα hooks βρίσκονται στο `.pre-commit-config.yaml`, για παράδειγμα
ruff check (auto-fix) και ruff format, έλεγχοι για κενά, YAML, JSON
και merge conflicts, το ESLint του frontend, οι έλεγχοι τεκμηρίωσης
(ratchet υποκατάστατων umlaut, αναφορές τεκμηρίωσης) και το
`plugin-lock-paired-with-pyproject` (μπλοκάρει): τρέχει
`poetry check --lock` για κάθε plugin του οποίου το `pyproject.toml`
ή το `poetry.lock` εμπλέκεται και αποτυγχάνει όταν οι εξαρτήσεις
άλλαξαν από τότε που γράφτηκε το lock· τρέχει επίσης στο pre-commit
job του CI σε όλα τα αρχεία. Σε αυτό το job το hook `eslint`
παραλείπεται (το job των frontend tests τρέχει το ESLint με
εγκατεστημένες εξαρτήσεις). Το Prettier δεν είναι hook: το
`bun run format:check` τρέχει στο job των frontend tests, χωρίς να
μπλοκάρει μέχρι την εφάπαξ αναμορφοποίηση του #3270.

## CI

Το CI χωρίζεται σε δύο βαθμίδες: οι πύλες ορθότητας τρέχουν σε κάθε
PR (πρέπει να περάσουν για να γίνει merge), ενώ οι ακριβές ή
μόνο-προειδοποιητικές σουίτες τρέχουν στη νυχτερινή βάρδια και κατά
την κυκλοφορία (release).

Το `.github/workflows/ci.yml` τρέχει σε push στο `develop` / `main`
και σε κάθε PR (Python 3.12):

1. Backend tests (pytest)
2. Plugin tests (`make test-plugins`, όλα μέσω του backend venv)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`), έλεγχος
   κυκλικών εξαρτήσεων, Stylelint, Vitest, `vite build`,
   `bun audit --audit-level=high` (μπλοκάρει σε ευρήματα υψηλής και
   κρίσιμης σοβαρότητας). Μια ειδοποίηση χωρίς διορθωμένη έκδοση που
   φτάνει μόνο σε μια εξάρτηση ανάπτυξης εξαιρείται με το ID της στο
   `frontend/audit-ignore.txt`: ένα ID ανά γραμμή, με ένα σχόλιο από
   πάνω που δίνει τον λόγο και πότε φεύγει η καταχώριση. Το
   `make check-security` διαβάζει την ίδια λίστα· το
   `security-scan.yml` μένει χωρίς φίλτρο.
4. Pre-commit hooks σε όλα τα αρχεία
5. Backend ruff + mypy + pip-audit
6. Ελεγκτής απόκλισης τεκμηρίωσης (`verify_docs.py` + συγχρονισμός
   mkdocs-nav)

**Test Impact Analysis (#615):** σε ένα PR τρέχουν μόνο τα
επηρεαζόμενα τεστ - `vitest run --changed origin/<base>` και
`pytest --testmon`. Τα push στο `develop` / `main`, οι νυχτερινές
εκτελέσεις και οι εκτελέσεις release τρέχουν πάντα την ΠΛΗΡΗ σουίτα.
Η μετάπτωση στην πλήρη σουίτα είναι αυτόματη (μη επιλύσιμο base ref ή
αστοχία της cache του testmon).
Και η πρώτη εκτέλεση ενός PR είναι επιλεκτική: διαβάζει τα δεδομένα του testmon που γράφει το job `testmon-seed` σε κάθε push στο `develop` (#3901).

Περισσότερες πύλες PR ζουν σε δικά τους workflows:

- `complexity-check.yml` - η πύλη ratchet πολυπλοκότητας
  (`make check-complexity-gate`, radon για Python + ESLint complexity
  για TS). Είναι ratchet πάνω σε baseline: αποτυγχάνει μόνο σε ΝΕΟΥΣ ή
  επιδεινωμένους παραβάτες σε σχέση με το `.complexity-baseline`, οπότε
  μπλοκάρει τη νέα πολυπλοκότητα χωρίς να επιβάλλει σάρωση του
  προϋπάρχοντος χρέους. Η πλήρης, μόνο-προειδοποιητική αναφορά
  πολυπλοκότητας τρέχει νυχτερινά. Στο ίδιο job τρέχει ο έλεγχος
  μεγέθους φακέλων (`scripts/check-folder-size.sh` έναντι του
  `.dirsize-baseline`)· τοπικά `make check-folder-size` ή ως μέρος
  του `make ci`.
- `cohesion-check.yml` - ο έλεγχος μεγέθους αρχείων (πύλη έναντι
  του `.filesize-whitelist`) συν δύο πύλες ονομάτων κλάσεων: νεκρά
  ονόματα κλάσεων CSS (`check-dead-classnames.py` έναντι του
  `.dead-classnames-baseline`) και η **πύλη unstyled-className**
  (`--unstyled`, ratchet έναντι του
  `.unstyled-classnames-baseline`) - ένα `className` του οποίου
  όλα τα tokens είναι νεκρά μπλοκάρει το PR.
- `visual-baseline-gate.yml` - ένα PR που αλλάζει οπτικά κρίσιμες
  διαδρομές (Lesson-components, exercise renderers, αρχεία
  theme/CSS) πρέπει να φέρνει τα επηρεαζόμενα baseline screenshots
  στο ίδιο PR· escape label `visual-baselines-unaffected` για
  αποδεδειγμένα αδρανείς αλλαγές.
- `testid-reference-gate.yml` - αν ένα PR αφαιρεί ή μετονομάζει
  ένα `data-testid` που ένα E2E spec αναφέρει στατικά (σε μια
  έντονα ορατή για τον χρήστη επιφάνεια) χωρίς να αγγίξει το spec,
  η πύλη αποτυγχάνει (`make check-testid-refs`)· escape label
  `testid-refs-unaffected`.
- `docker-build-smoke.yml` - build-only smoke των production
  compose images (η διαδρομή launcher / install.sh), φιλτραρισμένο
  κατά διαδρομές σε PRs, επιπλέον σε `release/**`, εβδομαδιαία και
  κατόπιν dispatch· τοπικά `make docker-build-smoke`.
- `dexie-smoke.yml` - η πύλη E2E της λειτουργίας Dexie: σε κάθε pull
  request που την αφορά (αποφασίζει το
  `scripts/dexie_smoke_affected.py`· το job `Dexie smoke (required)`
  αναφέρει πάντα), καθώς και καθημερινά, σε `release/**` και κατόπιν
  dispatch· τοπικά `make test-dexie-smoke`.
- `backup-e2e.yml` - τρέχει σε PRs που αγγίζουν μια διαδρομή backup
  (για παράδειγμα `frontend/src/storage/backup/`, τα Dexie stores ή
  τις υπηρεσίες backup του backend· η λίστα βρίσκεται στο workflow)
  και εκτελεί κάθε `e2e/dexie/backup-*.spec.ts`, μαζί με τον κύκλο
  export/import για όλους τους πίνακες του backup.

**Νυχτερινή βάρδια / Release (όχι σε PRs):**

- `coverage.yml` - αναφορά κάλυψης (καθημερινά + dispatch)
- `security-scan.yml` - pip-audit / bun audit / bandit (εβδομαδιαία +
  σε `release/**` + dispatch· μόνο προειδοποιητικό)
- `content-stats.yml` - απόκλιση στατιστικών περιεχομένου έναντι ενός
  φρέσκου checkout του αποθετηρίου περιεχομένου (καθημερινά +
  dispatch)
- `mutation-frontend.yml` - Stryker mutation testing (νυχτερινά
  πίσω από τη μεταβλητή repo `ENABLE_NIGHTLY_MUTATION` + dispatch·
  κάθε εκτέλεση μεταλλάσσει μία φέτα των αρχείων, ώστε ο γύρος να
  χωρά στο χρονικό όριο του job)· το mutation testing του backend
  χρησιμοποιεί mutmut
- `webkit-gate.yml` - η πύλη layout με πραγματική μηχανή WebKit
  (κλάσεις σφαλμάτων iOS/Safari που οι πύλες Chromium δομικά δεν
  μπορούν να δουν), καθημερινά πίσω από τη μεταβλητή repo
  `ENABLE_NIGHTLY_WEBKIT`, πάντα σε `release/**` και κατόπιν
  dispatch
- `visual-regression.yml` - η μήτρα των οπτικών baselines
  (καθημερινά + dispatch· με `update_baselines=true` τα baselines
  ξανααποδίδονται στο CI και ανεβαίνουν ως artifact)
- `visual-baseline-sync.yml` - service workflow: αποδίδει τα
  baselines στο CI και τα κάνει push ως commit στο branch του PR
  (label `refresh-visual-baselines`, ή dispatch με αριθμό PR) - η
  εξέταση των εικόνων πριν από το merge παραμένει υποχρεωτική
- `smoke-nightly.yml` - νυχτερινή εκτέλεση του smoke για mobile
  viewports· τα ευρήματα καταλήγουν σε ένα συγκεντρωτικό issue
- `unused-catalog-keys.yml` - νυχτερινή αναφορά για κλειδιά
  καταλόγου χωρίς καταναλωτή, παλαιότερα από το παράθυρο
  προετοιμασίας (`AGE_DAYS` στο
  `frontend/src/i18n/unused-catalog-keys.ts`), σε ένα συγκεντρωτικό
  issue· κάθε κλειδί εκεί είναι υποψήφιο και ελέγχεται ένα-ένα πριν
  διαγραφεί

Το `.github/workflows/release-gate.yml` τρέχει σε tag pushes:
επαληθεύει ότι τα version pins είναι συγχρονισμένα σε όλα τα αρχεία
που φέρουν έκδοση (χωρίς απόκλιση), ότι τα lockfiles των plugins
ταιριάζουν και ότι τα αναγεννώμενα artifacts είναι ενημερωμένα.
