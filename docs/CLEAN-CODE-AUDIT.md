# Clean Code Audit — Adaptive Learner

Datum: 2026-06-10
Commit: `810c0edac59e93aa1c29d0573856ff465fef845c`
Scope: `backend/app/` + `plugins/adaptive-learner-plugin-*/` + `frontend/src/` + `e2e/`

Methodik: aggregierte Metriken per `grep`/`wc` ueber den gesamten Scope, danach
vier fokussierte Tiefen-Analysen (Backend-Core, Plugins, Frontend-Storage/Lib,
Frontend-UI), jede mit Datei-Lektuere zur Bestaetigung jeder Einzelfeststellung.
Generierte Dateien, Tests-Interna, Mock-Daten, `node_modules`, `__pycache__`,
i18n-JSON ausgenommen.

---

## 1. Executive Summary

**Gesamtbewertung: 7.5 / 10.**

Eine ungewoehnlich disziplinierte Codebasis. Die in `.claude/rules/` kodifizierten
Architekturregeln werden flaechendeckend eingehalten — und zwar nicht nur formal,
sondern mit dokumentierten Ausnahmen an genau den Stellen, wo die Regel nicht
greift. Die technische Schuld ist konzentriert, nicht diffus: ein knappes Dutzend
God-Files und ein wiederholtes Muster (die 5 Exercise-Renderer) tragen den
Grossteil der Wartbarkeitslast. Es gibt **keine P0-Datenintegritaets- oder
Sicherheitsbefunde** und **null echte Regelverletzungen** bei den beiden
heikelsten Regeln (`HTTPException` aus Services, `api.*` direkt aus Komponenten).

**Top 3 Staerken**

1. **Fehlerbehandlungs-Architektur konsequent umgesetzt.** Null `HTTPException`
   aus Service-Bodies, null bare `except:`, null direkte `api.*`/`fetch()`-Aufrufe
   aus Komponenten (Dexie-Contract gewahrt). Externe Fehler werden als
   `ExternalServiceError` gewrappt.
2. **Repository-Pattern (EXP-024) und Dual-Storage-Contract sind vorbildlich.**
   `repositories/` ist HTTP-frei, `deps.py` ist ein sauberer Composition Root, jede
   Request-Service-Schicht haengt an Abstraktionen. Beide Storage-Impls erfuellen
   dasselbe `IStorageService`; `dexie-storage.ts` delegiert an ~20 Fokusmodule.
3. **Design-Tokens praktisch lueckenlos durchgesetzt.** Null Fixed-Palette-
   Tailwind-Klassen ueber 156 .tsx-Dateien; genau **1** echtes Farb-Literal
   ausserhalb der legitim befreiten Dateien (generierte SVGs, PDF-Renderer,
   Theme-Registry, Chart-Util).

**Top 3 Schwaechen**

1. **God-Files mit vermischten Concerns.** `session/routes.py` (1988 Z., Business-
   Logik in Route-Handlern), `Lesson.tsx` (1905 Z., 38 Hooks), `Content.tsx`
   (1874 Z., 6 Concerns), `dexie-storage.ts` (2461 Z.).
2. **Die 5 Exercise-Renderer duplizieren den gesamten Controlled-/Submit-/
   Review-Lifecycle** — ~80-120 redundante Zeilen pro Renderer. Die geteilte
   Infrastruktur (`exercise-control.ts`) existiert bereits, nur der Hook fehlt.
3. **Docstring-Abdeckung im Backend bei ~53 %** (352 von 753 public Symbolen
   ohne Docstring), plus 7 stumm geschluckte Exceptions in Plugins ohne Log.

**Geschaetzte technische Schuld: ~65-80 Stunden**, aufgeschluesselt:

