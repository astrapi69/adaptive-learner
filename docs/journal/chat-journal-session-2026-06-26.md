# Chat journal — 2026-06-26

## 1. Backend imported-chat context parity (#1154)

- Goal: mirror the Dexie-mode imported-chat fixes (#1078/#1122/#1137/#1147)
  on the backend/API path so desktop/server mode stops drifting off an
  imported chat's topic.
- Result: `compose_system_prompt` (imported-vs-learning branch, #797
  suppression for imports) + `build_outgoing_history` (rebuild-on-resume
  fresh from the conversation FK across `/message` + streaming) in the
  session plugin; pinned `LearningSessionOut.imported_conversation_id`. New
  pytest suite `test_session_imported_context_parity.py`.
- PR #1155 -> develop.

## 2. Tutor-session key gate (#1158, +stale test #1162)

- Goal: "Continue session" on an imported chat was clickable without an AI
  key and led into a dead `/session` (FUNKTION-NICHT-VERFUEGBAR violation).
- Result: `ImportActionBar` gates start AND continue on the session feature
  (disabled + tooltip); `Session.tsx` renders a clean `session-no-key`
  empty state (reusing `ApiKeyRequiredNotice` -> `/settings?tab=ai`) instead
  of a dead chat, covering every route-level entry. Fixed a stale resume
  test left behind by #1143 (#1162).
- PR #1159 -> develop.

## 3. Release v1.96.0 — prepare, finish, publish

- `release/1.96.0` refreshed from develop (conflict-free merge), version
  bumped to 1.96.0 (`make sync-versions`), changelog
  `changelog/releases/v1.96.0.md` written + extended with the post-cut
  develop changes (#1149 /contribute, #729 Continue-Learning, #1158/#1162,
  #1160 word-tile equivalence, #1163 test infra, process doc).
- Release-only gate surfaced a real failure: the dexie-smoke `/session`
  spec expected the old states; added `session-no-key` as accepted (#1158
  follow-up).
- `make release-test` fully green (backend 1285 + plugins + vitest, build,
  docs-discipline, pins, plugin-locks, dexie-smoke 91, manual-automation
  73/3-skipped). The previously-red Session/Settings network tests are
  green via #1163.
- Content (#71 `accept_orderings`): the app does NOT version content (no
  submodule/pin; GH-Pages deploy checks out content `main` at deploy time),
  so v1.96.0 needed no content change — the fix ships with the next deploy.
- `make release-finish VERSION=1.96.0`: main `2a86380c` "Release v1.96.0",
  tag `v1.96.0`, back-merged to develop (`78e80ce6`), release branch
  deleted.
- `make release-publish VERSION=1.96.0`: GitHub Release
  https://github.com/astrapi69/adaptive-learner/releases/tag/v1.96.0

## Summary

- v1.96.0 released. Headline: imported-chat backend/API parity (#1154) +
  tutor-session key gate (#1158); Reverse/Endless lesson modes (#1013/#1015);
  invitation-code content sharing (#1094); online-to-local migration (#1099);
  docker-app-launcher engine (#1064); SEO (#1108); preview-site auto-deploy
  (#1135). No schema/API/data change.
- Closed issues: #1154, #1158, #1162 (plus the changelog-tracked set).
- Post-release docs: CLAUDE.md current-state + this journal updated;
  ROADMAP/backlog headers already on v1.96.0 (no open items matched the
  shipped issue numbers).
