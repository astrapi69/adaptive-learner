# Handover — after v1.34.0, before v1.35.0 (Phase 52)

**Written**: 2026-05-28 (capacity-limit handover before any
v1.35.0 code lands).

**Purpose**: the v1.35.0 session ran out of capacity AFTER
plan + decisions were locked, BEFORE any code was written.
This document carries the locked plan into the next session
so it can resume work without re-deciding anything.

The next session should:
1. Read this file end-to-end.
2. Run the pre-flight chain (the baseline below MUST match).
3. Execute the 11-commit plan in § 4 from the top.
4. NOT re-litigate any of the 7 decisions in § 2 unless
   evidence in the code forces a revision.

---

## 1. State at session start

### Git

```
HEAD:    822935c docs: post-release v1.34.0 documentation update
Branch:  main
Tag:     v1.34.0 (annotated, pushed to origin)
Working tree: clean.
Ahead of origin: 0 commits (this handover commit will push).
```

### v1.34.0 baseline (the new pre-flight target)

```
Backend pytest:     1002 (+1 skipped)
Plugin tests:       881 (12 suites)
Vitest:             1896
Aggregate:          3779 (+1 skipped)
Dexie smoke gate:   18/18 (occasionally flakes once on
                    vite-preview startup race; re-run is
                    deterministic — see § 5)
```

### Phase 52 scope (per the v1.35.0 kickoff)

**EXP-007 Token-Diff + Cloze Exercise Type**. Wires
token-level visual feedback into every existing exercise
and adds a fifth exercise type (Cloze / fill-in-the-blank)
that auto-generates from a learner's specific mistakes. Plus
a "correction round" at the end of each lesson, cloze in
review sessions, hand-authored cloze in pilot content, and
optional token-roles on cards for smarter generation.

Closes (from the EXP-007 task list in
``docs/explorations/BACKLOG.md`` lines 111-125):

- **P-126** Token-Diff-Modul
- **P-127** Cloze-Generator
- **P-128** Lektions-Logik: Korrektur-Block
- **P-130** Token-Rollen-Schema
- **F-111** UI Cloze-Eingabe
- **F-112** Visuelles Diff-Highlighting
- **F-113** Korrektur-Block am Lektionsende
- **Q-110** Tests Diff-Algorithmus
- **Q-111** Tests Cloze-Generierung
- **Q-112** Tests mehrere Fehler

**P-129** (SRS-Erweiterung: Element-Level statt
Karten-Level) is ALREADY CLOSED by v1.30.0. Do NOT claim
to close it in any v1.35.0 commit message.

---

## 2. The seven decisions (locked)

Confirmed by the user at the end of the planning session. Do
NOT re-litigate. If evidence in the code forces a revision,
STOP and surface before changing direction.

### Decision 1 — Schema version bump 1.0 → 1.1

**Locked choice**: bump ``CURRENT_SCHEMA_VERSION = "1.1"``.