| Block | Schaetzung |
|-------|-----------|
| `session/routes.py` Dekomposition (+ Wegfall der `_finalize_stream_exchange`-Duplikation) | 12-16 h |
| `Lesson.tsx` + `Content.tsx` Dekomposition | 10-14 h |
| 5 Exercise-Renderer: `useControlledExercise` + `<ExerciseFooter>` | 6-8 h |
| Docstring-Nachzug (abstrakte Repos + Schemas + frontend Exports) | 8-12 h |
| `dexie-storage.ts` + `types.ts` Aufsplittung | 6 h |
| `backup_service`/`sync_service` Funktionszerlegung + `_row_belongs_to_user` dedup | 5-6 h |
| `_build_ai_caller` Triplikat-Konsolidierung | 3 h |
| 7 geschluckte Exceptions loggen + 17 `waitForTimeout` ersetzen | 4 h |
| P2-Reste (Naming, `voicePref`-Swallows, P0-Config-Swallow) | 4 h |

---

## 2. Kritische Probleme (P0)

| Datei | Zeile | Problem | Empfehlung |
|-------|-------|---------|------------|
| `backend/app/main.py` | 228-232 | `_load_app_config()` schluckt jeden Fehler beim `app.yaml`-Lesen (`except Exception: project = {}`) **ohne Logging** — einziger stummer Swallow im Backend; eine korrupte Config laesst die App mit allen Defaults starten, unsichtbar. Verletzt "no except without logger.error". | `except (OSError, yaml.YAMLError) as exc:` und `logger.warning("app.yaml unreadable, using defaults: %s", exc)` vor dem Fallback. |

> Es gibt keine P0-Befunde fuer Datenintegritaet, Sicherheit oder
> Dexie-Contract-Bruch. Der einzelne P0 ist ein Beobachtbarkeitsloch, kein
> Korrektheitsfehler.

---

## 3. Wichtige Probleme (P1)

