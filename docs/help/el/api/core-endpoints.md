# Βασικά endpoints

Endpoints που δεν καταχωρούνται από plugin: χρήστες, projects,
ρυθμίσεις, i18n, health.

## Health

```
GET /api/health
```

```json
{
  "status": "ok",
  "version": "1.20.0",
  "debug": false
}
```

## Κατάλογος i18n

```
GET /api/i18n/{lang}
```

Επιστρέφει τον πλήρη ένθετο κατάλογο για τη ζητούμενη γλώσσα.
Χρησιμοποιεί EN ως εναλλακτική αν το `{lang}` δεν είναι καταχωρημένο.

```json
{
  "common": {"save": "Save", "cancel": "Cancel"},
  "settings": {"title": "Settings", "section_language": "Language", ...},
  ...
}
```

## Χρήστες

```
POST /api/users
```

Σώμα:

```json
{"name": "Asterios", "email": "ar@example.com", "language": "de"}
```

Απόκριση (201):

```json
{
  "id": "abc-123",
  "name": "Asterios",
  "email": "ar@example.com",
  "language": "de",
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

```
GET /api/users/{user_id}
```

Επιστρέφει τον χρήστη. 404 αν δεν βρεθεί.

```
PATCH /api/users/{user_id}
```

Σώμα: οποιοδήποτε υποσύνολο του `{name, email, language}`. Επιστρέφει
την ενημερωμένη εγγραφή.

## Projects (σε επίπεδο χρήστη)

```
GET /api/users/{user_id}/projects
POST /api/users/{user_id}/projects
```

Σώμα POST:

```json
{
  "topic": "Spanish grammar",
  "goal": "Pass B2 exam",
  "timeframe": "6 weeks",
  "daily_minutes": 30,
  "current_problem": "Tenses",
  "active": true
}
```

Απόκριση (201):

```json
{
  "id": "p1",
  "user_id": "abc-123",
  "topic": "Spanish grammar",
  "goal": "Pass B2 exam",
  "timeframe": "6 weeks",
  "daily_minutes": 30,
  "current_problem": "Tenses",
  "active": true,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

## Projects (άμεσα)

```
GET /api/projects/{project_id}
PATCH /api/projects/{project_id}
```

Σώμα PATCH: οποιοδήποτε υποσύνολο του `{topic, goal, timeframe,
daily_minutes, current_problem, active}`. Επιστρέφει την ενημερωμένη
εγγραφή.

## Ρυθμίσεις

```
GET /api/settings/{user_id}
```

Επιστρέφει UserSettings με τα πεδία API Key **ως booleans + enums πηγής**
(το backend δεν στέλνει ποτέ πίσω κλειδιά σε απλό κείμενο):

```json
{
  "id": "s1",
  "user_id": "abc-123",
  "language": "de",
  "active_provider": "anthropic",
  "has_anthropic_key": true,
  "has_openai_key": false,
  "has_gemini_key": false,
  "key_source_anthropic": "secrets_yaml",
  "key_source_openai": "none",
  "key_source_gemini": "none",
  "model_override_anthropic": "claude-sonnet-4-20250514",
  "model_override_openai": null,
  "model_override_gemini": null,
  "created_at": "2026-05-19T12:00:00+00:00",
  "updated_at": "2026-05-19T12:00:00+00:00"
}
```

Τιμές `key_source_*`: `env` (μεταβλητή περιβάλλοντος ορισμένη + η τιμή
διαφέρει από το yaml), `secrets_yaml` (η τιμή αντιστοιχεί στο yaml Ή
συμπληρώθηκε από το yaml μέσω env), `settings` (κρυπτογραφημένη στήλη
Fernet DB), `none`.

```
PATCH /api/settings/{user_id}
```

Σώμα: οποιοδήποτε υποσύνολο του `{active_provider, language,
model_override_anthropic, model_override_openai,
model_override_gemini}`. Κενή συμβολοσειρά καθαρίζει μια
παράκαμψη· η παράλειψη ενός πεδίου δεν το αλλάζει.

## API Keys

```
POST /api/settings/{user_id}/api-key
```

Σώμα:

```json
{"provider": "anthropic", "key": "sk-ant-..."}
```

Κρυπτογραφεί με Fernet και αποθηκεύει. Επιστρέφει το ενημερωμένο
UserSettings με `has_<provider>_key: true`.

```
DELETE /api/settings/{user_id}/api-key/{provider}
```

Διαγράφει το κλειδί. Επιστρέφει το ενημερωμένο UserSettings με
`has_<provider>_key: false`.

## Curriculum

```
GET /api/users/{user_id}/curricula
POST /api/users/{user_id}/curricula
GET /api/curricula/{curriculum_id}
PATCH /api/curricula/{curriculum_id}
DELETE /api/curricula/{curriculum_id}
```

Σώμα POST για Curriculum:

```json
{"title": "Spanish", "description": "Grammar + vocab", "language": "de"}
```

```
GET /api/curricula/{curriculum_id}/topics
POST /api/curricula/{curriculum_id}/topics
GET /api/topics/{topic_id}
PATCH /api/topics/{topic_id}
DELETE /api/topics/{topic_id}
```

Σώμα POST για Topic:

```json
{"title": "Subjunctive", "description": null, "parent_id": null, "order_index": 0}
```

```
GET /api/curricula/{curriculum_id}/lessons
POST /api/curricula/{curriculum_id}/lessons
GET /api/lessons/{lesson_id}
PATCH /api/lessons/{lesson_id}
DELETE /api/lessons/{lesson_id}
```

Σώμα POST για Lesson:

```json
{"title": "Past subjunctive", "content": "# Past subjunctive...", "order_index": 0}
```
