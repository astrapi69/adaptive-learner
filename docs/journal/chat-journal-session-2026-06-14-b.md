# Chat journal — session 2026-06-14 (b)

Second CC session of the day. Picked up after the handover session;
culminated in the **v1.78.0 release**. Worked the issue queue, wrote two
design EXPs, and shipped the release autonomously. Parallel CCW lane
(frontend complexity burn-down) ran throughout; coordinated via isolated
worktrees and the release freeze.

---

## 1. Merge carried-over docs PR #432 (handover)

- Goal: land the previous session's handover PR.
- Result: squash-merged #432 → develop (CI green; docs-only). The scheduled
  wakeup that fired later to "merge #432" was a no-op (already merged).

## 2. #430 — pytest-randomly for per-plugin locks → won't-fix + spin-off #434

- Goal: queued P3 infra item — add pytest-randomly to the per-plugin CI locks.
- Premise check (verify-before-fix): the issue assumed a per-plugin CI matrix
  exists. It does not — both `ci.yml` (Plugin Tests) and `coverage.yml`
  (Plugin Coverage) carry the matrix **commented out** (skeleton `if: false`).
  Plugin tests run only locally via `make test-plugins` (backend venv, which
  already has pytest-randomly). Adding pytest-randomly to plugin pyprojects
  would be a CI no-op.
- Decision (user): close #430 won't-fix; open **#434** "re-enable the
  per-plugin CI test matrix (13 plugins)" as P3 infra for after the release.
- Result: #430 closed with full reasoning; #434 created (`tech-debt`,
  `tooling`).

## 3. EXP-025 — author-provided lesson sets (Refs #142)

- Goal: design doc for book-companion content sets.
- Result: `docs/explorations/EXP-025-author-provided-lesson-sets.md` — the
  5-section house structure + an Entscheidungen section (E1–E8) resolving the
  open questions (license policy, monetization optics, the AUTH-06 fork
  boundary). Grounded in real code (`books.yaml` already carries the #142
  example book, `book-recommendations.ts`, EXP-023, LESSON-FORMAT). Registered
  in EXP-INDEX. PR **#439**, squash-merged. `#142` stays open (vision).

## 4. EXP-026 — user-generated lessons in the content tree (Refs #97)

- Goal: design doc for #97, with a clear interface to EXP-025/AUTH-06.
- Result: `docs/explorations/EXP-026-user-lessons-in-content-tree.md` — same
  structure/depth; a dedicated AUTH-06 interface contract (the forked author
  set carries {source/target/level, variation_of, own id}; EXP-026 places +
  badges it). UGC-01..07 tasks. Stacked on #439 to avoid an EXP-INDEX merge
  conflict between the two open docs PRs.
- Conflict: after #439 squash-merged, #440 went CONFLICTING (the stacked
  index edits vs the squashed develop index). Resolved **without force-push**
  (rule) by merging develop into the branch and resolving EXP-INDEX in a merge
  commit. PR **#440** squash-merged.

## 5. Release v1.78.0 (autonomous)

- Goal: cut + ship v1.78.0 (maintenance / code-hygiene).
- Flow: `release-prepare` (release/1.78.0 from develop) → version bump
  1.77.0→1.78.0 (`make sync-versions`, 19 files, lock-step verified) →
  changelog `changelog/releases/v1.78.0.md` (verified against the 29 real
  commits; dropped the "npm audit fix" item — no commit for it in range, that
  was v1.77.0/#379) → doc version refs (CLAUDE.md, README, README-de, ROADMAP,
  backlog) → `make release-test` **green** (incl. dexie-smoke 88 passed,
  6 min) → release commit (`SKIP=plugin-lock-paired-with-pyproject`, version-
  only plugin bumps) → STOP for approval.
- After approval: `release-finish` (merge → main + tag v1.78.0 + back to
  develop) — the only error was the final `git push origin --delete
  release/1.78.0` (the branch was local-only; harmless no-op) →
  `release-publish` (GitHub Release published; launcher builds + GH-Pages
  deploy triggered).
- Content: complexity gate Phase 2 ratchet (#408), routes.py split (#412,
  last backend baseline entry — `.filesize-baseline` now empty), burn-down
  batch (#416–#460), Release-Freeze (#410) + No-Amend governance, two
  flaky-test fixes (lesson-tts #165/#425, pytest-randomly #426/#429), EXP-025
  + EXP-026. No schema/API/data change. 29 commits.

## 6. Post-release (this entry)

- Chat journal (this file), handover update, and the #434 feasibility analysis.

---

## Summary / stats

- **Released:** v1.78.0 (tag pushed, GitHub Release published).
- **PRs merged:** #432 (handover), #439 (EXP-025), #440 (EXP-026).
- **Issues:** #430 closed (won't-fix), #434 opened (plugin-CI-matrix, P3).
- **Open issues after:** #431 (CCW/frontend), #434 (infra P3), #142 + #97
  (features — now each backed by a design EXP), plus CCW burn-down issues.
- **Process notes:**
  - Verify-before-fix caught the #430 false premise (no per-plugin CI matrix).
  - No-Amend rule honoured on the #440 conflict (merge, not force-push).
  - Two autonomous changelog deviations reported: "npm audit fix" omitted
    (no commit in range); pytest-randomly cited as #426/#429 (not the
    outline's #164, an earlier v1.71.0 isolation fix).
  - Release freeze held; isolated worktree used for the EXP PRs so the shared
    checkout / CCW lane stayed undisturbed.