| Datei | Zeile | Problem | Empfehlung |
|-------|-------|---------|------------|
| `plugins/.../session/routes.py` | 619-1029 | `append_message` ist ein ~410-Zeilen-God-Handler ueber 3 Abstraktionsebenen mit 3 inneren Closures (`_build_response` 667, `_run_both` 830): Session-Guard, Persist, Provider/Key-Resolution, AI-Call, Step-Eval (sync + `asyncio.gather`), Auto-Loop, Cycle-Reset, Response-Bau. Business-Logik im Route-Modul. | `session_runner.py`-Service extrahieren: `run_message_exchange(ctx)` orchestriert `persist_user_message`/`resolve_ai_context`/`run_step_evaluation`/`run_auto_loop`. Handler schrumpft auf ~15 Zeilen. |
| `plugins/.../session/routes.py` | 1336 | `_finalize_stream_exchange` (~165 Z.) **re-implementiert** die zweite Haelfte von `append_message` (870-1019). Der Docstring gibt es selbst zu ("Mirrors the second half..."). Die beiden Pfade driften. | Die oben extrahierten `run_step_evaluation`/`run_auto_loop` werden die einzige Quelle, die sync- und Stream-Handler aufrufen. Entfernt ~130 Zeilen. |
| `plugins/.../{anki,notebooklm,session}/routes.py` | 76 / 59 / 1832 | `_build_ai_caller` dreifach nahezu verbatim (Provider+Key+Model-Resolution); das `default_models`-Dict ist eine 4. Kopie von `session/ai_orchestration.py:DEFAULT_MODELS`. Business-Logik in Route-Modulen. | Ein geteiltes `build_ai_caller(db, user_id, *, max_tokens=None)` in `app.services` (oder Plugin-Shared). `default_models` → ein Import von `DEFAULT_MODELS`. |
| `plugins/.../session/step_evaluator.py` | 358, 396 | `except Exception: return _deterministic_fallback(...)` — Modul hat **keinen** Logger. Ein kaputter AI-Provider ist unsichtbar. | Modul-`logger` + `logger.warning(..., exc_info=True)` vor dem Fallback. Verhalten korrekt, nur das Log fehlt. |
| `plugins/.../session/topic_transition.py` | 272, 309 | Identisches Muster, ebenfalls Modul ohne Logger. | s. o. |
| `plugins/.../missions/service.py` | 246 | `except Exception: pass` (Kommentar "XP is supplementary"), Modul ohne Logger — XP-Award-Fehler verschwinden komplett. | Logger + `logger.warning(exc_info=True)`. |
| `backend/app/services/lesson_progress.py` | 115 | `upsert_progress()` 183 Zeilen / **14 Parameter**, 5 sich gegenseitig ausschliessende Lifecycle-Transitions (complete/pause/abandon/resume/restart) inline + JSON-Serialisierung + Step-Merge in einem. | Branches in `_apply_completion`/`_apply_pause`/... extrahieren, Step-Merge in `_merge_step_result`. Statt 14 kwargs eine `LessonProgressMutation`-Dataclass. |
| `backend/app/services/backup_service.py` | 514, 732 | `_restore_table()` (130 Z.) und `restore_backup()` (120 Z.) — die zwei groessten Datenintegritaets-Funktionen, hoechstes Wartungsrisiko (Backup-Restore hatte 5 "fixed"-Releases). | Coerce→FK-Check→Unique-Match→Upsert-Pipeline in benannte Schritte; per-Table-Loop-Body und Summary-Aggregation aus `restore_backup` herausziehen. |
| `backend/app/services/sync_service.py` `+` `backup_service.py` | 767 / 647 | **`_row_belongs_to_user` dupliziert mit Divergenz** — sicherheitsrelevanter User-Scoping-Check; Backup-Variante prueft zusaetzlich `row.user_id is not None`, Sync nicht; verschiedene Spec-Lookups. Kann driften. | Eine kanonische `row_belongs_to_user(...)` in `sync_service` (besitzt `TABLES`/`TableSpec`); `backup_service` importiert sie. `backup_service._spec()` (Einzeiler-Indirektion) entfernen. |
| `backend/app/{services/settings.py, services/lesson_session_unification.py, routers/content.py, routers/imports.py, routers/plugin_settings.py}` | 222 / 156 / 98 / 188 / 123,160 | 6 Lazy-Imports aus `app.main` (privates `_get_user_override_path`/`_load_override_file`, Plugin-`manager`) zur Zirkular-Import-Vermeidung. Services haengen an `main`. | `PluginManager`-Instanz in `app/plugin_manager.py` (oder via `deps.py`); Override-Helfer in `config_overlay.py`. Entfernt alle 6 Workarounds. |
| `frontend/src/components/exercises/*` | — | **Die 5 Renderer duplizieren den kompletten Lifecycle** (`handleSubmit`/`handleReset`/`useImperativeHandle`/`onInteraction`-Effect/`reviewed`-Narrowing/Footer-JSX) — nur die `derive*Attempt`-Funktion variiert. ~80-120 redundante Zeilen je Renderer. | `useControlledExercise<TAnswer>()`-Hook (besitzt `submitted`/`result`/Imperative-Handle/`onInteraction`/Reset, nimmt `score(answer)`-Callback) + `<ExerciseFooter>`-Komponente. `exercise-control.ts` hat die Typen schon — der Hook ist das fehlende Stueck. **Hoechster Hebel im Frontend.** |
| `frontend/src/pages/Lesson.tsx` | 133-1180 | God-Komponente: `LessonPage` ~1047 Zeilen, 38 Hooks; mischt Pause/Resume/Abandon, Enter-Key-Zweiphasen-Shortcut, Step-Navigation, Autosave, Theory-Backlinks, Result-Export. | `useLessonFlowControl`, `useLessonNavigation` extrahieren; Result-Export-Builder nach `lib/lesson/`. |
| `frontend/src/pages/Content.tsx` | 129-1874 | God-Komponente: 38 Hooks ueber 6 Concerns — Set-Listing/Download, Delete-Dialog, **Share-Wizard-Flow**, **AI-Validation**, Book-Recommendations, **Search/Index**. | Share-Validation-State in `ShareWizard` (oder `useShareValidation`) heben; `useContentSearch` extrahieren — ~12 der 38 State-Hooks. |
| `frontend/src/storage/dexie-storage.ts` | 443 | Ein 2461-Zeilen-Objekt-Literal; verbleibende Inline-Namespaces (`session`, `imports` @2191, `gamification`, Assessment-Badge-Block @2066) tragen echte Logik. | Inline-Namespaces in Geschwistermodule extrahieren (Muster `session-flow.ts` existiert). Ziel < 800 Z. |
| `frontend/src/storage/types.ts` | 1 | `IStorageService` als 1491-Zeilen-Einzel-Interface mit ~30 Namespaces. | Pro-Namespace-Interface-Dateien + Barrel `types/index.ts`. Type-only, risikoarm. |

