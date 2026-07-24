# Endpoints plugins

Οι διαδρομές κάθε plugin τοποθετούνται κάτω από `/api/plugins/{plugin-name}/`.

## Plugin αξιολόγησης

```
GET /api/plugins/assessment/questions?lang=en
```

Επιστρέφει το πακέτο 12 ερωτήσεων με το `text` ανακτημένο
στη ζητούμενη γλώσσα. Κάθε απάντηση φέρει τα βάρη ανά μέθοδο.

```json
[
  {
    "id": "q01",
    "type": "multi",
    "text": "How do you approach a new topic?",
    "answers": [
      {
        "id": "a",
        "text": "I read the rules and theory first.",
        "weights": {"deductive": 1.0}
      },
      ...
    ]
  },
  ...
]
```

```
POST /api/plugins/assessment/evaluate
```

Σώμα:

```json
{
  "project_id": "p1",
  "answers": [
    {"question_id": "q01", "answer_ids": ["a", "b"]},
    {"question_id": "q02", "answer_id": "c"},
    ...
  ]
}
```

Γίνονται αποδεκτές τόσο η μορφή μοναδικής επιλογής
(`answer_id: string`) όσο και πολλαπλής (`answer_ids: string[]`).
Επιστρέφει το δημιουργημένο LearningProfile:

```json
{
  "id": "pr1",
  "user_id": "abc-123",
  "project_id": "p1",
  "deductive": 0.4167,
  "inductive": 0.1833,
  "error_based": 0.0833,
  "dialogic": 0.0833,
  "contextual": 0.0833,
  "ai_adaptive": 0.1500,
  "assessed_at": "2026-05-19T12:00:00+00:00",
  "version": 1,
  "dominant_method": "deductive"
}
```

```
GET /api/plugins/assessment/profile/{project_id}
```

Επιστρέφει το πιο πρόσφατο LearningProfile για το project.

## Plugin συνεδρίας

```
POST /api/plugins/session/start
```

Σώμα:

```json
{
  "project_id": "p1",
  "method": "deductive",
  "cycle_step": 1,
  "lang": "en"
}
```

Τα `method`, `cycle_step`, `lang` είναι προαιρετικά. Επιστρέφει
τη δημιουργημένη συνεδρία + το σύνθετο system prompt:

```json
{
  "session": {
    "id": "s1",
    "project_id": "p1",
    "method": "deductive",
    "started_at": "2026-05-19T12:00:00+00:00",
    "ended_at": null,
    "cycle_step": 1,
    "status": "active"
  },
  "system_prompt": "You are a deductive learning companion. ..."
}
```

```
POST /api/plugins/session/{session_id}/message
```

Σώμα:

```json
{"role": "user", "content": "I'd like to start with the present tense."}
```

Ο διακομιστής αποθηκεύει το μήνυμα του χρήστη, εκτελεί
`ai_complete`, διατηρεί την απάντηση του assistant, εκτελεί
τον αξιολογητή βήματος και επιστρέφει το σύνθετο αποτέλεσμα:

```json
{
  "user_message": {"id": "m1", "session_id": "s1", "role": "user", "content": "...", "created_at": "..."},
  "assistant_message": {"id": "m2", "session_id": "s1", "role": "assistant", "content": "...", "created_at": "..."},
  "ai_error": null,
  "session": {"...": "session row after cycle_step advance"},
  "step_evaluation": {
    "advance": true,
    "confidence": 0.85,
    "reason": "Learner clearly grasped the input.",
    "suggested_step": 2,
    "fallback_used": false,
    "applied": true,
    "from_step": 1
  }
}
```

```
POST /api/plugins/session/{session_id}/rate
```

Σώμα:

```json
{
  "understanding": 4,
  "stress": 2,
  "method_fit": 5,
  "notes": "Felt productive."
}
```

Αποθηκεύει μια εγγραφή SessionRating. Επιστρέφει την εγγραφή.

