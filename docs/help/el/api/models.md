# Μοντέλα δεδομένων

Τα **25 μοντέλα SQLAlchemy** στο
`backend/app/models/__init__.py`, με τα σχήματα Pydantic
για τη μεταφορά δεδομένων. Η επιφάνεια συγχρονισμού περιλαμβάνει
28 πίνακες (τα 25 μοντέλα + 3 πίνακες σύνδεσης: `project_subjects`,
`project_tags`, `user_badges`).

Τα 14 αρχικά μοντέλα της v0.7.0 τεκμηριώνονται λεπτομερώς
παρακάτω· τα 11 που προστέθηκαν έκτοτε (Phase 12+ imports,
Phase 22 subjects/tags, Phase 29-30 gamification + anki,
Phase 32 notebooklm) αναφέρονται στο τέλος με ονομασία + πίνακα.
Βλ. το OpenAPI spec στο `/openapi.json` για κάθε πεδίο
κάθε μοντέλου.

## User

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| name | string | Υποχρεωτικό |
| email | string \| null | Μοναδικό όταν ορίζεται, προαιρετικό |
| language | string | Προεπιλογή `"de"` |
| created_at | datetime (ISO 8601) | Ορίζεται αυτόματα |
| updated_at | datetime (ISO 8601) | Ενημερώνεται αυτόματα |

Σχέσεις: `projects`, `curriculums`, `profiles`,
`settings` (1:1).

## UserSettings

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| user_id | string (UUID) | FK → User, μοναδικό |
| language | string | Προεπιλογή `"de"` |
| active_provider | enum `AIProvider` | `anthropic` / `openai` / `gemini`, προεπιλογή `anthropic` |
| api_key_anthropic | string \| null | Κρυπτογραφημένο με Fernet· μόνο για backend |
| api_key_openai | string \| null | Κρυπτογραφημένο με Fernet· μόνο για backend |
| api_key_gemini | string \| null | Κρυπτογραφημένο με Fernet· μόνο για backend |
| model_override_anthropic | string \| null | Προεπιλογή `null` (χρήση προεπιλογής plugin) |
| model_override_openai | string \| null | Προεπιλογή `null` |
| model_override_gemini | string \| null | Προεπιλογή `null` |

Το σχήμα μεταφοράς (`UserSettingsOut`) αντικαθιστά τα τρία
πεδία `api_key_*` με booleans `has_<provider>_key: bool` -
το απλό κείμενο δεν μεταφέρεται ποτέ πίσω στον client. Από
την v1.20.0 / Phase 34, το σχήμα μεταφοράς φέρει επίσης
`key_source_<provider>: ApiKeySource` (enum:
`env | secrets_yaml | settings | none`) που αναφέρει ποιο
επίπεδο επέλεξε ο resolver.

## LearningProject

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| user_id | string (UUID) | FK → User |
| topic | string | Έως 500 χαρακτήρες |
| goal | string | Κείμενο, απεριόριστο |
| timeframe | string | Έως 100 χαρακτήρες |
| daily_minutes | integer | Υποχρεωτικό |
| current_problem | string \| null | Κείμενο, προαιρετικό |
| active | boolean | Προεπιλογή `true` |
| created_at | datetime | |
| updated_at | datetime | |

## LearningProfile

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| user_id | string (UUID) | FK → User |
| project_id | string (UUID) | FK → LearningProject |
| deductive | float | 0.0-1.0 |
| inductive | float | 0.0-1.0 |
| error_based | float | 0.0-1.0 |
| dialogic | float | 0.0-1.0 |
| contextual | float | 0.0-1.0 |
| ai_adaptive | float | 0.0-1.0 |
| assessed_at | datetime | |
| version | integer | Αυξάνεται κατά την επαναξιολόγηση |

Το σχήμα μεταφοράς προσθέτει `dominant_method` (υπολογιζόμενη
ιδιότητα, argmax επί των 6 βαρών, αλφαβητική σειρά σε ισοπαλία).

## LearningSession

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| project_id | string (UUID) | FK → LearningProject |
| method | enum `LearningMethod` | Μία από τις έξι |
| started_at | datetime | Ορίζεται αυτόματα κατά τη δημιουργία |
| ended_at | datetime \| null | Ορίζεται κατά το `/end` |
| cycle_step | integer | 1-7, προεπιλογή 1 |
| status | enum `SessionStatus` | `active` / `completed` / `abandoned` |

## SessionMessage

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| session_id | string (UUID) | FK → LearningSession |
| role | enum `MessageRole` | `user` / `assistant` / `system` |
| content | string | Κείμενο, απεριόριστο |
| created_at | datetime | |

## SessionRating

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| session_id | string (UUID) | FK → LearningSession |
| understanding | integer | 1-5 |
| stress | integer | 1-5 |
| method_fit | integer | 1-5 |
| notes | string \| null | Προαιρετικό |
| created_at | datetime | |

## SessionNote

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| session_id | string (UUID) | FK → LearningSession |
| content | string | Υποχρεωτικό |
| created_at | datetime | |

