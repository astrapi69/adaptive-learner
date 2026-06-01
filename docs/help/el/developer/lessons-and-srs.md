# Εσωτερική λειτουργία μαθημάτων + SRS

Αυτή η σελίδα τεκμηριώνει πώς η στοίβα χαρακτηριστικών
μαθημάτων-περιεχομένου + SRS των v1.27.0-v1.31.0 συνδέεται
μεταξύ backend, frontend και δύο plugins. Για την επισκόπηση
από πλευράς χρήστη βλ.
[`user-guide/lessons.md`](../user-guide/lessons.md).

---

## Επισκόπηση αρχιτεκτονικής

```
┌──────────────────────────────────────────────────────────┐
│ Frontend: lesson viewer + review session                 │
│   pages/Lesson.tsx  ──→  ExerciseDispatcher  ──→  one of │
│   pages/Review.tsx           ↓               4 exercise  │
│                              ↓               components  │
│                              ↓                           │
│                   recordStepResult                       │
│                              ↓                           │
│                  elementErrors.recordBulk                │
│                              ↓                           │
└──────────────────────────────────────────────────────────┘
                              ↓
                   IStorageService boundary
                              ↓
   ┌─────────────────────┐      ┌─────────────────────────┐
   │ ApiStorage          │      │ DexieStorage            │
   │                     │      │                         │
   │ POST /api/users/    │      │ element-errors-dexie.ts │
   │   {id}/element-     │      │   mirrors the backend   │
   │   errors            │      │   service 1:1 against   │
   │                     │      │   IndexedDB             │
   └─────────────────────┘      └─────────────────────────┘
            ↓
   ┌──────────────────────────────────────────────────────┐
   │ Backend                                              │
   │                                                      │
   │  app/services/element_errors.py                      │
   │    - upsert transition matrix                        │
   │    - MASTERY_THRESHOLD = 3                           │
   │                                                      │
   │  app/services/element_srs.py                         │
   │    - 1d/3d/7d band scheduler                         │
   │    - overdue → error_count → last_error_at sort      │
   │                                                      │
   │  app/services/lesson_progress.py                     │
   │    - upsert_progress with mark_completed flip        │
   │      triggers lesson_session_unification             │
   │                                                      │
   │  app/services/lesson_session_unification.py          │
   │    - find_or_create_content_pseudo_project (lazy)    │
   │    - record_lesson_completion_session                │
   │    - fires on_session_complete via manager._pm.hook  │
   └──────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────────────────────┐
            │ Gamification plugin             │
            │   on_session_complete dispatch  │
            │     method == "content"  →      │
            │       award_xp_for_lesson_      │
            │       session (lesson formula)  │
            │     else →                      │
            │       award_xp_for_session      │
            │       (chat formula, unchanged) │
            │   badge_service.evaluate_user   │
            │     → 4 new lesson predicates   │
            └─────────────────────────────────┘
```

---

## Παρακολούθηση σφαλμάτων σε επίπεδο στοιχείου (v1.30.0 / Phase 46B)

### Μοντέλο

``app/models/__init__.py:ElementError`` με σύνθετο περιορισμό
UNIQUE στο
``(user_id, set_id, lesson_id, exercise_id, element_key)``.
Κλειδιά στοιχείων εντός μαθήματος σύμφωνα με την απόφαση **D2** —
η ίδια λέξη σε δύο διαφορετικά μαθήματα είναι δύο εγγραφές.

```python
class ElementError(Base):
    user_id: str           # FK → users.id (CASCADE)
    set_id: str            # content set id (string, not FK)
    lesson_id: str         # content lesson id (string, not FK)
    exercise_id: str       # exercise id within the lesson
    element_key: str       # the specific word/pair/phrase
    element_type: str      # "vocabulary" | "grammar_rule"
    user_answer: str
    correct_answer: str
    error_count: int       # incremented on each wrong attempt
    correct_streak: int    # incremented on correct, reset on wrong
    last_error_at: datetime | None
    last_attempt_at: datetime
    mastered: bool         # True iff correct_streak ≥ 3
    mastered_at: datetime | None
```

Αποσυνδεδεμένο από το ``learning_sessions`` (χωρίς FK) σκόπιμα —
τα μαθήματα περιεχομένου αναφέρουν IDs συνόλου / μαθήματος
περιεχομένου ως συμβολοσειρές, όχι μέσω relational join. Αυτό
σημαίνει ότι ο πίνακας επιβιώνει στην εκκαθάριση cache
ανεξάρτητα από οποιαδήποτε εγγραφή συνεδρίας.

