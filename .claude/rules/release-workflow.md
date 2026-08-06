---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Complete release process - version bump, changelog, tests, GitHub release, Docker, docs deployment
globs:
  - "**/*"
alwaysApply: false
---

# Release Workflow

The permanent workflow for AdaptiveLearner releases. Claude Code reads this file automatically when a release is due.

**Prompt triggers**: "release new version", "new release", "deploy new version"

**Architecture reference**: the 4-Tier version-propagation model, the full Tier-2 file inventory, and the `make release-*` aggregate-target catalogue live in `docs/development/release-automation.md`. This file is the human-side workflow; the doc is the tooling reference.

## Gitflow (#334): cut the release on a release branch, not on main

`main` holds releases only; `develop` is the active branch (the GitHub default). A release is prepared on a `release/*` branch cut from `develop`, then merged to `main` (where it is tagged) and back to `develop`:

```bash
make release-prepare VERSION=X.Y.Z     # checkout develop, create release/X.Y.Z
# on release/X.Y.Z: bump backend/pyproject.toml, make sync-versions,
# draft changelog/releases/vX.Y.Z.md, make release-test, commit

make release-finish VERSION=X.Y.Z      # merge --no-ff to main + tag; open a PR to back-merge into develop

make release-publish VERSION=X.Y.Z     # GitHub Release from the changelog file
```

The Step 1-11 detail below is the per-step substance (version bump, changelog, gates, GitHub release, post-release docs) — it now runs ON the `release/*` branch, and the tag lands on `main` via the `release-finish` merge instead of a direct push to `main`. Hotfixes are the only exception: branch `hotfix/vX.Y.Z` from `main`, fix, tag, back-merge into `develop`.

### The develop back-merge goes through a PR (#2182, decided: Variante 1)

