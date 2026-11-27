# Release Workflow

The permanent workflow for AdaptiveLearner releases. Claude Code reads this file automatically when a release is due.

**Prompt triggers**: "release new version", "new release", "deploy new version"

**Architecture reference**: the 4-Tier version-propagation model, the full Tier-2 file inventory, and the `make release-*` target catalogue live in `docs/development/release-automation.md`. This file is the human-side workflow; the doc is the tooling reference.

## The path: two workflows, nothing by hand (owner decision 2026-11-27)

`main` holds releases only; `develop` is the active branch (the GitHub default). A release is cut on `release/X.Y.Z` from `develop`, merged to `main` (where it is tagged) and back to `develop` (#334). Two dispatched workflows do it:

| Stage | Dispatch | Does |
|---|---|---|
| Rehearse | `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare` | cut, bump, full gate on the runner; pushes nothing |
| Cut | the same, plus `-f push_branch=true` | the same, then pushes `release/X.Y.Z`: the freeze starts |
| Finish | `gh workflow run release-finish.yml --ref release/X.Y.Z -f version=X.Y.Z` | merge to `main` (no-ff) + tag, back-merge PR, DRAFT GitHub Release |

Why not by hand: `release.yml` gates the bumped tree in a clean container BEFORE anything is pushed, and tests run in GitHub Actions, not on the maintainer's machine. Cutting, bumping, tagging or pushing `main` by hand goes around that.

- `make release-prepare`, `release-finish`, `release-publish` and `release-test` are what the workflows call. In a regular release nobody runs them, and nobody tags or edits a version field.
- The `finish` stage of `release.yml` is not the path. `release-finish.yml` is.

### What has never run (2026-11-27)

Say so in the journal when a release is the first run of one of these:

- **No workflow finish since 2026-09-17** (v2.15.0). Since then the make target stops on a `gh` error (#3276) and merges through `scripts/release_finish_merge.sh` (#3904); v2.16.0 to v2.17.1 were finished by hand. The first finish run is its own proof.
- **The token's right to open a pull request.** In v2.15.0 finish tagged `main` and did not open the back-merge PR. Before the first finish the owner checks that `RELEASE_PAT` has "Pull requests: Read and write".
- If finish stops after the tag ("main is tagged"): do NOT dispatch it again. Open the back-merge PR by hand and run `make release-publish VERSION=X.Y.Z`.
- **The cut has pushed once**, in a proof run from a fix branch (run 45832107793), never yet for a new version.

## Ground rules

- **Release, tag or publish only on the owner's go.** It covers the finish, the merge of the back-merge PR and the publish. A rehearsal needs none.
- **Do not skip steps**: the checklist at the end is mandatory.
- **Every release is a logical boundary**: do not release in the middle of a feature.
- **Tests must be green**: red tests block the release, no exceptions.
- **The changelog is for humans**: do not paste raw commit messages, summarize meaningfully.
- **Version bump follows SemVer.**
- **NEVER delete, move or recreate a pushed tag.** A wrong tag stays; the next version corrects it.

## Before the cut: on develop, by pull request

Everything a release needs from a human lands on `develop` first. The cut copies develop; after it the freeze is on (`vibe-coding.md`).

### Step 1: Capture the state

```bash
git tag --sort=-creatordate | head -5
git log vA.B.C..origin/develop --oneline --no-merges    # vA.B.C: the newest tag
grep -H "^version" backend/pyproject.toml
```

Show the owner the summary and wait for confirmation.

### Step 2: Pick the version per SemVer

| Commits since the last tag | Bump |
|---|---|
| `BREAKING CHANGE` in a body or `!` after the type | Major |
| `feat:` | Minor |
| only `fix:`, `perf:`, `refactor:`, `docs:`, `chore:`, `test:` | Patch |

**Data formats** (backup format, browser schema): a change an older version reads only in part is Minor while the new version reads everything older ones wrote; the release notes' Compatibility section names what older versions lose (#3827). Propose the version with its reason and wait for the owner's OK. No pre-release tags.

### Step 3: Write the changelog

`changelog/releases/vX.Y.Z.md`, grouped and summarized from the commits: Breaking Changes (only when needed), Added, Changed, Deprecated, Removed, Fixed, Security. Take the scope where it helps, collapse commits on one feature, drop internal refactorings.

- The file is also the GitHub release text: it carries the "Before you install", "Download" and "Verifying downloads" sections of `.github/RELEASE_TEMPLATE.md` above the changes. Finish builds the draft from it, so they belong in now.
- A user-facing section in `docs/help/<lang>/changelog.md`, all 8 help languages; for a minor or major version the gate fails while a page lags (#3161).
- `release.yml` refuses to start without the file on develop. It never invents a changelog.

### Step 4b: Dependencies

`make release-outdated` reports every dependency surface (it always exits 0; a surface it cannot check says so). Apply routine bumps (patch and minor) by PR; a major gets its own session. Check the `pluginforge` pin in `backend/pyproject.toml` and every `plugins/*/pyproject.toml` against PyPI (`pip index versions pluginforge`); it is not under `sync-versions`, and when it drifts more than once between releases it goes under it. Rules: `lessons/release-packaging.md`.

### Rehearse

- `gh workflow run release-prepare.yml -f version=<develop's own version>`: the gate on develop's tree, read-only token.
- The rehearse dispatch of the table above: the gate on the bumped tree.
- develop's own CI is green on the commit to be cut: ruff, mypy and pre-commit run there. No stage runs them on the bumped tree; they run again on `main` after the tag and on the back-merge PR. The bump step writes version fields and doc headers only.

## The cut

The cut dispatch does, in this order: cut `release/X.Y.Z` from develop, set `backend/pyproject.toml`, `make sync-versions`, `sync-versions-check`, `verify_version_pins.sh`, fix the doc headers, commit, `make release-test`, and only on green push the branch.

**Step 5, the gate.** `make release-test` is: `make test`, frontend build and Vitest, theme gate, docs drift gate, the ratchet gates (#2190), version lock-step, schema and data-model drift, plugin locks, the Dexie-mode gate and the manual-plan automation.

**Step 4: version fields derive, nobody edits them.** `backend/pyproject.toml` is the one source; the workflow sets it. The full set of derived files is `collect_targets()` in `scripts/sync_versions.py`; the mechanisms:

| Derived location | Mechanism |
|---|---|
| `backend/app/__init__.py:__version__` | `tomllib` parse at import |
| `frontend/package.json`, `launcher/pyproject.toml`, `plugins/*/pyproject.toml` | `make sync-versions` |
| `launcher/adaptive_learner_launcher/__init__.py`, the spec's CFBundle fields | `make sync-versions` (literal, for the frozen binary) |
| `launcher/.../installer.py:ADAPTIVE_LEARNER_TARGET_VERSION` | PyInstaller build-time injection (`_build_info.py`) |
| `install.sh` | generated from `install.sh.template` (`scripts/generate_install_sh.sh`) |
| frontend `__APP_VERSION__` | Vite `define` from `frontend/package.json` |

A hardcoded version literal in one of these is a broken derivation: fix the derivation. `verify_version_pins.sh` detects new literals; `release-gate.yml` runs it again on the tag.

### Step 6: after the push, before finish

The branch is pushed with the workflow's own token, and such a push starts no workflow (0 runs, measured 2026-11-26). Dispatch on the branch, each with `gh workflow run <file> --ref release/X.Y.Z`:

- `docker-build-smoke.yml`, `security-scan.yml`, `webkit-gate.yml` (their `release/**` trigger did not fire);
- `visual-regression.yml` (#3745);
- `launcher-linux.yml`, `launcher-macos.yml`, `launcher-windows.yml` (the bump touches `launcher/`).

`dexie-smoke.yml` and `manual-automation.yml` repeat what the gate ran. Review the branch. All green, and the owner's go: finish.

**The full Playwright smoke** runs only with `-f skip_e2e=false` on the cut dispatch (job `extra-smoke`, after the push, one retry). It has never been green in CI (#1254: four runs, none green). Until it is, that is an open gap of every release: record its RUN ID and Playwright's passed / skipped / flaky counts, and the owner decides on a red run. The silenced-spec budget (#2170, `e2e/.smoke-skip-baseline.json`) is checked inside `make test`.

**A fix after the push** goes onto the release branch by a push of your own (that push does start the `release/**` workflows), and is gated again with `gh workflow run release-prepare.yml --ref release/X.Y.Z -f version=X.Y.Z`. NEVER dispatch the cut again afterwards: it force-pushes the branch and erases the fix. **A red gate** pushed nothing: fix on develop by PR, then dispatch again.

## Finish (Step 7)

Note `git rev-parse origin/main` first. `release-finish.yml` merges `release/X.Y.Z` into `main` (no fast-forward), tags the merge commit, pushes both, opens the back-merge PR and creates the DRAFT release. Afterwards `git log -1 --format=%P vX.Y.Z` shows two parents, the first of them the noted one.

### The develop back-merge goes through a PR (#2182)

The PR `release/X.Y.Z` -> `develop` runs the required checks like any other (`enforce_admins` is on for develop). **If a ratchet gate blocks it, that is desired: raise the ratchet's baseline in the release branch and push; do not read the block as a fault.** Wait for the changed-areas detection before reading the check list: the four test contexts are created by it, so for the first minutes "still being created" and "will never come" look the same. Merge when green, never squashed, THEN delete the release branch. Background: `docs/development/release-ratchet-gap.md`.

## Publish (Step 8; dispatch-only chain, since v2.8.0)

The publisher workflows carry no `release:` trigger: the verified artifact must BE the shipped one. The draft produces no image and no binaries by itself.

1. The tag commit's own `main` CI is fully green (pending counts as not green, #2178).
2. `gh workflow run publish-image.yml --ref vX.Y.Z -f dry_run=false -f version=X.Y.Z`: the green gate runs inside it, then the per-arch anonymous pull, the arm64 start, the size gates and the version agreement.
3. Launcher binaries: the artifacts of the GREEN `main`-push builds of the tag commit (never rebuild: bit drift), attached with their `.sha256` files via `gh release upload`.
4. COMPLETENESS CHECKPOINT: the draft's assets equal 3 binaries + 3 `.sha256` + `image-digest.txt`. Per-arch image archives are not in the set (#2938): no workflow builds them; when one does, they come back here and the install docs flip to "available" in the same PR. Anything missing: do not publish.
5. Only then `gh release edit vX.Y.Z --draft=false`.

The docs site deploys from the `main` push (`deploy-gh-pages.yml`); verify the run and https://astrapi69.github.io/adaptive-learner/.

## Hotfix: the one path by hand

Neither workflow can do it: `release.yml` cuts from develop, `release-finish.yml` checks out `release/X.Y.Z`. On the owner's go:

1. Branch `hotfix/vX.Y.Z` from `main`, fix with its test.
2. Set `version` in `backend/pyproject.toml`, `make sync-versions`, `make sync-versions-check`, `scripts/verify_version_pins.sh X.Y.Z`; write `changelog/releases/vX.Y.Z.md` (Step 3). Commit, push.
3. Gate it in GitHub Actions: `gh workflow run release-prepare.yml --ref hotfix/vX.Y.Z -f version=X.Y.Z`, and the Step 6 dispatches on the branch.
4. `make release-finish VERSION=X.Y.Z FINISH_BRANCH=hotfix/vX.Y.Z` (never run by a release yet with `FINISH_BRANCH`), then `make release-publish VERSION=X.Y.Z`, Step 8, and the back-merge PR.

## After the release (Step 11): on develop, by pull request

- `docs/journal/chat-journal-session-{today}.md`: version, date, main changes, the run ids of the checklist.
- `make docs-checklist VERSION=X.Y.Z` prints the docs to-do list of the changelog's features (README, CLAUDE.md, help pages); work it off.
- `docs/ROADMAP.md`: mark what shipped, then archive (`python3 scripts/archive_completed_task.py --id <ID>`).
- `docs/ROADMAP.md` + `docs/backlog.md` header prose: `make roadmap-header-bump`, then refine by hand; `verify-docs-discipline` must report zero version WARNs (#2503).
- ROADMAP "Blocked / Upstream Wait": does this tag trigger a held entry? Then un-draft, merge, archive.
- `CLAUDE.md` on new endpoints or architectural changes; `lessons-learned.md` when the release taught something.

## Final checklist

Missing items block the release. A tick for work a workflow did carries its RUN ID.

- [ ] `launcher/launcher.json` `container_volumes` still names the PREFIXED volume (#2154). The bare name mounts an empty volume while the user's database, uploads and Fernet key sit invisible in the other one.
- [ ] Commits since the last tag reviewed; version confirmed by the owner
- [ ] `changelog/releases/vX.Y.Z.md` with the template sections, and `docs/help/*/changelog.md` in all 8 languages, on develop
- [ ] pluginforge and the routine dependency bumps on develop
- [ ] A release that touches backup or restore: the manual round trip of `quality-checks.md` (BACKUP-AKZEPTANZTEST) is done, by the owner
- [ ] Rehearsed (#3976): `release-prepare.yml` on develop and the rehearse dispatch of `release.yml`, RUN IDs
- [ ] develop's CI green on the cut commit (ruff, mypy, pre-commit), RUN ID
- [ ] The cut dispatch green, RUN ID: its `make release-test` is the gate
- [ ] Playwright smoke (`skip_e2e=false`): RUN ID and the counts, or the gap named with the owner's decision. A tick without numbers is the v2.6.1 false tick: that release checked this box while the suite never ran.
- [ ] On the release branch, each with its RUN ID: `docker-build-smoke`, `security-scan`, `webkit-gate`, `visual-regression` ("N passed / M failed"; a run that stays red cannot show a new deviation, #3745), the three `launcher-*` builds
- [ ] The owner's go for finish; `RELEASE_PAT` checked before the first one
- [ ] `release-finish.yml` green, RUN ID; the tag is on a merge commit of `main`
- [ ] Back-merge PR merged (not squashed), release branch deleted
- [ ] `publish-image.yml` green, RUN ID: it proves the anonymous pull, the arm64 start, the per-arch size gates and the version agreement
- [ ] Completeness checkpoint passed; release published
- [ ] Docs site deployed and verified
- [ ] Journal entry, docs checklist worked off, ROADMAP marked and archived, header prose refreshed (0 version WARNs), "Blocked / Upstream Wait" read
- [ ] `CLAUDE.md` updated (if needed)

## Troubleshooting

- **A gate or test is red**: no workaround, no disabled test. Before the push: fix on develop by PR, dispatch again. After the push: fix on the release branch and gate it again (Step 6).
- **Dependencies broke the build**: `poetry lock` and `bun install` in the affected project, in their own commit.
- **The docs deploy failed**: the tag stays valid; fix it after the release and note it in the journal.
- **The image publish failed**: the tag stays valid, the release stays a draft; dispatch `publish-image.yml` again when the cause is fixed.
- **A wrong version was tagged**: the tag stays (ground rules). Release the next patch version and name the wrong tag in its notes.

## Note for Claude Code

This workflow is a guide, not a rigid script. If the owner explicitly asks for a deviation, accept it and say in the journal WHY.

But: checklist items that touch safety (tests green, build successful, correct version) must NEVER be skipped, not even on instruction. Better to postpone the release than to ship broken software.