### Πίνακας μεταβάσεων upsert

Το ``app/services/element_errors.py:upsert_element_error`` είναι
ο μοναδικός μεταλλακτήρας. Συμπεριφορά:

| Έναυσμα | Ενέργεια |
|---|---|
| Πρώτη εμφάνιση (σωστά) | INSERT εγγραφή, ``correct_streak=1`` |
| Πρώτη εμφάνιση (λάθος) | INSERT εγγραφή, ``error_count=1`` |
| Υπάρχουσα εγγραφή, σωστή απόπειρα | ``correct_streak += 1``· αναστρέφει ``mastered=True`` αν το streak φτάσει ``MASTERY_THRESHOLD`` (3) |
| Υπάρχουσα εγγραφή, λανθασμένη απόπειρα σε μη-κατακτημένη εγγραφή | ``error_count += 1``, ``correct_streak = 0`` |
| Υπάρχουσα εγγραφή, λανθασμένη απόπειρα σε **κατακτημένη** εγγραφή | υποβάθμιση: ``mastered=False``, ``mastered_at=None``, ``correct_streak=0``, ``error_count += 1`` |

Το κατώφλι κατάκτησης είναι σταθερά κώδικα
(``MASTERY_THRESHOLD = 3``)· σύμφωνα με την απόφαση **D4**
είναι εγγενές στη σημασιολογία SRS, όχι παράμετρος ρύθμισης.

### Mirror Dexie

Το ``frontend/src/storage/element-errors-dexie.ts`` κατοπτρίζει
την υπηρεσία backend 1:1 έναντι IndexedDB. Το συμβόλαιο στο
``IElementErrorsNamespace`` είναι πανομοιότυπο μεταξύ και των
δύο υλοποιήσεων αποθήκευσης, οπότε η πύλη έκδοσης λειτουργίας
Dexie (``make test-dexie-smoke``) εντοπίζει οποιαδήποτε
απόκλιση.

---

## Χρονοπρογραμματισμός SRS (v1.30.0 / Phase 46C)

### Πολιτική διαστήματος

Το ``app/services/element_srs.py:next_review_due_at`` προβλέπει
την επόμενη επανεξέταση μιας μη-κατακτημένης εγγραφής:

| ``correct_streak`` | Διάστημα |
|---|---|
| 0 | 1 ημέρα μετά το ``last_attempt_at`` |
| 1 | 3 ημέρες |
| 2 | 7 ημέρες |
| ≥ 3 | κατακτημένο — εξαιρείται από την ουρά |

### Ταξινόμηση προτεραιότητας

Το endpoint ουράς επανεξέτασης ταξινομεί κατά:

1. **Ληξιπρόθεσμα πρώτα** (``next_review_due_at < now``
   κατατάσσεται άνω του ``next_review_due_at > now``)
2. **Πλήθος σφαλμάτων φθίνον** (περισσότερα σφάλματα =
   υψηλότερη προτεραιότητα)
3. **Πιο πρόσφατο σφάλμα πρώτο** (η πιο πρόσφατη αποτυχία
   κατατάσσεται άνω από παλαιότερες, ανάλυση microsecond μέσω
   ``-last_error_at.timestamp_us``)

Η πλειάδα δεικτοδοτείται από ``_sort_key`` που επιστρέφει
``tuple[int, int, int]`` (η επείγουσα επιδιόρθωση v1.30.0 CI
``9275841`` καρφίτσωσε την αρπαγή mypy μετά από αναδιαμόρφωση
από datetime σε ακέραια microseconds).

### Endpoint

Το ``GET /api/users/{user_id}/element-errors/review-queue``
επιστρέφει την ταξινομημένη ουρά. Ισοδύναμο στη μεριά Dexie:
``computeReviewQueueDexie`` στο
``element-errors-dexie.ts``. Το widget
``<ReviewQueueCard>`` του Dashboard καλεί το ένα ή το άλλο
ανάλογα με τη ρυθμισμένη λειτουργία αποθήκευσης και αποδίδει
τον αριθμό + το badge ληξιπρόθεσμων + μια CTA στη συνεδρία
επανεξέτασης.

---

## Ενοποίηση LessonProgress ↔ LearningSession (v1.31.0 / Phase 46F)

