# CC Session Handover — 2026-06-15

Self-contained handover for the next Claude Code (CC) session. You can continue
without follow-up questions. Branch model is **gitflow**: `develop` is the
active branch (the GitHub default), `main` holds releases only (tags `vX.Y.Z`).

---

## 1. State of `develop`

**v1.80.0 is SHIPPED** — tagged `v1.80.0` on `main`, GitHub Release published
2026-06-15 (draft=false), merged back to `develop`. Release notes:
`changelog/releases/v1.80.0.md`. `main` = `develop` = version **1.80.0**. The
**release freeze is LIFTED** — normal develop flow (branch from develop, PR
against develop).

v1.80.0 headline: user profile picture (#508), EXP-026 user lessons folded into
the content tree (UGC-01..07), EXP-025 book companion (AUTH-01/02), selective
data export (#544), localized lesson-split titles (#512), a11y skip-link +
dialog focus (#514/#515), plus a maintenance batch (#511 About overflow, #537
flaky de-flake, #540/#541 import-cycle + complexity gates, #543 Dexie gate
green, #550 320px export overflow) and a comprehensive docs sweep (#534).

No schema / API / data-model change in v1.80.0 beyond the additive
book-metadata `book` block.

## 2. Open issues

- **#547** (P-low / test) — un-fixme the `recommended-repos` discovery E2E
  (`e2e/dexie/recommended-repos.spec.ts`) once the curated catalogue is
  published. It is `test.fixme`'d because `CATALOGUE_PUBLISHED = false` in
  `frontend/src/lib/content/recommended-repos.ts` (commit 70108061) →
  `fetchRecommendedRepos` short-circuits to `[]`, so the discovery section never
  renders. Flip the flag → remove the `test.fixme`.

No other open issues at handover. No open PRs.

## 3. CI / gate changes to know about (#552)

- **Dexie-smoke no longer runs on every PR.** `dexie-smoke.yml` now triggers on
  a **daily schedule (04:00 UTC)** + **push on `release/**`** +
  **`workflow_dispatch`** (manual). It is STILL a mandatory gate in
  `make release-test` (run before tagging) and runs on release branches, so no
  release ships without it. Locally: `make test-dexie-smoke` unchanged.
- The 3 CI watchers from the v1.77.0–v1.79.0 line are live: file-size cohesion
  (#371, hard gate at 1000 lines), security-scan (#378), complexity (#400, +
  Phase-2 radon hard gate #494/#495 blocking cc > 20). Both `.filesize-baseline`
  and `.complexity-baseline` are **empty**.
- `develop` has **no branch protection** (so merges don't wait on required
  checks; a red non-required check does not block a squash-merge).

## 4. New lifecycle rule (act on it)

`.claude/rules/ai-workflow.md` now has **SUB-ISSUE-CLOSES**: a PR implementing a
sub-issue of an umbrella MUST cite `Closes #<sub-issue>` (not only
`Refs #<umbrella>`), else the sub-issue stays open after merge. This came from
the 8-issue CCW cleanup this session — follow it for any future epic/sub-issue
work.

## 5. Known process pitfall — release freeze for real

During the v1.80.0 prep, `develop` kept absorbing features (#544/#545 selective
export, #546/#549 Settings nav) while the release branch was open. Each rebase
of `release/1.80.0` onto develop pulled in a fresh regression (#543, then #550),
turning release prep into a moving target. **Next release: enforce the
Vibe-Coding release freeze** (`.claude/rules/vibe-coding.md` — no merges to
develop once `release/X.Y.Z` is cut) so the release branch is stable.

## 6. Suggested next work (no commitment)

- **#547** quick win when the catalogue publishes.
- **EXP-027 I18N-* tasks** (vision, post-v1.80.0): I18N-02 (scale the language
  picker) + I18N-03 (Hindi UI + Devanagari font) are the lowest-risk entry
  points; RTL infra (I18N-01) is the prerequisite for Arabic. See
  `docs/explorations/EXP-027-internationalization-strategy.md`.
- Post-release polish: a full v1.80.0 state paragraph in the CLAUDE.md header
  (the version string is already 1.80.0; the prose summary still leads with
  v1.79.0 detail).

## 7. Reference

- Rules: `.claude/rules/` (architecture, coding-standards, code-hygiene,
  quality-checks, release-workflow, ai-workflow, vibe-coding, reusability,
  design-tokens, lessons-learned).
- Release flow: `.claude/rules/release-workflow.md` + `make release-prepare /
  release-test / release-finish / release-publish`.
- This session's journal: `docs/journal/chat-journal-session-2026-06-15.md`.
