# Ανάπτυξη

Τέσσερις λειτουργίες ανάπτυξης παρέχονται στην v1.20.0:

| Λειτουργία | Πού | Backend | Κλήσεις ΤΝ | Πηγή κλειδιού |
|---|---|---|---|---|
| Τοπική ανάπτυξη | `make dev` | FastAPI στο :18001 | Πλευρά διακομιστή | env / secrets.yaml / DB |
| GitHub Pages | `astrapi69.github.io/adaptive-learner/` | Κανένα (Dexie) | Απευθείας browser | DB (IndexedDB) |
| Desktop launcher | Binary PyInstaller | FastAPI εκκινείται τοπικά | Πλευρά διακομιστή | secrets.yaml (αυτόματη δημιουργία) / UI Ρυθμίσεων |
| Docker | Docker Compose self-host | FastAPI σε container | Πλευρά διακομιστή | env / UI Ρυθμίσεων |

## Τοπική ανάπτυξη

```bash
make dev
```

Εκκινεί το backend (FastAPI + uvicorn `--reload`) στη θύρα 18001
και το frontend (Vite dev server) στη θύρα 15174 παράλληλα.
Πάτησε Ctrl-C μία φορά για να σταματήσουν και τα δύο.

Το Vite proxy του frontend προωθεί `/api/*` στο backend, οπότε
το frontend χρησιμοποιεί πάντα `/api` ως base URL - δεν χρειάζεται
διαμόρφωση CORS για τοπική ανάπτυξη.

Για λειτουργία παρασκηνίου:

```bash
make dev-bg     # αποσυνδεδεμένο
make dev-down   # διακοπή
```

## GitHub Pages (μόνο Dexie)

Το `.github/workflows/deploy-gh-pages.yml` χτίζει το frontend με:

- `VITE_BASE="/adaptive-learner/"` - προθεματίζει κάθε URL asset
  για τη διαδρομή Pages ανά repo.
- `VITE_STORAGE_MODE="dexie"` - καρφώνει το DexieStorage ως
  προεπιλεγμένη λειτουργία.
- `VITE_API_BASE=""` - κανένα backend στο οποίο να δείχνει.

Το workflow τρέχει σε κάθε push στο `main` και σε χειροκίνητη
εντολή. Μετά το build αντιγράφει `dist/index.html` σε
`dist/404.html` για τη εναλλακτική SPA-router, στη συνέχεια
χρησιμοποιεί `actions/upload-pages-artifact@v5` + `actions/deploy-pages@v5`
για δημοσίευση.

Το URL του site είναι `https://astrapi69.github.io/adaptive-learner/`.
Χρήστες με custom domain προσθέτουν αρχείο `CNAME` στο `frontend/public/`
με το όνομα domain· η Pages routing του GitHub που γνωρίζει domain
αναλαμβάνει τα υπόλοιπα.

## Docker Compose (πλήρης στοίβα)

```bash
make prod        # docker compose up -d
make prod-down   # docker compose down
```

Το `docker-compose.prod.yml` περιλαμβάνει:

- **backend** (FastAPI σε image Python 3.12), εκθέτει θύρα 7880.
- **nginx** sidecar που σερβίρει το χτισμένο frontend
  (`frontend/dist/`) και δρομολογεί `/api/*` στο backend.
- **Ένα SQLite volume** που επιβιώνει από επανεκκινήσεις container.

Τα `install.sh` και `install.ps1` είναι οι curl-pipe installers
για τελικούς χρήστες - κατεβάζουν tagged release tarball,
ρυθμίζουν `ADAPTIVE_LEARNER_SECRET_KEY` και εκτελούν
`docker compose up`.

Τα installers αναγεννιούνται κατά τον χρόνο release από
`install.sh.template` / `install.ps1.template` συν την έκδοση του
`backend/pyproject.toml` (δες `scripts/sync_versions.py`).
Μην επεξεργάζεσαι τα παραγόμενα αρχεία απευθείας.

## Διαμόρφωση για παραγωγή

Τρία πράγματα έχουν σημασία για την παραγωγή:

1. **`ADAPTIVE_LEARNER_SECRET_KEY`**: πρέπει να είναι σταθερό κλειδί
   Fernet. Παράγαγέ το μία φορά, αποθήκευσέ το ασφαλώς (HashiCorp
   Vault, AWS Secrets Manager, σφραγισμένο `.env`). Η απώλειά του
   σημαίνει ότι όλα τα κρυπτογραφημένα API keys καθίστανται μη
   αναγνώσιμα. Η εφαρμογή αποτυγχάνει σκληρά κατά την εκκίνηση αν
   δεν είναι ορισμένο (χωρίς σιωπηλή προεπιλογή).
