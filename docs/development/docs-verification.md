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
PyYAML). The one place PyYAML is needed, the `_meta.yaml` <->
`mkdocs.yml` nav-sync check, lives in `generate_mkdocs_nav.py`, run
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
| `docs-third-party` | FAIL | `mkdocs.yml` must keep `theme.font: false` and `theme.custom_dir: docs/help-overrides`, whose `partials/source.html` links `repo_url` without `data-md-component="source"` and whose `main.html` defines a `ResizeObserver` stand-in in the `libs` block: otherwise pages load Google Fonts, call api.github.com or load a polyfill from unpkg.com (#3802) | no |
| `help-index-versions` | FAIL | any `vX.Y[.Z]` literal on a `docs/help/*/index.md` front page: they are versionless (#1766) | no |
| `help-prose-versions` | FAIL | any `vX.Y[.Z]` literal in end-user help prose under `docs/help/*/**` (#1767); skips the `developer/` + `api/` reference trees, `changelog.md`, `index.md`, and `<!-- version-exempt: reason -->` lines | no |
| `help-changelog` | FAIL | a `docs/help/<locale>/changelog.md` whose newest `## vX.Y.Z` heading is older than the canonical `major.minor` (a missing patch release is not drift); a page without a version heading, or a help tree without changelog pages, fails closed (#3161) | no |
| `help-coverage` | FAIL/WARN | en<->de help-page parity (FAIL); App.tsx routes with no help page (WARN, heuristic: the route's last static segment must appear in some help slug); a route whose page lives under an underivable slug is mapped explicitly in `_ROUTE_HELP_SLUG` (#2944), and a mapping to a page missing in en or de is a FAIL (stale claim) | no |
| `locale-coverage` | FAIL | every EN help page exists in every translated locale under `docs/help/` (each language directory except `en` and `de`), unless `docs/help/.locale-gaps.json` declares the gap; a declared gap whose page now exists fails too, so the list only shrinks by a visible edit. A missing EN tree, no locale directories or an unreadable list fail closed (#3453) | no |
| `help-strong-emphasis` | FAIL | a `**` run in a help page that the CommonMark flanking rule does not pair into bold, so it shows as literal asterisks (frequent in CJK text, where bold has no surrounding spaces); fenced and inline code, HTML comments and escapes are skipped (#3655) | no |
| `help-terms` | FAIL | a term the term table `frontend/src/data/i18n-terms.json` rejects (German "Session" or "Streak" instead of "Sitzung" and "Serie", for example), in the help glossary and help pages of every language the table covers; `developer/`, `api/`, `changelog.md`, code, comments and placeholders are skipped (#3433) | no |
| `privacy-promises` | FAIL | a promise that nothing personal is sent, in any of the 11 catalog languages (#3812), or one of the four promises of #3829 (`nothing about the words you struggle with is sent anywhere`, `nothing is uploaded to a server`, `all your data stays in your browser`, `nothing is sent to a server except ...`) in a language it occurred in, in the catalogs, the help glossary, the help pages, the other current docs, the root Markdown files and the UI `t()` fallbacks; historical records (`docs/explorations/`, `docs/review/`, `docs/journal/`, `docs/roadmap-archive/`, help `changelog.md`) are exempt. Say what leaves the device instead. The check knows phrasings, so it gives precision only; a false promise in new words passes (#3830) | no |
| `testplan-parity` | FAIL | the DE and EN manual test plans differ in checkpoints, sections or the issues they cite (and how often), or the same case carries different IDs (TESTPLAN-PFLICHT; #3065, #3274) | no |
| `testplan-ids` | FAIL | the case and suite IDs of the other plans and checklists listed in `PLANS` (`scripts/testplan_ids.py`): a checkbox or suite heading without an ID, a wrong prefix, an ID used twice, a reused retired number, or a number the register holds that is neither in a plan nor retired (#3274, #3279) | no (`python3 scripts/testplan_ids.py --assign`) |
| `feature-shots` | FAIL | a PNG named in the catalogue table of `e2e/visual/features/README.md` that is not on disk, or one on disk that no row names; a row whose render is still owed carries `<!-- shot-pending: reason -->`, accepted only while one of its files is missing (#3182) | no |
| `api-reference` | FAIL | `docs/help/<locale>/api/endpoints.md` must equal what `scripts/generate_api_reference.py` renders from `schema/openapi.json`; a missing snapshot or one without operations fails closed (#3454) | no (`make sync-openapi`) |
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
i18n sync. Anything needing human writing (dated/phase prose in
ROADMAP/backlog, missing help pages, feature lists) is **flagged,
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
- **`.github/workflows/ci.yml`** has a `docs-verification` job (push +
  PR) running `verify_docs.py` + `generate_mkdocs_nav.py --check` with
  stdlib + PyYAML. Since #3800 the same job also parses every Mermaid
  code block in `docs/help` with the vendored Mermaid script
  (`scripts/verify_mermaid_blocks.mjs`): it fails on a block that does
  not parse or lacks `accTitle`/`accDescr`, on a bundle that differs
  from the pinned release or that `mkdocs.yml` does not load, and on a
  missing or changed notices file; locally `make verify-mermaid`.
  Since #3802 it also installs the docs
  environment (`docs/poetry.lock`), builds the site and scans it with
  `scripts/check_external_hosts.py` for anything a page would fetch from
  a third-party host; locally `make docs-build`, then
  `make verify-docs-external-hosts`. `deploy-gh-pages.yml` repeats the
  scan on the built site before it uploads it.
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
   current repo: a new FAIL on a correct tree means the check has
   false positives; downgrade to WARN or tighten it.