---

## 4. Verbesserungsvorschlaege (P2)

| Datei | Zeile | Problem | Empfehlung |
|-------|-------|---------|------------|
| `backend/app/main.py` | 424 | `lifespan()` (87 Z.) mischt Migration, 3 Seed-Schritte, Plugin-Discovery, OpenAPI-Backfill. | `_migrate_api_keys_safe()`/`_seed_subjects_safe()`/`_seed_badges_safe()` extrahieren, `lifespan` als Schrittliste. |
| `backend/app/services/sync_service.py` | 789 | `push_records()` (90 Z.) verzweigt append-only/mutable/conflict in einem. | `_push_append_only_row`/`_push_mutable_row` extrahieren. |
| `backend/app/repositories/*_repo.py`, `routers/*.py`, `schemas/__init__.py` | — | **~352 von 753 public Symbolen ohne Docstring** (abstrakte Repo-Methoden = Datenschicht-Contract; 94 Schema-Klassen; Route-Handler). | Mindestens abstrakte Repo-Methoden + Schema-Klassen mit Einzeiler-Docstrings versehen (Google-Style). |
| `backend/app/services/lesson_progress.py` | 207, 221 | Inline-Kommentare `# BUG P1 / Problem 2`, `# BUG #41` — Commit-Message-Residue, gehoeren nicht inline (DOC-DOCSTRINGS-NOT-INLINE). | In Docstring verlagern oder loeschen (git haelt die Historie). |
| `backend/app/{secrets_service,reset_service,identity_service,routers/*}` | versch. | ~23 generische Lokalnamen (`data = yaml.safe_load(...)`, `result`, `obj`). Regel verbietet `data`/`result`/`obj`/`temp`. | `raw_secrets`/`parsed_identity`/`push_result`/`json_object` etc. (opportunistisch beim Anfassen). |
| `frontend/src/lib/voice/voicePref.ts` | 93-116 | 8 bare `catch {}` auf `localStorage.setItem` ohne Kommentar. Pragmatisch ok (Prefs unkritisch), aber Regelbruch. | Ein `/* localStorage best-effort (private mode/quota) */`-Kommentar oder `safeSet`-Helfer, der es einmal dokumentiert. |
| `frontend/src/lib/{learning-path/personal-path,backup-diff,adaptive/lesson-generator}.ts` | — | TSDoc fehlt auf einigen Exports (Return-Types vorhanden dank strict). | Einzeiler-TSDoc je public Funktion. |
| `frontend/src/storage/session-flow.ts` `+` `chat_import/analysis.ts` | 281 / 175 | `sendMessage` ~158 Z. (innere `buildResponse`-Closure), `buildSystemPrompt` ~100 Z. | `buildResponse` auf Modulebene heben (Context-Objekt-Param); Prompt-Kontextblock + Per-Sprache-Fallback in benannte Helfer. |
| `frontend/src/components/about/DonationSection.tsx` | 105 | Hartes `rgba(255,255,255,0.2)` Inline-Style auf "preferred"-Badge (nicht auf der Befreiungsliste); insgesamt 7 Inline-`style`-Bloecke. | Ueber Token routen (z. B. `--badge-tint`); Tailwind/CSS-Module-Pass. |
| `frontend/src/pages/Onboarding.tsx` `+` `components/BackupSection.tsx` | 285 / 443 | `console.log` (BACKUP-AKZEPTANZTEST-Evidenz, gewollt) — verstoesst formal gegen no-console.log. | `// eslint-disable-next-line no-console` ergaenzen (Muster wie `DangerZoneSection.tsx:119`). |
| `e2e/**/*.spec.ts` | — | **17× `page.waitForTimeout(...)`** — Flaky-Test-Anti-Pattern (feste Wartezeiten statt Bedingungen). | Durch `expect(locator).toBeVisible()`/`waitForResponse`/`toHaveURL` ersetzen. (Positiv: **0** CSS-Selektoren — testid-only wie verlangt.) |

