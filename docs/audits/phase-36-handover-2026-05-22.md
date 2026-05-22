# Phase 36 — Handover (2026-05-22)

This document captures the state of Phase 36 (Import + Analysis
Bugfixes from Manual Testing) at the moment the previous session
hit its context budget. The next session should be able to pick
up from "awaiting user answers to Q1–Q5" and proceed directly
to Bug 2.

## Where we are

| Phase | Status |
|---|---|
| 34 (v1.20.0) | **shipped** — `secrets.yaml` API-key storage |
| 35 (v1.21.0) | **shipped** — comprehensive documentation refresh |
| **36** | **design** — 5 bugs scoped + diagnosed + plan drafted; awaiting user answers to 5 open questions before code touches |

Current HEAD: `f84c993` (v1.21.0 release bump).
`git log --oneline -3` should show the v1.21.0 tag + the doc
refresh commit chain.

## Pre-flight (re-verify on session start)

Run before anything else:

```bash
make test               # backend + plugins + Vitest
cd frontend && npm run build
```

Expected baseline at v1.21.0:

| Suite | Count |
|---|---|
| Backend (pytest) | 786 |
| Plugins × 10 | 615 (110+34+31+33+215+64+58+23+20+27) |
| Frontend Vitest | 1233 |
| **Total** | **2634** |

Frontend build clean (PWA, ~1.7 MB main bundle). If any of these
are red, **stop and diagnose** before touching Phase 36 work —
the bug list assumes a green baseline.

## The 5 bugs (from manual testing)

User reported 5 issues after manual testing of the import +
analysis feature against the real Claude.ai per-conversation
Markdown export fixed up in Phase 33. Spec sits in the user's
original Phase 36 message; the summary table is here for the
new agent's quick orientation. Full spec text is verbatim in
the conversation history.

| # | Bug | One-line | Risk | Migration? |
|---|---|---|---|---|
| 1 | **Duplicate imports + no delete** | Importing the same convo twice creates two records; no delete button | Med | Yes (Alembic + Dexie) |
| 2 | **Analysis language ignored** | User locale=DE but analysis returns English text | Low | No |
| 3 | **Curriculum button stays active** | Clicking "Erstelle Curriculum" again creates duplicates | Low | Yes (small) |
| 4 | **Start Session always new** | Should resume existing active session from the same analysis | Med | Yes (small) |
| 5 | **Anki extract fails silently** | Real cause: ai-anthropic sends `system: None` to API; Anthropic rejects | Low | No |

### Spec-mandated execution order

1. Bug 2 — analysis language (smallest fix, biggest UX impact)
2. Bug 1 — duplicates + delete (touches migration)
3. Bug 3 — curriculum button (small UI fix, small migration)
4. Bug 4 — session resume (small migration + FK)
5. Bug 5 — Anki extraction (root cause diagnosed below)

After all 5: `v1.21.1` patch release.

## Bug 5 — root-cause diagnosis (do not re-investigate)

The user pasted shell logs from a live run. The actual error
chain:

```
USER clicks "Anki-Karten extrahieren" (API mode)
  → plugins/.../anki/routes.py:308 _ai(...)
  → manager._pm.hook.ai_complete(messages=[{role: 'user', content: '...'}], ...)
  → plugins/.../ai-anthropic/plugin.py:56 _complete(...)
  → plugins/.../ai-anthropic/client.py:73 client.messages.create(
        max_tokens=2048,
        messages=[...],
        model='claude-haiku-4-5-20251001',
        system=None,                     # ← THE BUG
    )
  → anthropic.BadRequestError 400:
       {'type': 'error', 'error': {'type': 'invalid_request_error',
        'message': 'system: Input should be a valid array'}}
  → ExternalServiceError("anthropic", str(exc))
  → 502 to the frontend
  → ImportDetail.tsx catch → notify.error(err.detail)
```

The Anki plugin's extraction prompt is a single user-message
call (no system message needed). The Anthropic SDK accepts
`system=` as a string OR omitted entirely OR
`anthropic.NOT_GIVEN`. Passing `system=None` (explicit `null`
on the wire) is what breaks. The fix is in the ai-anthropic
provider client, not in the Anki plugin.

**Audit the other two providers (ai-openai, ai-gemini) for the
same shape**: they may also pass `system=None` when there's no
system message. Add regression tests per provider.