```
POST /api/plugins/session/{session_id}/end
```

Κλείνει τη συνεδρία. Ενεργοποιεί `on_session_complete` (το
tracking plugin γράφει ένα ProgressCommit). Επιστρέφει:

```json
{"session": {"...": "the session with status='completed' and ended_at set"}}
```

```
GET /api/plugins/session/switch-recommendation/{session_id}
```

Επιστρέφει:

```json
{"recommended": false, "to_method": null, "reason": null}
```

Ή, όταν εντοπίζεται στασιμότητα:

```json
{"recommended": true, "to_method": "dialogic", "reason": "Three sessions of flat understanding + high stress."}
```

```
POST /api/plugins/session/{session_id}/switch
```

Σώμα:

```json
{"to_method": "dialogic", "reason": "Felt right."}
```

Ενημερώνει το `session.method`, γράφει μια εγγραφή ελέγχου
MethodSwitch, επιστρέφει την ενημερωμένη συνεδρία.

## Plugin παρακολούθησης

```
GET /api/plugins/tracking/progress/{project_id}
```

Επιστρέφει τη συνοπτική αναφορά ανά namespace· το τμήμα
`tracking` φέρει την έξοδο του aggregator:

```json
{
  "tracking": {
    "total_sessions": 7,
    "total_minutes": 195,
    "streak_days": 3,
    "sessions_per_method": {"deductive": 4, "inductive": 2, "dialogic": 1},
    "method_distribution": [...],
    "recent_understanding": [0.6, 0.8, 0.8, 0.8, 1.0],
    "recent_stress": [0.4, 0.4, 0.2, 0.2, 0.2],
    "mean_understanding": 0.8,
    "mean_stress": 0.3,
    "recent_sessions": [...]
  },
  "step_evaluation": {
    "total_evaluations": 28,
    "average_confidence": 0.78,
    "advance_count": 21,
    "repeat_count": 5,
    "backward_count": 2,
    "fallback_count": 1,
    "evaluations_per_step": {"1": 7, "2": 6, ...},
    "time_seconds_per_step": {"1": 180.5, ...}
  }
}
```

```
GET /api/plugins/tracking/commits/{project_id}
```

Επιστρέφει όλες τις εγγραφές ProgressCommit για το project,
χρονολογικά.

## Plugin εργαλείων

```
GET /api/plugins/tools/recommendations/{project_id}?lang=en
```

Επιστρέφει τα 5 εργαλεία του καταλόγου κατατεταγμένα κατά
σχετικότητα με το profile του project:

```json
[
  {
    "name": "Anki",
    "url": "https://apps.ankiweb.net/",
    "why": "Spaced-repetition flashcards - great for cementing rules and error-corrections long-term.",
    "weight_keys": ["deductive", "error_based"],
    "score": 0.5
  },
  ...
]
```

```
GET /api/plugins/tools/spaced/{project_id}?lang=en
```

Επιστρέφει κάρτες ενεργειών επαναλαμβανόμενης εξάσκησης
βασισμένες στην πρόσφατη δραστηριότητα:

```json
[
  {
    "id": "sr-deductive-first",
    "method": "deductive",
    "interval_days": 1,
    "action": "session",
    "title": "First practice in deduction.",
    "urgency": 0.5
  },
  ...
]
```

## Plugin συνεδρίας - streaming + προφορά (v1.6.0+, v1.18.0+)

```
POST /api/plugins/session/{id}/message/stream  (SSE)
```

Ίδιο σχήμα σώματος με το `/message`· εκπέμπει τρεις τύπους
συμβάντων SSE:

- `start` - ωφέλιμο φορτίο `{user_message}` (η σειρά χρήστη
  αποθηκεύτηκε τώρα).
- `chunk` - ωφέλιμο φορτίο `{delta}` (ένα ή περισσότερα τμήματα
  κειμένου που φτάνουν από τη ροή του παρόχου ΤΝ).