---

## 5. Statistiken

- **Dateien analysiert:** ~95 Backend-`.py` (app) + ~21 Plugin-Quellmodule >50 Z. +
  ~95 Frontend-Nicht-UI-`.ts` + 156 `.tsx` (pages/components) + 39 e2e-Specs.
- **Backend LOC (app):** 18.940 · **Plugin-Quellen LOC:** ~17.335 ·
  **Frontend `src` LOC:** ~150.708 (inkl. Tests).
- **Funktionen > 50 Zeilen:** Backend 19 (AST-gemessen) · Plugins ~6 echte
  God-/Long-Handler (`append_message`, `_finalize_stream_exchange`, `start_session`
  + 3 lange-aber-kohaerente) · Frontend ~4 (`sync`, `sendMessage`,
  `buildSystemPrompt`, dexie `imports.upsert`) + 2 God-Komponenten.
- **Funktionen > 5 Parameter:** Backend 5 (`upsert_progress` 14 — alle keyword-only
  nach `*`).
- **`any`-Typen (Frontend, nicht-test):** **1 echter** (`lazyWithReload.ts:74`, mit
  `eslint-disable` + Kommentar gerechtfertigt). Die uebrigen 6 grep-Treffer sind das
  Wort "any" in Kommentaren/Identifiern, keine Annotationen.
- **Fehlende Docstrings:** Backend ~352 / 753 public Symbole (~47 %); Plugins
  praktisch lueckenlos (genau **1** echte Luecke: `content-loader/routes.py:155
  from_entry`).
- **Hardcodierte Farben (nicht-exempt):** Backend n/a · Frontend **1**
  (`DonationSection.tsx:105`). Alle anderen Treffer liegen in legitim befreiten
  Dateien (generierte SVGs, PDF-Renderer, Theme-Registry, Chart-Util) oder waren
  Issue-Referenzen (`#185`) in Kommentaren.
- **Fixed-Palette-Tailwind-Klassen:** **0**.
- **`HTTPException` aus Service-Body:** **0** (Backend) / **0** (Plugins).
- **Bare `except:`:** **0**. **Geschluckte Exceptions ohne Log:** 1 Backend (P0) +
  7 Plugins (P1) + 8 `voicePref`-localStorage (P2).
- **Direkte `api.*`/`fetch()` aus Komponenten:** **0 Verletzungen** (3 `api.*`-Sites
  alle korrekt API-Mode-gegated; 0 `fetch(`).
- **`console.log`:** Frontend 2 (gewollte Backup-Evidenz).
- **DRY-Verletzungen (relevant):** 5 Exercise-Renderer-Lifecycle ·
  `_build_ai_caller` ×3 + `default_models` ×4 · `_row_belongs_to_user` ×2 ·
  `_finalize_stream_exchange` vs `append_message`.

---

## 6. Refactoring-Beispiele

### Beispiel 1 — `_row_belongs_to_user` (P1, sicherheitsrelevant)

Zwei divergierende Kopien eines User-Scoping-Checks ueber 2 Services. Das ist die
gefaehrlichste Duplikation im Backend: ein Auseinanderdriften kann Daten ueber
User-Grenzen hinweg sichtbar/wiederherstellbar machen.

**Vorher** — `backup_service.py:647`:
```python
def _row_belongs_to_user(table: str, row: Any, user_id: str) -> bool:
    spec = _spec(table)                       # eigener Lookup
    if spec.user_column is None:
        return True
    value = getattr(row, spec.user_column, None)
    return value is not None and value == user_id   # zusaetzlicher None-Check
```
**Vorher** — `sync_service.py:767`:
```python
def _row_belongs_to_user(table: str, row: Any, user_id: str) -> bool:
    spec = TABLES[table]                      # anderer Lookup
    if spec.user_column is None:
        return True
    return getattr(row, spec.user_column, None) == user_id   # kein None-Check
```
**Nachher** — eine kanonische Funktion in `sync_service.py` (Eigentuemer von
`TABLES`/`TableSpec`):
```python
def row_belongs_to_user(table: str, row: Any, user_id: str) -> bool:
    """Return True if ``row`` is owned by ``user_id`` (or is user-agnostic).

    A row is user-agnostic when its table declares no ``user_column``
    (seeded catalogs). Otherwise the column must be present AND equal.
    """
    spec = TABLES[table]
    if spec.user_column is None:
        return True
    value = getattr(row, spec.user_column, None)
    return value is not None and value == user_id
```
```python
# backup_service.py
from app.services.sync_service import row_belongs_to_user  # bereits TableSpec/TABLES importiert
# _spec() und die lokale Kopie entfallen.
```
Die strengere `value is not None`-Semantik wird zur einzigen Wahrheit — fail-safe
fuer beide Pfade.

