# Επισκόπηση API

Το backend του AdaptiveLearner εκθέτει ένα REST API μέσω FastAPI. Σε
λειτουργία Server το frontend επικοινωνεί μαζί του· σε λειτουργία
Local (Dexie) το API δεν είναι προσβάσιμο — οι ίδιες λειτουργίες
εκτελούνται στον browser.

## Βασικό URL

- **Τοπική ανάπτυξη**: `http://localhost:18001/api`
- **Docker prod**: διαμορφώνεται ανά deployment (π.χ.
  `https://yourdomain.com/api`)
- **GH Pages**: δεν εφαρμόζεται (Dexie mode)

Το frontend επιλύει το βασικό URL από `VITE_API_BASE` κατά τη
διάρκεια της κατασκευής· η προεπιλογή είναι `/api` ώστε ο Vite dev
server να κάνει forward διαφανώς.

## Πιστοποίηση

Η έκδοση v1.20.0 δεν διαθέτει πιστοποίηση ανά αίτημα. Το σύστημα
είναι μονού χρήστη ανά browser: ένα `user_id` αποθηκεύεται στο
`localStorage` και διαβιβάζεται στις διαδρομές URL
(`/users/{user_id}/...`).

Τα κλειδιά παρόχων ΤΝ επιλύονται μέσω μιας τριεπίπεδης αλυσίδας
(`services.settings.resolve_api_key`):