### Η απόφαση

Η εργασία ``ElementError`` της v1.30.0 αποσυνδέθηκε σκόπιμα
από το ``LearningSession``. Η Phase 46F της v1.31.0 προσθέτει
το επίπεδο ενοποίησης: κάθε ολοκλήρωση μαθήματος-περιεχομένου
γράφει πλέον μια εγγραφή ``LearningSession`` ώστε η υπάρχουσα
μηχανή gamification + παρακολούθησης + streak να την παραλαμβάνει
χωρίς νέα hooks.

Τρεις αποφάσεις καθορίζουν τη μορφή:

- **D1 (τεμπέλικο ψευδο-project)**: ένα ``LearningProject``
  "Content Lessons" με ``kind="content"`` δημιουργείται αυτόματα
  κατά την πρώτη ολοκλήρωση μαθήματος (δεν σπέρνεται κατά
  την αρχική ρύθμιση). Ένα ανά χρήστη.
- **D2 (7η τιμή ``method="content"``)**:  προστέθηκε στο σύνολο
  έγκυρων τιμών ``LearningSession.method`` ειδικά για τη διαδρομή
  ενοποίησης. Οι άλλες έξι μέθοδοι (deductive / inductive /
  error_based / dialogic / contextual / ai_adaptive) καλύπτουν
  τις συνεδρίες chat αναλλοίωτες.
- **D5 (επαναχρησιμοποίηση, χωρίς επέκταση)**: κανένα νέο
  hookspec. Το ``record_lesson_completion_session`` εκτελεί
  το υπάρχον hook ``on_session_complete`` μέσω
  ``manager._pm.hook``. Οι υπάρχοντες χειριστές των plugins
  gamification + παρακολούθησης εκτελούνται σαν να ήταν το
  μάθημα μια συνεδρία chat, με αποστολή βάσει ``method``.

### Αλλαγή σχήματος

```python
# app/models/__init__.py — Phase 46F.1
LEARNING_PROJECT_KIND_STANDARD = "standard"
LEARNING_PROJECT_KIND_CONTENT = "content"

class LearningProject(Base):
    ...
    kind: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=LEARNING_PROJECT_KIND_STANDARD,
        server_default=LEARNING_PROJECT_KIND_STANDARD,
    )
```

Το Alembic ``0020_learning_project_kind`` προσθέτει τη στήλη
μέσω ``batch_alter_table`` + ``add_column`` με
``server_default="standard"`` ώστε οι υπάρχουσες εγγραφές
να συμπληρωθούν σωστά στο SQLite. Η επιφάνεια συγχρονισμού
παραλαμβάνει τη στήλη ώστε η μετάβαση μέσω ``ApiStorage`` ↔
``DexieStorage`` να λειτουργεί και στις δύο κατευθύνσεις.

### Βοηθητικό ενοποίησης

Το ``app/services/lesson_session_unification.py`` έχει δύο
δημόσιες συναρτήσεις:

- ``find_or_create_content_pseudo_project(db, user_id)`` —
  ιδεμποτής αναζήτηση· δημιουργεί μόνο σε απόκρυψη.
- ``record_lesson_completion_session(db, *, user_id,
  lesson_progress_id, score_correct, score_total)`` —
  γράφει την εγγραφή ``LearningSession``, υποβάλλει και στη
  συνέχεια εκτελεί ``on_session_complete``.

Και τα δύο καλούνται από
``app/services/lesson_progress.py:upsert_progress`` όταν η
εγγραφή αναστρέφεται από ``in_progress`` σε ``completed``. Οι
δικές του εγγραφές DB του βοηθητικού διαδίδουν εξαιρέσεις
(πραγματικό πρόβλημα DB), αλλά η διαδρομή εκτέλεσης του hook
περιτυλίγει εξαιρέσεις συνδρομητών σύμφωνα με το πρότυπο
``_fire_on_session_complete`` από το ``routes.py`` του session
plugin — μια κατάρρευση gamification δεν μπορεί να αναιρέσει
το μάθημα που ο χρήστης είδε ήδη στην οθόνη σύνοψης.

### Φίλτρο frontend

Το ``frontend/src/lib/learning-project.ts`` εκθέτει
``isStandardProject`` + ``filterStandardProjects``. Τρεις
καταναλωτές εφαρμόζουν το φίλτρο:

- ``DashboardFilterBar.tsx`` (η επιλογή project του dashboard)
- ``ExportSection.tsx`` (επιλογέας export)
- ``Anki.tsx`` (αναπτυσσόμενο project Anki)

Το endpoint backend εκθέτει σκόπιμα ακόμα το ψευδο-project
ώστε μια μελλοντική "όλη η δραστηριότητα" προβολή admin να
μπορεί να το ενεργοποιήσει. Το φίλτρο είναι μια απόφαση
πολιτικής UI, όχι απόκρυψη δεδομένων.

---

## Κανόνας XP μαθήματος (v1.31.0 / Phase 46E.1)

Το ``adaptive_learner_gamification.xp_service`` αποκτά:

- ``compute_stars(correct, total)`` — 0-3 από βαθμολογία, με
  ζώνες στο 50% / 75% / 90%. Αντικατοπτρίζει το ``computeStars``
  του frontend στο ``lib/lesson-summary.ts`` ώστε και οι δύο
  πλευρές να προβάλλουν την ίδια αξιολόγηση αστεριών.
- ``calculate_lesson_session_xp(*, stars, first_attempt,
  streak_days)`` — αμιγής υπολογιστής. Βάση 30 + 10/αστέρι +
  20 για πρώτη-απόπειρα-3-αστέρων + ίδιος πολλαπλασιαστής
  +25%/ημέρα streak (με ανώτατο 7) όπως ο τύπος chat.
- ``_is_first_attempt(db, lesson_progress_id)`` — διαβάζει
  το JSON ``LessonProgress.step_results`` και επιστρέφει True
  αν κάθε εγγραφή βήματος έχει ``attempts == 1``.
- ``award_xp_for_lesson_session(db, *, session)`` —
  περιτύλιγμα επιμονής που επιλύει το user_id από το FK του
  project και εφαρμόζει τον τύπο.

Η αποστολή γίνεται στο ``GamificationPlugin.on_session_complete``
βάσει ``session["method"]``. Οι μέθοδοι chat παραμένουν στο
``award_xp_for_session``. Η μέθοδος Content δρομολογείται στον
τύπο μαθήματος. Το ωφέλιμο φορτίο συνεδρίας από το βοηθητικό
ενοποίησης φέρει τα ειδικά κλειδιά μαθήματος
(``lesson_progress_id``, ``score_correct``,
``score_total``)· τα ωφέλιμα φορτία συνεδρίας chat δεν τα φέρουν,
οπότε ο συντελεστής XP μαθήματος θα υποβαθμιζόταν ομαλά αν
η αποστολή διέρρεε — αλλά η δοκιμή pin παλινδρόμησης στο
``backend/tests/test_lesson_session_unification.py``
βεβαιώνει την ακριβή απονομή μαθήματος (100 XP για 4/4
ολοκλήρωση πρώτης-απόπειρας + streak πρώτης ημέρας) οπότε
μια διαρροή θα εντοπιζόταν αμέσως.

---

## Badges μαθημάτων (v1.31.0 / Phase 46E.2)

Τέσσερα νέα κατηγορήματα προστέθηκαν στο
``adaptive_learner_gamification.badge_service._EVALUATORS``:

| Κλειδί | Κατηγόρημα | Βοηθητικό |
|---|---|---|
| ``first_lesson`` | ``_completed_lesson_count >= 1`` | μετρά ``LessonProgress.status="completed"`` (όχι μέσω LearningSession — η εγγραφή μαθήματος είναι αυθεντική) |
| ``lessons_10`` | ``_completed_lesson_count >= 10`` | το ίδιο |
| ``three_star_streak`` | ``_last_n_lessons_all_three_star(n=3)`` | διαβάζει τα τελευταία 3 ολοκληρωμένα ``LessonProgress`` του χρήστη κατά ``completed_at`` desc· προβάλλει κάθε ένα μέσω ``xp_service.compute_stars`` |
| ``review_master`` | ``_mastered_elements_count >= 50`` | μετρά ``ElementError.mastered=True`` |

Αριθμός καταλόγου: **24 → 28** (+1 getting_started + 1
consistency + 2 depth). Η υπάρχουσα δοκιμή συμμετρίας
``every yaml badge has an evaluator`` (στο
``backend/tests/test_gamification_badges_integration.py``)
εντοπίζει αποκλίσεις μεταξύ των δύο λιστών.

---

