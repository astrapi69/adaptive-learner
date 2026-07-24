# Δοκιμές

Η πειθαρχία δοκιμών του AdaptiveLearner επιβάλλεται από το
`make test` σε κάθε αλλαγή. Η στρατηγική είναι πυραμίδα: unit
στη βάση, integration στη μέση, E2E smoke στην κορυφή.

## Αριθμός δοκιμών

| Επίπεδο | Αριθμός | Εργαλείο |
|---|---|---|
| Backend unit + integration | 786 | pytest ^9 |
| Plugin tests (10 plugins) | 615 | pytest ^9 |
| Frontend unit + integration | 1233 | Vitest 4 |
| E2E smoke | 16 spec files | Playwright |
| **Σύνολο (`make test`)** | **2634** | |

Ανάλυση plugin: assessment 110 + ai-anthropic 34 + ai-openai 31
+ ai-gemini 33 + session 215 + tracking 64 + tools 58 +
gamification 23 + anki 20 + notebooklm 27.

## Backend pytest

```bash
make test-backend      # 786 tests, ~35s
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
make test-frontend                # 387 tests, ~2s
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
διαδρομή `make test`· χρειάζονται τρέχουσα εφαρμογή
(`make dev-bg` πρώτα).

## Κάλυψη

```bash
make test-coverage   # opt-in· αργό + θερμικά επιβαρυντικό
```

Η κάλυψη τρέχει στο CI για κάθε push στο main· κατέβασε τα
artifacts:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

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

Hooks: ruff check (auto-fix), ruff format, trailing whitespace,
end-of-file fixer, check-yaml, check-merge-conflict. Μόνο
backend - το frontend lint τρέχει κατά CI, όχι κατά pre-commit.

## CI

Το CI χωρίζεται σε δύο βαθμίδες: οι πύλες ορθότητας τρέχουν σε κάθε
PR (πρέπει να περάσουν για να γίνει merge), ενώ οι ακριβές ή
μόνο-προειδοποιητικές σουίτες τρέχουν στη νυχτερινή βάρδια και κατά
την κυκλοφορία (release).

Το `.github/workflows/ci.yml` τρέχει σε push στο `develop` / `main`
και σε κάθε PR (Python 3.12):

1. Backend tests (pytest)
2. Plugin tests (`make test-plugins`, και τα 13 μέσω του backend venv)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`), έλεγχος
   κυκλικών εξαρτήσεων, Stylelint, Vitest, `vite build`, `npm audit`
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

Περισσότερες πύλες PR ζουν σε δικά τους workflows:

- `complexity-check.yml` - η πύλη ratchet πολυπλοκότητας
  (`make check-complexity-gate`, radon για Python + ESLint complexity
  για TS). Είναι ratchet πάνω σε baseline: αποτυγχάνει μόνο σε ΝΕΟΥΣ ή
  επιδεινωμένους παραβάτες σε σχέση με το `.complexity-baseline`, οπότε
  μπλοκάρει τη νέα πολυπλοκότητα χωρίς να επιβάλλει σάρωση του
  προϋπάρχοντος χρέους. Η πλήρης, μόνο-προειδοποιητική αναφορά
  πολυπλοκότητας τρέχει νυχτερινά.
- `cohesion-check.yml` - ο έλεγχος μεγέθους αρχείων (πύλη έναντι
  του `.filesize-whitelist`) συν δύο πύλες ονομάτων κλάσεων: νεκρά
  ονόματα κλάσεων CSS (`check-dead-classnames.py` έναντι του
  `.dead-classnames-baseline`) και η **πύλη unstyled-className**
  (`--unstyled`, ratchet έναντι του
  `.unstyled-classnames-baseline`) - ένα `className` του οποίου
  όλα τα tokens είναι νεκρά μπλοκάρει το PR. Ο συνοδευτικός
  έλεγχος μεγέθους φακέλων τρέχει τοπικά μέσω
  `make check-folder-size`.
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

**Νυχτερινή βάρδια / Release (όχι σε PRs):**

- `dexie-smoke.yml` - η πύλη E2E της λειτουργίας Dexie (καθημερινά +
  σε `release/**` + dispatch· τοπικά `make test-dexie-smoke`)
- `coverage.yml` - αναφορά κάλυψης (καθημερινά + dispatch)
- `security-scan.yml` - pip-audit / npm audit / bandit (εβδομαδιαία +
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

Το `.github/workflows/release-gate.yml` τρέχει σε tag pushes:
επαληθεύει ότι τα version pins είναι συγχρονισμένα σε όλα τα αρχεία
που φέρουν έκδοση (χωρίς απόκλιση), ότι τα lockfiles των plugins
ταιριάζουν και ότι τα αναγεννώμενα artifacts είναι ενημερωμένα.