1. Μεταβλητή περιβάλλοντος `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
2. `ai.<provider>.api_key` στο
   `~/.config/adaptive_learner/secrets.yaml`.
3. Κρυπτογραφημένη με Fernet στήλη `UserSettings.api_key_<provider>`
   (ορίζεται μέσω του UI Ρυθμίσεων· δεν επιστρέφεται ποτέ στο
   frontend ως απλό κείμενο).
4. `None` — η κλήση ΤΝ επιστρέφει σφάλμα στο UI.

Το `UserSettingsOut.key_source_*` (enum
`env | secrets_yaml | settings | none`) αναφέρει ποιο επίπεδο
επέλυσε το ενεργό κλειδί, ανά πάροχο, για το badge πηγής στο UI
Ρυθμίσεων.

Ένα μελλοντικό πολυ-χρηστικό / πολυ-μισθωτικό στάδιο θα προσθέσει
πιστοποίηση. Προς το παρόν, τα deployments πρέπει να βρίσκονται πίσω
από το δικό τους επίπεδο πιστοποίησης (reverse proxy με HTTP basic
auth, Tailscale, VPN κ.λπ.) όταν εκτίθενται σε δίκτυο.

## Μορφή απόκρισης

Οι επιτυχημένες αποκρίσεις επιστρέφουν αμέσως το αντικείμενο
δεδομένων, χωρίς περιτύλιγμα:

```json
{
  "id": "abc-123",
  "topic": "Spanish grammar",
  "active": true
}
```

Οι λίστες επιστρέφουν πίνακες JSON:

```json
[
  {"id": "p1", "topic": "Spanish"},
  {"id": "p2", "topic": "Calculus"}
]
```

Κωδικοί κατάστασης HTTP:

| Κωδικός | Σημασία |
|---|---|
| 200 | OK (ανάγνωση) |
| 201 | Δημιουργήθηκε (POST) |
| 204 | Χωρίς περιεχόμενο (DELETE) |
| 400 | Σφάλμα επικύρωσης (Pydantic) |
| 404 | Δεν βρέθηκε |
| 409 | Σύγκρουση (σπάνιο) |
| 422 | Σφάλμα επικύρωσης Pydantic (προεπιλογή FastAPI) |
| 500 | Σφάλμα διακομιστή |
| 502 | Εξωτερική υπηρεσία μη προσβάσιμη (πάροχος ΤΝ) |

## Μορφή σφάλματος

Τα σφάλματα επιστρέφουν ένα μοναδικό πεδίο `detail`:

```json
{"detail": "Project abc-123 not found"}
```

Τα σφάλματα επικύρωσης Pydantic επιστρέφουν μια δομημένη λίστα:

```json
{
  "detail": [
    {"loc": ["body", "daily_minutes"], "msg": "value is not a valid integer", "type": "type_error.integer"}
  ]
}
```

Σε λειτουργία αποσφαλμάτωσης (`ADAPTIVE_LEARNER_DEBUG=true`) η
απόκριση περιλαμβάνει επίσης ένα πεδίο `traceback`. Τα production
deployments πρέπει να αφήνουν τη λειτουργία αποσφαλμάτωσης
απενεργοποιημένη.

Η κλάση `ApiError` του frontend χρησιμοποιεί και τις δύο μορφές —
βλ. `frontend/src/api/client.ts` για τον ακριβή αναλυτή.

## Ομάδες endpoints

| Ομάδα | Πρόθεμα | Τι κάνει |
|---|---|---|
| Health + i18n | `/health`, `/i18n/{lang}` | Υγεία εφαρμογής + συμβολοσειρές UI |
| Users | `/users` | CRUD χρηστών + nested projects |
| Projects | `/projects` | Ανάγνωση / ενημέρωση με εύρος project |
| Settings | `/settings/{user_id}` | UserSettings + κλειδιά API + key_source + διαθέσιμα μοντέλα |
| System | `/system/info` | Έκδοση, διαδρομές, εκδόσεις εξαρτήσεων |
| Backup | `/backup/export`, `/backup/import`, `/backup/stats` | Στιγμιότυπο JSON + επαναφορά |
| Export | `/export/{progress,session,curriculum}` | Αναφορές MD + PDF |
| Sync | `/sync/...` | Push, pull, επίλυση, σύζευξη |
| Imports | `/users/{user_id}/imports` | Εισαγωγή ιστορικού συνομιλίας + αναλυτής |
| Subjects + tags | `/subjects`, `/users/{id}/tags`, `/projects/{id}/{subjects,tags}` | Παγκόσμια ταξινόμηση + ετικέτες ανά χρήστη |
| Assessment plugin | `/plugins/assessment/...` | Ερωτήσεις, αξιολόγηση, προφίλ |
| Session plugin | `/plugins/session/...` | Έναρξη, μήνυμα + ροή, βαθμολόγηση, λήξη, εναλλαγή, προφορά |
| Tracking plugin | `/plugins/tracking/...` | Πρόοδος + commits |
| Tools plugin | `/plugins/tools/...` | Συστάσεις + spaced |
| Gamification plugin | `/plugins/gamification/...` | XP, badges, streaks, επαναφορά |
| Anki plugin | `/plugins/anki/...` | CRUD καρτελών + εξαγωγή ΤΝ + mark-exported |
| NotebookLM plugin | `/plugins/notebooklm/...` | Ερωτήσεις μελέτης + οδηγός μελέτης |
| Curriculum | `/users/{user_id}/curricula`, `/curricula/{id}` | CRUD curriculum + θεμάτων + μαθημάτων |
| Ανακάλυψη plugins | `/plugins/manifests`, `/plugins/health`, `/plugins/errors` | Ό,τι είναι καταχωρημένο |

Βλ. [Core endpoints](core-endpoints.md) και
[Plugin endpoints](plugin-endpoints.md) για την πλήρη λίστα
μεθόδων με παραδείγματα αίτησης / απόκρισης.

## OpenAPI / Swagger

Το FastAPI δημιουργεί αυτόματα ένα spec OpenAPI 3.1 από τα schemas
Pydantic. Σε λειτουργία ανάπτυξης:

- **Swagger UI**: `http://localhost:18001/api/docs`
- **Redoc**: `http://localhost:18001/api/redoc`
- **Raw OpenAPI JSON**: `http://localhost:18001/api/openapi.json`

Αυτές είναι η αυθεντική αναφορά για τον ακριβή σχηματισμό κάθε
endpoint. Οι σελίδες Markdown εδώ είναι ένα επιμελημένο υποσύνολο για
αναγνωσιμότητα.

## Σελιδοποίηση

Τα endpoints δεν σελιδοποιούν στην έκδοση v1.20.0. Το σύνολο
δεδομένων είναι μονού χρήστη και μικρό· η μεγαλύτερη λίστα (sessions
ανά project) φτάνει τις εκατοντάδες, όχι χιλιάδες. Ένα μελλοντικό
στάδιο θα προσθέσει σελιδοποίηση βάσει cursor αν το σχήμα δεδομένων
μεγαλώσει.

## Εκδόσεις

Το API δεν έχει πρόθεμα έκδοσης στο URL. Οι αλλαγές που σπάνε τη
συμβατότητα εισάγονται σε όρια semver-major· το CHANGELOG τεκμηριώνει
τι άλλαξε.
