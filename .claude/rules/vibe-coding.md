---
description: Vibe coding policy - release freeze, no-amend-on-open-PR, priority order, layer architecture, test discipline, dependency control
globs:
   - "**/*"
alwaysApply: true
---

# Vibe Coding Rules

Full policy: docs/policies/VIBE-CODING-POLICY.md

## Short rules for every task

- **PROMPT-PRECISION**: Reference existing patterns (guardedFetch, IStorageService, Repository Pattern, PluginForge Hooks) instead of reinventing. Name file, function, expected behavior.

- **LAYER ARCHITECTURE**: No business logic in components. No DB queries in routers. No direct fetch calls. Dependency direction: Router -> Service -> Repository -> Models.

- **TESTS**: Every behavior change needs tests. Backup changes additionally need the manual round-trip (BACKUP-AKZEPTANZTEST). User-visible functionality updates the manual test plan (TESTPLAN-PFLICHT in ai-workflow.md: DE + EN in the same PR, otherwise referenced follow-up comment on #1087; "not requested" is not a valid reason). PR-CI: selective tests (vitest --changed, pytest --testmon). Nightly + Release: full suite.

- **DEPENDENCIES**: No new dependencies without manual check on maintenance status and security. Prefer existing dependencies.

- **REFACTORING**: Split god-files, do not whitelist. Whitelist only for single-concern files (models, schemas, static data).

- **GIT**: Issue FIRST (GITHUB-ISSUE-PFLICHT). Closes #XX in every commit. Docstrings over inline comments. One concern per PR. Every pushed code change opens a PR (PR-PFLICHT in ai-workflow.md) — always, not only on request. "No PR, not requested" is not a valid completion report. Exceptions: release freeze (below) and pure analysis/status tasks without code change.

## Priority (fixed, non-negotiable)

1. Merge open PRs
2. P0/P1 bugs
3. Infrastructure (CI, security, guards)
4. UI fixes
5. Cleanup/refactoring
6. Features
7. Release

Foundation before features. Measure first, then secure.

## Release freeze

When a release branch is cut (release/X.XX.0 exists), until the release is tagged and published:

- No new PRs against develop
- No merges to develop
- No new code, only release workflow (release-test, release-finish, release-publish, journal)
- Exception: a P0 hotfix that blocks the release itself

Tag first, then continue working.
