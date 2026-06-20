# Chat journal — 2026-06-20

## Release cut v1.90.0 (gitflow release branch → main + develop)

CCW release session: cut the v1.90.0 feature release from `develop` per
`.claude/rules/release-workflow.md`, with the release freeze active from the
branch creation through the published tag.

### 1. Release branch + version bump

- Goal: branch `release/v1.90.0` from a fresh `develop`, bump the canonical
  version, propagate, and refresh the version badges.
- Result: `develop` was already in sync with origin (clean tree). Created
  `release/v1.90.0`. Hand-edited `backend/pyproject.toml` 1.89.0 → 1.90.0 and
  ran `make sync-versions` (19 files: frontend package.json/lock, launcher
  spec/init/pyproject, all 13 plugin pyprojects, install.sh/ps1).
  `make sync-versions-check` + `verify_version_pins.sh 1.90.0` both clean.
  Version badges refreshed in `README.md`, `README-de.md`, `CLAUDE.md`
  (new current-state block, v1.89.0 demoted), `docs/ROADMAP.md` (line-3 state
  block, v1.89.0 → "Prior:").

### 2. CHANGELOG — verified against git log, not the prompt draft

- Goal: write `changelog/releases/v1.90.0.md` for the release.
- Result: built the changelog from the actual 19 commits in
  `git log v1.89.0..HEAD`. The prompt's draft referenced multiple PRs that
  were **not in range** — corrected throughout:
  - AIX-01–06 are #817 / #829 / #834 / #835 / #836 / #838 (not
    #826/#830/#831/#832/#833).
  - Desktop auto-update is #843 (not #840); db.ts split is #844 (not #842);
    AI session-language directive is #828 (not #827); matching animation is
    merge #825 (refs #824); per-provider Test is merge #814 (refs #813).
  - Excluded items already shipped in v1.89.0: directory restructuring (#809),
    theory-only offline save (#795/#796).
  - "Developer documentation (#839)" did not exist in range; the only docs PR
    is #841 — the AI content-validation **user** guide.

### 3. Content repo + gates

- Goal: fresh-pull the content repo and run the full release gate chain.
- Result: `adaptive-learner-content` pulled — `main @ 19c3ae7`, already up to
  date. Gates on the release branch all green:
  - `make test` — Vitest 5387 passed (509 files) + backend + plugins.
  - `make test-dexie-smoke` — 89 passed (7.4m).
  - `tsc --noEmit` — clean (exit 0).
  - `npm run build` — built, PWA 231 precache entries generated.

### 4. Merge, tag, publish

- Goal: merge to `main`, tag, push, merge back to `develop`, publish the
  GitHub release.
- Result: release commit `3f283c31` (`--no-verify` — version-only plugin
  pyproject bumps have no lock-content change, mirroring the documented
  v1.89.0 pattern). Merged `--no-ff` into `main` (`9c7f125c`), tagged
  `v1.90.0` → `9c7f125c`, pushed `main --tags`. Merged `--no-ff` back into
  `develop` (`9e6c6bcf`), pushed. Deleted the local release branch (was
  never pushed to origin). Published the GitHub Release (non-draft) from
  `CHANGELOG_LATEST.md`:
  https://github.com/astrapi69/adaptive-learner/releases/tag/v1.90.0

### 5. Post-release docs (this session)

- Goal: Step 11 — journal entry + ROADMAP `[x]` marking, committed directly
  on `develop`.
- Result: this journal entry. **ROADMAP `[x]` marking: nothing to flip** —
  `docs/ROADMAP.md` has zero open `[ ]` checkboxes (it tracks state via the
  line-3 block, already updated to v1.90.0 in step 1), and the backlog's open
  items are all future/deferred work unrelated to this release. The v1.90.0
  features (EXP-036 / AIX-01–06, auto-update, etc.) were tracked as GitHub
  issues closed by their merge commits per ISSUE-LIFECYCLE, not as roadmap
  checkboxes.

### Notes / lessons

- **The prompt's CHANGELOG draft is a hypothesis, not a contract.** Several
  PR numbers were wrong and two items were already in v1.89.0. Verifying every
  reference against `git log v1.89.0..HEAD` before writing the changelog is
  what kept the release notes honest (`.claude/rules/ai-workflow.md` numeric
  claims verification + "verify against reality").
- **Release freeze held throughout:** no new feature work, gates run separately
  from the irreversible git ops, one command per merge/tag/push step.

## Release summary

- **Tag:** `v1.90.0` → `9c7f125c271edabaad439711b182b623cc95c5b0`
- **main:** `9c7f125c` · **develop:** `9e6c6bcf`
- **Type:** feature release (no schema/API/data change)
- **Gates:** `make test`, `make test-dexie-smoke` (89), `tsc --noEmit`,
  `npm run build` — all green
- **Headline:** AI Exercise Generation Pipeline (EXP-036 / AIX-01–06)

## Release cut v1.91.0 (gitflow release branch → main + develop)

CCW release session: cut the v1.91.0 UX release from `develop` per
`.claude/rules/release-workflow.md`, release freeze active from branch creation
through the published tag. Same evening as v1.90.0.

### 1. Release branch + version bump

- Goal: branch `release/v1.91.0` from a fresh `develop`, bump + propagate the
  version, refresh badges.
- Result: `develop` in sync with origin (clean). Hand-edited
  `backend/pyproject.toml` 1.90.0 → 1.91.0, `make sync-versions` (19 files);
  `sync-versions-check` + `verify_version_pins.sh 1.91.0` clean. Badges
  refreshed in `README.md`, `README-de.md`, `CLAUDE.md` (new state block,
  v1.90.0 demoted), `docs/ROADMAP.md` (line-3 state block, v1.90.0 → "Prior:").

### 2. CHANGELOG — verified against git log

- Goal: write `changelog/releases/v1.91.0.md`.
- Result: built from the actual commits in `git log v1.90.0..HEAD`. This time
  the prompt's PR refs (#850, #846) **matched** the log. Cross-checked the #850
  sub-claims against the commit body and tightened: it is a grouped **horizontal
  nav bar** with a reusable `NavGroup` component (not a literal "sidebar");
  **Session was also removed** from the nav (route kept); old routes survive via
  **redirects** (`/statistics` → `/progress?tab=stats`, `/curriculum` →
  `/progress?tab=paths`, `/import` → `/discover?tab=import`). Added a Docs line
  for the EXP-037 design doc (#848). Excluded the v1.90.0 post-release journal
  commit (#844) — in range but not a v1.91.0 change.

### 3. Content repo + gates

- Goal: fresh-pull the content repo and run the full gate chain.
- Result: `adaptive-learner-content` pulled — `main @ 19c3ae7`, up to date.
  Gates green on the release branch:
  - `make test` — Vitest 5426 passed (514 files) + backend + plugins.
  - `make test-dexie-smoke` — 90 passed (6.9m).
  - `tsc --noEmit` — clean.
  - `npm run build` — built, PWA 233 precache entries.

### 4. Merge, tag, publish

- Goal: merge to `main`, tag, push, merge back to `develop`, publish the GitHub
  release.
- Result: release commit `e6cc3b34` (`--no-verify` — version-only plugin bumps,
  documented pattern). Merged `--no-ff` into `main` (`173d663b`), tagged
  `v1.91.0` → `173d663b`, pushed `main --tags`. Merged `--no-ff` back into
  `develop` (`c198169e`), pushed. Deleted the local release branch. Published
  the GitHub Release (non-draft) from `CHANGELOG_LATEST.md`:
  https://github.com/astrapi69/adaptive-learner/releases/tag/v1.91.0

### 5. Post-release docs (this session)

- Goal: Step 11 — journal entry on `develop`.
- Result: this section. **ROADMAP `[x]` marking: nothing to flip** — same as
  v1.90.0, `docs/ROADMAP.md` has zero open `[ ]` checkboxes (state tracked via
  the line-3 block, already updated in step 1); EXP-037 / #850 / #846 were
  GitHub-issue-tracked and closed by their merge commits per ISSUE-LIFECYCLE.

## Release summary v1.91.0

- **Tag:** `v1.91.0` → `173d663b9213d9bdd3f6145dec3fb246900747be`
- **main:** `173d663b` · **develop:** `c198169e`
- **Type:** UX release (no schema/API/data change)
- **Gates:** `make test` (5426), `make test-dexie-smoke` (90), `tsc --noEmit`,
  `npm run build` — all green
- **Headline:** navigation restructuring 12+ → 7 grouped entries (EXP-037, #850)
  + PWA update-banner persistence fix (#846)
