# Lektionen + SRS - Interna

Diese Seite dokumentiert, wie der v1.27.0–v1.31.0-Stack für
Inhaltslektionen + SRS über Backend, Frontend und zwei
Plugins verdrahtet ist. Für die nutzerseitige Übersicht
siehe [`user-guide/lessons.md`](../user-guide/lessons.md).

---

## Architektur-Überblick

```
┌──────────────────────────────────────────────────────────┐
│ Frontend: Lektions-Viewer + Wiederholungssitzung         │
│   pages/Lesson.tsx  ──→  ExerciseDispatcher  ──→  eine   │
│   pages/Review.tsx           ↓               von 4       │
│                              ↓               Übungs-     │
│                              ↓               komponenten │
│                   recordStepResult                       │
│                              ↓                           │
│                  elementErrors.recordBulk                │
│                              ↓                           │
└──────────────────────────────────────────────────────────┘
                              ↓
                   IStorageService-Grenze
                              ↓
   ┌─────────────────────┐      ┌─────────────────────────┐
   │ ApiStorage          │      │ DexieStorage            │
   │                     │      │                         │
   │ POST /api/users/    │      │ element-errors-dexie.ts │
   │   {id}/element-     │      │   spiegelt den Backend- │
   │   errors            │      │   Service 1:1 gegen     │
   │                     │      │   IndexedDB             │
   └─────────────────────┘      └─────────────────────────┘
            ↓
   ┌──────────────────────────────────────────────────────┐
   │ Backend                                              │
   │                                                      │
   │  app/services/element_errors.py                      │
   │    - Upsert-Übergangsmatrix                          │
   │    - MASTERY_THRESHOLD = 3                           │
   │                                                      │
   │  app/services/element_srs.py                         │
   │    - 1d/3d/7d Banden-Scheduler                       │
   │    - Sortierung: überfällig → error_count →          │
   │      last_error_at                                   │
   │                                                      │
   │  app/services/lesson_progress.py                     │
   │    - upsert_progress mit mark_completed-Flip         │
   │      triggert lesson_session_unification             │
   │                                                      │
   │  app/services/lesson_session_unification.py          │
   │    - find_or_create_content_pseudo_project (lazy)    │
   │    - record_lesson_completion_session                │
   │    - feuert on_session_complete via                  │
   │      manager._pm.hook                                │
   └──────────────────────────────────────────────────────┘
                              ↓
            ┌─────────────────────────────────┐
            │ Gamification-Plugin             │
            │   on_session_complete-Dispatch  │
            │     method == "content"  →      │
            │       award_xp_for_lesson_      │
            │       session (Lektionsformel)  │
            │     sonst →                     │
            │       award_xp_for_session      │
            │       (Chat-Formel, unverändert)│
            │   badge_service.evaluate_user   │
            │     → 4 neue Lektions-Prädikate │
            └─────────────────────────────────┘
```

---

## Element-genaue Fehlerverfolgung (v1.30.0 / Phase 46B)

### Modell

``app/models/__init__.py:ElementError`` mit einem zusammen-
gesetzten UNIQUE-Constraint auf
``(user_id, set_id, lesson_id, exercise_id, element_key)``.
Lektions-bezogene Element-Schlüssel gemäß Entscheidung
**D2** - dasselbe Wort in zwei verschiedenen Lektionen
sind zwei Zeilen.

```python
class ElementError(Base):
    user_id: str           # FK → users.id (CASCADE)
    set_id: str            # Content-Set-ID (String, kein FK)
    lesson_id: str         # Content-Lektions-ID (String, kein FK)
    exercise_id: str       # Übungs-ID innerhalb der Lektion
    element_key: str       # das konkrete Wort/Paar/Phrase
    element_type: str      # "vocabulary" | "grammar_rule"
    user_answer: str
    correct_answer: str
    error_count: int       # bei jedem falschen Versuch erhöht
    correct_streak: int    # bei korrekt erhöht, bei falsch zurückgesetzt
    last_error_at: datetime | None
    last_attempt_at: datetime
    mastered: bool         # True wenn correct_streak ≥ 3
    mastered_at: datetime | None
```

Entkoppelt von ``learning_sessions`` (kein FK) - Inhalts-
lektionen referenzieren Content-Set- / Lektions-IDs als
String, nicht über einen relationalen Join. Damit überlebt
die Tabelle Cache-Räumungen unabhängig von jeder Session-
Zeile.