`make release-finish` no longer direct-pushes `develop`; it pushes `release/X.Y.Z` and opens a PR to `develop`, then STOPS for develop. Reason: a direct push bypassed the required checks (`enforce_admins=false`), which is how ratchet-tripping changes reached develop ungated (#2180). The back-merge PR runs the required checks like any other; **if a ratchet gate blocks it, that is desired — raise the ratchet's baseline in the release branch and push, do not read the block as a fault.** Merge the PR once green, THEN delete the release branch. Two things about
that PR, both learned the hard way on 2026-08-01: **wait for the
changed-areas detection before reading the check list** - the four test
contexts are CREATED by it, so for the first minutes "still being
created" and "will never come" look identical, and only the second is a
finding; and **verify you are actually ON main before merging the release
branch into it** - `git checkout main` fails when another worktree holds
it, the subsequent merge then reports "Already up to date" from the
release branch itself, and the tag lands on the branch head instead of a
main merge commit. The release-test ratchet gates (#2190) catch the normal case before the tag, so a blocked back-merge PR should be rare. Hotfixes back-merge the same way — via a PR to develop, never a direct push. The rejected alternative (a scripted `enforce_admins` off/on toggle) is an automated bypass, not an explained one, and is worse than the open channel because it adds false confidence — see `docs/development/release-ratchet-gap.md`. Closure requires the release manager to enable `enforce_admins` on develop; that decision and its price live in that doc.

## Ground rules

- **Do not skip manual steps**: the checklist at the end is mandatory
- **Every release is a logical boundary**: do not release in the middle of a feature
- **Tests must be green**: red tests block the release, no exceptions
- **The CHANGELOG is for humans**: do not paste raw commit messages, summarize meaningfully
- **Version bump follows SemVer**, even in the 0.x phase
- **Gitflow**: the release is cut on `release/*` from `develop` and merged to `main`; never develop or hand-tag directly on `main` (#334). See `coding-standards.md` §Git for the full branching model.

## Step 1: Capture the current state

Before doing anything, show the current state:

```bash
# Latest release tag
git tag --sort=-creatordate | head -5

# Commits since the last tag (tag determined dynamically)
LAST_TAG=$(git describe --tags --abbrev=0)
git log ${LAST_TAG}..HEAD --oneline --no-merges

# Statistics
git diff ${LAST_TAG}..HEAD --stat | tail -1

# Current versions
grep -H "version" backend/pyproject.toml frontend/package.json 2>/dev/null | head -5
```

Show the user the summary and wait for confirmation before the release continues.

## Step 2: Version bump per SemVer

Analyze the commits to decide:

| Commit type | Bump |
|---|---|
| `BREAKING CHANGE` in the body or `!` after the type | Major (v1.0.0) |
| `feat:` | Minor (v0.X.0) |
| `fix:`, `perf:`, `refactor:` without breaking changes | Patch (v0.X.Y) |
| Only `docs:`, `chore:`, `test:` | Patch (v0.X.Y) |

In the 0.x phase a major bump is rare. Breaking changes usually lead to a minor bump with a breaking-changes section in the CHANGELOG.

Propose the new version with rationale. Wait for user OK or correction.

## Step 3: Generate CHANGELOG.md

Build a clean CHANGELOG entry from the commits. Do not paste raw, group and summarize.

**Groups in this order**:

1. Breaking Changes (only when needed, at the top)
2. Added (`feat:`)
3. Changed (`refactor:`, `perf:`)
4. Deprecated
5. Removed
6. Fixed (`fix:`)
7. Security

**Format rules**:

- Past tense or present, consistent within the entry
- Take the scope from the commit when it helps (e.g. "Gamification plugin: ...")
- Collapse multiple commits touching the same feature
- Drop or briefly mention internal refactorings without user impact

**Example structure**:

```markdown
## [0.10.0] - 2026-04-XX

### Added
- Feature description, user-relevant

### Fixed
- Bug description so the user can tell what improved

### Changed
- Important changes to existing features
```

Also produce a separate file `changelog/releases/v0.X.0.md` containing only the new entry, for the GitHub release notes.

**Commit**: `docs: changelog for v0.X.0`

## Step 4: Bump version

AdaptiveLearner ships in lock-step. ALL components carry the same version string at every release. Only ONE file is hand-edited; everything else is propagated by tooling.

### Hand-edit (the ONLY editable version source)

- [ ] `backend/pyproject.toml`: `version`

That is the entire human-side checklist. Do not touch any other version field; do not touch `frontend/package.json`'s version, do not touch any `plugins/*/pyproject.toml`, do not touch the launcher spec or `__init__.py`. The tool does it.

### Propagate to all subsystems

```bash
make sync-versions
```

This single command updates:

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py` (`__version__` literal)
- `launcher/adaptive-learner-launcher.spec` (CFBundleVersion + CFBundleShortVersionString, both same value)
- All 13 `plugins/*/pyproject.toml`
- `install.sh` (regenerated from `install.sh.template` via `scripts/generate_install_sh.sh`)

### Verify

```bash
make sync-versions-check
scripts/verify_version_pins.sh <new-version>
```

`make sync-versions-check` exits non-zero if any subsystem drifts from canonical. `verify_version_pins.sh` runs the same check plus regression detectors for hardcoded literals in the "DO NOT EDIT" tier (Python `__version__ = "..."` outside `_build_info`, any reintroduction of the removed `COMPATIBLE_VERSION` symbol, frontend `APP_VERSION = "..."` literals, `install.sh` template sync). Both must succeed before tagging.

CI runs the same checks at `release-gate.yml` (on tag push) and again as the first step of every launcher build job (on `release: created`). Artifact attachment is blocked if either fails - this is hard enforcement, not advisory.

### Tag and push

```bash
git add -A
git commit -m "chore(release): bump version to v<new-version>"
git tag v<new-version>
git push origin main --tags
```

### What derives from what (DO NOT EDIT)

| Derived location | Source | Mechanism |
|---|---|---|
| `backend/app/__init__.py:__version__` | `backend/pyproject.toml` | `tomllib` parse at module import |
| `install.sh` | `install.sh.template` + `backend/pyproject.toml` | release-time substitution via `scripts/generate_install_sh.sh` (called by `sync-versions`) |
| `launcher/adaptive_learner_launcher/installer.py:ADAPTIVE_LEARNER_TARGET_VERSION` | `backend/pyproject.toml` | PyInstaller build-time injection via `adaptive-learner-launcher.spec` writing `_build_info.py` |
| `launcher/adaptive_learner_launcher/__init__.py:__version__` | `backend/pyproject.toml` | `make sync-versions` literal substitution (literal kept for frozen-binary compatibility) |
| `launcher/adaptive-learner-launcher.spec` CFBundle plist fields | `backend/pyproject.toml` | `make sync-versions` literal substitution |
| `launcher/pyproject.toml:version` | `backend/pyproject.toml` | `make sync-versions` |
| `plugins/*/pyproject.toml:version` | `backend/pyproject.toml` | `make sync-versions` (lock-step; per-plugin independent versions deferred to a future Core-vs-Third-Party decision) |
| `plugins/adaptive-learner-plugin-git-sync/adaptive_learner_git_sync/__init__.py:__version__` | own pyproject | `importlib.metadata.version` |
| `frontend/src/components/*` `__APP_VERSION__` | `frontend/package.json` | Vite `define` build-time literal |

(`frontend/bun.lock` carries no app version, unlike npm's `package-lock.json` which duplicated it in two top-level fields; the `make sync-versions` surgery for it was removed when the frontend moved to Bun, #1492.)

If a hardcoded version literal appears anywhere in the "DO NOT EDIT" list, the derivation is broken. Fix the derivation, do not edit the literal. The verify script's regression detectors catch new literals.

### Conditional documentation updates (manual, only when needed)

- [ ] `docs/reference/CONCEPT.md` (if the version is mentioned in prose)
- [ ] `README.md` (if the version is mentioned in prose)

### External Adaptive Learner-owned dependencies

One library that the Adaptive Learner project also maintains is pinned via the standard Poetry mechanism, NOT under `make sync-versions` automation. It has an independent release lifecycle:

- `pluginforge` (plugin framework, also used by other apps)

At each Adaptive Learner release, manually verify:

- [ ] `pluginforge` pin in `backend/pyproject.toml` and every `plugins/*/pyproject.toml` matches the latest released `pluginforge` on PyPI

Quick check:

```bash
pip index versions pluginforge
grep -rn "pluginforge" \
  backend/pyproject.toml plugins/*/pyproject.toml \
  | grep "version\|\^"
```

The current deferral from `make sync-versions` rests on an assumption of low drift. If you find PluginForge drifting more than once between Adaptive Learner releases, bring it under `sync-versions` automation. Concrete repeated drift overrides the deferral.

### Other release-time considerations

The `make sync-versions` step covers all AdaptiveLearner-internal versions. The external-dep block above is the only manual checkpoint at release time.

## Step 4b: Dependency currency check

Before running the test suite, check for outdated dependencies:

```bash
cd backend && poetry show --outdated
cd launcher && poetry show --outdated
cd frontend && bun outdated
```

Apply routine bumps (patch + minor within the same major) as part of the release. Major bumps with breaking changes get their own dedicated session, not bundled into a release.

See `lessons/release-packaging.md` "Release-cycle dependency review" for the stability filter and red-flag rules.

## Step 5: Tests

Full test suite. Every command in this list is MANDATORY.

The 2026-05-04 v0.26.0 → v0.26.3 hotfix chain (four mechanical point releases for a chmod bit, a PyInstaller spec NameError, a mypy `[no-any-return]`, and a ruff-format nit) happened because the local pre-tag verification was skipped in favor of running only `make test`. Each hotfix was caught by a CI gate that the local sweep would have caught first. Do not skip.

```bash
# Backend + all plugins
make test

# Frontend unit tests + type check
cd frontend && bunx tsc --noEmit && bun run test

# Smoke tests (fast Playwright suite)
npx playwright test --project=smoke

# Dexie-mode release gate (MANDATORY since 2026-05-26,
# DEXIE-MODE-RELEASE-GATE-01). Builds the frontend with
# VITE_STORAGE_MODE=dexie (matching the GitHub Pages
# deployment) and walks every nav-reachable route against a
# vite-preview static server, NO backend. Any error toast or
# uncaught error on any route fails this gate. The Phase 42
# Learning Repository ship-and-pray (raw HTTP 404 on Settings /
# Dashboard / Learning-Repo for every gh-pages visitor for ~24h
# after v1.26.0) is exactly the failure mode this prevents.
# Aggregated into `make release-test` so it cannot be skipped.
make test-dexie-smoke

# Linting and type checking (MANDATORY)
cd backend && poetry run ruff check app/ && poetry run mypy app/

# Pre-commit hooks on all files (MANDATORY - catches ruff-format
# nits, trailing whitespace, end-of-file fixes). The pre-push git
# hook installed by `make install-hooks` enforces this on every
# tag push (CI-PRECOMMIT-HOOK-01), but running it explicitly here
# is still mandatory because the hook fails the push, not the tag
# creation - skipping the pre-tag step makes a half-tagged repo.
cd backend && poetry run pre-commit run --all-files

# Docs discipline (MANDATORY since v0.30.0+ MKDOCS-DISCIPLINE-01).
# `make verify-docs-discipline` aggregates two layers:
#   1. verify-docs (scripts/verify_docs.py): the stdlib drift
#      verifier. FAIL gates: version badges/headers vs canonical
#      pyproject, plugin counts vs disk, theme-token parity, mkdocs
#      orphans + dead links, en<->de help-page parity. WARN signals:
#      test counts, README feature mentions, stale dates, i18n key
#      drift. Orphan detection is filesystem-based (every help page
#      on disk must have a nav entry; every nav entry must resolve).
#   2. verify-mkdocs-nav: mkdocs.yml is in sync with
#      docs/help/_meta.yaml (single source of truth for help-page
#      nav). Drift is the failure mode that produced the v0.30.0
#      docs+i18n drift audit findings.
# Full reference: docs/development/docs-verification.md. After tagging,
# `make release-tag` prints the post-release docs checklist
# (scripts/generate_docs_checklist.py) for the changelog's features.
make verify-docs-discipline

# Launcher build smoke (MANDATORY for any release that touches
# launcher/ or its embedded version - catches PyInstaller spec
# errors that only surface when the spec is exec'd by
# pyinstaller, NOT when it is imported as Python).
cd launcher && poetry run pyinstaller adaptive-learner-launcher.spec --clean --noconfirm
```

**ALL must be green.** On a red test:

1. Abort the release
2. Analyze and fix the problem
3. Only then restart the release from step 1

## Step 6: Verify the build

```bash
# Backend
cd backend && poetry build

# Frontend
cd frontend && bun run build

# Docker: build the production compose images (MANDATORY since #1990 -
# no longer "if active"). This is the build path the desktop launcher +
# install.sh use; the docker-build-smoke.yml CI gate runs the same command
# on release/** branches, but run it locally too before tagging. Build only,
# no `up`.
make docker-build-smoke
```

On a build error: stop, report, fix, restart.

## Step 7: Git tag and push

```bash
git tag -a v0.X.0 -m "Release v0.X.0"
git push origin main
git push origin v0.X.0
```

## Step 8: Create the GitHub Release

**Publish sequence (MANDATORY since v2.8.0 - Option 1, dispatch-only chain):**
The four publisher workflows carry NO `release:` trigger any more (drafts
never fire `created`; `published` would re-run the chain on draft-publish
against a non-bit-identical rebuild - the verified artifact must BE the
shipped one). Creating a release therefore produces NO image and NO
binaries by itself - the checklist carries the trigger:

1. Tag pushed, the tag commit's OWN main CI fully green (pending counts
   as not green - the gate reads real check-runs since #2178).
2. `gh release create vX.Y.Z --draft --notes-file changelog/releases/vX.Y.Z.md`
   - invisible, fires nothing.
3. Sharp chain: `gh workflow run publish-image.yml --ref vX.Y.Z -f dry_run=false -f version=X.Y.Z`
   - the green gate runs INSIDE this dispatch; then the per-arch anonymous
   pull, arm64 start, size gates, version agreement.
4. Launcher binaries: take the artifacts of the GREEN main-push builds of
   the tag commit (never rebuild - bit-drift), attach with `.sha256` files
   via `gh release upload`.
5. COMPLETENESS CHECKPOINT before going visible: the draft's asset list
   MUST equal the expected set - 3 binaries + 3 `.sha256`, the per-arch
   image archives + `.sha256` (the install docs describe the registry-free
   path as AVAILABLE), and the `image-digest.txt` asset. Missing
   anything: do not publish - a visible release must not point at
   something absent (the image rule, applied to assets). If archives are
   deliberately deferred, the docs must say "announced", not available.
6. Only after every station is green AND the checkpoint passed:
   `gh release edit vX.Y.Z --draft=false`. Record the publish run id in
   the checklist item below.


Before invoking `gh release create`, build the per-release notes file by combining the static prerequisites template with the version-specific changelog:

1. Open `.github/RELEASE_TEMPLATE.md`. Copy the "Before you install", "Download", and "Verifying downloads" sections into `changelog/releases/v0.X.0.md` if not already present.
2. Replace the trailing `## What's new` placeholder with the per-version changelog excerpt produced in Step 3.

The template is a static reference; nothing reads it automatically. The reason it exists at all is to stop every release from rewriting the prerequisites block (Docker required, guide URLs, hash-verify commands) from memory and producing inconsistent or incomplete release pages.

Then with the gh CLI (preferred):

```bash
gh release create v0.X.0 \
  --title "AdaptiveLearner v0.X.0" \
  --notes-file changelog/releases/v0.X.0.md
```

If the gh CLI is not available: print instructions for manual creation on GitHub:

- URL: `https://github.com/astrapi69/adaptive_learner/releases/new`
- Tag: select `v0.X.0`
- Title: `AdaptiveLearner v0.X.0`
- Notes: paste the contents of `changelog/releases/v0.X.0.md`
- Click "Publish release"

## Step 9: Tag and push the Docker image

If Docker images are published:

```bash
docker build -t adaptive_learner:v0.X.0 -t adaptive_learner:latest .
docker push adaptive_learner:v0.X.0
docker push adaptive_learner:latest
```

If not active: skip this step and note it in the release log.

## Step 10: Deploy the documentation site

When the help system with MkDocs is set up:

- A GitHub Action triggers automatically on push to main
- No manual step
- Verify: `https://astrapi69.github.io/adaptive_learner/` shows the new content
- Check the action status: `gh run list --workflow=docs.yml --limit=1`

On a failed deploy: pull the error from the action logs and fix it, but the release is still out.

## Step 11: Post-release documentation

- `docs/journal/chat-journal-session-{today}.md`: release entry with version, date, main changes, deploy time
- `ROADMAP.md`: mark every item included in the release as `[x]`
- `ROADMAP.md` "Blocked / Upstream Wait": read it - does this tag now trigger a
  held entry (e.g. a PR parked for the NEXT release)? If so, un-draft it, merge,
  and archive the entry. The read step for a draft parked on a tag it cannot
  point past.
- `CLAUDE.md`: update on new endpoints or architectural changes
- `.claude/rules/lessons-learned.md`: if anything noteworthy happened during the release (new pitfall, workflow improvement), document it

**Commit**: `docs: post-release documentation v0.X.0`

```bash
git push origin main
```

## Final checklist

This checklist MUST be fully checked off before the release counts as "done". Missing items block the release.

- [ ] `launcher/launcher.json` `container_volumes` still names the PREFIXED
      volume (#2154). Shipping the bare name mounts an empty volume while the
      user's database, uploads and Fernet key sit invisible in the other one.
      The "no user notification needed" answer holds only while no release
      goes out carrying the bare name.
- [ ] Reviewed the commits since the last tag
- [ ] Version number picked per SemVer and confirmed by the user
- [ ] CHANGELOG.md with the new entry committed
- [ ] `changelog/releases/v0.X.0.md` created for the GitHub release
- [ ] Version updated in all pyproject.toml and package.json
- [ ] Version updated in `__version__` and other Python modules
- [ ] pluginforge and other externally-owned Adaptive Learner deps at the current version
- [ ] `make test` green
- [ ] Frontend `tsc --noEmit` clean
- [ ] `bun run test` (Vitest) green
- [ ] `npx playwright test --project=smoke` RUN IN THIS SESSION, result recorded
      as "N passed / M silenced" with M matching `e2e/.smoke-skip-baseline.json`
      (#2170 budget gate). A tick without both numbers is the v2.6.1 false tick:
      that release checked this box while the suite never ran (its journal lists
      dexie-smoke + manual-automation, not this project) and specs had been
      failing since May. Naming the numbers is what makes the box unfakeable.
- [ ] `make test-dexie-smoke` green (MANDATORY since 2026-05-26: DEXIE-MODE-RELEASE-GATE-01 — walks every nav-reachable route against the GH-Pages-shape build with NO backend; any error toast or page crash blocks the release)
- [ ] `ruff check` clean
- [ ] `mypy app/` clean (MANDATORY since v0.26.x; not "if active")
- [ ] `poetry run pre-commit run --all-files` clean (MANDATORY)
- [ ] `make verify-docs-discipline` clean (MANDATORY since v0.30.0+: aggregates `verify-mkdocs-nav` + `check-mkdocs-orphans`; addresses the v0.30.0 docs+i18n drift audit findings)
- [ ] Backend `poetry build` successful (skipped iff `package-mode = false`)
- [ ] Frontend `bun run build` successful
- [ ] `cd launcher && poetry run pyinstaller adaptive-learner-launcher.spec --clean --noconfirm` succeeds (MANDATORY for any release touching launcher/ or its embedded version)
- [ ] `make docker-build-smoke` successful (MANDATORY since #1990: builds the prod compose images - the launcher/install.sh path; also gated in CI on `release/**` via `docker-build-smoke.yml`)
- [ ] Git tag created and pushed
- [ ] GitHub release published
- [ ] GHCR image published + verified by the `publish-image.yml` release run:
      record the RUN ID; the run itself proves anonymous pull, arm64 start,
      per-arch size gates, version agreement. "(if active)" is retired - the
      publish chain exists since v2.7.0 and an unrecorded run id is the same
      evidence-free tick the smoke box suffered.
- [ ] MkDocs site deployed and verified
- [ ] Chat journal release entry
- [ ] ROADMAP done items marked
- [ ] ROADMAP "Blocked / Upstream Wait" read: any entry triggered by this tag actioned (held PRs un-drafted + merged, entry archived)
- [ ] CLAUDE.md updated (if needed)
- [ ] Post-release commit pushed

## Troubleshooting

### Tests fail right before the release

Do not break out of the workflow. Abort the release, fix the test, commit, restart from step 1. No workarounds like "disable the test for this release".

### Build broken because of dependencies

`poetry lock --no-update` and `bun install` in both projects, then rebuild. On persistent errors: abort the release, solve the problem in its own commit.

### GitHub Action for the docs failed

The release tag stays valid. The docs deploy is a separate problem that can be fixed after the release. Note it in the chat journal.

### Docker push fails

Check the login: `docker login`. Check the tag: `docker images | grep adaptive_learner`.

On a registry problem: the release is still valid; retry the push when the registry is available again.

### Wrong version number after a tag push

```bash
git tag -d v0.X.0
git push origin :refs/tags/v0.X.0
```

Then a new tag with the correct number. **CAUTION**: only if the tag has not yet been published as a GitHub release and nobody has already pulled it.

## Versioning convention

AdaptiveLearner follows Semantic Versioning 2.0.0:

- **Major** (X.0.0): breaking changes in the API or fundamental architectural changes. Rare in the 0.x phase.
- **Minor** (0.X.0): new features, backward-compatible. Small breaking changes are acceptable in 0.x, but must be called out prominently in the CHANGELOG.
- **Patch** (0.X.Y): bug fixes, backward-compatible.

Pre-release tags (`-alpha`, `-beta`, `-rc`) are currently not used. Releases are always stable.

## Note for Claude Code

This workflow is a guide, not a rigid script. If the user explicitly asks for a deviation (e.g. "skip Docker this time"), accept it and document in the chat journal WHY it was deviated from.

But: checklist items that touch safety (tests green, build successful, correct version) must NEVER be skipped, not even on instruction. Better to postpone the release than to ship broken software.
