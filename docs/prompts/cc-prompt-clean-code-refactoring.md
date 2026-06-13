# CC-Prompt: Clean Code Refactoring — God-Files + Tech Debt

Basiert auf dem Clean Code Audit (docs/CLEAN-CODE-AUDIT.md, 7.5/10).
Geschaetzte technische Schuld: 65-80h. Phasenweise abarbeiten.

Fuer JEDEN Block: GitHub Issue ZUERST erstellen. Closes #XX im Commit.
Status nach jedem Block melden.

---

## REIHENFOLGE NACH HEBEL

Hoechster Hebel zuerst (meiste Duplikation weg, meiste Wartbarkeit gewonnen):

1. Exercise-Renderer Lifecycle-Hook (6-8h)
2. _row_belongs_to_user Deduplikation (2h, sicherheitsrelevant)
3. session/routes.py Dekomposition (12-16h)
4. Lesson.tsx + Content.tsx Dekomposition (10-14h)
5. dexie-storage.ts Aufsplittung (6h)
6. _build_ai_caller Konsolidierung (3h)
7. Plugin-Exceptions loggen (2h)
8. Docstring-Nachzug (8-12h)
9. Kleinere P2-Reste (4h)

---

## Block 1: useControlledExercise Hook (HOECHSTER HEBEL)

GitHub Issue: "Extract useControlledExercise hook from 5 exercise renderers"

### Problem

Die 5 Exercise-Renderer (FreeText, Cloze, Matching, WordTiles, PictureChoice)
duplizieren den KOMPLETTEN Controlled-/Submit-/Review-Lifecycle:
- useState(submitted), useState(result)
- handleSubmit mit score-Berechnung
- handleReset
- useImperativeHandle(ref, () => ({ submit }))
- useEffect fuer onInteraction
- Footer JSX (Pruefen/Weiter/Wiederholen Buttons)

~80-120 redundante Zeilen PRO Renderer. 5 Renderer = ~500 Zeilen Duplikation.
Die geteilte Infrastruktur (exercise-control.ts) existiert bereits, nur
der Hook fehlt.

### Loesung

Erstelle `frontend/src/lib/exercises/useControlledExercise.ts`:

```typescript
/**
 * Shared lifecycle hook for all 5 exercise renderers.
 * Manages submitted/result state, imperative submit handle,
 * interaction tracking, and reset logic.
 *
 * Each renderer provides only its score() function — the unique part.
 */
export function useControlledExercise<TAnswer>(opts: {
  controlled: boolean;
  reviewed: boolean;
  onComplete: (scored: ExerciseScored) => void;
  onInteraction?: (answerable: boolean) => void;
  ref: React.Ref<ExerciseHandle>;
  isAnswerable: boolean;
  score: (answer: TAnswer) => ExerciseScored;
}): {
  submitted: boolean;
  result: ExerciseScored | null;
  submit: (answer: TAnswer) => void;
  reset: () => void;
}
```

Erstelle `frontend/src/components/exercises/ExerciseFooter.tsx`:

```typescript
/**
 * Shared footer for all exercise renderers.
 * Renders Check/Next/Retry buttons with consistent styling.
 */
export function ExerciseFooter(props: {
  testidPrefix: string;
  submitted: boolean;
  result: ExerciseScored | null;
  onCheck: () => void;
  onRetry: () => void;
}): JSX.Element
```

### Migration pro Renderer

Fuer JEDEN der 5 Renderer:
1. Den duplizierten Lifecycle-Code durch useControlledExercise ersetzen
2. Die Footer-JSX durch ExerciseFooter ersetzen
3. Nur die score()-Funktion bleibt renderer-spezifisch
4. Tests muessen GRUEN bleiben nach jedem Renderer

### Commit-Strategie

```
feat: add useControlledExercise hook + ExerciseFooter
refactor: migrate FreeTextExercise to useControlledExercise
refactor: migrate ClozeExercise to useControlledExercise
refactor: migrate MatchingExercise to useControlledExercise
refactor: migrate WordTilesExercise to useControlledExercise
refactor: migrate PictureChoiceExercise to useControlledExercise
```

Ein Renderer pro Commit. tsc + Vitest nach jedem Commit.

---

## Block 2: _row_belongs_to_user Deduplikation (SICHERHEITSRELEVANT)

GitHub Issue: "Deduplicate _row_belongs_to_user (security-relevant)"

### Problem

Zwei divergierende Kopien eines User-Scoping-Checks:
- `backup_service.py:647` — prueft `value is not None and value == user_id`
- `sync_service.py:767` — prueft `value == user_id` (kein None-Check)

