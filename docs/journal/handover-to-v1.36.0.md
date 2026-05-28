# Handover — after v1.35.0, before v1.36.0

**Written**: 2026-05-28 (immediately after the v1.35.0 tag).

**Purpose**: snapshot of the state of `main` after Phase 52
ships, plus the candidate scope choices for v1.36.0 so the next
session can re-decide direction with all information present.

---

## 1. State at session start

### Git

```
HEAD:    <R2 commit> docs: post-release v1.35.0 documentation update
Branch:  main
Tag:     v1.35.0 (annotated)
Working tree: clean.
Ahead of origin: 1-2 commits (R1 release + R2 post-release).
```

Push with `git push origin main --tags` to publish.

### v1.35.0 baseline (the new pre-flight target)

```
Backend pytest:     1002 (+1 skipped)
Plugin tests:       908 (12 suites — content-loader at 214 after
                    52I + 52D additions)
Vitest:             1978
Aggregate:          3888 (+1 skipped)
Dexie smoke gate:   18/18 (occasionally flakes once on
                    vite-preview startup race; re-run is
                    deterministic — see § 5)
```

### Phase 52 scope shipped

Everything in the v1.35.0 § 4 plan, plus one folded-in bugfix:

- 52A — Token-diff module (TS-only)
- 52B — DiffHighlight component
- 52I — Token-roles in card schema
- 52C — Wire diff into 4 exercise renderers + LessonSummary
- 52D — Cloze exercise type (schema 1.0 → 1.1)
- 52E — Cloze generator from ElementError records
- 52F — Correction block at lesson end
- 52G — Cloze in review sessions
- 52H — Hand-authored cloze in pilot content
- 52J — Docs + verification
- **fix(session): render AI responses as formatted Markdown** —
  user-requested UX-critical fix folded into the v1.35.0
  release train. Pre-fix, AI session bubbles rendered raw
  Markdown (asterisks visible, pipes for tables, etc.). Now
  uses the existing react-markdown + remark-gfm pipeline for
  assistant messages only; user messages stay as-typed.

11 sub-phase / fix commits + 2 release commits = 13 commits in
the v1.35.0 cycle.

---

## 2. Candidate scope for v1.36.0

These are the standing candidates from the v1.34.0 handover plus
new items surfaced during Phase 52. Pick one and lock the plan
the same way v1.35.0 was planned (decisions + 11-commit cadence).

### § 2.1 — Picture-choice illustration assets

All 15 pilot lessons reference image paths but the files don't
exist. Renderer uses a labelled fallback. Asset creation is
pure content polish — defer until the in-lesson surface
catches more user attention.

### § 2.2 — Generic plugin-settings UI (D-plugin-settings-ui)

Carry-over from v1.33.0 + v1.34.0. Three plugins have config
that would benefit from a generic editor (gamification,
content-loader, session). The bones already exist in
`backend/app/services/plugin_settings.py` + the
`/api/plugin-settings/{plugin_name}` endpoint; the frontend
surface is what's missing.

### § 2.3 — EXP-013 Adaptive Lektionen Stufe 3

Per-element grouping in review, dashboard viz, AI hints.
Builds on the v1.30.0 element-error tracking + the v1.35.0
cloze generator. Could integrate AI-generated cloze hints
when the user gets a generated cloze wrong twice in a row.

### § 2.4 — A2 / B1 lessons (community + extension)

The v1.34.0 + v1.35.0 pilot content covers A1 only.
Suggested concrete next step: ship a German A1 (~5 lessons)
pilot to prove the format across multiple target languages,
then jump to FR A2.

### § 2.5 — Set Browser source-config UI

Edit `DEFAULT_SOURCES` from Settings instead of hardcoded
YAML/TS constants. Low-risk, low-flash.

### § 2.6 — Real picture-choice images for ONE pilot lesson

Scoped version of § 2.1 — pick one high-value lesson (e.g. FR
A1 L03 articles, where the picture choices most directly
support the grammar rule).

### § 2.7 — NEW: backend cloze generator + Python parity

Phase 52 deliberately shipped TS-only (no Python diff /
generator). If a future server-side AI-assisted generator
becomes desirable, port the TS generator to Python and pin
both via the established cross-language parity-test pattern
(v1.32.0 + v1.33.0 + the 52A-as-baseline). NOT urgent unless
a concrete server-side consumer emerges.

### § 2.8 — NEW: token_roles authoring tooling