Προς το παρόν δεν χρησιμοποιείται από το UI της v0.7.0·
διατηρείται για μελλοντική δυνατότητα ενσωματωμένου σημειωματάριου.

## ProgressCommit

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| project_id | string (UUID) | FK → LearningProject |
| session_id | string (UUID) | FK → LearningSession |
| method | enum `LearningMethod` | |
| understanding | float | 0.0-1.0 (αναλλοίωτα από 1-5) |
| stress | float | 0.0-1.0 |
| error_rate | float | 0.0-1.0, προς το παρόν πάντα 0.0 |
| duration_minutes | integer | Υπολογίζεται από ended_at - started_at |
| committed_at | datetime | |

Γράφεται από το hookimpl `on_session_complete` του tracking plugin
όταν μια συνεδρία τελειώνει με αξιολόγηση.

## StepEvaluation

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| session_id | string (UUID) | FK → LearningSession |
| from_step | integer | Βήμα κύκλου ΠΡΙΝ την αξιολόγηση |
| to_step | integer | Βήμα κύκλου ΜΕΤΑ (= from_step αν δεν εφαρμόστηκε) |
| advance | boolean | Η ΤΝ είπε να προχωρήσει; |
| confidence | float | 0.0-1.0 |
| applied | boolean | Εφαρμόστηκε τελικά η πρόταση; |
| fallback_used | boolean | True αν η ανάλυση JSON απέτυχε |
| reason | string | Αναγνώσιμη εξήγηση από την ΤΝ |
| evaluated_at | datetime | |

## MethodSwitch

| Πεδίο | Τύπος | Σημειώσεις |
|---|---|---|
| id | string (UUID) | Πρωτεύον κλειδί |
| project_id | string (UUID) | FK → LearningProject |
| from_method | enum `LearningMethod` | |
| to_method | enum `LearningMethod` | |
| reason | string | Γιατί ο χρήστης αποδέχτηκε την αλλαγή |
| switched_at | datetime | |

## Curriculum, LearningTopic, Lesson

| Curriculum | Τύπος | Σημειώσεις |
|---|---|---|
| id | UUID | |
| user_id | UUID | FK |
| title, description, language | string, string\|null, string | |

| LearningTopic | Τύπος | Σημειώσεις |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| parent_id | UUID \| null | Self-FK για δέντρο |
| title, description, order_index | | |

| Lesson | Τύπος | Σημειώσεις |
|---|---|---|
| id | UUID | |
| curriculum_id | UUID | FK |
| title, content, order_index | | |

## Enums

```python
class LearningMethod(str, Enum):
    DEDUCTIVE = "deductive"
    INDUCTIVE = "inductive"
    ERROR_BASED = "error_based"
    DIALOGIC = "dialogic"
    CONTEXTUAL = "contextual"
    AI_ADAPTIVE = "ai_adaptive"

class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

class AIProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GEMINI = "gemini"

# Since v1.20.0 / Phase 34
class ApiKeySource(str, Enum):
    ENV = "env"
    SECRETS_YAML = "secrets_yaml"
    SETTINGS = "settings"
    NONE = "none"

# Since v0.9.0 / Phase 12
class ImportedConversationSource(str, Enum):
    CHATGPT = "chatgpt"
    CLAUDE = "claude"
    GEMINI = "gemini"
    MANUAL = "manual"
    UNKNOWN = "unknown"
```

Η μορφή μεταφοράς είναι η τιμή συμβολοσειράς πεζών γραμμάτων
(π.χ. `"deductive"`, όχι `"DEDUCTIVE"`).

## Μοντέλα που προστέθηκαν μετά τη βάση v0.7.0 (11)

| Μοντέλο | Πίνακας | Από | Σκοπός |
|---|---|---|---|
| ImportedConversation | imported_conversations | v0.9.0 | Μία εισαγόμενη συνομιλία (πηγή, τίτλος, analysis_result JSON) |
| ImportedMessage | imported_messages | v0.9.0 | Μία σειρά σε εισαγόμενη συνομιλία |
| Subject | subjects | v1.9.0 | Κόμβος παγκόσμιας ιεραρχικής ταξινόμησης |
| Tag | tags | v1.9.0 | Ετικέτα ελεύθερου κειμένου ανά χρήστη |
| ProjectSubject | project_subjects | v1.9.0 | M:N (LearningProject, Subject) |
| ProjectTag | project_tags | v1.9.0 | M:N (LearningProject, Tag) |
| UserXP | user_xp | v1.16.0 | XP + singleton επιπέδου ανά χρήστη |
| Badge | badges | v1.16.0 | Κατάλογος badge (σπαρμένος από YAML) |
| UserBadge | user_badges | v1.16.0 | Εγγραφή κερδισμένου badge (μόνο προσθήκη) |
| UserStreak | user_streaks | v1.16.0 | Κατάσταση streak + παγώματα + λειτουργία Σαββατοκύριακου |
| AnkiCardSuggestion | anki_card_suggestions | v1.17.0 | Υποψήφια κάρτα flashcard που εξήχθη από ΤΝ |
| StudyQuestion | study_questions | v1.19.0 | Ερώτηση ενεργής ανάκλησης που δημιουργήθηκε από ΤΝ |
