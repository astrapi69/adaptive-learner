# Chat Journal - Session 2026-08-14

## Release v2.12.0 (Minor)

### Goal
Cut and publish the v2.12.0 release from develop (50 commits since v2.11.0; 7 feat, no breaking changes -> minor bump).

### Result
v2.12.0 tagged on main (`5601f96e5 "Release v2.12.0"`), GitHub Release published, GH-Pages deployed, GHCR image published, back-merged to develop.

### Green baseline (verified this session)
- `make test`: 8595 tests green (backend + plugins + Vitest)
- ruff, mypy, tsc --noEmit, sync-versions-check, verify-docs-discipline, verify-mkdocs-nav: all green
- Full `make release-test` gate: green on CI (prepare stage)

### Three blockers found + fixed during the release (none in the release code itself)

1. **`schema_generated.py` latent drift (#2602).** PR #2598 bumped `datamodel-code-generator` 0.71.0 -> 0.72.3 without re-running `make sync-schema`; 0.72.3 wraps `Field(...)` calls at black's 88-col default. `sync-schema-check` runs only in `make release-test`, so it was invisible on PR CI and surfaced at the release gate. Fixed by regenerating (whitespace-only). Same class as ci-gates.md "Engine re-pin without make sync-schema". PR #2603.

2. **`release.yml` prepare stage missing PyYAML (#2604).** The one-click Release workflow (unused since 2026-07-09, bit-rotted) ran `python3 scripts/verify_docs.py --fix` with the bare setup-python, whose i18n check shells out to `sync_i18n_to_frontend.py` (import yaml). The Playwright container's python had no PyYAML; the mainline "Docs drift verifier" CI job installs it, release.yml did not. Fixed by adding a PyYAML install step. PR #2605.

3. **Gitflow version-lineage merge conflict at finish.** `make release-finish`'s plain `git merge --no-ff release/2.12.0` into main conflicted on every sync-versions file (main at 2.11.0, release at 2.12.0; merge base predated both bumps because main and develop's release lineages diverged). No tag/push happened (clean failure). Resolved by merging `origin/main` into `release/2.12.0` first (all conflicts pure version strings -> 2.12.0, non-version content identical), making the finish merge conflict-free. Re-dispatched finish -> success.

### Release mechanics
- Cut + gated + tagged + published via the `Release` workflow (release.yml) dispatched as stage=prepare then stage=finish (RELEASE_PAT present, so the main push fired GH-Pages + launcher builds).
- Back-merge to develop: make release-finish's `gh pr create` did not fire (no GH_TOKEN in that step); opened manually as PR #2607 (conflict-free).
- Launcher binaries built green on the main push but are not auto-attached to the Release (post-v2.8.0 the release-event attach was removed); attaching via `gh release upload` is the manual checklist step.

### Follow-ups / notes
- launcher binary + `.sha256` attach to the v2.12.0 Release is the one remaining manual step (needs `gh release upload`).
