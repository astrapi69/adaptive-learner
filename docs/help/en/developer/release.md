# Release workflow

AdaptiveLearner cuts a release on every major sub-phase
completion. The full process is automated by `make sync-versions`
and a release-gate CI job; the human steps are just version
choice, CHANGELOG, and tag.

## Versioning convention

AdaptiveLearner follows Semantic Versioning 2.0.0:

- **Major (X.0.0)** — breaking changes in API or
  architecture. Rare in the 0.x phase.
- **Minor (0.X.0)** — new features, backward-compatible. The
  default for each phase completion.
- **Patch (0.X.Y)** — bug fixes, backward-compatible. Hotfix
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

### 2. Update the CHANGELOG entry

Add a top-block entry to `docs/CHANGELOG.md` (currently
unstructured prose; the project plan tracks per-version notes
under "Phase history"). Group by Added / Changed / Fixed.

### 3. Hand-edit the canonical version

The only hand-edited version field in the entire repo:

```toml
# backend/pyproject.toml
[tool.poetry]
version = "0.X.Y"
```

### 4. Propagate

```bash
make sync-versions
```

Updates 12 files automatically:

- `frontend/package.json`
- `launcher/pyproject.toml`
- `launcher/adaptive_learner_launcher/__init__.py`
- `launcher/adaptive-learner-launcher.spec` (CFBundle plist)
- 7× `plugins/adaptive-learner-plugin-*/pyproject.toml`
- `install.sh` (regenerated from template)
- `install.ps1` (regenerated from template)

### 5. Verify

```bash
make sync-versions-check     # exits non-zero on drift
make test                    # 1312 tests must pass
cd frontend && npm run build # must succeed
```

The release-gate CI workflow (`.github/workflows/release-gate.yml`)
runs the same `sync-versions-check` on every tag push. If
local agrees but CI fails, the drift was introduced between
your local check and the push — investigate.

### 6. Commit + tag

```bash
git add -A
git commit -m "chore(release): bump to v0.X.Y + docs sweep"
git tag -a v0.X.Y -m "v0.X.Y — phase headline + summary"
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
gh release create v0.X.Y --generate-notes
```

`--generate-notes` pulls the commit list since the last tag.
You can edit the release notes after creation to highlight
the headline changes.

## Plugin versions

Plugins lock-step with the canonical app version since v0.2.0
— the same number across all 7 plugin `pyproject.toml` files.
A future "core vs third-party plugin" decision may unlink
them, but the v0.7.0 setup is uniform.

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