### Beispiel 2 — Exercise-Renderer-Lifecycle (P1, hoechster Hebel)

**Vorher** — identisch in allen 5 Renderern (hier `FreeTextExercise.tsx`):
```tsx
const [submitted, setSubmitted] = useState(false)
const [result, setResult] = useState<ExerciseScored | null>(null)

const handleSubmit = () => {
  if (submitted || !answerable) return
  const { correct, total } = scoreFreeText(value, exercise)
  const scored: ExerciseScored = { correct, total, attempts: deriveFreeTextAttempt(...),
    raw_answer: { kind: "free_text", value } }
  setResult(scored); setSubmitted(true); onComplete(scored)
}
const handleReset = () => { setValue(""); setSubmitted(false); setResult(null) }
useImperativeHandle(ref, () => ({ submit: handleSubmit }))
useEffect(() => {
  if (!controlled || reviewedFreeText || submitted) return
  onInteraction?.(answerable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [value, submitted])
```
**Nachher** — geteilter Hook (`lib/exercises/useControlledExercise.ts`), je Renderer
nur noch die `score`-Funktion:
```tsx
const { submitted, result, submit, reset } = useControlledExercise<FreeTextAnswer>({
  controlled, reviewed, onComplete, onInteraction, ref,
  isAnswerable: answerable,
  score: (answer) => {
    const { correct, total } = scoreFreeText(answer.value, exercise)
    return { correct, total, attempts: deriveFreeTextAttempt(...),
      raw_answer: { kind: "free_text", value: answer.value } }
  },
})
// ...
<ExerciseFooter testidPrefix="free-text" i18nNamespace="exercise"
  submitted={submitted} result={result} onCheck={submit} onRetry={reset} />
```
Entfernt ~80-120 Zeilen je Renderer und macht die Footer-/Celebration-/Retry-Logik
zentral aenderbar.

### Beispiel 3 — `append_message` God-Handler (P1)

**Vorher** — `session/routes.py:619` (Auszug, ~410 Zeilen, 3 innere Closures):
```python
@router.post("/{session_id}/message")
async def append_message(session_id, body, db=Depends(get_db), ...):
    session = db.get(LearningSession, session_id)         # Guard
    if session is None: raise NotFoundError(...)
    # ... persist user message ...
    # ... validate model cache, resolve provider + key + model (dupliziert) ...
    def _build_response(...): ...                          # inline closure
    async def _run_both(...): ...                          # inline closure, asyncio.gather
    # ... AI call + timing ...
    # ... step evaluation (sync + parallel) ...
    # ... auto-loop / topic-transition / cycle_topics JSON mutation ...
    return _SessionMessageExchangeOut(...)
```
**Nachher** — `session/session_runner.py` als Service, Handler duenn:
```python
@router.post("/{session_id}/message")
async def append_message(session_id, body, db=Depends(get_db), ...):
    ctx = build_message_context(session_id, body, db)      # Guard + Laden
    return await run_message_exchange(ctx)                  # Orchestrierung im Service

# session_runner.py
async def run_message_exchange(ctx: MessageContext) -> ExchangeResult:
    persist_user_message(ctx)
    ai = resolve_ai_context(ctx)            # model-validate + key + model (shared build_ai_caller)
    reply = await call_ai(ai, ctx)
    evaluation = await run_step_evaluation(ctx, reply)
    loop = run_auto_loop(ctx, evaluation)
    return assemble_exchange(ctx, reply, evaluation, loop)
```
`run_step_evaluation`/`run_auto_loop` werden dann auch von
`_finalize_stream_exchange` aufgerufen — die ~130-Zeilen-Duplikation des
Stream-Pfads entfaellt.