## Προειδοποιήσεις λειτουργίας αποθήκευσης

Η αλυσίδα παρακολούθησης στοιχείων + SRS λειτουργεί πανομοιότυπα
και στις **δύο** λειτουργίες αποθήκευσης — το συμβόλαιο
``IElementErrorsNamespace`` είναι ανεξάρτητο λειτουργίας και
η πύλη έκδοσης λειτουργίας Dexie (18 προδιαγραφές συμπεριλαμβανομένης
της διαδρομής ``/review``) αποκλείει οποιαδήποτε παλινδρόμηση.

Η ενοποίηση lesson-session + οι παρενέργειες gamification
είναι **μόνο για λειτουργία API**. Σε λειτουργία Dexie η
ολοκλήρωση μαθήματος εξακολουθεί να γράφει ``LessonProgress``,
εξακολουθεί να καταγράφει εγγραφές ``ElementError`` και
εξακολουθεί να τροφοδοτεί την ουρά επανεξέτασης — αλλά η
εγγραφή ``LearningSession`` + το hook ``on_session_complete``
δεν εκτελούνται ποτέ (χωρίς backend, χωρίς hookable). Οι χρήστες
λειτουργίας Dexie αποκτούν τον πλήρη βρόχο επανεξέτασης·
οι απονομές XP / badge από τη διαδρομή chat-session εξακολουθούν
να λειτουργούν, αλλά οι ολοκληρώσεις μαθημάτων δεν συνεισφέρουν
ακόμα σε αυτό το σύνολο.

Μια μελλοντική ενοποίηση των παρενεργειών gamification στο
``DexieStorage`` (ώστε η ολοκλήρωση μαθήματος χρήστη λειτουργίας
Dexie να απονέμει επίσης XP τοπικά) είναι σκόπιμα εκτός
στόχου για την v1.31.0 — θα απαιτούσε είτε αντιγραφή της
υλοποίησης τύπου σε TypeScript είτε ένα shim service-worker
για το hook on_session_complete. Και τα δύο είναι μεγαλύτερες
αναδιαμορφώσεις από ό,τι επιτρέπει το πεδίο της v1.31.0.

---

## Πού να κοιτάξετε στη συνέχεια

- ``backend/app/services/element_errors.py`` — ο πίνακας
  μεταβάσεων upsert.
- ``backend/app/services/element_srs.py`` — ο χρονοπρογραμματιστής.
- ``backend/app/services/lesson_session_unification.py`` —
  το ψευδο-project + εκτέλεση hook.
- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py`` —
  ``calculate_lesson_session_xp`` + αποστολή.
- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/badge_service.py`` —
  τα τέσσερα νέα κατηγορήματα.
- ``frontend/src/lib/learning-project.ts`` — το βοηθητικό
  φίλτρου ψευδο-project.
- ``e2e/dexie/dexie-mode.spec.ts`` — η πύλη έκδοσης που
  αποτρέπει παλινδρομήσεις λειτουργίας Dexie (προδιαγραφή
  μαθημάτων στο ``/lesson/...``, προδιαγραφή επανεξέτασης
  στο ``/review/...``).

---

## Token-diff + cloze + γύρος διόρθωσης (v1.35.0 / Phase 52)

Τρεις διαστρωματωμένες προσθήκες που μετατρέπουν την παθητική
αναπαραγωγή σε ενεργή μάθηση:

**Token-diff + DiffHighlight** — Λανθασμένες απαντήσεις
free-text και word-tiles αποδίδουν πλέον `<DiffHighlight tokens={tokenDiff(
input, canonical)} />` inline κάτω από την παράγραφο αποτελέσματος.
Η ανά-άσκηση ανάλυση της σύνοψης μαθήματος εμφανίζει την ίδια
διαφορά για free-text + word-tiles όταν το αποθηκευμένο
`user_answer` της v1.35.0+ είναι διαθέσιμο (παλαιότερες εγγραφές
υποβαθμίζονται στη γραμμή μόνο-κανονικής). Αλγόριθμος στο
`frontend/src/lib/exercises/token-diff.ts` — αμιγές LCS σε
επίπεδο λέξης, κανονικοποιημένο NFC, ευαίσθητο σε πεζά/κεφαλαία
+ τόνους.