2. **`ADAPTIVE_LEARNER_CORS_ORIGINS`**: λίστα επιτρεπόμενων origins
   χωρισμένη με κόμματα. Η προεπιλογή είναι επιτρεπτική· σφίξε
   την για παραγωγή.
3. **`ADAPTIVE_LEARNER_DEBUG`**: άφησε χωρίς ορισμό / false στην
   παραγωγή. Η λειτουργία debug εκθέτει stack traces στις
   αποκρίσεις σφαλμάτων.
4. **`ADAPTIVE_LEARNER_BIND_ADDRESS`**: προεπιλογή `127.0.0.1`,
   ώστε η δημοσιευμένη θύρα να είναι προσβάσιμη μόνο από τον ίδιο
   τον host. Η εφαρμογή δεν έχει πιστοποίηση - δέσε `0.0.0.0` μόνο
   συνειδητά, και μόνο σε αξιόπιστο δίκτυο ή πίσω από δικό σου
   στρώμα auth (reverse proxy με basic auth, VPN).

Για containers, οι μεταβλητές περιβάλλοντος είναι το ιδιωματικό
κανάλι έγχυσης. Η επικάλυψη `~/.config/adaptive_learner/secrets.yaml`
προορίζεται για desktop / launcher· μπορείς να τη bind-mount-αρεις
μέσα σε container αν προτιμάς ένα αρχείο διαμόρφωσης αντί για
πολλές μεταβλητές.

## Desktop launcher

Τα binaries PyInstaller στο `launcher/` εκκινούν τοπικό FastAPI
στο `http://localhost:7880`, στη συνέχεια ανοίγουν τον προεπιλεγμένο
browser του χρήστη. Κατά την πρώτη εκκίνηση ο launcher δημιουργεί
επίσης `~/.config/adaptive-learner/secrets.yaml` ως σχολιασμένο
πρότυπο + `chmod 0600` σε POSIX ώστε ο χρήστης να μπορεί να
τοποθετήσει τα API keys του χωρίς να αγγίξει το UI Ρυθμίσεων.

Η πλήρης αλυσίδα διαμόρφωσης τριών επιπέδων (YAML έργου < επικάλυψη
χρήστη < μεταβλητές περιβάλλοντος) τεκμηριώνεται στο
`docs/configuration.md`.

## Launcher (desktop διαπλατφορμικό)

Το `launcher/` είναι ένα one-binary installer βασισμένο σε
PyInstaller. Το GitHub Actions χτίζει τρία binaries ανά release:

- `launcher-linux.yml` → `adaptive-learner-launcher-linux`
- `launcher-macos.yml` → `adaptive-learner-launcher-macos`
- `launcher-windows.yml` → `adaptive-learner-launcher.exe`

Κάθε launcher ενσωματώνει την έκδοση (literal `__version__` +
`_build_info.py` γραμμένο από το spec αρχείο κατά το build) και
κατεβάζει το αντίστοιχο tagged release tarball + εξάγει +
εκκινεί το backend + ανοίγει το frontend στον browser του χρήστη.

Ο launcher δεν είναι εσκεμμένα το πρωταρχικό κανάλι διανομής
(αυτό είναι το Docker). Υπάρχει για χρήστες που θέλουν εμπειρία
"διπλό κλικ για εγκατάσταση".

## Αρχιτεκτονική CI/CD

Κάθε workflow τρέχει σε απομόνωση· χωρίς κοινή κατάσταση μεταξύ τους:

| Workflow | Εντολή | Τι κάνει |
|---|---|---|
| `ci.yml` | push, pull_request | Τεστ + lint + tsc |
| `coverage.yml` | push στο main | Coverage HTML + xml |
| `release-gate.yml` | tag push | Έλεγχος απόκλισης pin έκδοσης |
| `deploy-gh-pages.yml` | push στο main, dispatch | Build + deploy GH Pages |
| `launcher-{linux,macos,windows}.yml` | release: created | Build + επισύναψη binary launcher |
| `docs.yml` | push στο main | Build MkDocs (αυτή τη στιγμή ανενεργό - το site έρχεται από workflow GH Pages) |