---

## 7. Positives

Was als Vorbild dient und **nicht** angefasst werden sollte:

- **Fehlerbehandlung ist Lehrbuch.** Jeder breite `except Exception` (ausser dem
  einen P0) traegt `# noqa: BLE001` + WHY + `logger.exception`/`logger.warning`.
  AI-Provider-Plugins (anthropic/openai/gemini) wrappen jeden SDK-Call in typisiertes
  `ExternalServiceError(service, str(exc)) from exc`, sync und Stream. Router sind
  echt duenn und fangen nur enge `ValueError`→`ValidationError`-Konvertierungen.
- **Repository-Pattern exemplarisch.** `repositories/base.py` dokumentiert den
  Contract sauber, das Paket ist HTTP-frei, `deps.py` ist der einzige Ort, der
  FastAPI **und** konkrete Impls kennt. `RepositoryError`/`UniqueViolationError`
  geben ein backend-neutrales Persistenz-Signal — gute Interface-Segregation. Alle
  dokumentierten Session-Ausnahmen (`_scoped_query`, `subjects_seed`,
  `routers/sync.py` etc.) sind genau wie spezifiziert; **kein** undokumentiertes
  Session-Leck.
- **Dual-Storage-Contract gewahrt.** Beide Impls erfuellen `IStorageService`;
  `apiStorage` ist eine dokumentierte 1:1-Delegation, `dexie-storage.ts` delegiert an
  ~20 Fokusmodule. Die einzige TS↔TS-Ueberlappung waeren TS↔**Python**-Paritaets-
  Ports (Gamification-XP, `dedupeContentEntries`, `backup.ts`) — alle bewusst und in
  CLAUDE.md dokumentiert; **keine** versehentliche Single-Mode-Duplikation gefunden.
- **Diagnostik faellt offen aus** (`routers/system.py` Git-Hash/Version/Build-Date)
  mit engen Exception-Tupeln und dokumentierten `None`-Fallbacks — matcht die
  "Diagnostic features must fail open"-Regel.
- **High-Param-Funktionen sind keyword-only** (`*`) und voll dokumentiert — die
  Parameterzahl ist strukturell abgemildert.
- **Design-Tokens flaechendeckend** durchgesetzt; **0** Fixed-Palette-Tailwind ueber
  156 .tsx; shadcn-`Button` erzwingt `min-h-11` per Konstruktion (44px-Targets
  weitgehend by-design erfuellt).
- **e2e nutzt ausschliesslich testid-Selektoren** (0 CSS-Selektoren) wie von der
  Regel verlangt.
- **`questions.py` (907 Z.) und content-loader `schema.py`/`models.py` sind keine
  God-Files** — statische `QUESTIONS`-Daten bzw. Pydantic-Definitionen; korrekt
  **nicht** geflaggt. Ebenso sind `models/__init__.py` (1717) + `schemas/__init__.py`
  (1586) die bewusst dokumentierte "single-file domain model"-Konvention.

---

## Annahmen und offene Punkte

- `models/__init__.py` und `schemas/__init__.py` werden **nicht** als SRP-Verletzung
  gewertet (dokumentierte Single-File-Domain-Model-Konvention).
- `dict[str, Any]` in `backup_service`/`sync_service` ist die gerechtfertigte Form
  fuer beliebige serialisierte Tabellenzeilen (JSON-Grenze), kein un-kommentierter
  `Any`-Verstoss.
- Browser-direkte `fetch()`-Aufrufe (AI-Provider, GitHub-Raw, SSE, Sync-Transport)
  sind legitim — die "fetch nur ueber client.ts"-Regel zielt auf API-Mode-Backend-
  Calls, fuer die es im Dexie-Mode keinen Backend-Pfad gibt.
- Route-Handler- und abstrakte-Repo-Docstring-Luecken sind echte Regelverstoesse,
  aber niedrigster Severity (P2), da OpenAPI/Contract sie teilweise abdecken.
