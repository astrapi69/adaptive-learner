# Handover — after v1.34.0, before v1.35.0

**Written**: 2026-05-28 (end of Phase 51 session).

This document is the cold-pickup brief for the next session.
Anyone (or any model) reading this should be able to start work
on v1.35.0 without needing the prior conversation context.

---

## 1. What just shipped: v1.34.0

**Phase 51 — Content Expansion: French A1 + Spanish A1 +
GH-Pages bundling**. First release where Adaptive Learner ships
a real learning experience out of the box. v1.27.0 (Phase 43)
shipped the content-loader infrastructure; this release fills
it with 15 A1-level lessons + bundles them into the GH-Pages
build.

Full per-release detail: ``changelog/releases/v1.34.0.md``.

### Test counts (the new baseline)

```
Backend pytest:     1002 (+1 skipped)
Plugin tests:       881 (12 suites; +31 from Phase 51A
                    pilot-content tests)
Vitest:             1896 (+1 from Phase 51D bundled-URL test)
Aggregate:          3779 (+1 skipped)
Dexie smoke gate:   18/18
```

### What landed (6 atomic + 1 release + 1 post-release)

- **51A** — French A1 lessons 3-10. 8 new pedagogically
  progressive lessons covering articles, être/avoir,
  self-introduction, family, colors+clothing, restaurant,
  directions, passé composé. ~270 lines JSON each. New
  parametrized pytest discovers + validates every lesson via
  glob. +31 pytest.
- **(bugfix)** — Session + lesson headers show topic / set
  context. Session.tsx: new ``project`` state + ``Topic: ___``
  line. Lesson.tsx: new ``setTitle`` state + ``Set: ___``
  line. New i18n keys ``session.topic_label`` +
  ``lesson.set_label`` in all 8 catalogs.
- **51B** — Spanish A1 pilot set (5 lessons): greetings,
  numbers+time, articles+gender, ser/estar (with worked
  decision rule), restaurant. ~280 lines JSON per lesson.
  +10 pytest.
- **51C** — Content authoring guide (EN + DE) under
  ``docs/help/{en,de}/developer/authoring-content.md``, wired
  into _meta.yaml + mkdocs.yml. ~250 lines per language.
- **51D** — Build-time bundling. ``copy-bundled-content.mjs``
  script + predev/prebuild npm hooks +  ``bundled:`` source
  prefix handling in ``content-loader-dexie.ts``.
  ``DEFAULT_SOURCES`` updated: bundled pilots first, GitHub
  upstream as fallback. +1 Vitest pinning the URL contract.
- **release** — version bump + ``make sync-versions`` (18
  files) + changelog + tag ``v1.34.0`` (annotated).
- **post-release** (this commit) — CLAUDE.md + this handover.

---

## 2. What's open: candidates for v1.35.0

The v1.34.0 release closes the content gap that v1.31.0–v1.33.0
left open. The next session's candidate list:

### 2.1 Picture-choice illustration assets (carry-over)

All 15 lessons reference image paths like
``assets/img/water-tap.png`` for picture-choice exercises;
those image files don't exist. The renderer falls back to the
text label — picture-choice exercises function but look like
labelled-button choices. Real illustrations would make the
exercises visually distinct from matching/multiple-choice.

Options:
- **(a)** Hand-curated SVG icons. ~30-50 SVGs of design work.
  Stable, scalable, small.
- **(b)** AI-generated images (Stable Diffusion / DALL-E /
  Imagen). Faster to produce, larger file sizes, copyright +
  consistency questions.
- **(c)** Public-domain photo curation from sources like
  Wikimedia or Unsplash. Real but requires careful attribution
  + topic matching.

This is content polish, not infrastructure — defer until the
core experience has more users complaining about it.

### 2.2 Generic plugin-settings UI (D-plugin-settings-ui)

Still open from the v1.33.0 + v1.34.0 handovers. The
``LearningRepoSettingsSection`` is the only component using the
``pluginSettings`` namespace. Three plugins have config that
would benefit from a generic settings form (gamification,
content-loader, session). A typed-defaults JSON schema → form
generator would turn the new namespace into a real platform
feature.

### 2.3 EXP-013 Adaptive Lektionen Stufe 3 (carry-over)

Same as the v1.33.0 handover. Stufe-3 work beyond the v1.30.0
SRS foundation:
- Per-element grouping in the review session.
- Per-element progress visualisation on the Dashboard.
- AI-assisted hints when the same element fails 5+ times.

### 2.4 A2 / B1 lessons (community + extension)