## Survey findings — what's already in place

Verified via the Phase 36 survey agent. Key facts the next
session needs to know:

### Imports backend

- `backend/app/models/__init__.py:690-743` — `ImportedConversation`
  columns: `id, user_id, project_id, source, title,
  message_count, imported_at, analyzed, analysis_result,
  topic_tag, model, source_created_at`. **NO** `content_hash`,
  `created_curriculum_id`, `last_session_id`. All three need to
  be added across Bugs 1 / 3 / 4.
- `backend/app/routers/imports.py:100-106` — DELETE endpoint
  **already exists**: `@imports_router.delete("/{conversation_id}", status_code=204)`.
  Service-level `delete_conversation()` at
  `backend/app/services/imports.py:176-179` cascades to
  `ImportedMessage` rows.
- Latest Alembic revision: `0013_study_questions.py`. Next
  revisions for this phase will be `0014_imports_content_hash`,
  `0015_imports_curriculum_link`, `0016_session_imported_conv_link`.

### Imports frontend

- `frontend/src/storage/db.ts` — Dexie at version **10** (the
  survey said v2; that was reading the wrong file or version
  declaration. Verified via `grep "this.version" db.ts` shows
  versions 1→10). Three new bumps in Phase 36: v11 / v12 / v13.
- `frontend/src/storage/dexie-storage.ts:1137` — `imports`
  namespace exists. **NO `remove()` method**. Has `create`,
  `get`, `list`, `update`, `saveAnalysis`, `analyze`.
  `remove()` must be added.
- `frontend/src/pages/Import.tsx` — list view, **no delete
  button**.
- `frontend/src/pages/ImportDetail.tsx` — single-conversation
  view with Create Curriculum + Start Session + Extract Anki
  buttons. All three handlers need refactoring (Bugs 3, 4, 5).

### Analysis language path

- `frontend/src/chat_import/analysis.ts:53-144` — SYSTEM_PROMPT
  is **hardcoded English**. No lang parameter on
  `analyzeConversation()` or `AnalysisOptions`. Needs the user's
  language threaded through. ImportDetail call at
  `frontend/src/pages/ImportDetail.tsx:118-128` doesn't pass it.
- `backend/app/services/conversation_analysis.py:53-143` —
  **identical** hardcoded English prompt mirroring frontend.
  Same fix needed both sides.
- `backend/app/routers/imports.py:154-215` (analyze endpoint) —
  reads settings but ignores `settings.language` /
  `user.language`. Both fields exist on the model.
- `backend/app/models/__init__.py:75` — `User.language: str =
  "de"`. Defensive fallback exists.

### Curriculum + session links (Bugs 3 + 4)

- ImportDetail's `createCurriculumFromAnalysis()` at
  `frontend/src/pages/ImportDetail.tsx:158-220` creates curriculum
  + topics, navigates to `/curriculum?id=<uuid>`. No state
  tracking of "this analysis already created curriculum X".
- ImportDetail's Start Session button at lines 307-316 is a
  bare `onClick={() => go("/session")}` — no payload, no FK
  lookup. Always creates a fresh session via the default flow.
- `LearningSession` columns at lines 400-464 — has `status`
  field (default `"active"`, also `"completed"` / `"abandoned"`).
  **No FK back to ImportedConversation.**
- `/session/start` endpoint body accepts `{projectId, method?,
  cycleStep?, lang?}` — **does NOT accept `imported_conversation_id`**
  yet. Both backend route + Dexie session-flow.ts need the
  new field.

### Existing tests to update / pin

- `backend/tests/test_imports_router.py` — CRUD + analysis;
  no delete test, no duplicate test, no language-passthrough
  test. **Three new tests needed** (one per bug 1, 2 backend
  surface).
- `frontend/src/chat_import/analysis.vocabulary.test.ts` — pins
  BL-27 closure. **Does not test the lang parameter** because
  there isn't one yet.
- `frontend/src/pages/ImportDetail.test.tsx` — exists; needs
  new cases for delete button, duplicate confirm, curriculum
  button-disabled-state, session resume.
- `frontend/src/pages/Anki.test.tsx` — exists; Bug 5 fix may
  need new error-toast persistence test.