**Reasoning**: Adding CLOZE to the closed ExerciseType enum
AND adding optional ``token_roles`` to Card both constitute
a minor schema change per the schema's OWN docstring
(``plugins/.../content-loader/schema.py:21`` — *"Adding a
fifth type [...] requires a minor schema_version bump"*).

``is_supported_schema_version`` does a MAJOR version match,
so 1.x lessons stay forward-compatible at the schema-version
layer. The breaking surface is the closed ExerciseType enum
— an older app loading a 1.1 lesson with ``type: "cloze"``
will get a Pydantic validation error AT the exercise level.
That's the desired contract: clean, debuggable failure
instead of a silent "unknown exercise" fallback.

**Action**: bump the constant + update the schema docstring
to note that 1.1 added CLOZE + token_roles. Pin in tests.

### Decision 2 — Skip Python token-diff + parity

**Locked choice**: TypeScript-only token-diff. No Python
mirror, no parity test.

**Reasoning**: Token-diff is consumed by the renderer
(frontend only). The cloze generator runs client-side from
cached ``ElementError`` records — no backend roundtrip. A
Python diff with no Python consumer would be dead
infrastructure.

If/when a future backend-side cloze generator needs a Python
diff, port + add parity then (the v1.32.0 + v1.33.0 parity
methodology is established). Document in the 52A commit
message as a known-deferred extension.

**Action**: write the diff in TS only. Tests in Vitest.

### Decision 3 — Cloze schema shape: marker-only with `___`

**Locked choice**: sentence carries visible ``___`` markers;
``blanks[i]`` provides metadata for the i-th marker;
NO ``position`` field.

**Reasoning**: Marker-based is the "standard convention"
the kickoff calls for. Position-only would force authors to
edit two places (sentence text + position index) for one
logical edit. Marker-only keeps the sentence readable in
JSON + makes the i↔i mapping obvious.

**Validator pins**: ``sentence.count("___") === len(blanks)``
at schema-validate time. Failure surfaces at lesson
download, not at render time.

**Shape**:
```json
{
  "type": "cloze",
  "id": "ex-cloze-01",
  "prompt": "Fill in the article.",
  "card_ids": ["art-un"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un", "Un"],
      "hint": "article indéfini masculin",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "Articles indéfinis — Leçon 03."
}
```

### Decision 4 — Cloze rendering mode: optional field, "type" default

**Locked choice**: ``cloze_mode: "type" | "select"`` optional
field on the exercise. Default ``"type"``. ``"select"``
requires non-empty ``distractors[]``.

**Reasoning**: Auto-detecting by viewport
(``window.innerWidth`` mobile vs desktop) is fragile —
resize events, orientation flips, dev-tools mode changes,
tablet landscape all confuse the signal. Per-exercise
author choice is reliable + explicit.

**Validator**: when ``cloze_mode === "select"``,
``distractors.length >= 1`` (otherwise the user has nothing
to pick from). Failure at schema-validate time.

### Decision 5 — Cloze-in-Review priority

**Locked choice**: per source exercise type:
- Source was ``free_text`` or ``word_tiles`` → generate a Cloze
- Source was ``matching`` or ``picture_choice`` → replay original
- **Fallback**: if cloze generation fails for ANY reason, fall
  back to replay. Generation is best-effort; user never sees
  a broken review step.

**Reasoning**: free_text and word_tiles already test recall
+ production — generating a cloze from them tests the same
knowledge in a DIFFERENT shape, exercising the user's
flexibility. Matching + picture-choice are recognition
exercises — generating a cloze from them would change the
cognitive demand. Replay is the right call.

**Action**: extend ``synthesizeReviewLesson`` in
``frontend/src/lib/review-lesson.ts``. New helper
``_buildReviewStep(item, sourceExercise)`` returns either a
generated cloze step OR the replayed original. The decision
lives in this helper.

### Decision 6 — Token-roles scope (52I)

**Locked choice**: keep the kickoff's scope. Add optional
``token_roles: list[{token: str, role: str}]`` to the Card
schema. Add to 3-4 pilot cards as worked examples
(target: FR articles + ES ser/estar — highest-value cards).

**Reasoning**: Optional field; doesn't break existing
content. The cloze generator uses ``token_roles`` when
available (smarter blank selection) + falls back to a
position-based heuristic when absent.

**Roles to support in v1.35.0** (closed enum at the schema
level):
``article | verb | noun | adjective | preposition |
gender_marker | tense_marker``

Future categories (auxiliary, pronoun, conjunction, ...)
extend the enum in a later release.

### Decision 7 — 11-commit cadence

**Locked choice**: ship 9 sub-phase commits + 2 release
commits = 11 total in v1.35.0. Don't split scope unless a
sub-phase EXPLODES (e.g. 52C wiring-into-existing-exercises
needs more than just the diff component — STOP and ask if
that happens, do NOT silently extend the commit).

**Dependency chain** (run in order):
- **Diff path**: 52A → 52B → 52C
- **Cloze path**: 52D → 52E → 52F → 52G → 52H
- **Token-roles**: 52I (mostly independent; 52E uses it if
  present, so 52I before 52E is preferable but not strictly
  required)
- **Docs + release**: 52J → R1 → R2

**Recommended actual order**: 52A → 52B → 52I → 52C → 52D
→ 52E → 52F → 52G → 52H → 52J → R1 → R2. Putting 52I
before 52E means the generator can use token-roles on its
first run; otherwise 52I is a no-op refactor of 52E.

Atomic-green-commit discipline: every commit individually
green through the full pre-flight gate chain (§ 8).

---

## 3. Codebase findings (the investigation cache)

Spent the planning session reading these files. Re-reading
in the next session is OPTIONAL if this summary suffices.

### Existing exercise infrastructure (well-factored)

- ``frontend/src/components/exercises/ExerciseDispatcher.tsx``
  — closed ``SUPPORTED_EXERCISE_TYPES`` set + if-cascade.
  Adding ``cloze`` is a 2-line extension: extend the set,
  add an ``if (ex.type === "cloze")`` branch routing to the
  new renderer.
- Each renderer takes
  ``{exercise, setId, lessonId, onComplete: ({correct, total, attempts}) => void}``.
  Cloze must match this contract.
- ``FreeTextExercise.tsx`` exports
  ``isFreeTextCorrect(input, accept)`` — NFC-normalized
  exact match first, Levenshtein ≤ 1 fallback. REUSE for
  per-blank validation in cloze. Don't reimplement.
- ``frontend/src/lib/element-attempt.ts`` has
  ``deriveFreeTextAttempt`` and siblings. Add a new
  ``deriveClozeAttempts(exercise, perBlankInputs)`` that
  emits ONE ``ElementAttempt`` per blank (so element-level
  tracking lights up correctly on partial-correct cloze).

### Schema (Pydantic v2)

- ``plugins/adaptive-learner-plugin-content-loader/
  adaptive_learner_content_loader/schema.py``
- Constants to change: ``CURRENT_SCHEMA_VERSION = "1.0"``
  → ``"1.1"``.
- Enum to extend: ``ExerciseType`` (line 59-72). Add
  ``CLOZE = "cloze"``.
- New fields on ``Exercise``: ``sentence`` (str | None),
  ``blanks`` (list[dict] | None), ``cloze_mode`` (Literal
  "type"|"select" | None). Type-specific validation goes in
  the existing ``_enforce_type_specific_fields`` model
  validator.
- New field on ``Card``: ``token_roles`` (optional list of
  ``{token: str, role: TokenRole}``). Closed role enum.

### Frontend types

- ``frontend/src/storage/types.ts`` — mirror of the Pydantic
  schemas. Add ``CLOZE`` to the ``ContentLessonExercise``
  type union + the new fields.

### Review-synthesizer surface

- ``frontend/src/lib/review-lesson.ts:84`` —
  ``synthesizeReviewLesson(queue, cachedLessons, opts)``.
  Walks the queue, replays each ``exercise_id``. The
  extension for 52G is a per-item branch:
  - If source exercise type is free_text/word_tiles AND
    cloze generation succeeds → emit synthesized cloze step.
  - Else → replay original (current behaviour).

### Element-Error tracking (v1.30.0)

- ``ElementError`` already carries everything the cloze
  generator needs: ``element_key``, ``user_answer``,
  ``correct_answer``, ``error_count``, ``correct_streak``,
  ``mastered``, ``mastered_at``. No schema change needed
  on the ElementError side.
- ``IElementErrorsNamespace`` shape unchanged.

### Existing tests to be aware of

- ``frontend/src/components/exercises/FreeTextExercise.test.tsx``
  — verifies the existing "wrong → show correct answer"
  contract. 52C will change this contract (wrong → show
  diff instead of bare correct answer). Update or add
  parallel tests.
- ``plugins/adaptive-learner-plugin-content-loader/tests/
  test_pilot_content.py`` (Phase 51A) — parametrized
  schema validator. Adding cloze to pilot content (52H)
  will be picked up automatically; the exercise-variety
  test requires ≥ 2 types per lesson — cloze contributes.

---

## 4. The 11-commit plan

Execute in this order. Each commit individually green
through the pre-flight chain in § 8.

### 52A — Token-diff module (TS-only)

**File**: ``frontend/src/lib/exercises/token-diff.ts``.

**Algorithm**: word-level diff (whitespace split, NOT
character-level), wrapping a Myers-style or
SequenceMatcher-style LCS algorithm. Output type:

```typescript
type DiffOp = "equal" | "insert" | "delete" | "replace";
interface DiffToken {
  text: string;        // the raw token (one word + trailing whitespace)
  type: DiffOp;
  expected?: string;   // only when type === "replace" — the expected word
}
function tokenDiff(userAnswer: string, correctAnswer: string): DiffToken[];
```

**Edge cases (from the kickoff)**:
- Empty input → entire correct answer is one "insert" token
- Identical input → all "equal"
- Completely different → all "delete" + all "insert"
- Extra whitespace → normalize (NFC + collapse runs) before
  diffing
- Case differences → "replace" (case matters in language
  learning)
- Accents (``cafe`` vs ``café``) → "replace" (accents matter
  in FR/ES at A1)

**Tests** (Q-110): all the above edges + multi-replace
runs + interleaved equal-insert-delete patterns.

**Commit**: ``feat(exercises): token-diff module with
word-level diff (Phase 52A / v1.35.0 / P-126, Q-110)``

### 52B — DiffHighlight component

**File**: ``frontend/src/components/exercises/DiffHighlight.tsx``.

**Renders** a ``DiffToken[]`` as inline coloured text:
- ``equal`` — normal weight, no decoration
- ``delete`` — red background + strikethrough + leading icon
  (e.g. small × marker for colorblind users)
- ``insert`` — green background + leading icon (small +)
- ``replace`` — amber background; user's word struck through,
  expected word inline after with a "→" arrow

**Accessibility**:
- Not color-only — every op also carries a decoration AND
  an icon AND an ``aria-label``.
- Readable at 360px width (mobile floor).
- ``data-testid`` on each token so E2E + Vitest can assert.

**CSS**: add ``.diff-token`` + per-op classes to
``frontend/src/styles/global.css``. Theme-variable based
(no hardcoded colors — per the architecture rule).

**Tests** (F-112): renders all four diff types, accessibility
markers present, mobile width.

**Commit**: ``feat(exercises): visual diff highlighting
component (Phase 52B / v1.35.0 / F-112)``

### 52I — Token-roles in card schema (move forward in cadence)

**Why before 52E**: the cloze generator (52E) can use
``token_roles`` on its first run if 52I lands first.
Otherwise 52I is a no-op refactor of 52E.

**Schema changes**:
- ``schema.py``: ``TokenRole`` enum
  (article/verb/noun/adjective/preposition/gender_marker/
  tense_marker). New ``CardTokenRole`` model with
  ``token: str`` + ``role: TokenRole``. ``Card.token_roles:
  list[CardTokenRole] | None``.
- ``types.ts``: mirror the type union.

**Worked examples** in pilot content (3-4 cards):
- FR ``art-le``, ``art-un`` (Lesson 03) — role:
  ``article``
- ES ``ser-soy``, ``estar-estoy`` (Lesson 04) — role:
  ``verb``

**Tests**: schema validator pins the closed enum; old
cards without ``token_roles`` still validate (optional
field).

**Commit**: ``feat(content): token-roles in card schema
for smarter cloze generation (Phase 52I / v1.35.0 /
P-130)``

### 52C — Wire diff into existing 4 exercise renderers

**Edits**:
- ``FreeTextExercise.tsx``: after wrong answer, render
  ``<DiffHighlight tokens={tokenDiff(input, accept[0])} />``
  below the input. Remove the bare "correct was: X" line.
- ``WordTilesExercise.tsx``: after wrong order, highlight
  which tiles are misplaced (compare user's emitted
  sentence to the canonical from ``tiles``).
- ``MatchingExercise.tsx``: after wrong pair, show the
  correct pairing with the wrong-pair marker. Diff is
  simpler here — render the user's left→right with the
  correct right beneath.
- ``PictureChoiceExercise.tsx``: wrong choice in red,
  correct in green (already partially done — formalise +
  use DiffHighlight's icons for accessibility).
- ``LessonSummary``: per-exercise breakdown shows
  ``<DiffHighlight />`` for each wrong answer.

**Risk**: this commit touches 5 components. If it explodes
(e.g. the LessonSummary breakdown needs a new data model
that isn't already in step_results), STOP and ask.

**Tests** (Q-112): each renderer shows diff on error. Each
renderer's existing tests update to reflect the new
post-wrong-answer surface.

**Commit**: ``feat(exercises): wire diff highlighting into
all 4 exercise feedback surfaces (Phase 52C / v1.35.0 /
Q-112)``

### 52D — Cloze exercise type: schema + renderer + dispatcher

**Schema changes**:
- ``ExerciseType``: add ``CLOZE = "cloze"``.
- ``CURRENT_SCHEMA_VERSION``: "1.0" → "1.1".
- ``Exercise`` model: new optional fields ``sentence``,
  ``blanks``, ``cloze_mode``. ``_enforce_type_specific_fields``
  gets a new branch for CLOZE: ``sentence.count("___") ==
  len(blanks)``, ``cloze_mode`` defaults to ``"type"``,
  ``"select"`` requires non-empty ``distractors``.

**Renderer**:
``frontend/src/components/exercises/ClozeExercise.tsx``.
Two modes:
- ``"type"``: sentence rendered with inline ``<input>`` at
  each blank. Submit validates each blank with
  ``isFreeTextCorrect`` (reused from FreeTextExercise).
- ``"select"``: sentence rendered with ``<select>`` at each
  blank, options drawn from ``distractors`` + the canonical
  accept.

**Element-attempt derivation**:
``deriveClozeAttempts(exercise, perBlankInputs): ElementAttempt[]``
in ``frontend/src/lib/element-attempt.ts``. One
ElementAttempt per blank. ``element_key`` = the
canonical accept of that blank.

**Dispatcher**: extend ``SUPPORTED_EXERCISE_TYPES`` set +
add the ``if (ex.type === "cloze")`` branch in
``ExerciseDispatcher.tsx``.

**Tests**: type mode, select mode, multiple blanks,
partial correct, Levenshtein tolerance per blank, marker-
count mismatch rejected at schema time.

**Commit**: ``feat(exercises): Cloze exercise type — schema
+ renderer (Phase 52D / v1.35.0 / P-127, F-111)``

### 52E — Cloze generator from ElementError records

**File**: ``frontend/src/lib/exercises/cloze-generator.ts``.

**Signature**:
```typescript
function generateClozeFromError(
  error: ElementError,
  sourceExercise: ContentLessonExercise,
  sourceCard: Card | null,
): ContentLessonExercise | null;
```

**Algorithm**:
1. From the error, take ``correct_answer`` and
   ``user_answer``.
2. Find the source sentence:
   - If sourceExercise.type === "free_text" with a
     ``prompt`` that contains the answer → use the prompt
     with the answer replaced by ``___``.
   - If sourceExercise.type === "word_tiles" → join the
     ``tiles`` then blank out the target.
   - Else → return null (generator can't help; review will
     fall back to replay).
3. If sourceCard has ``token_roles`` and one matches the
   error's element_key, blank that token specifically.
4. Build the new cloze exercise:
   - ``accept = [correct_answer, alternative casings]``
   - ``distractors = [user_answer, ...]`` (plus any
     accept-list entries from the source exercise that
     weren't the canonical)
   - ``cloze_mode = "type"`` (deterministic; select-mode
     requires authoring a longer distractor list).

**Deterministic**: same input → same output. No
randomness, no AI. Pin in tests (Q-111).

**Tests**: generation from free_text source, from
word_tiles source, from matching/picture_choice → null,
distractor quality (user's wrong answer always present).

**Commit**: ``feat(exercises): cloze generator from
ElementError records (Phase 52E / v1.35.0 / P-127, Q-111)``

### 52F — Correction block at lesson end

**File**:
``frontend/src/components/exercises/CorrectionBlock.tsx``.

**Wired into**: ``LessonSummary`` component (or wherever
the lesson-end summary lives — find via
``grep -rn "lesson.summary" frontend/src/``).

**Behaviour**:
- Reads the lesson's ``step_results`` for wrong attempts.
- For each wrong attempt, looks up the matching
  ``ElementError`` record (just-written by the lesson) +
  calls ``generateClozeFromError``.
- Surfaces 2-5 generated clozes (cap configurable).
- Renders ``<CorrectionBlock />`` BETWEEN score display
  and action buttons.
- ONLY appears when there are errors. Perfect-score
  lessons skip the block entirely.
- User can skip (Next Lesson button stays visible).
- On completion: re-record ElementAttempts (each blank
  → one attempt). ``correct_streak`` advances toward
  mastery. Show "${N} elements improved" with i18n.

**i18n keys**:
- ``lesson.correction.title`` — "Correction round" /
  "Korrektur-Runde"
- ``lesson.correction.skip`` — "Skip"
- ``lesson.correction.improvement`` — "{n} element
  improved" / "{n} elements improved" (plural variants)

**Tests** (P-128): block appears on errors, hidden on
perfect score, exercises target actual errors, skip
works, results update mastery.

**Commit**: ``feat(lesson): correction block with
auto-generated cloze exercises (Phase 52F / v1.35.0 /
P-128, F-113)``

### 52G — Cloze in review sessions

**File**: ``frontend/src/lib/review-lesson.ts`` (extend
the existing ``synthesizeReviewLesson``).

**New helper**:
```typescript
function _buildReviewStep(
  item: ReviewQueueItem,
  sourceLesson: ContentLesson | undefined,
): ContentLessonStep | null;
```

**Logic** (per Decision 5):
- Look up source exercise via
  ``sourceLesson.steps[].exercise.id``.
- If type is free_text or word_tiles → try
  ``generateClozeFromError`` (with the matching
  ``ElementError`` from the queue item). On success,
  emit cloze step. On failure, fall through.
- If type is matching/picture_choice, OR cloze generation
  failed → replay the original (existing behaviour).

**Tests**: queue with mixed source types produces mixed
review steps; cloze-generation failure falls back to
replay; pure-replay still works for matching-only queues.

**Commit**: ``feat(lesson): cloze exercises in review
sessions (Phase 52G / v1.35.0)``

### 52H — Hand-authored cloze in pilot content

Add cloze exercises to the existing pilot lessons (NOT
new lessons — extend existing ones):

- **FR A1 Lesson 03** (Articles) — add a cloze step:
  "Je vois ___ chat" (accept: "un", distractors: ["le",
  "la", "les"])
- **FR A1 Lesson 04** (Être/Avoir) — add a cloze step:
  "Elle ___ une amie" (accept: "a", distractors:
  ["est", "as", "ont"])
- **ES A1 Lesson 04** (Ser/Estar) — add a cloze step:
  "Yo ___ estudiante." (accept: "soy", distractors:
  ["estoy", "es", "está"])

Bump the set manifests' versions (fr: 1.1.0 → 1.2.0,
es: 1.0.0 → 1.1.0). Add the new step IDs to the lesson's
``steps[]`` arrays. Pilot-content parametrized pytest
picks it up automatically.

**Commit**: ``content: add hand-authored cloze exercises
to pilot lessons (Phase 52H / v1.35.0)``

### 52J — Docs + verification + release prep

**Docs to update**:
- ``docs/help/{en,de}/user-guide/...`` — cloze, correction
  block, diff highlighting (3 new user-facing concepts).
- ``docs/help/{en,de}/developer/authoring-content.md`` —
  cloze exercise format + token_roles + cloze_mode + the
  ``___`` marker convention.
- ``docs/help/{en,de}/developer/lessons-and-srs.md`` —
  cloze in review sessions, generator architecture.
- ``docs/help/_meta.yaml`` + ``mkdocs.yml`` if new pages
  ship.
- ``CLAUDE.md`` — version + test counts.

**Verification scenarios** (manual smoke before tag):
1. Complete a lesson with errors → diff highlighting
   shows on wrong answers
2. Lesson summary → correction block appears with cloze
3. Complete correction block → element mastery updates
4. Review session includes cloze for failed elements
5. Hand-authored cloze in pilot content works
6. All works in Dexie mode (run
   ``make test-dexie-smoke``)

**Commit**: ``docs: Phase 52 — token-diff + cloze user +
developer documentation (Phase 52J / v1.35.0)``

### R1 — Version bump + tag

Standard release-workflow.md flow:
- ``backend/pyproject.toml``: ``1.34.0`` → ``1.35.0``
- ``make sync-versions`` (propagates to 18 files)
- ``changelog/releases/v1.35.0.md`` (new — author from
  the changelog template + the 52A-J commit summaries)
- Commit: ``chore(release): bump version to v1.35.0``
- ``git tag -a v1.35.0 -m "Release v1.35.0 — Phase 52:
  Token-Diff + Cloze Exercise Type"``

### R2 — Post-release docs

- ``CLAUDE.md`` current-state header rewritten for
  v1.35.0; v1.34.0 demoted to second paragraph.
- ``docs/journal/handover-to-v1.36.0.md`` written.
- Commit: ``docs: post-release v1.35.0 documentation
  update``

---

## 5. Risks + edge cases (the next session should preempt)

### 5.1 Dexie smoke flake (vite-preview ECONNREFUSED race)

Already documented in the v1.34.0 handover § 4.2 and again
in v1.34.0's pre-release retro. Re-runs cleanly. Pattern:
the static-asset server hasn't fully started when Playwright
tries to connect. Treat as flaky-not-broken; re-run before
declaring a regression. NOT in scope to fix here.

### 5.2 Schema bump compatibility

When v1.34.0 apps fetch a v1.35.0-bundled lesson with cloze,
they'll fail Pydantic validation on the unknown ExerciseType.
Two layers of protection:
- The ``is_supported_schema_version`` major-match means the
  manifest itself loads fine; the failure is at the per-
  exercise level.
- The schema docstring (line 21) anticipates this exactly.

But for the **bundled content** path (Phase 51D —
``frontend/public/content/``): the bundled pilot content
ships ALONGSIDE the app. The v1.35.0 build bundles v1.1
lessons + ships a v1.1-capable app. No version mismatch in
the bundled path. The risk only applies to external content
sources that ship v1.1 content to v1.0 apps.

**Action**: 52D should add a Vitest pinning that v1.1
lessons fail to load on a v1.0 schema (negative test) +
that v1.0 lessons still load on a v1.1 schema (positive
forward-compat test).

### 5.3 ``isFreeTextCorrect`` is exported from FreeTextExercise.tsx

It lives in a .tsx file rather than a .ts. Importing from a
.tsx file works under Vite but is unusual. Cloze renderer
(52D) imports it for per-blank validation. Verify Vitest
resolves the import correctly; if not, extract the helper
into ``frontend/src/lib/exercises/free-text-validator.ts``
in a small precursor change (still inside 52D's commit).

### 5.4 Element-attempt deriver naming

There are existing ``derive{Type}Attempt`` helpers in
``frontend/src/lib/element-attempt.ts``. The new helper for
cloze emits MULTIPLE attempts per exercise, not one. Name it
``deriveClozeAttempts`` (plural). Pin the contract in
tests.

### 5.5 Correction block + ElementError race

When the lesson completes, ``recordBulk`` writes the
ElementError rows. The correction block (52F) reads them
immediately. In Dexie mode this is in-process, no race. In
API mode the write returns the updated records — make sure
the correction block reads the RETURN VALUE, not a
follow-up GET (otherwise eventual consistency could miss
the latest write).

### 5.6 Pilot content version bumps

When 52H adds cloze to existing lessons, the set version
must bump (per Phase 51's lock-step rule). The content-
loader does a version-reconciled cache invalidation — old
cached copies will refresh automatically.

The fr-a1 set is at 1.1.0; 52H bumps to 1.2.0. The es-a1
set is at 1.0.0; 52H bumps to 1.1.0.

### 5.7 Backend mirror for cloze schema

The schema change touches the Pydantic model. The cloze
validator (``_enforce_type_specific_fields``) is a single
function — easy edit. Don't forget:
- Backend mypy passes after the change.
- Backend tests cover the new branch
  (``plugins/.../tests/``).

### 5.8 Token-roles closed enum

``TokenRole`` is a closed Pydantic enum. Adding a category
later (e.g. ``pronoun``) is a minor schema bump.
v1.35.0 ships with the seven from Decision 6. Document the
closed-enum-bump-protocol in the schema docstring so future
contributors know it's not free-form.

### 5.9 Cloze generator ``card_ids`` referential integrity

When the generator emits a cloze, the new exercise's
``card_ids`` must reference cards that exist in the LESSON
the cloze will be inserted into (correction block) OR in
the SYNTHESIZED REVIEW LESSON (which has empty ``cards``).
The schema validator enforces this AT VALIDATION TIME, but
the generator runs at runtime AFTER validation. Two
options:
- Generated cloze omits ``card_ids`` entirely (empty
  array — schema allows).
- Generator preserves the original element's card_id (if
  the SourceCard parameter is provided).

**Decide at generator-write time**. Empty array is the
simpler default; preserve the card_id when available so
SRS tracking continues threading the same element.

---

## 6. Kickoff prompt for the next CC session

Paste this verbatim at the start of the next session:

```text
Phase 52: v1.35.0 — EXP-007 Token-Diff + Cloze Exercise Type.

Read first:
1. CLAUDE.md
2. .claude/rules/ (all files)
3. docs/journal/handover-to-v1.35.0.md (THIS FILE — contains the locked
   plan + 7 decisions + 11-commit cadence; do NOT re-decide)
4. changelog/releases/v1.34.0.md (what just shipped)

Pre-flight: make test + npm run build + npm run test +
make test-dexie-smoke. All must be green. Baseline to match:
backend 1002 (+1 skipped) + plugins 881 + Vitest 1896 = 3779
+ Dexie 18/18. The Dexie gate occasionally flakes once on a
vite-preview startup race; re-run is deterministic.

After pre-flight, execute the 11-commit plan from § 4 of
the handover IN ORDER. Recommended cadence (re-stated from
the handover):
  52A → 52B → 52I → 52C → 52D → 52E → 52F → 52G → 52H → 52J → R1 → R2

Atomic-green-commit discipline: every commit individually
green through the full pre-flight gate chain. If a sub-phase
explodes in scope (e.g. 52C wiring-into-existing-exercises
needs more than just the diff component), STOP and surface
before silently extending.

Open decisions: NONE. The handover § 2 locked all seven.
Re-litigating is out of scope unless evidence in the code
forces a revision — in that case STOP and surface.

After R2, push origin main --tags + gh release create
v1.35.0.

Begin with pre-flight, then 52A.
```

---

## 7. Carry-over candidates (still open, NOT part of v1.35.0)

These were on the v1.34.0 → v1.35.0 candidate list but the
user picked Phase 52 instead. They stay open for v1.36.0+:

- **§ 2.1** — Picture-choice illustration assets. All 15
  pilot lessons reference image paths but the files don't
  exist. Renderer uses labelled fallback. Asset creation is
  pure content polish; defer.
- **§ 2.2** — Generic plugin-settings UI
  (D-plugin-settings-ui). Carry-over from v1.33.0 +
  v1.34.0. Three plugins have config that would benefit
  (gamification, content-loader, session).
- **§ 2.3** — EXP-013 Adaptive Lektionen Stufe 3.
  Per-element grouping in review, dashboard viz, AI hints.
- **§ 2.4** — A2 / B1 lessons (community + extension).
  Suggested concrete next step: ship a German A1 (~5
  lessons) pilot to prove the format across multiple
  languages.
- **§ 2.5** — Set Browser source-config UI. Edit
  ``DEFAULT_SOURCES`` from Settings instead of hardcoded
  YAML/TS constants.
- **§ 2.6** — Real picture-choice images for ONE pilot
  lesson (scoped version of § 2.1).

---

## 8. Pre-flight discipline (the gate chain)

Unchanged from v1.31.0..v1.34.0. Every commit:

```bash
make test                            # backend + plugins + Vitest
cd backend && poetry run mypy app/   # mandatory
cd backend && poetry run pre-commit run --all-files   # mandatory
# For commits touching the Dexie path (schema, renderer,
# IStorageService consumer):
make test-dexie-smoke                # Dexie release gate (re-run on flake)
cd frontend && npx tsc --noEmit      # TypeScript strict
# For release commits:
cd frontend && npm run build         # production bundle
```

If ANY gate fails: stop, investigate, fix. Don't proceed
with stacked broken commits — the atomic-green-commit
discipline is what makes bisect useful.

---

## 9. Files of interest (the quick-jump map)

For 52A (token-diff) — pure new file:
- ``frontend/src/lib/exercises/token-diff.ts`` (new)
- ``frontend/src/lib/exercises/token-diff.test.ts`` (new)

For 52B (DiffHighlight):
- ``frontend/src/components/exercises/DiffHighlight.tsx`` (new)
- ``frontend/src/components/exercises/DiffHighlight.test.tsx`` (new)
- ``frontend/src/styles/global.css`` (extend with
  ``.diff-token`` + per-op classes)

For 52I (token-roles):
- ``plugins/.../content-loader/schema.py`` (add ``TokenRole``
  enum + ``CardTokenRole`` model + field on Card)
- ``frontend/src/storage/types.ts`` (mirror)
- ``docs/explorations/sample-content/fr-a1/sets/.../lessons/
  03-articles.json`` (add token_roles to art-le + art-un)
- ``docs/explorations/sample-content/es-a1/sets/.../lessons/
  04-ser-estar.json`` (add token_roles to ser-soy +
  estar-estoy)

For 52C (wire diff):
- ``frontend/src/components/exercises/FreeTextExercise.tsx``
- ``frontend/src/components/exercises/WordTilesExercise.tsx``
- ``frontend/src/components/exercises/MatchingExercise.tsx``
- ``frontend/src/components/exercises/PictureChoiceExercise.tsx``
- ``frontend/src/components/exercises/LessonSummary.tsx``
  (grep to confirm exact path)
- Each renderer's existing ``*.test.tsx`` updates

For 52D (cloze):
- ``plugins/.../content-loader/schema.py`` (extend
  ``ExerciseType`` + new fields + validator branch)
- ``frontend/src/storage/types.ts`` (mirror)
- ``frontend/src/components/exercises/ClozeExercise.tsx`` (new)
- ``frontend/src/components/exercises/ClozeExercise.test.tsx`` (new)
- ``frontend/src/components/exercises/ExerciseDispatcher.tsx``
  (extend ``SUPPORTED_EXERCISE_TYPES`` + add branch)
- ``frontend/src/lib/element-attempt.ts`` (add
  ``deriveClozeAttempts``)

For 52E (generator):
- ``frontend/src/lib/exercises/cloze-generator.ts`` (new)
- ``frontend/src/lib/exercises/cloze-generator.test.ts`` (new)

For 52F (correction block):
- ``frontend/src/components/exercises/CorrectionBlock.tsx`` (new)
- ``frontend/src/components/exercises/CorrectionBlock.test.tsx`` (new)
- LessonSummary integration (grep to find)
- 8 i18n catalogs:
  ``backend/config/i18n/{de,en,es,fr,el,pt,tr,ja}.yaml``

For 52G (review):
- ``frontend/src/lib/review-lesson.ts`` (extend
  ``synthesizeReviewLesson``)
- ``frontend/src/lib/review-lesson.test.ts``

For 52H (pilot content):
- ``docs/explorations/sample-content/fr-a1/sets/.../lessons/
  03-articles.json`` (add cloze step)
- Same for 04-etre-avoir + es-a1/05-restaurante (wait,
  Decision says ES A1 Lesson 04 — ser-estar, not
  restaurante. Use ser-estar.)
- Set manifest version bumps (fr 1.1.0 → 1.2.0, es 1.0.0 →
  1.1.0)
- The pilot-content parametrized pytest picks up new
  exercises automatically — verify after the JSON edits.

---

End of handover. Total Phase 52 scope: ~9 source commits +
2 release commits = 11 commits. Estimated session
size: 2-3× Phase 51. The plan is locked; the next session
executes.
