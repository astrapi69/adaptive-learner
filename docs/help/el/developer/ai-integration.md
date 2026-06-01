# Ενσωμάτωση ΤΝ

Το Adaptive Learner εκτελεί κάθε συνομιλία μάθησης μέσω έως
**τριών** κλήσεων ΤΝ ανά γύρο — η streamed απάντηση, ο αξιολογητής
βήματος και (στο βήμα 7) ο αξιολογητής μετάβασης θέματος. Τρεις
πάροχοι έρχονται έτοιμοι· νέοι πάροχοι συνδέονται μέσω της
οικογένειας hooks `ai_complete*`.

## Ο hook ai_complete

```python
# backend/app/hookspecs.py
@hookspec(firstresult=True)
def ai_complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = 1024,
) -> str | None:
    """Επιστρέφει το κείμενο βοηθού, ή None αν αυτό το plugin δεν χειρίζεται το ``model``."""
```

Το `firstresult=True` σημαίνει ότι το pluggy σταματά στο πρώτο
μη-None επιστρεφόμενο. Κάθε plugin παρόχου ελέγχει το πρόθεμα
`model` και επιστρέφει το κείμενο αν κατέχει το μοντέλο:

```python
@hookimpl
def ai_complete(
    self, messages, model, api_key, max_tokens
) -> str | None:
    if not model.startswith("claude-"):
        return None
    # ... κλήση Anthropic API, επιστροφή κειμένου ...
```

Παρέχονται τρία plugins: `ai-anthropic` (claude-*), `ai-openai`
(gpt-*), `ai-gemini` (gemini-*).

## Ασύγχρονες + streaming παραλλαγές

```python
@hookspec(firstresult=True)
async def ai_complete_async(messages, model, api_key, max_tokens) -> str:
    """Awaitable· ίδια μορφή με ai_complete. v1.5.0+."""

@hookspec(firstresult=True)
def ai_complete_stream(messages, model, api_key, max_tokens):
    """Επιστρέφει async iterator τμημάτων κειμένου. v1.6.0+."""
```

Το `ai_complete_async` χρησιμοποιείται από το session route στο
όριο κύκλου βήμα 6→7, ώστε η αξιολόγηση βήματος και η μετάβαση
θέματος να εκτελεστούν ταυτόχρονα μέσω `asyncio.gather`
(`async_evaluation: true` στο `app.yaml`).

Το `ai_complete_stream` τροφοδοτεί το streaming SSE endpoint
`POST /api/plugins/session/{id}/message/stream` που εκπέμπει
γεγονότα `start` / `chunk` / `done`.

## Λογική επιλογής παρόχου (v1.20.0)

Η `_resolve_active_key()` του session route καλεί
`services/settings.resolve_api_key(db, user_id, provider)`
που διατρέχει την τριεπίπεδη αλυσίδα:

1. Μεταβλητή περιβάλλοντος `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY`.
2. `ai.<provider>.api_key` στο
   `~/.config/adaptive_learner/secrets.yaml`.
3. Fernet-αποκρυπτογραφημένο `UserSettings.api_key_<provider>`.
4. `None` — η κλήση εμφανίζει `ai_error` στο UI.

Η `resolve_default_model(db, user_id, provider)` διατρέχει την
ίδια αλυσίδα για την παράκαμψη μοντέλου (env > yaml > παράκαμψη UI >
`DEFAULT_MODELS[provider]`).

Στη συνέχεια εκτελείται το `ai_complete*` με τις επιλυμένες τιμές.
Το plugin του αντίστοιχου παρόχου επιστρέφει το κείμενο· τα υπόλοιπα
επιστρέφουν None (firstresult σταματά στο πρώτο αποτέλεσμα).

## Αρχιτεκτονική διπλής προτροπής (v0.5.0) + auto-loop (v1.4.0)

Κάθε `POST /api/plugins/session/{id}/message` για ρόλο `user`
κάνει έως τρεις κλήσεις ΤΝ:

1. **Απάντηση μάθησης** — streamed μέσω `ai_complete_stream`.
   Η system prompt συντίθεται από `build_prompt(project, profile,
   method, cycle_step, lang)` από τον πίνακα 42 κελιών.
   `max_tokens=1024`. Το SSE εκπέμπει γεγονότα `start` / `chunk` /
   `done`.
2. **Αξιολογητής βήματος** — ξεχωριστή system prompt
   (`EVALUATION_SYSTEM_PROMPT`) που ζητά από την ΤΝ να διαβάσει
   την ανταλλαγή και να εκπέμψει ετυμηγορία JSON
   (`advance`, `confidence`, `reason`, `suggested_step`).
   `max_tokens=256`. Η ετυμηγορία καθορίζει την προώθηση
   `cycle_step` (με πύλη `confidence ≥ 0.6`).
3. **Μετάβαση θέματος** — μόνο στο βήμα 7. Μια τρίτη κλήση ΤΝ
   κρίνει αν το θέμα ενσωματώθηκε και αν να ξεκινήσει νέος κύκλος
   σε νέο υποθέμα. Όριο `max_cycles=5` ανά συνεδρία.

Αν ο αξιολογητής επιστρέψει μη-αναλύσιμο JSON, ενεργοποιείται η
ντετερμινιστική εναλλακτική +1 (περιορισμένη στο 7) και καταγράφεται
`fallback_used=True`.

Το όριο κύκλου (βήμα 6 → 7) εκτελεί αξιολόγηση βήματος +
μετάβαση θέματος ταυτόχρονα μέσω `asyncio.gather` (εξοικονομεί
~T₂ καθυστέρησης). Επιστρέφεται στο μπλοκ `timings` της απάντησης
μηνύματος (`learning_ms`, `evaluation_ms`, `topic_transition_ms`,
`total_ms`, `parallel_saved_ms`).

## Ο πίνακας προτροπών 42 κελιών