### Upsert-Übergangsmatrix

``app/services/element_errors.py:upsert_element_error`` ist
der einzige Mutator. Verhalten:

| Auslöser | Aktion |
|---|---|
| Erstes Auftreten (korrekt) | INSERT-Zeile, ``correct_streak=1`` |
| Erstes Auftreten (falsch) | INSERT-Zeile, ``error_count=1`` |
| Bestehende Zeile, korrekter Versuch | ``correct_streak += 1``; ``mastered=True`` umflippen wenn Streak ``MASTERY_THRESHOLD`` (3) erreicht |
| Bestehende Zeile, falscher Versuch auf nicht-gemeisterter Zeile | ``error_count += 1``, ``correct_streak = 0`` |
| Bestehende Zeile, falscher Versuch auf **gemeisterter** Zeile | Demotion: ``mastered=False``, ``mastered_at=None``, ``correct_streak=0``, ``error_count += 1`` |

Die Meisterungsschwelle ist eine Code-Konstante
(``MASTERY_THRESHOLD = 3``); gemäß Entscheidung **D4** ist
sie intrinsisch zur SRS-Semantik, kein Config-Knopf.

### Dexie-Spiegel

``frontend/src/storage/element-errors-dexie.ts`` spiegelt
den Backend-Service 1:1 gegen IndexedDB. Der Vertrag auf
``IElementErrorsNamespace`` ist über beide Storage-
Implementierungen identisch, sodass das Dexie-Mode-Release-
Gate (``make test-dexie-smoke``) jede Drift abfängt.

---

## SRS-Planung (v1.30.0 / Phase 46C)

### Intervall-Policy

``app/services/element_srs.py:next_review_due_at`` projiziert
die nächste Wiederholung einer nicht-gemeisterten Zeile:

| ``correct_streak`` | Intervall |
|---|---|
| 0 | 1 Tag nach ``last_attempt_at`` |
| 1 | 3 Tage |
| 2 | 7 Tage |
| ≥ 3 | gemeistert - aus der Warteschlange ausgeschlossen |

### Prioritäts-Sortierung

Der Review-Queue-Endpoint sortiert nach:

1. **Überfällig zuerst** (``next_review_due_at < now`` ist
   höher als ``next_review_due_at > now``)
2. **Fehleranzahl absteigend** (mehr Fehler = höhere
   Priorität)
3. **Letzter Fehler zuerst** (jüngster Fehlversuch ist
   höher als ältere, Mikrosekunden-Auflösung via
   ``-last_error_at.timestamp_us``)

Das Tupel wird über ``_sort_key`` mit
``tuple[int, int, int]`` geliefert (der v1.30.0-CI-Hotfix
``9275841`` pinte die mypy-Annotation nach einem Refactor
von datetime zu Integer-Mikrosekunden).

### Endpoint

``GET /api/users/{user_id}/element-errors/review-queue``
liefert die priorisierte Warteschlange. Dexie-seitiges
Äquivalent: ``computeReviewQueueDexie`` in
``element-errors-dexie.ts``. Das Dashboard-Widget
``<ReviewQueueCard>`` ruft das eine oder andere je nach
konfiguriertem Speichermodus auf und rendert die Anzahl +
das Überfällig-Badge + einen CTA zur Wiederholungssitzung.

---

## LessonProgress ↔ LearningSession-Vereinheitlichung (v1.31.0 / Phase 46F)

### Die Entscheidung

Die v1.30.0-``ElementError``-Arbeit hat sich absichtlich
von ``LearningSession`` entkoppelt. Phase 46F von v1.31.0
fügt die Vereinheitlichungsschicht hinzu: Jeder
Inhaltslektions-Abschluss schreibt jetzt eine
``LearningSession``-Zeile, damit die bestehende
Gamification- + Tracking- + Streak-Maschinerie sie ohne
neue Hooks aufgreift.

Drei Entscheidungen treiben die Form:

- **D1 (lazy Pseudo-Projekt)**: Ein "Content Lessons"-
  ``LearningProject`` mit ``kind="content"`` wird beim
  ersten Lektionsabschluss automatisch erstellt (nie
  während des Onboardings). Eines pro Nutzer:in.
- **D2 (``method="content"`` 7. Wert)**: dem Satz der
  gültigen ``LearningSession.method``-Werte spezifisch
  für den Vereinheitlichungspfad hinzugefügt. Die anderen
  sechs Methoden (deductive / inductive / error_based /
  dialogic / contextual / ai_adaptive) decken Chat-
  Sessions unverändert ab.