The v1.34.0 pilot sets are A1-only. A2-level lessons (passé
composé deepening, subjunctive intro, more verb tenses) would
extend the experience. The Phase 51C authoring guide is
designed exactly for this kind of community contribution.

Practical next step: ship a third pilot — German A1 (~5
lessons) — to prove the format scales across multiple Western
languages + demonstrate to potential contributors that the
authoring workflow is real.

### 2.5 Set Browser source-config UI

The content-loader's ``default_sources`` are currently
hardcoded in YAML (API mode) and in the Dexie module's
``DEFAULT_SOURCES`` constant. A user-facing UI for adding /
removing content sources (e.g. "add my own GitHub repo") is
the obvious next ergonomic feature now that bundled + remote
sources both work.

### 2.6 Real picture-choice images for a single pilot

A scoped version of § 2.1: pick ONE lesson (say, FR Lesson
03 — articles), commission 4-5 real images for its picture-
choice exercises, ship them. Demonstrates the asset pipeline
+ shows what the experience looks like with real images.
Lighter-weight than a full set-wide rollout.

---

## 3. Architectural decisions still in force

Phase 51 added two:

| ID | What | Status |
|----|------|--------|
| **D-CONTENT-BUNDLING** | Bundled pilot content as static assets under ``frontend/public/content/``, copied at build time from ``docs/explorations/`` | **NEW** (Phase 51D). Bundle is a derived artefact + gitignored; canonical source stays in ``docs/``. |
| **D-BUNDLED-PREFIX** | Source identifiers can carry a ``bundled:`` prefix. ``rawUrl()`` dispatches: prefix → static-asset path, no prefix → ``raw.githubusercontent.com`` | **NEW** (Phase 51D). Minimal API surface change. |

Carry-over from v1.33.0 handover (still open):

| ID | What | Status |
|----|------|--------|
| **D-plugin-settings-ui** | Generic plugin-settings UI | Still open. See § 2.2. |

---

## 4. Gotchas + recurring false positives

Most of the IDE static-analysis false positives from prior
handovers still apply. Pattern unchanged.

### 4.1 IDE static-analysis false positives (ignorable)

| Diagnostic | Reality |
|---|---|
| `pytest`: Cannot find module | Backend venv issue. Tests run fine via `make test*`. |
| `sqlalchemy` / `sqlalchemy.orm`: Cannot find module | Same. |
| `alembic` / `alembic.config`: Cannot find module | Same. |
| `app.models` / `app.database` (in plugin code) | Plugin runs inside the backend venv at runtime where backend's `app.*` is on sys.path. |

### 4.2 Real footguns surfaced this session

1. **card_ids referential integrity**: every
   ``exercise.card_ids[i]`` must exist in the parent lesson's
   ``cards[]`` list. Easy to forget when copy-pasting an
   exercise between lessons — the source lesson's card
   doesn't follow automatically. The schema validator catches
   this at ``make test`` time (clear error message); the
   pitfall is the time spent debugging when validation fails
   in CI but not locally because the locally-run pytest
   subset didn't include the broken file.
2. **Vite ``BASE_URL`` for bundled sources**: the GH-Pages
   build sets ``VITE_BASE=/adaptive-learner/`` which becomes
   ``import.meta.env.BASE_URL``. The bundled-URL resolver
   MUST prepend this — otherwise the static assets 404 on
   the GH-Pages deployment. Tested via the Dexie smoke gate.
3. **predev / prebuild npm hooks**: the copy-bundled-content
   script runs as ``predev`` AND ``prebuild`` so both dev
   server + production build pick up the latest content.
   Forgetting either hook means stale bundled content in
   that mode. Pinned by ``make test-dexie-smoke`` (which
   runs ``npm run build`` end-to-end).
4. **Picture-choice ``is_correct`` is a string, not a bool**:
   the schema specifically requires ``"true"`` because the
   picture_choice ``images`` field is ``list[dict[str, str]]``
   under the hood. Authors who write ``"is_correct": true``
   (JSON boolean) get a validation error. Documented in the
   Phase 51C authoring guide.
5. **Vite preview ECONNREFUSED race**: the Dexie smoke
   occasionally fails on a fresh process when the
   ``vite preview`` server hasn't fully started by the time
   Playwright tries to connect. Re-running the gate is the
   workaround; the failure is purely a startup timing issue,
   not a real regression. Not introduced this release but
   surfaced again on the fresh-checkout side.

### 4.3 Discipline reinforced

- **Iterative preview saves rework**: the user requested a
  full-lesson preview of FR Lesson 03 before committing to
  all 13 lessons. ~20 minutes of preview work + review;
  after sign-off, the other 12 lessons followed the same
  template. The alternative (writing all 13 lessons before
  any review) would have risked rewriting most of them if
  the style or structure had been off.
