# Release workflow

AdaptiveLearner cuts a release on every major sub-phase
completion. The full process is automated by `make sync-versions`
and a release-gate CI job; the human steps are just version
choice, CHANGELOG, and tag.

## Versioning convention

Adaptive Learner follows Semantic Versioning 2.0.0:

- **Major (X.0.0)** — breaking changes in API or
  architecture. Reserved for future big shifts.
- **Minor (X.Y.0)** — new features, backward-compatible.
  Default for each phase completion (we're at v1.20.0 / 34
  phases shipped).
- **Patch (X.Y.Z)** — bug fixes, backward-compatible. Hotfix
  chains.

Pre-release tags (`-alpha`, `-beta`, `-rc`) are not used.
Releases are always stable.

## The 8-step release

### 1. Capture state

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD
git diff --stat $(git describe --tags --abbrev=0)..HEAD
```

Review what landed since the last tag. Decide the bump tier.

### 2. Write the per-release notes

Add a `changelog/releases/vX.Y.Z.md` file following the
shape of the most recent release (Added / Fixed / Tests /
Closed backlog items / Commits / Upgrade notes). The
release-gate CI checks that this file exists for the tag
being pushed.

### 3. Hand-edit the canonical version

The only hand-edited version field in the entire repo:

```toml
# backend/pyproject.toml
[tool.poetry]
version = "X.Y.Z"
```

### 4. Propagate

```bash
make sync-versions
```

Updates **18 files** automatically:

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py`
- `launcher/adaptive-learner-launcher.spec` (CFBundle plist
  + CFBundleShortVersionString)
- 10× `plugins/adaptive-learner-plugin-*/pyproject.toml`
- 3× plugin `__init__.py` `__version__` literals
- `install.sh` (regenerated from `install.sh.template`)
- `install.ps1` (regenerated from `install.ps1.template`)

### 5. Verify

```bash
make sync-versions-check     # exits non-zero on drift
make test                    # 2634 tests must pass
cd frontend && npm run build # must succeed
```

The release-gate CI workflow (`.github/workflows/release-gate.yml`)
runs the same `sync-versions-check` on every tag push. If
local agrees but CI fails, the drift was introduced between
your local check and the push — investigate.

### 6. Commit + tag

```bash
git add -A
git commit -m "chore(release): bump version to vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z — phase headline + summary"
```

Tag messages are annotated, multi-line, and summarise the
release. They become the GitHub Release notes when the next
step runs.

### 7. Push

```bash
git push origin main --tags
```

Triggers:

- `ci.yml` on the new commit (tests)
- `release-gate.yml` on the new tag (version-pin drift check)
- `coverage.yml` on the new commit (coverage HTML)
- `deploy-gh-pages.yml` on the new commit (publish public
  site)
- `launcher-{linux,macos,windows}.yml` when GitHub creates
  the Release from the tag

### 8. Create the GitHub Release

```bash
gh release create vX.Y.Z \
  --title "Adaptive Learner vX.Y.Z" \
  --notes-file changelog/releases/vX.Y.Z.md
```

`--notes-file` ensures the GitHub Release page matches the
per-release notes committed in step 2.

## Plugin versions

Plugins lock-step with the canonical app version. The same
number across all 10 plugin `pyproject.toml` files plus the
three plugin `__init__.py` `__version__` literals. A future
"core vs third-party plugin" decision may unlink them, but
the v1.20.0 setup is uniform across the 18 propagated files.

## Hotfix flow

Patch-level releases (0.X.1, 0.X.2) follow the same 8 steps.
The "Hotfix history" section of the release CHANGELOG records
the chain when multiple hotfixes land back-to-back.

## Discrete pre-release dep-sweep commits

When the release cycle bumps dependencies (Vite, React,
manuscripta, etc.), keep each bump as its own commit. Reasons:

- **Bisect granularity** — a regression isolates to one bump.
- **CHANGELOG legibility** — readers see the actual
  motivation for each bump.
- **Rollback** — a bad bump can be reverted independently.

The full pattern is documented in
`.claude/rules/release-workflow.md`. The rules-as-docs
discipline keeps the human-readable docs (this page) and the
machine-readable rules in sync.
