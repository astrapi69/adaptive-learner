# Session handover → v1.64.0

Long-form state + gotchas for continuing in a fresh session. Pairs with
the kickoff prompt at the bottom. Supersedes
`session-handover-2026-06-06.md` (the v1.63.0-in-progress one).

## TL;DR

- **v1.63.0 is released + tagged + published.** `backend/pyproject.toml`
  = `1.63.0`. GitHub release published; Release-Gate CI on the tag was
  green; launcher builds (Linux/macOS/Windows) were triggered on the
  release event — **verify they finished + attached artifacts**
  (`gh run list --limit 8 | grep -i launcher`).
- **`main` (HEAD `e0756827`) has 2 unreleased `feat:` commits** since the
  `v1.63.0` tag = the start of **v1.64.0**:
  - `feat:` simplify onboarding to 2 required fields (#92, PR #93)
  - `feat:` optional onboarding wizard (#94, PR #95)
- **Next:** either keep building features then cut **v1.64.0**, or work
  the open bug queue first (#45 / #43 / #42) and fold them in.
- **Shared-checkout warning:** the previous session ran in the SAME
  working directory the user was doing git ops in. A `git checkout main`
  by the user mid-session moved an in-progress commit onto local `main`
  and dropped a feature branch. If you see your branch vanish or a commit
  land on `main` unexpectedly, that's why — recover by recreating the
  branch at the commit SHA and `git branch -f main origin/main`. Prefer
  one git command per step; verify `git branch --show-current` before
  committing.

## What shipped THIS session (for context)

All on `main`, all green through CI:

1. **v1.63.0 release** — 6 WCAG-AA theme presets (#86, pre-session), the
   #80 i18n audit, the #72 filter fix, + #82/#84/#87. Notes:
   `changelog/releases/v1.63.0.md`.
2. **#80 systematic i18n audit** (PR #91):
   - **Subject/category names** (data-i18n): 77 seeded subjects rendered
     English everywhere (the DB stores the literal English `name`, no
     slug column — deliberate in `subjects_seed.py`). Added a
     `subjects.*` catalog (60 keys × 8 langs, keyed by a normalized
     English name) + `frontend/src/lib/subjectI18n.ts`
     (`translateSubjectName` / `translateSubjectPath`, fallback to
     `subject.name` for proper nouns like Python/React + custom
     subjects). Wired into `DashboardFilterBar` + Onboarding.
   - **Code-key sweep**: 92 `t()` keys were called in code but absent
     from every catalog (the WHOLE `editor.*` toolbar — no `editor:`
     section existed — plus danger-zone, dashboard metrics,
     learning-path aria). Added + translated in all 8 langs.
3. **#92 onboarding → 2 required fields** (PR #93): name + topic only,
   defaults for the rest.
4. **#94 optional onboarding wizard** (PR #95): see the dedicated
   section below — this is the most likely thing you'll touch next.

## Onboarding flow — fully rebuilt this session (READ before touching)

`frontend/src/pages/Onboarding.tsx` is now a **3-phase** flow driven by a
`phase: "form" | "invite" | "wizard"` state:

1. **`form`** — quick start: **only name + topic are required** (+
   contextual subject suggestions). Submit creates the User + the
   LearningProject with **defaults** (goal `"Learn {topic}"`, timeframe =
   `t("onboarding.wizard.timeframe_flexible")`, 15 min/day,
   `current_problem: null`), assigns any picked subjects, then
   `setPhase("invite")` — it does **NOT** navigate to /assessment any
   more.
2. **`invite`** — "Want to set up your learning profile in more detail?"
   - **"Jump right in"** (primary, `onboarding-invite-start-now`) →
     `/dashboard` (assessment is skipped — the empty-state Dashboard
     already handles a profile-less user).
   - **"Set up profile"** (`onboarding-invite-setup-profile`) →
     `setPhase("wizard")`.
3. **`wizard`** — `frontend/src/components/onboarding/OnboardingWizard.tsx`:
   one question per screen, each pre-filled with a default so "Next"
   always works. Steps: goal (textarea) / timeframe (segmented shadcn
   `Button` choice: 4w/3m/semester/flexible) / minutes (native
   `<input type=range>` 5–60) / current problem (textarea) / done
   ("Start the assessment?" Yes/Later). Progress via shadcn `Progress`
   + a `Back` on every step (step-1 Back → `onExit` → invite).
   `onFinish(values, startAssessment)` calls
   `getStorage().projects.update(createdProject.id, …)` then navigates
   (`true` → /assessment, `false` → /dashboard). Goal/current_problem are
   only sent when non-empty (backend rejects an empty `goal`).

**Consequences that will bite if you forget them:**

- **Assessment is now OPTIONAL.** The only way to /assessment is the
  wizard's last step (Yes). "Jump right in" goes to /dashboard. Any new
  flow that assumed onboarding → assessment is wrong now.
- **The E2E helper changed** (`e2e/helpers/onboarding.ts`):
  `completeOnboarding` now fills name+topic → submit → clicks
  "Set up profile" → walks the wizard (`onboarding-wizard-next` ×4) →
  clicks `onboarding-wizard-start-assessment` → waits for /assessment.
  The `timeframe` arg of `OnboardingArgs` is now **unused** (the wizard
  offers fixed choices, not free text) — kept for back-compat. If you add
  an onboarding E2E path, drive it through these phase testids.
- **No more `<details>` / tags on the quick-start.** #92 briefly added a
  collapsed `<details>` "More details"; #94 removed it (the wizard
  supersedes it). The tags input is gone entirely (subjects stay).
  Removed dead keys: `onboarding.field_tags*`, `onboarding.more_details`,
  `onboarding.default_timeframe`, `onboarding.skip*`,
  `toast.onboarding_skipped`. New keys: `onboarding.invite_*`,
  `onboarding.wizard.*`. `onboarding.default_goal` stays (project
  goal default).
- **No project editor exists post-onboarding.** goal / timeframe /
  daily_minutes / current_problem are editable at creation (wizard) but
  NOT afterward (no Settings/Dashboard/Curriculum project-edit UI — the
  old skip-hint's "edit from the Curriculum page" was always false). A
  dedicated project editor is a sensible future enhancement (noted on
  #92). The wizard's `projects.update` proves the storage path works.

## i18n mechanics (used heavily this session)

- Backend YAML (`backend/config/i18n/{lang}.yaml`, 8 langs) is canonical;
  `make sync-i18n` regenerates `frontend/src/data/i18n/*.json`. **Always
  run it after editing the YAML.**
- For bulk add/remove of keys, the comment-preserving approach is a
  **ruamel.yaml round-trip script** (ruamel 0.19.1 IS in the backend
  venv). Pattern used: `YAML(preserve_quotes=True, width=4096)`, wrap new
  scalars in `DoubleQuotedScalarString`, append into the existing
  `CommentedMap` (purely additive diff; existing lines stay
  byte-identical). Do NOT hand-edit 8 files for >2 keys — it's
  error-prone and the parity test is strict.
- **Parity is enforced**: `frontend/src/data/i18n/i18n-sync.test.ts`
  (every en key present in all 8) + backend
  `tests/test_i18n_parity.py` / `test_i18n_structure.py` /
  `test_i18n_translation_audit.py` (63 tests). Run the backend trio after
  any YAML churn: `cd backend && ADAPTIVE_LEARNER_TEST=1 poetry run
  pytest tests/test_i18n_*.py -q`.
- **Audit recipe** that found the 92 missing keys (re-run any time):
  grep `\bt\("([a-zA-Z0-9_.]+)"` across `frontend/src` (skip
  `*.test.*`), diff first-arg keys against the flattened `en.json`. 0
  missing now; keep it that way.
- New regression pin this session:
  `frontend/src/data/i18n/taxonomy-keys.test.ts` now also asserts
  `subjects.*` parity across all 8 catalogs.

## Open contrast finding (#96) — already triaged, do NOT re-chase blindly

The user reported the lesson-view ghost "Tipp anzeigen?"
(`lesson.exercise.*.hint_show`, a ghost `<Button class="text-[var(--accent)]">`)
and outline "Zurück zum Dashboard" (`adaptive.back_to_dashboard`) looked
unreadable in a dark-theme screenshot. **Audit verdict: they pass AA in
all 4 dark themes on their real surfaces** (outline inherits
`--fg-primary` → 12–21:1; ghost accent-text on `--surface` → 5.4–8.6:1).
The classic `theme-dark.css` was not changed by #86, so it was already
fine — the screenshot predates the v1.63.0 token work. **No broken-button
fix is needed.** The REAL gap (filed as **#96**, low priority): the WCAG
pin (`styles/contrast.test.ts`) doesn't cover `--accent`-as-text, and
catppuccin-mocha's accent on `bg-elevated` is **4.49** (a hair under AA,
on a surface the hint doesn't use). If you take #96: add a contrast pin
for accent-as-text (≥4.5 on bg-primary/surface; ≥3 on bg-elevated) and
nudge catppuccin-mocha via `scripts/generate_preset_themes.py`.

## Theme system reminder (unchanged this session)

12 themes (6 recommended + 6 classic), each a full 43-token
`styles/themes/theme-<id>.css`. The shadcn bridge is `@theme inline` in
`styles/tailwind.css`; `--color-accent-foreground = var(--accent-fg)` is
the #82 fix (don't revert — ghost/outline HOVER text fails AA in every
theme if you do). The 6 recommended presets are GENERATED by
`scripts/generate_preset_themes.py` (reads `/tmp/chosen-presets.json`
from a fresh tweakcn clone). WCAG verified computationally:
`contrast.test.ts` (all 12) + `themes.test.ts` (token parity) +
`no-hardcoded-colors.test.ts`.

## Standing gotchas (still true)

1. **`make release-test` does NOT run mypy** — only CI does. Before any
   tag: `cd backend && poetry run mypy app/`. (CI's "Backend ruff + mypy"
   job covers PRs, so a merged green PR is mypy-clean.)
2. **`plugin-lock-paired-with-pyproject` pre-commit hook is a false
   positive on a version-only bump.** Commit the `make sync-versions`
   bump with `git commit --no-verify` AFTER confirming
   `make verify-plugin-locks` reports no real drift.
3. **The docs gate (`make verify-docs-discipline`) is release-blocking
   and runs BEFORE the tag.** On a version bump it FAILS until you bump
   the version token in README + README-de (auto: `make verify-docs-fix`)
   AND by hand in CLAUDE.md "Current state", ROADMAP.md header, backlog.md
   header. CLAUDE.md's current-state prose had drifted 2 releases behind
   — when you write the v1.64.0 entry, demote the v1.63.0 block and check
   the chain is consistent.
4. **`make test-dexie-smoke` (73 specs) is the mandatory non-CI release
   gate** and it exercises the onboarding flow via the helper. Since the
   onboarding flow changed twice this session, this gate is the one most
   likely to catch a regression — run it after ANY onboarding/i18n change
   before tagging. ~5.5 min.
5. **Run vitest from `frontend/`** (`cd frontend && npx vitest run …`).
   Backend/plugin tests: `cd backend && ADAPTIVE_LEARNER_TEST=1 poetry
   run pytest …`. The shell `cd` does not persist between tool calls in
   this environment — prefix every command with the right `cd`.
6. **`gh issue view`/`list` can hit a GraphQL "Projects (classic)
   deprecated" error.** Fallback: the REST API,
   `gh api repos/astrapi69/adaptive-learner/issues/NN --jq '.title'`.
   `gh issue create` worked fine all session.

## Open issues (the bug queue)

- **#96** — harden WCAG pin for accent-as-text (enhancement, low). Filed
  this session; fully specified above.
- **#45** — imported/created lessons not placed in the correct
  `sets/{source}/{target-level}/lessons` path (bug). Not triaged.
- **#43** — lesson content panel still jumps/shifts when advancing
  between steps (bug, needs-repro). Not triaged.
- **#42** — Content Browser shows two scrollbars (bug, needs-repro). Not
  triaged.

## Test baseline (verify, don't trust)

Last seen this session: frontend Vitest **3501** green (319 files); the
backend i18n trio **63**; the Dexie gate **73**. Re-verify with the
authoritative collect commands (numbers drift) — see
`.claude/rules/ai-workflow.md` "Numeric claims verification".

## Useful commands

```bash
git log v1.63.0..main --oneline --no-merges      # what's queued for v1.64.0
gh issue list --state open                       # the queue (REST fallback if GraphQL errors)
cd backend && poetry run mypy app/               # NOT in release-test
make sync-i18n                                    # after editing i18n YAML
cd frontend && npx vitest run src/data/i18n/      # i18n parity pins
make test-dexie-smoke                             # mandatory release gate; exercises onboarding
make verify-docs-discipline                       # release-blocking docs gate
```