- `done` - ωφέλιμο φορτίο πανομοιότυπο με τη σύγχρονη απόκριση
  `/message`: μήνυμα assistant + cycle_step + χρόνοι +
  προαιρετική κάρτα μετάβασης κύκλου.

```
GET  /api/plugins/session/pronunciation/eligibility/{project_id}
POST /api/plugins/session/pronunciation/phrase
POST /api/plugins/session/pronunciation/judge
```

Η καταλληλότητα προφοράς εξαρτάται από την ταξινομία θεμάτων
του project (διατρέχει τους γονείς αναζητώντας ρίζα
Languages / Sprachen). Το endpoint judge επιστρέφει
`{matches, score, feedback, missed_sounds}`.

## Plugin gamification (v1.16.0+)

```
GET  /api/plugins/gamification/xp/{user_id}
POST /api/plugins/gamification/xp/{user_id}/award
POST /api/plugins/gamification/xp/{user_id}/award-assessment
POST /api/plugins/gamification/xp/{user_id}/award-import
GET  /api/plugins/gamification/badges
GET  /api/plugins/gamification/badges/{user_id}
POST /api/plugins/gamification/badges/{user_id}/evaluate
GET  /api/plugins/gamification/streak/{user_id}
GET  /api/plugins/gamification/streak/{user_id}/heatmap
POST /api/plugins/gamification/streak/{user_id}/weekend-mode
POST /api/plugins/gamification/reset/{user_id}
```

Το `/streak/{user_id}/heatmap` επιστρέφει
`[{date, count}, ...]` για τις τελευταίες 365 ημέρες (περιορίζεται
σε [7, 730]). Το endpoint reset επιβεβαιώνει διπλά και στη
συνέχεια διαγράφει τις εγγραφές `user_xp` + `user_badges` +
`user_streaks`.

## Plugin Anki (v1.17.0+)

```
GET    /api/plugins/anki/cards/{user_id}
POST   /api/plugins/anki/cards
PATCH  /api/plugins/anki/cards/{id}
DELETE /api/plugins/anki/cards/{id}
POST   /api/plugins/anki/cards/extract/session/{id}
POST   /api/plugins/anki/cards/extract/conversation/{id}
POST   /api/plugins/anki/cards/mark-exported
```

Η εξαγωγή με ΤΝ γίνεται κατόπιν ενέργειας χρήστη. Η διαδρομή
εξαγωγής συνομιλίας διαβάζει επίσης το `analysis_result.vocabulary`
(από την v1.20.0) για να παράγει κάρτες cloze χωρίς επιπλέον
κλήση ΤΝ όταν η ανάλυση έχει ήδη συμπληρώσει τον πίνακα
λεξιλογίου.

## Plugin NotebookLM (v1.19.0+)

```
GET    /api/plugins/notebooklm/questions/{user_id}
POST   /api/plugins/notebooklm/questions
PATCH  /api/plugins/notebooklm/questions/{id}
DELETE /api/plugins/notebooklm/questions/{id}
POST   /api/plugins/notebooklm/generate-from-session/{id}
POST   /api/plugins/notebooklm/generate-from-project/{id}
POST   /api/plugins/notebooklm/study-guide/{project_id}
```

Το `/study-guide/{project_id}` επιστρέφει `text/markdown`
(μία μεγάλη κλήση ΤΝ με περικοπή περιεχομένου περίπου στους
30K χαρακτήρες). Οι επεξεργασίες από τον χρήστη θέτουν
`edited=True` ώστε ο εκ νέου εκτελεστής ΤΝ να τις παραλείπει.

## Ανακάλυψη plugins

```
GET /api/plugins/manifests
GET /api/plugins/health
GET /api/plugins/errors
```

Το καθένα επιστρέφει έναν χάρτη κλειδωμένο με το όνομα
plugin. Χρησιμοποιείται από το UI Ρυθμίσεων > Plugins για
την κατάσταση ενεργοποίησης + την ορατότητα σφαλμάτων φόρτωσης.