**Τύπος άσκησης Cloze (σχήμα 1.1)** — πέμπτος ExerciseType:
συμπλήρωση κενού με ορατούς δείκτες `___`. Δύο λειτουργίες
απόδοσης: `type` (προεπιλογή, `<input>`) και `select`
(`<select>` με επιλογές από `distractors`). Ανά-κενό fan-out
SRS μέσω `deriveClozeAttempts` — ένα ElementAttempt ανά κενό,
ώστε η παρακολούθηση κατάκτησης ανά κενό να λειτουργεί καθαρά.
Αποδότης στο
`frontend/src/components/exercises/ClozeExercise.tsx`·
σχήμα στο
`plugins/adaptive-learner-plugin-content-loader/
adaptive_learner_content_loader/schema.py`.

**Γεννήτρια Cloze** — `generateClozeFromError(error,
sourceExercise, sourceCard)` συνθέτει ένα βήμα cloze από
ένα ElementError. Αλγόριθμος:

1. Αν το `sourceCard.token_roles` έχει μια καταχώρηση της οποίας
   το `token === error.correct_answer`, αδειάζει αυτό το token
   στο `sourceCard.front`.
2. Διαφορετικά, αν το `sourceCard.front` περιέχει κυριολεκτικά
   το `error.correct_answer` ακριβώς μία φορά, το αδειάζει.
3. Διαφορετικά, αν η πηγή είναι free_text και το prompt της
   περιέχει την απάντηση ακριβώς μία φορά, την αδειάζει.
4. Διαφορετικά επιστρέφει null — ο καλών υποβαθμίζεται σε
   αναπαραγωγή.

Ντετερμινιστική: ίδιες εισόδους → byte-ταυτόσημη έξοδος. Χωρίς
ΤΝ, χωρίς τυχαιότητα, χωρίς async. Τα distractors φέρουν
πρώτα το `error.user_answer` (όταν διαφέρει από το σωστό), μετά
το `sourceExercise.distractors` φιλτραρισμένο + αφαιρούμενο
από διπλότυπα. Κώδικας στο
`frontend/src/lib/exercises/cloze-generator.ts`.

**Γύρος διόρθωσης στο τέλος μαθήματος** —
Το `<CorrectionBlock />` τοποθετείται μέσα στο `LessonSummary`
μεταξύ της βαθμολογίας / ανάλυσης και των κουμπιών ενεργειών.
Κατά την τοποθέτηση, διαβάζει εγγραφές ElementError για το
μόλις-ολοκληρωμένο μάθημα, παράγει ένα cloze για κάθε μη-
κατακτημένη αποτυχία (ανώτατο 5) και οδηγεί τον χρήστη μέσα
από αυτές. Κάθε ολοκληρωμένο cloze γράφει νέες εγγραφές
ElementAttempt έναντι του ίδιου element_key κατά του οποίου
καταγράφηκε η αρχική αποτυχία, οπότε το streak SRS + η κατάκτηση
προχωρούν. Κρύβεται από μόνο του σε τέλεια βαθμολογία / κανένα
σφάλμα / μη κατασκευάσιμο cloze. Κώδικας στο
`frontend/src/components/exercises/CorrectionBlock.tsx`.

**Cloze σε συνεδρίες επανεξέτασης (Phase 52G)** —
Ο κλάδος ανά-στοιχείο του `synthesizeReviewLesson`
(`_buildReviewStep`) επιλέγει πλέον:

- πηγή free_text ή word_tiles → δοκιμή cloze, υποβάθμιση σε
  αναπαραγωγή
- matching, picture_choice, cloze → πάντα αναπαραγωγή

Κριτήρια απόφασης τεκμηριωμένα στο
`frontend/src/lib/review-lesson.ts`. Τα IDs βήματος αναπαραγωγής
αρχίζουν με `review-`· τα παραγόμενα IDs βήματος cloze αρχίζουν
με `review-cloze-` για ανιχνευσιμότητα.

**Token-roles σε κάρτες (Phase 52I)** — προαιρετική
αρπαγή `token_roles: list[{token, role}]` σε Card με κλειστό
enum γραμματικών ρόλων (article / verb / noun / adjective /
preposition / gender_marker / tense_marker). Η γεννήτρια τα
χρησιμοποιεί για να επιλέξει ένα σημαντικό κενό αντί να
βασιστεί σε αντιστοίχιση υποσυμβολοσειράς. Η προσθήκη ρόλου
είναι αύξηση ελάσσονος schema_version — κρατήστε το enum κλειστό.
