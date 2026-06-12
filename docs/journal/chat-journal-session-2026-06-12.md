# Chat journal - 2026-06-12

## Session: TipTap v2 -> v3 migration + v1.75.0 release

### 1. TipTap v2 -> v3 migration (#311)

- Goal: migrate the whole `@tiptap/*` stack from v2 (2.27.2) to v3 in one
  atomic change, lifting the Dependabot major-hold (#305) that prior
  piecemeal bumps had forced.
- Approach: created issue #311 first (GITHUB-ISSUE-PFLICHT), then verified
  the v3 breaking changes against the *actually installed* 3.26.1 packages
  (export maps + `.d.ts`) rather than the migration-guide prose, which was
  incomplete. Key finding: the v3 legacy package names ship as re-export
  shims that keep most `default` exports, and `@tiptap/react` still
  `export *`s from `@tiptap/core`, so the surface area was far smaller than
  the failure history (#267/#288) suggested.
- Result: only five code changes were needed -
  - `TextStyle` + `Table` lost their default export -> named imports.
  - StarterKit v3 bundles `Link` + `Underline` -> disabled both so the
    custom standalone extensions do not collide.
  - `setContent(doc, false)` -> `setContent(doc, {emitUpdate: false})`.
  - `<NodeViewContent<"code"> as="code">` (the `as` prop is now generic
    with `NoInfer`).
  - `Editor`/`JSONContent`/`NodeViewProps` imports unchanged.
  - Gates: `tsc` clean, `npm run build` green (no MISSING_EXPORT), **3953
    vitest pass with zero test changes**, `make test-dexie-smoke` 88/88.
- PR #314 (squash-merged with admin override - the CI Dexie-smoke job was
  timing out in *Install Playwright browsers*, infra, before any test ran).

### 2. Pre-existing ESLint break unblocked (#312)

- While verifying the migration's `eslint --max-warnings 0` gate, found 5
  `no-useless-assignment` errors already red on `main`, introduced by the
  `@eslint/js` 9 -> 10 bump (#310) which added the rule to
  `eslint:recommended`. Unrelated to TipTap.
- Per one-concern-per-PR, filed #312 and fixed it on its own branch
  (PR #313, merged first to unblock the migration PR's CI). Dropped the 5
  dead initializers; definite-assignment still holds (tsc clean).

### 3. Formatting churn cleanup (#315)

- The migration inadvertently committed a whole-file 2-space reformat of
  the two editor files: `frontend/` has no prettier config, so the
  `prettier-frontend` pre-commit hook runs prettier *defaults* and rewrote
  the 4-space files; a `git stash` then captured that reformat and it got
  committed. Restored both files to 4-space with only the ~20-line v3
  change (PR #315). Asked the user; they chose fix-first before tagging.

### 4. Release v1.75.0

- Bumped `backend/pyproject.toml` 1.74.0 -> 1.75.0, `make sync-versions`
  (19 files), wrote `changelog/releases/v1.75.0.md`, updated CLAUDE.md /
  README(-de) badges / ROADMAP + backlog state headers. `make
  verify-docs-discipline` 0 FAIL.
- `make release-test` green (full backend+plugin+vitest, build, drift +
  version-lock checks, 88/88 dexie-smoke). Single `chore(release): v1.75.0`
  commit (plugin-lock pairing hook skipped for the version-only plugin
  bumps, per precedent). `make release-tag` + `make release-publish`.
- Release: https://github.com/astrapi69/adaptive-learner/releases/tag/v1.75.0

### Follow-ups filed

- `frontend/` prettier-config mismatch: the `prettier-frontend` hook is
  misconfigured relative to the 4-space codebase (CI already skips it). A
  later PR should add a 4-space `.prettierrc` or drop the hook.

### Stats

- 3 PRs merged (#313, #314, #315) + 1 release commit. Issues #311, #312
  closed. 5 editor-code changes + 5 lint-fix lines. No schema/API/data
  change.