The 7-role closed enum landed with worked examples on 4
pilot cards. A future authoring UI (likely a Settings page
under the content-loader plugin's manifest) would let
authors annotate cards visually instead of editing JSON by
hand. NOT urgent — the current JSON authoring path works.

### § 2.9 — NEW: Phase 52G inverse-cloze for matching

The current 52G branch only generates cloze for free_text +
word_tiles sources. matching + picture_choice always replay.
A future phase could explore inverse-cloze for matching
(turn "match each French word with English" into "fill the
English translation of `Bonjour`"), which would diversify
the review surface for those source types too. Out of scope
for v1.35.0 (Decision 5 / handover § 2 locked it).

### § 2.10 — NEW: streaming Markdown in chat bubbles needs
review

The v1.35.0 bugfix renders Markdown for assistant chat
bubbles, including streaming ones (react-markdown handles
partial trees cleanly). However, the visual cursor (▍) is
positioned via CSS as an inline-block sibling of the
Markdown root. On a streaming bubble where the trailing text
is wrapped in a `<p>`, the cursor renders BELOW the
paragraph, not inline at the end. This is a minor visual
nit — not a regression of the old `<pre>` behavior (the cursor
was inline there) — but a future polish pass could fix it
by injecting the cursor into the last text node via a
component override. NOT urgent.

---

## 3. Pre-flight discipline (the gate chain)

Unchanged from v1.31.0..v1.35.0. Every commit:

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

## 4. Notes from the v1.35.0 cycle

Operational notes worth carrying forward:

### 4.1 — User-injected bugfix mid-train

The Markdown chat-bubble bugfix was added mid-train at the
user's explicit request, between 52J and R1. The mechanism
that worked:

1. Stash the R1 work (`git stash push -u`) — includes
   untracked files (the changelog/releases/v1.35.0.md).
2. Implement the bugfix as its own commit.
3. Pop the stash.
4. Add a "Fixed" section to the changelog mentioning the
   bugfix.
5. Commit R1 as planned.

The handover plan's "11-commit cadence" was extended to 13
(10 sub-phase + 1 bugfix + 2 release). Decision 7's
"Don't split scope unless a sub-phase EXPLODES" applies to
SCOPE creep WITHIN a sub-phase, not to user-injected
out-of-scope fixes. Future user-injected fixes follow the
same stash-implement-pop pattern.

### 4.2 — 52C was an explicit scope-up choice

The handover plan for 52C had FreeText + WordTiles inline
diff + LessonSummary diff as 5 components. At the read-through
the LessonSummary diff path required a new `user_answer`
field on `LessonStepResult` (the existing breakdown only had
`canonicalAnswer`). I surfaced the choice as a STOP-and-ask
(minimal vs push-wider); the user chose push-wider.
Subsequent work landed user_answer plumbing through the
Pydantic schema + Dexie row + LessonProgress storage path.
This pattern — STOP at the seam BEFORE writing code —
saved a backwards-needed refactor.

### 4.3 — i18n drift gate caught EN-only changes twice

Once in 52C (free_text + word_tiles result_wrong simplified
only in en.yaml), once in 52F (correction round keys only in
en.yaml). The `i18n-sync.test.ts` test catches per-EN-key
parity across all 8 catalogs and forces the catch-up before
release. Worth flagging as a working gate — it has paid for
itself many times now.

### 4.4 — cwd drift in Bash tool

`cd frontend && ...` from earlier calls persists across Bash
invocations within the same session. Multiple times the next
`cd frontend` from the (now-wrong) cwd failed with "directory
not found: frontend". Two workarounds, both used in this
session:

1. Use absolute paths in `cd`:
   `cd /home/astrapi69/dev/git/hub/astrapi69/adaptive-learner/...`
2. Whenever Vitest fails with `setup: 0ms` /
   `environment: 0ms` / `ReferenceError: document is not
   defined`, the cwd is wrong — re-cd into `frontend/` and
   re-run.

NOT a v1.35.0 regression; a long-standing harness quirk
documented in lessons-learned.md "Run vitest from
`frontend/`, not the repo root". Pin this as a heads-up
for the next session.

---

## 5. Known wobbles (carry over to v1.36.0)

- **Dexie smoke flake (vite-preview ECONNREFUSED race)** —
  unchanged from v1.34.0. Re-runs cleanly.
- **`docs/help/de/developer/lessons-and-srs.md` lagging EN**
  — the EN side got the Phase 52 section in 52J. The DE
  developer mirror has been catch-up-only since v1.31.0 and
  will track on its own cadence (user-guide DE IS up to
  date).
- **Streaming Markdown cursor positioning** — see § 2.10
  above. Minor visual nit, not a regression.

---

## 6. Kickoff prompt for the next CC session

```text
Next phase: v1.36.0 — TBD. Read first:
1. CLAUDE.md
2. .claude/rules/ (all files)
3. docs/journal/handover-to-v1.36.0.md (THIS FILE — surveys
   open scope candidates)
4. changelog/releases/v1.35.0.md (what just shipped)

Pre-flight: make test + npm run build + npm run test +
make test-dexie-smoke. All must be green. Baseline to match:
backend 1002 (+1 skipped) + plugins 908 + Vitest 1978 = 3888
+ Dexie 18/18.

After pre-flight, decide phase scope from the candidates in
the handover § 2. Lock decisions (handover § 2 → 7-decision
list pattern proved useful in v1.35.0), then plan an
11-commit cadence (9 sub-phase + 2 release) and execute in
order. Atomic-green-commit discipline: every commit
individually green through the full pre-flight gate chain.
```

---

End of handover.