- **Glob-based test discovery beats explicit lists**: the
  new ``test_pilot_content.py`` finds every JSON via
  ``glob("*/sets/*/lessons/*.json")`` and parametrizes the
  test. Adding a new lesson picks up automatically; no test
  edit needed. Same pattern as Phase 49F's parity-fixture
  goldens.

---

## 5. State at end of session

### Git

```
HEAD:    <post-release commit> docs: post-release v1.34.0
Tag:     v1.34.0 (annotated, NOT YET pushed at the time of writing)
Branch:  main, ahead of origin/main by 8 commits + 1 tag
Clean working tree.
```

The user has NOT been asked to push yet. Pattern from prior
releases: post-release commit → user authorizes push +
``gh release create``. The release notes for
``gh release create`` are ``changelog/releases/v1.34.0.md``.

### Recent commits (latest 8)

```
<this commit>    docs: post-release v1.34.0 documentation update
996c2db chore(release): bump version to v1.34.0
36fe4f7 feat(content): default sources + bundled pilot content for GH Pages (Phase 51D / v1.34.0)
39821d6 docs: content authoring guide for lesson creators (Phase 51C / v1.34.0)
df3daa6 content(es-a1): Spanish A1 pilot set — 5 lessons (Phase 51B / v1.34.0)
8861322 fix(session): show topic and lesson title in session header (Phase 51 / v1.34.0)
952cb4d content(fr-a1): 8 new lessons (articles through passé composé) (Phase 51A / v1.34.0)
c6dff91 docs: post-release v1.33.0 documentation update
```

### Files of interest for v1.35.0

#### For more content (§ 2.4)

- ``docs/help/en/developer/authoring-content.md`` — the
  authoring guide. Anyone (including future Claude sessions)
  authoring lessons should read this end-to-end.
- ``docs/explorations/sample-content/fr-a1/sets/language-fr-a1/lessons/03-articles.json``
  — the canonical reference lesson. Style + structure
  approved by the user; subsequent lessons match its shape.
- ``frontend/scripts/copy-bundled-content.mjs`` — the
  ``BUNDLED_SETS`` constant. Adding a new bundled set
  requires adding its key here + creating the directory
  under ``docs/explorations/sample-content/``.

#### For picture-choice assets (§ 2.1 + § 2.6)

- ``docs/explorations/sample-content/{fr-a1,es-a1}/sets/{set-id}/assets/img/``
  — directories don't exist yet; the picture-choice
  exercises reference these paths but the files are missing.
- The renderer code at
  ``frontend/src/components/lesson/`` (specifically the
  picture-choice dispatcher) — already handles missing
  images via the labelled fallback. No code change needed
  to ADD assets; just drop them in.

#### For the plugin-settings UI (§ 2.2)

- ``frontend/src/components/LearningRepoSettingsSection.tsx``
  — the prototype.
- ``frontend/src/data/plugin-config/*.json`` — type-
  inferrable defaults (5 plugins shipped).

---

## 6. Pre-flight discipline (the gate chain)

Unchanged from v1.31.0..v1.34.0. Every commit:

```bash
make test                            # backend + plugins + Vitest
cd backend && poetry run mypy app/   # mandatory
cd backend && poetry run pre-commit run --all-files   # mandatory
# For release commits / Dexie-affecting commits, additionally:
make test-dexie-smoke                # Dexie release gate
cd frontend && npm run build         # production build
cd frontend && npx tsc --noEmit      # TypeScript check
```

---

## 7. Cold-pickup checklist for the next session

Run these in order before any code:

```bash
# 1. Confirm state
git log --oneline -5
git status --short

# 2. Baseline test gates (should all be green)
make test                  # expect 1002 backend + 881 plugins + 1896 Vitest
make test-dexie-smoke      # expect 18/18 green
cd backend && poetry run mypy app/                          # Success
cd backend && poetry run pre-commit run --all-files         # Passed

# 3. Confirm CI is green on the v1.34.0 push (once it lands)
gh run list --limit 5
```

If any baseline doesn't match, **STOP and investigate**
before proceeding with v1.35.0.

Then read, in order:
1. `CLAUDE.md`
2. `.claude/rules/` (all files — these are now Bibliogon-
   residue-free post-Phase 50D and well-trimmed)
3. This file (handover-to-v1.35.0.md)
4. `changelog/releases/v1.34.0.md` (the per-release detail)

Then propose the v1.35.0 commit plan with whatever
candidate from § 2 the user picks, wait for green-light,
execute.

---

End of handover.
