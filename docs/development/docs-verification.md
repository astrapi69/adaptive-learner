# Documentation verification system

After 58 phases the documentation drifts on every release: version
badges, plugin counts, test counts, feature lists, help pages, mkdocs
nav, i18n catalogs and theme tokens all go stale. This system catches
that drift **before** a release ships, the same way a failing test
blocks a tag.

It **verifies** docs; it does not **write** them. Writing is human
work. The verifier tells you what is stale; the
[checklist generator](#post-release-checklist) tells you what to write.

- Verifier: [`scripts/verify_docs.py`](../../scripts/verify_docs.py)
- Checklist: [`scripts/generate_docs_checklist.py`](../../scripts/generate_docs_checklist.py)
- Nav sync (pre-existing): [`scripts/generate_mkdocs_nav.py`](../../scripts/generate_mkdocs_nav.py)

The verifier is **stdlib only** (`tomllib`, `json`, `re`, `pathlib`,
`subprocess`, `argparse`) so it runs with a bare `python3` in CI
before any project venv exists. It parses YAML-shaped files by regex
and reads the committed frontend JSON i18n bundles directly (no
PyYAML). The one place PyYAML is needed -- the `_meta.yaml` <->
`mkdocs.yml` nav-sync check -- lives in `generate_mkdocs_nav.py`, run
as a separate step.

## Checks

`verify_docs.py` runs these checks. **FAIL** blocks a release (a hard
contract with no false positives on a correct repo); **WARN** is
advisory (heuristic or count-based, where a wrong FAIL would block a
correct state).

| Check | Severity | Catches | `--fix` |
|---|---|---|---|
| `version` | FAIL | README/README-de badges, CLAUDE.md current-state, ROADMAP/backlog headers vs `backend/pyproject.toml` | badges + CLAUDE only; dated prose flagged |
| `plugins` | FAIL | CLAUDE.md / README plugin counts vs `plugins/` dirs on disk | yes |
| `test-counts` | WARN | CLAUDE.md `backend+plugins+Vitest=total` arithmetic; README test badges; optional real pytest/vitest collection (`--test-counts`, 5% drift) | total + badges |
| `feature-completeness` | WARN | README may not mention features shipped since its version badge (changelog `###` headings) | no (human writing) |
| `stale-dates` | WARN | dates >2 months older than the latest release in current-state docs | no |
| `themes` | FAIL | every `theme-*.css` must define the same canonical token set | no |
| `mkdocs` | FAIL | help pages on disk with no nav entry (orphans) + nav entries pointing at missing files (dead links) | no |
| `help-index-versions` | FAIL | any `vX.Y[.Z]` literal on a `docs/help/*/index.md` front page -- they are versionless (#1766) | no |
| `help-prose-versions` | FAIL | any `vX.Y[.Z]` literal in end-user help prose under `docs/help/*/**` (#1767); skips the `developer/` + `api/` reference trees, `changelog.md`, `index.md`, and `<!-- version-exempt: reason -->` lines | no |
| `help-coverage` | FAIL/WARN | en<->de help-page parity (FAIL); App.tsx routes with no help page (WARN, heuristic) | no |
| `i18n` | WARN | any `frontend/src/data/i18n/*.json` missing >5% of the `en` key set | runs `sync_i18n_to_frontend.py` |

Exit codes: `0` clean (no FAIL; WARN allowed) / `1` drift (>=1 FAIL) /
`2` the verifier itself could not run.

## Usage

```bash
make verify-docs              # run every check (FAIL -> exit 1)
make verify-docs-fix          # best-effort auto-fix of mechanical drift
make check-mkdocs-orphans     # just the mkdocs orphan/dead-link check
make verify-docs-discipline   # verify-docs + verify-mkdocs-nav (release gate)

# Direct (more control):
python3 scripts/verify_docs.py --list                  # list checks
python3 scripts/verify_docs.py --check version,plugins # subset
python3 scripts/verify_docs.py --test-counts           # + real collection (slow)
python3 scripts/verify_docs.py --fix                   # auto-fix
```

### `--fix` is best-effort and never corrupts docs

Only mechanically-safe drift is rewritten: version badges, plugin
counts, the CLAUDE.md test-total arithmetic, README test badges, and
i18n sync. Anything needing human writing -- dated/phase prose in
ROADMAP/backlog, missing help pages, feature lists -- is **flagged,
never edited**. ROADMAP/backlog version headers are deliberately
non-fixable because the version sits inside dated, phase-specific
prose that a naive replace would falsify.

## Post-release checklist

`generate_docs_checklist.py` turns a release's changelog into a docs
to-do list:

```bash
make docs-checklist VERSION=1.41.0
```

It reads `changelog/releases/v{VERSION}.md`, extracts the `###`
feature headings, and prints a Markdown checklist (README/README-de
mentions, CLAUDE.md notes, bilingual help pages) plus the standard
version/count/archive checks. `make release-tag` prints it
automatically after pushing the tag.

## CI + release wiring

- **`make release-test`** runs `verify-docs-discipline` as a gate
  alongside the version/lockfile/dexie gates. A stale README or
  CLAUDE.md blocks the tag.
- **`.github/workflows/ci.yml`** has a lightweight `docs-verification`
  job (push + PR) running `verify_docs.py` + `generate_mkdocs_nav.py
  --check`. Stdlib + PyYAML, no Poetry.
- **`.github/workflows/release-gate.yml`** runs the same two checks on
  every `v*` tag push.

## Adding a new check

1. Write a `check_<name>(report, ...)` function in `verify_docs.py`
   that appends `report.fail(...)` / `report.warn(...)` findings.
   FAIL only for a hard contract with zero false positives on a
   correct repo; otherwise WARN.
2. Register it in the `CHECKS` dict (the key is the `--check` name).
3. If it can auto-fix safely, take a `fix` arg and gate writes on it;
   otherwise flag only.
4. Run `python3 scripts/verify_docs.py --check <name>` against the
   current repo -- a new FAIL on a correct tree means the check has
   false positives; downgrade to WARN or tighten it.