- **D5 (wiederverwenden, nicht erweitern)**: keine neue
  Hookspec. ``record_lesson_completion_session`` feuert
  den bestehenden ``on_session_complete``-Hook via
  ``manager._pm.hook``. Die bestehenden Handler der
  Gamification- + Tracking-Plugins laufen, als wäre die
  Lektion eine Chat-Session, mit Dispatch auf ``method``.

### Schema-Änderung

```python
# app/models/__init__.py - Phase 46F.1
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

Alembic ``0020_learning_project_kind`` fügt die Spalte über
``batch_alter_table`` + ``add_column`` mit
``server_default="standard"`` hinzu, sodass bestehende
Zeilen sauber auf SQLite zurückgefüllt werden. Die
Sync-Oberfläche nimmt die Spalte auf, sodass der Round-Trip
durch ``ApiStorage`` ↔ ``DexieStorage`` in beide Richtungen
funktioniert.

### Vereinheitlichungs-Helfer

``app/services/lesson_session_unification.py`` hat zwei
öffentliche Funktionen:

- ``find_or_create_content_pseudo_project(db, user_id)`` -
  idempotente Suche; erzeugt nur bei Miss.
- ``record_lesson_completion_session(db, *, user_id,
  lesson_progress_id, score_correct, score_total)`` -
  schreibt die ``LearningSession``-Zeile, committet und
  feuert dann ``on_session_complete``.

Beide werden von
``app/services/lesson_progress.py:upsert_progress``
aufgerufen, wenn die Zeile von ``in_progress`` zu
``completed`` umflippt. Die eigenen DB-Schreibzugriffe des
Helfers propagieren Ausnahmen (echtes DB-Problem), aber der
Hook-Feuer-Pfad wickelt Subscriber-Ausnahmen gemäß dem
Muster ``_fire_on_session_complete`` aus der ``routes.py``
des Session-Plugins ein - ein Gamification-Crash kann die
Lektion, die der Nutzer auf dem Zusammenfassungsbildschirm
bereits gesehen hat, nicht zurückrollen.

### Frontend-Filter

``frontend/src/lib/learning-project.ts`` exponiert
``isStandardProject`` + ``filterStandardProjects``. Drei
Konsumenten wenden den Filter an:

- ``DashboardFilterBar.tsx`` (die Dashboard-Projektauswahl)
- ``ExportSection.tsx`` (Export-Auswahl)
- ``Anki.tsx`` (Anki-Projekt-Dropdown)

Der Backend-Endpoint exponiert das Pseudo-Projekt absichtlich
weiterhin, damit eine zukünftige "alle Aktivitäten"-
Admin-Ansicht es einbinden kann. Der Filter ist eine
UI-Policy-Entscheidung, kein Daten-Verstecken.

---

## Lektions-XP-Formel (v1.31.0 / Phase 46E.1)

``adaptive_learner_gamification.xp_service`` gewinnt:

- ``compute_stars(correct, total)`` - 0-3 aus einem Ergebnis,
  mit Banden bei 50 % / 75 % / 90 %. Spiegelt das
  ``computeStars`` des Frontends in ``lib/lesson-summary.ts``,
  sodass beide Seiten dieselbe Sterne-Bewertung projizieren.
- ``calculate_lesson_session_xp(*, stars, first_attempt,
  streak_days)`` - reiner Rechner. 30 Basis + 10/Stern +
  20 erster-Versuch-3-Sterne + derselbe +25 %/Tag
  Serien-Multiplikator (bei 7 gedeckelt) wie die
  Chat-Formel.
- ``_is_first_attempt(db, lesson_progress_id)`` - liest
  ``LessonProgress.step_results``-JSON und gibt True
  zurück, wenn jede Schritt-Zeile ``attempts == 1`` hat.
- ``award_xp_for_lesson_session(db, *, session)`` -
  Persistenz-Wrapper, der user_id aus dem Projekt-FK auflöst
  und die Formel anwendet.

Der Dispatch passiert in
``GamificationPlugin.on_session_complete`` basierend auf
``session["method"]``. Chat-Methoden bleiben bei
``award_xp_for_session``. Content-Methode geht zur
Lektionsformel. Die Session-Payload des Vereinheitlichungs-
Helfers trägt die lektions-spezifischen Schlüssel
(``lesson_progress_id``, ``score_correct``,
``score_total``); Chat-Session-Payloads nicht, sodass der
Lektions-XP-Wrapper graziös degradieren würde, falls der
Dispatch je leckt - aber der Regressions-Pin-Test in
``backend/tests/test_lesson_session_unification.py``
verifiziert die exakte Lektions-Vergabe (100 XP für einen
4/4-Erstversuchs-Abschluss + Erst-Tags-Serie), sodass ein
Leck sofort sichtbar würde.

---

## Lektions-Abzeichen (v1.31.0 / Phase 46E.2)

Vier neue Prädikate, hinzugefügt zu
``adaptive_learner_gamification.badge_service._EVALUATORS``:

| Schlüssel | Prädikat | Helfer |
|---|---|---|
| ``first_lesson`` | ``_completed_lesson_count >= 1`` | zählt ``LessonProgress.status="completed"`` (nicht via LearningSession - die Lektionszeile ist maßgeblich) |
| ``lessons_10`` | ``_completed_lesson_count >= 10`` | dasselbe |
| ``three_star_streak`` | ``_last_n_lessons_all_three_star(n=3)`` | liest die letzten 3 abgeschlossenen ``LessonProgress`` nach ``completed_at`` desc; projiziert jede via ``xp_service.compute_stars`` |
| ``review_master`` | ``_mastered_elements_count >= 50`` | zählt ``ElementError.mastered=True`` |

Katalog-Anzahl: **24 → 28** (+1 getting_started + 1
consistency + 2 depth). Der bestehende Symmetrie-Test
``every yaml badge has an evaluator`` (in
``backend/tests/test_gamification_badges_integration.py``)
fängt Drift zwischen den beiden Listen ab.

---

## Speichermodus-Vorbehalte

Die Element-Verfolgung + SRS-Kette funktioniert in
**beiden** Speichermodi identisch - der
``IElementErrorsNamespace``-Vertrag ist modusagnostisch,
und das Dexie-Mode-Release-Gate (deckt die nav-erreichbaren
Routen inkl. ``/review`` ab) blockiert jede Regression.

Die Lektions-Session-Vereinheitlichung +
Gamification-Seiteneffekte sind **nur im API-Modus**
verfügbar. Im Dexie-Modus schreibt der Lektionsabschluss
weiterhin ``LessonProgress``, zeichnet weiterhin
``ElementError``-Zeilen auf und treibt weiterhin die
Wiederholungs-Warteschlange - aber der
``LearningSession``-Schreibvorgang + der
``on_session_complete``-Hook feuern nie (kein Backend,
nichts zum Aufhängen). Dexie-Modus-Nutzer:innen erhalten
die volle Wiederholungsschleife; die XP- /
Abzeichen-Vergaben über den Chat-Session-Pfad
funktionieren weiterhin, aber Lektionsabschlüsse tragen
noch nicht zu dieser Summe bei.

Eine zukünftige Vereinheitlichung der Gamification-
Seiteneffekte in ``DexieStorage`` (sodass der
Lektionsabschluss eines Dexie-Modus-Nutzers auch lokal XP
vergibt) ist ein bewusstes Nicht-Ziel für v1.31.0 - sie
würde entweder die Formel-Implementierung in TypeScript
duplizieren oder einen Service-Worker-Shim des
``on_session_complete``-Hooks erfordern. Beide sind größere
Refactors als der v1.31.0-Umfang zulässt.

---

## Wo als Nächstes nachschauen

- ``backend/app/services/element_errors.py`` - die
  Upsert-Übergangsmatrix.
- ``backend/app/services/element_srs.py`` - der Scheduler.
- ``backend/app/services/lesson_session_unification.py`` -
  das Pseudo-Projekt + der Hook-Fire.
- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/xp_service.py`` -
  ``calculate_lesson_session_xp`` + Dispatch.
- ``plugins/adaptive-learner-plugin-gamification/
  adaptive_learner_gamification/badge_service.py`` - die
  vier neuen Prädikate.
- ``frontend/src/lib/learning-project.ts`` - der
  Pseudo-Projekt-Filter-Helfer.
- ``e2e/dexie/dexie-mode.spec.ts`` - das Release-Gate, das
  Dexie-Modus-Regressionen verhindert (Lektions-Spec unter
  ``/lesson/...``, Review-Spec unter ``/review/...``).