## The 5 open questions (awaiting user answers)

These were presented at the end of the previous session. The
new agent must wait for explicit yes/no per question before
writing code. **Do not assume; the user explicitly invoked
"If unsure: STOP and ask."**

### Q1 — Content-hash scope (Bug 1)

Proposed normalize:

```python
content_hash = SHA-256(
    "\n".join(f"{m.role.lower()}:{m.content.strip()}"
              for m in messages)
).hexdigest()
```

Role-prefixed, role lowercased, content stripped, joined by
`\n`. **Title NOT included** — so re-uploading the same
transcript with a different title still detects as duplicate.
Should this also include `m.timestamp` for safety, or stay
content-only?

### Q2 — FK direction (Bugs 3 + 4)

Two designs:

- **Children-side** (recommended): `Curriculum.imported_conversation_id`
  + `LearningSession.imported_conversation_id`.
- **Parent-side**: `ImportedConversation.created_curriculum_id` +
  `ImportedConversation.last_session_id`.

Children-side keeps cardinality clean for future
"curricula from multiple sources". Parent-side keeps the
"what did this import create" lookup as a single row read.

### Q3 — Dexie schema bumps

- (a) Three discrete bumps v11 → v12 → v13 (one per Phase 36
  commit). Cleanest per-commit isolation; matches Alembic.
- (b) One bump v11 with all three columns. Faster but couples
  the schema work.

Recommend (a).

### Q4 — Bug 5 provider audit scope

Audit `ai-openai` and `ai-gemini` for the same `system=None`
shape, fix wherever it surfaces, add regression tests per
provider? Or only fix `ai-anthropic` since that's the only
one observed in the wild?

### Q5 — Error toast persistence API

The spec says error toasts for failures should NOT auto-
dismiss. React-toastify supports `autoClose: false`. Two API
shapes for the `notify` utility at
`frontend/src/utils/notify.ts`:

- (a) `notify.error(msg, {persistent: true})` — extend the
  existing function.
- (b) `notify.errorPersistent(msg)` — separate function.

Recommend (a).

## Gotchas / Lessons from previous phases (apply throughout)

These are recurring patterns the next session needs to honour.

### Atomic green commits

- One commit per bug. Each commit must leave `make test` +
  `npm run build` green.
- The user enforces "atomic commit per bug" as the structure
  for this phase. Don't bundle 2 bugs in 1 commit.

### Real umlauts in German

- `backend/config/i18n/de.yaml` MUST use real ä ö ü ß. ASCII
  folding ("Schluessel") is banned. Same for any
  `docs/help/de/**` edit.
- Code identifiers + filenames stay ASCII.

### Pydantic datetime acceptance

- The `source_created_at` 422 we hit in v1.19.1 — Pydantic
  v2 `datetime | None` ONLY accepts ISO-8601 or `None`. M/D/YYYY
  and D.M.YYYY are rejected. Any new datetime-shaped column
  needs the same normalisation.

### Anthropic SDK `system=None`

- Documented above in Bug 5. The SDK accepts `system=` as
  string OR omits it entirely OR `anthropic.NOT_GIVEN`. Passing
  Python `None` becomes JSON `null` on the wire, which the API
  rejects. Don't make the same mistake elsewhere.

### Three-layer secrets (Phase 34)

- API key resolution: env > secrets.yaml > Fernet DB column.
- Every AI call goes through
  `services.settings.resolve_api_key(db, user_id, provider)`.
- The Settings UI shows the source per provider via
  `UserSettingsOut.key_source_*`.

### `make sync-versions` at release time

- Hand-edit ONLY `backend/pyproject.toml`. Run `make
  sync-versions` to propagate to 18 files.
- `make sync-versions-check` exits non-zero on drift.
- Same release-workflow chain as v1.19.x / v1.20.0 / v1.21.0.
  Confirmed working.

### Per-release changelog file

- `changelog/releases/vX.Y.Z.md` must exist before
  `gh release create vX.Y.Z --notes-file ...`.
- Phase 36 ends with `v1.21.1` — write
  `changelog/releases/v1.21.1.md` before tagging.

### User's preference patterns (from prior decision points)

- **Existing codebase conventions over spec notation**. When
  the spec says one shape and the codebase already has a
  different shape, follow the codebase (e.g.
  `_ENV_SECRET_OVERRIDES` shape).