Το `plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py`
περιέχει ένα `dict[method, dict[step, dict[lang, str]]]` — έξι
μέθοδοι, επτά βήματα, δύο γλώσσες, 84 κελιά. Κάθε κελί είναι
1-2 προτάσεις που ορίζουν τον ρόλο της ΤΝ + το task του βήματος.
Ένα μπλοκ πλαισίου ("Learning project: 'X' | Goal: 'Y'. Profile
hint: …") προσαρτάται κατά τη σύνθεση.

Για τη λειτουργία Dexie, οι προτροπές εξάγονται αυτούσιες στο
`frontend/src/data/session-prompts.json` και φορτώνονται από
`frontend/src/storage/prompts.ts`. Ίδιο κείμενο, ίδια μορφή
μπλοκ πλαισίου — δεν είναι δυνατή απόκλιση.

## Προσθήκη νέου παρόχου

1. Δημιούργησε `plugins/adaptive-learner-plugin-ai-newprovider/`.
2. Υλοποίησε τον hookimpl `ai_complete`: ελέγξε το πρόθεμα
   μοντέλου, κάλεσε το HTTP API του παρόχου, επέστρεψε το κείμενο.
3. Πρόσθεσε το πρόθεμα του παρόχου στο `DEFAULT_MODELS` στο
   `ai_orchestration.py` με ένα φθηνό προεπιλεγμένο μοντέλο.
4. Πρόσθεσε το όνομα παρόχου στο enum `AIProvider` στο
   `app/schemas/__init__.py`.
5. Πρόσθεσέ το στο `AI_PROVIDERS` στο
   `frontend/src/lib/constants.ts`.
6. Για ισοτιμία Dexie-mode: πρόσθεσε client στο
   `frontend/src/storage/ai-providers.ts` και δρομολόγησε σε αυτό
   από το `aiComplete()`.

Κάθε plugin παρόχου τεστάρει τον hookimpl + κλήση παρόχου σε
απομόνωση — δες `plugins/adaptive-learner-plugin-ai-anthropic/tests/`
για πρότυπο (η HTTP κλήση παρόχου γίνεται mock).

## Άμεσες κλήσεις από browser (λειτουργία Dexie)

Στη λειτουργία Dexie η κλήση ΤΝ δεν περνά από το σύστημα plugin.
Το `storage/ai-providers.ts` κάνει απευθείας το HTTP request.
Το Anthropic απαιτεί την επικεφαλίδα
`anthropic-dangerous-direct-browser-access: true` για να ξεπεραστεί
το CORS preflight· OpenAI και Gemini δέχονται άμεσες κλήσεις
από browser.

Η λογική διπλής προτροπής είναι ίδια και στις δύο λειτουργίες —
το `storage/session-flow.ts` καλεί `aiComplete()` δύο φορές και
αναλύει το JSON του αξιολογητή με τον ίδιο τρόπο που το κάνει
το backend.

## Κατώφλι εμπιστοσύνης

Το `session.step_evaluation.confidence_threshold` (προεπιλογή 0.6)
του `backend/config/app.yaml` καθορίζει αν μια πραγματική (μη
εναλλακτική) ετυμηγορία αξιολογητή μετακινεί πραγματικά το
cycle_step. Ορίσου υψηλότερα για πιο συντηρητική συμπεριφορά,
χαμηλότερα για πιο επιθετική. Οι ετυμηγορίες εναλλακτικής
(αποτυχίες ανάλυσης) εφαρμόζουν πάντα την προώθηση +1.

Η θύρα Dexie αντικατοπτρίζει αυτό με σταθερό 0.6 στο
`storage/session-flow.ts`. Μια μελλοντική φάση θα εκθέσει αυτό
στο UI Ρυθμίσεων.

## Άλλες επιφάνειες ΤΝ (σύνοψη μόνο ανάγνωσης)

Πολλές μη-συνεδριακές λειτουργίες χρησιμοποιούν τα ίδια plugin
παρόχων μέσω `ai_complete*`:

- **Αναλυτής συνομιλιών** (Phase 12 / v0.9.0+) —
  Το `frontend/src/chat_import/analysis.ts` χωρίζει σε τμήματα τις
  εισαγόμενες αντιγραφές στα 16K χαρακτήρες με επικάλυψη 2 μηνυμάτων,
  εκτελεί `ai_complete` ανά τμήμα, συγχωνεύει αποτελέσματα. Εξάγει
  θέμα / αδυναμίες / error_patterns / recommended_method /
  vocabulary (από v1.20.0). Ανεκτικός αναλυτής JSON χειρίζεται
  ακατάλληλη συμπεριφορά Haiku-class (φραγμένη έξοδος, εισαγωγικό
  πεζόλογο).
- **Εξαγωγή Anki** (Phase 30 / v1.17.0) — Το `plugins/.../
  anki/card_extraction.py` εξάγει υποψήφιες κάρτες flash από
  συνεδρία ή συνομιλία· η διαδρομή λεξιλογίου εκτελείται
  client-side χωρίς ΤΝ όταν υπάρχει `analysis_result.vocabulary`.
- **Ερωτήσεις μελέτης NotebookLM + οδηγός** (Phase 32 /
  v1.19.0) — `plugins/.../notebooklm/question_generator.py`
  + `study_guide.py`· ανεκτικός αναλυτής JSON· οι ερωτήσεις που
  επεξεργάστηκε ο χρήστης παραλείπουν αναδημιουργία.
- **Κριτής προφοράς** (Phase 31 / v1.18.0) —
  Το `plugins/.../pronunciation.py` παράγει στοχευμένες φράσεις
  + κρίνει ομοιότητα ηχογράφησης μαθητή (επιλεξιμότητα καθορίζεται
  από την ταξινομία θεμάτων Languages).