Sicherheitsrelevant: ein Auseinanderdriften kann Daten ueber
User-Grenzen sichtbar/wiederherstellbar machen.

### Loesung

Eine kanonische Funktion in `sync_service.py` (Eigentuemer von TABLES/TableSpec):

```python
def row_belongs_to_user(table: str, row: Any, user_id: str) -> bool:
    """Return True if row is owned by user_id (or is user-agnostic).

    A row is user-agnostic when its table declares no user_column.
    Otherwise the column must be present AND equal.
    """
    spec = TABLES[table]
    if spec.user_column is None:
        return True
    value = getattr(row, spec.user_column, None)
    return value is not None and value == user_id
```

In backup_service.py:

```python
from app.services.sync_service import row_belongs_to_user
# _spec() und die lokale Kopie entfallen.
```

Die strengere `value is not None` Semantik wird zur einzigen Wahrheit.

Commit: `fix: deduplicate _row_belongs_to_user into single canonical function`

---

## Block 3: session/routes.py Dekomposition

GitHub Issue: "Decompose session/routes.py God-handler (1988 lines)"

### Problem

`append_message` ist ein ~410-Zeilen-God-Handler mit 3 inneren Closures.
`_finalize_stream_exchange` (~165 Z.) re-implementiert die zweite Haelfte
von `append_message`. Die beiden Pfade driften.

### Loesung

Extrahiere `plugins/.../session/session_runner.py`:

```python
async def run_message_exchange(ctx: MessageContext) -> ExchangeResult:
    """Orchestrates a complete message exchange."""
    persist_user_message(ctx)
    ai = resolve_ai_context(ctx)
    reply = await call_ai(ai, ctx)
    evaluation = await run_step_evaluation(ctx, reply)
    loop = run_auto_loop(ctx, evaluation)
    return assemble_exchange(ctx, reply, evaluation, loop)
```

Der Route-Handler schrumpft auf ~15 Zeilen:

```python
@router.post("/{session_id}/message")
async def append_message(session_id, body, db=Depends(get_db), ...):
    ctx = build_message_context(session_id, body, db)
    return await run_message_exchange(ctx)
```

`_finalize_stream_exchange` ruft dieselben Funktionen auf
(run_step_evaluation, run_auto_loop). ~130 Zeilen Duplikation entfallen.

### Phasenweise

1. `MessageContext` Dataclass definieren
2. `persist_user_message` extrahieren
3. `resolve_ai_context` extrahieren (inkl. shared build_ai_caller, Block 6)
4. `run_step_evaluation` extrahieren
5. `run_auto_loop` extrahieren
6. `assemble_exchange` extrahieren
7. Handler umstellen
8. `_finalize_stream_exchange` auf dieselben Funktionen umstellen
9. Tote innere Closures loeschen

tsc/ruff/mypy/pytest nach jedem Schritt.

---

## Block 4: Lesson.tsx + Content.tsx Dekomposition

GitHub Issue: "Decompose Lesson.tsx (1905 lines) and Content.tsx (1874 lines)"

### Lesson.tsx

38 Hooks, mischt: Pause/Resume/Abandon, Enter-Key-Shortcut,
Step-Navigation, Autosave, Theory-Backlinks, Result-Export.

Extrahiere:
- `useLessonFlowControl()` — Pause/Resume/Abandon State + Handlers
- `useLessonNavigation()` — Step Navigation, Autosave, Progress Tracking
- `lib/lesson/buildLessonExport.ts` — Result-Export-Builder (reine Funktion)

### Content.tsx

38 Hooks ueber 6 Concerns: Set-Listing/Download, Delete-Dialog,
Share-Wizard-Flow, AI-Validation, Book-Recommendations, Search/Index.

Extrahiere:
- `ShareWizard` Komponente (oder `useShareValidation` Hook)
- `useContentSearch` Hook (~12 der 38 State-Hooks)
- Book-Recommendations als eigene Section-Komponente (falls nicht schon)

### Commit-Strategie

Pro extrahiertem Hook/Komponente ein Commit. Tests nach jedem Schritt.

---

## Block 5: dexie-storage.ts Aufsplittung

GitHub Issue: "Split dexie-storage.ts (2461 lines) into focused modules"

### Problem

Ein 2461-Zeilen-Objekt-Literal. Verbleibende Inline-Namespaces
(session, imports, gamification, Assessment-Badge-Block) tragen
echte Logik.

### Loesung

Das Muster existiert bereits: `session-flow.ts` ist ein extrahiertes
Modul. Die verbleibenden Inline-Namespaces analog extrahieren:

- `dexie-imports.ts` — imports Namespace (@2191)
- `dexie-gamification.ts` — gamification + Assessment-Badge-Block (@2066)
- `dexie-session.ts` — session Namespace (falls nicht schon in session-flow.ts)

Ziel: dexie-storage.ts < 800 Zeilen. Nur Delegation, keine Logik.

---

## Block 6: _build_ai_caller Konsolidierung

GitHub Issue: "Consolidate _build_ai_caller triplication"

### Problem

`_build_ai_caller` existiert dreifach nahezu verbatim in:
- `anki/routes.py:76`
- `notebooklm/routes.py:59`
- `session/routes.py:1832`

`default_models` Dict ist eine 4. Kopie von `DEFAULT_MODELS`.

### Loesung

Ein geteiltes `build_ai_caller(db, user_id, *, max_tokens=None)`
in `app.services` oder Plugin-Shared. `DEFAULT_MODELS` als
einziger Import.

---

## Block 7: Plugin-Exceptions loggen

GitHub Issue: "Add logging to 7 silently swallowed plugin exceptions"

### Problem

7 `except Exception: pass` oder `except Exception: return fallback`
in Plugins OHNE Logger. Fehler verschwinden komplett.

### Loesung

Fuer jedes Modul: Logger anlegen, `logger.warning(..., exc_info=True)`
vor dem Fallback. Verhalten bleibt gleich (graceful degradation),
nur die Sichtbarkeit wird hergestellt.

Betroffene Module (aus dem Audit):
- `step_evaluator.py:358, 396` (kein Logger im Modul)
- `topic_transition.py:272, 309` (kein Logger im Modul)
- `missions/service.py:246` (XP-Award-Fehler verschwindet)
- Pruefe ob weitere dazugekommen sind seit dem Audit

Commit: `fix: add logging to silently swallowed plugin exceptions`

---

## Block 8: Docstring-Nachzug

GitHub Issue: "Add missing docstrings (352 of 753 public symbols)"

### Prio-Reihenfolge

1. **Abstrakte Repo-Methoden** (Datenschicht-Contract, hoechste Prio)
2. **Schema-Klassen** (94 Klassen, API-Vertrag)
3. **Route-Handler** (OpenAPI deckt teilweise ab, niedrigere Prio)
4. **Frontend exportierte Funktionen** (TSDoc)

### Regeln

- Google Style Docstrings (Python)
- TSDoc (TypeScript)
- Einzeiler reichen fuer offensichtliche Methoden
- Mehrzeiler fuer komplexe Logik, Parameter-Erklaerungen, Exceptions
- NICHT generisch ("This function does X"). Beschreibe WAS und WARUM.

### Phasenweise Commits

```
docs: add docstrings to abstract repository methods
docs: add docstrings to schema classes
docs: add docstrings to route handlers
docs: add TSDoc to frontend exported functions
```

---

## Block 9: Kleinere P2-Reste

GitHub Issue: "Resolve remaining P2 clean-code items"

Aus dem Audit:
- `main.py:424` lifespan() 87Z → Schritte extrahieren
- `sync_service.py:789` push_records() Branch-Split
- `lesson_progress.py:207, 221` Inline BUG-Kommentare entfernen
- 23 generische Lokalnamen (data, result, obj) → sprechende Namen
- `voicePref.ts:93-116` — 8 bare catch → safeSet Helfer
- `DonationSection.tsx:105` hardcoded rgba → Token
- `Onboarding.tsx + BackupSection.tsx` console.log → eslint-disable
- 17 waitForTimeout in e2e → explizite Waits

Alles opportunistisch, nicht als eigener Sprint.
Beim naechsten Mal wenn man die Datei anfasst: mitfixen.

---

## REGELN

- Ein Block, ein Issue, ein PR
- tsc + Vitest + ruff + mypy nach JEDEM Commit
- Keine funktionalen Aenderungen (ausser Block 2 + 7)
- Tests duerfen NICHT rot werden
- Wenn ein Refactoring einen Test bricht: Test anpassen,
  nicht den Refactoring zurueckrollen
- axe + Visual Regression nach groesseren UI-Refactorings (Block 1, 4)
- Kein mass-git add, explicit paths
- TSDoc/Google-Style Docstrings, keine Inline-Kommentare

## NICHT JETZT

- Kein Rewrite von Grund auf
- Keine Architektur-Aenderungen (Repository Pattern ist fertig)
- Kein Framework-Wechsel
- Keine Performance-Optimierung (kommt nach Refactoring)
- models/__init__.py und schemas/__init__.py NICHT aufspalten
  (dokumentierte Single-File-Domain-Model-Konvention)