- **File-level config beats UI**. Power users edit files;
  files win over UI overrides.
- **Fail-hard over silent defaults**. Don't auto-generate
  fallback secrets or invent missing data.
- **Per-page targeted edits for stale-but-mostly-good docs**.
  Don't blind-rewrite; surgical edits where surrounding prose
  is still accurate.
- **Cross-surface tests for shared bug classes**. When a fix
  in one place could regress in a parallel place
  (anthropic/openai/gemini), pin it in every place.

### Pre-commit hooks

- `cd backend && poetry run pre-commit install` — usually
  already done in the venv. If a commit gets blocked by the
  `plugin-lock-paired-with-pyproject` hook, run
  `cd plugins/<plugin>/ && poetry lock` to refresh the
  paired lockfile.

### Test-isolation tripwire

- Production data dirs carry `.adaptive-learner-production`.
  If pytest aborts with returncode=2, a test pointed at real
  data — STOP and investigate, never delete the marker.

### CLAUDE.md is now 9,870 bytes

- After Phase 35, CLAUDE.md is at 9,870 / 10,000 byte budget.
  Any new addition needs a corresponding trim.

## Decision-history nuggets

These came up across the previous v1.19.x → v1.21.0 sessions
and may resurface:

- "Numbers must be verified by running the command, not by
  recall" — for any test-count claim in commit messages or
  release notes.
- "User-perceived bug != code bug" — workbox console
  messages are informational, not blockers. Verify network
  + backend state before believing a console message.
- "Articles-vs-Books parity discipline" is from the upstream
  Bibliogon project — does NOT apply here. Adaptive Learner
  has no Books/Articles surface.
- "Auto-archive backlog [x] items" — when you close a backlog
  entry in this phase, run `make archive-task` (or
  `make archive-task-dry` for preview) to move closed entries
  to `docs/roadmap-archive/YYYY-MM.md`.

## File map (where to look)

```
backend/
  app/
    models/__init__.py        # ImportedConversation, LearningSession, etc.
    services/imports.py       # CRUD + delete_conversation
    services/conversation_analysis.py  # SYSTEM_PROMPT (Bug 2)
    services/settings.py      # resolve_api_key (Phase 34)
    routers/imports.py        # /imports endpoints + analyze
  migrations/versions/
    0013_study_questions.py   # latest revision
  tests/
    test_imports_router.py    # extend with new tests

plugins/
  adaptive-learner-plugin-ai-anthropic/
    adaptive_learner_ai_anthropic/
      client.py:73            # Bug 5 root cause: system=None
      plugin.py:56            # ai_complete entry
  adaptive-learner-plugin-ai-openai/   # audit for same bug
  adaptive-learner-plugin-ai-gemini/   # audit for same bug
  adaptive-learner-plugin-anki/
    adaptive_learner_anki/
      card_extraction.py      # downstream of the 400 error
      routes.py:308           # _ai caller

frontend/
  src/
    storage/
      db.ts                   # Dexie schema, currently v10
      dexie-storage.ts:1137   # imports namespace, missing remove()
      anki.ts                 # extractFromConversationDexie
    chat_import/
      analysis.ts:53-144      # SYSTEM_PROMPT (Bug 2)
      analysis.vocabulary.test.ts
    pages/
      Import.tsx              # list view — no delete button
      ImportDetail.tsx        # detail view — handlers for bugs 3, 4, 5
      ImportDetail.test.tsx   # extend with new tests
      Anki.tsx                # may also have extract button
    utils/
      notify.ts               # Q5 — toast API extension
```

## How to continue

1. Run pre-flight (`make test`, `npm run build`) — re-verify
   2634 green.
2. Wait for user answers to Q1–Q5. **Do not start writing
   code until you have them.**
3. Once answered, start with **Bug 2** per the spec's
   execution order. One atomic green commit, then move to
   Bug 1, then 3, then 4, then 5.
4. After all 5 bugs: write `changelog/releases/v1.21.1.md`,
   bump `backend/pyproject.toml` to `1.21.1`, run
   `make sync-versions`, commit `chore(release): bump version
   to v1.21.1`, tag, push, `gh release create`.

The kickoff prompt for the new session is in the next
session bootstrap message.
