# Release workflow

A release is made by two workflows, not by hand. `release.yml` cuts the release branch, sets the version and runs the full gate before it pushes anything. `release-finish.yml` merges to `main`, tags and creates the draft release. The binding step-by-step version is `.claude/rules/release-workflow.md`; this page is the overview.

## Versioning convention

Adaptive Learner follows Semantic Versioning 2.0.0:

- **Major (X.0.0)** - breaking changes in API or
  architecture. Reserved for future big shifts.
- **Minor (X.Y.0)** - new features, backward-compatible.
  Default for each phase completion.
- **Patch (X.Y.Z)** - bug fixes, backward-compatible. Hotfix
  chains.

Pre-release tags (`-alpha`, `-beta`, `-rc`) are not used.
Releases are always stable.

## The path

1. **On develop, by pull request**: the release notes `changelog/releases/vX.Y.Z.md`, the "What's new" section of the help pages, and the dependency updates. The workflow refuses to start without the notes file.
2. **Rehearse**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare` cuts, sets the version and gates on the runner, and pushes nothing.
3. **Cut**: `gh workflow run release.yml -f version=X.Y.Z -f stage=prepare -f push_branch=true`. On a green gate the branch `release/X.Y.Z` is pushed; from then on develop is frozen.
4. **Check the branch**: the image build, the security scan, the WebKit gate, the visual comparison and the three launcher builds are dispatched on the release branch. A branch pushed by a workflow starts none of them by itself.
5. **Finish**: `gh workflow run release-finish.yml --ref release/X.Y.Z -f version=X.Y.Z` merges into `main` without fast-forward, tags the merge commit, opens the pull request that merges the release back into develop, and creates the GitHub Release as a draft.
6. **Publish**: `publish-image.yml` publishes and verifies the image, the launcher binaries of the green `main` builds are attached, and only then the draft becomes visible.

### The version is set in one place

`backend/pyproject.toml` is the only source. The cut sets it, and `make sync-versions` writes every other version-bearing file (the full set is `collect_targets()` in `scripts/sync_versions.py`). Nobody edits a version field by hand. `release-gate.yml` checks the pins again on the tag.

### What starts what

- a push to `main`: `ci.yml`, `deploy-gh-pages.yml` and the launcher builds
- the tag: `release-gate.yml`
- the draft release: nothing; image and binaries come from the publish step

`coverage.yml` does not run on push; it runs nightly and on demand (`gh workflow run coverage.yml --ref main`).

## Plugin versions

Plugins lock-step with the canonical app version. The same
number across every plugin `pyproject.toml` plus the plugin
`__init__.py` `__version__` literals. A future "core vs
third-party plugin" decision may unlink them, but the current
setup is uniform across all propagated files.

## Hotfix flow

A hotfix is the one release made by hand: neither workflow can cut from `main`. Branch `hotfix/vX.Y.Z` from `main`, fix, set the version and write the notes, gate the branch with `release-prepare.yml`, then `make release-finish VERSION=X.Y.Z FINISH_BRANCH=hotfix/vX.Y.Z` and `make release-publish VERSION=X.Y.Z`.

A pushed tag is never deleted or moved. A wrong release is corrected by the next version.

## Discrete pre-release dep-sweep commits

When the release cycle bumps dependencies (Vite, React,
manuscripta, etc.), keep each bump as its own commit. Reasons:

- **Bisect granularity** - a regression isolates to one bump.
- **CHANGELOG legibility** - readers see the actual
  motivation for each bump.
- **Rollback** - a bad bump can be reverted independently.

The full pattern is documented in
`.claude/rules/release-workflow.md`. The rules-as-docs
discipline keeps the human-readable docs (this page) and the
machine-readable rules in sync.
