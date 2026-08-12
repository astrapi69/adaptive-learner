# Testing

AdaptiveLearner's test discipline is enforced by `make test`
on every change. The strategy is a pyramid: unit at the base,
integration in the middle, E2E smoke at the top.

## Test counts

| Layer | Tool |
|---|---|
| Backend unit + integration | pytest ^9 |
| Plugin tests (all plugins) | pytest ^9 |
| Frontend unit + integration | Vitest 4 |
| E2E smoke | Playwright |
| Dexie-mode release gate | Playwright |

The counts grow every release. To avoid duplicated numbers
that drift out of sync, this page does NOT hardcode a total.
`docs/audits/current-coverage.md` is the single canonical,
always-current source for test counts and coverage. The
plugins are assessment, the AI providers (anthropic / openai /
gemini / perplexity), session, tracking, tools, gamification,
anki, notebooklm, learning-repo, content-loader, and missions.

## Test-driven development: the workflow

Everything below this section describes the infrastructure: which
runner to invoke, how to mock, where CI runs what. This section
describes the order of work. The binding norm lives in the
repository's rule catalogue (`.claude/rules/tdd.md` and the Tests
section of `.claude/rules/coding-standards.md`); this page explains
the workflow and walks through one real cycle. Where the two differ,
the rule catalogue wins.

The cycle is Red-Green-Refactor:

1. **RED** - write a test that describes the wanted behaviour, and
   run it. It must fail, and it must fail for the expected reason.
2. **GREEN** - write the minimal code that makes it pass. Nothing
   "for later".
3. **REFACTOR** - clean up names, duplication, formatting. The tests
   stay green and are not touched.

### When the obligation applies

Every change with behaviour: a new code path, a condition, a
calculation, a validation, a mapping. Bug fixes are the strictest
case: a fix without a first-failing test is not a proven fix. The
reproduction test is written before the fix and stays in the repo as
the regression pin afterwards.

It does not apply to pure renames, mechanical refactors already
covered by existing tests (the suite staying green is the proof),
formatting, configuration without logic, or documentation.

### A real cycle from this repository

The example is the release helper `scripts/bump_roadmap_header.py`
with its suite `backend/tests/test_bump_roadmap_header.py`. It was
chosen because its red state is unambiguous and needs no domain
knowledge: the module under test did not exist yet, and the decisive
error case is a missing file.

**What was to be built**, in two sentences: `docs/ROADMAP.md` and
`docs/backlog.md` open with a dated "Current state" prose entry that
had gone stale for five releases in a row. The helper prepends the
released version as the new entry (summary seeded from the release
notes), demotes the previous entry into the prior chain, and must
refuse loudly when the release-notes file or the header anchor is
missing.

**The test first.** The fixture builds the real repo shape in
`tmp_path` (a `backend/pyproject.toml` carrying the canonical
version, both header files, one release-notes file), and the tests
drive the CLI entry point, not internal functions:

```python
@pytest.fixture()
def fake_repo(tmp_path: Path) -> Path:
    """Build a minimal repo layout the script operates on."""
    (tmp_path / "backend").mkdir()
    (tmp_path / "backend" / "pyproject.toml").write_text(
        '[tool.poetry]\nname = "adaptive_learner"\nversion = "2.7.0"\n',
        encoding="utf-8",
    )
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "ROADMAP.md").write_text(ROADMAP_TEMPLATE, encoding="utf-8")
    (docs / "backlog.md").write_text(BACKLOG_TEMPLATE, encoding="utf-8")
    releases = tmp_path / "changelog" / "releases"
    releases.mkdir(parents=True)
    (releases / "v2.7.0.md").write_text(CHANGELOG_BODY, encoding="utf-8")
    return tmp_path


def test_bump_prepends_current_state_and_demotes_prior_when_stale(
    fake_repo: Path,
) -> None:
    exit_code = bump_roadmap_header.main(["--repo-root", str(fake_repo), "--date", "2026-07-30"])
    assert exit_code == 0

    roadmap = (fake_repo / "docs" / "ROADMAP.md").read_text(encoding="utf-8")
    assert roadmap.count("Current state:") == 1
    assert "Current state: **v2.7.0 (released 2026-07-30 - " in roadmap
    assert (
        "see changelog/releases/v2.7.0.md).** Recent prior: **v2.6.1 (released 2026-07-24"
        in roadmap
    )
    assert "Recent prior: **v2.6.0" in roadmap
```

The error case the helper exists for: the release-notes file is
missing, so the run must fail instead of writing a half-truth into
the headers.

```python
def test_bump_fails_when_changelog_missing(fake_repo: Path) -> None:
    (fake_repo / "changelog" / "releases" / "v2.7.0.md").unlink()
    exit_code = bump_roadmap_header.main(["--repo-root", str(fake_repo), "--date", "2026-07-30"])
    assert exit_code == 1
```

The file holds six tests in total; the other four cover idempotence
at the canonical version, a missing header anchor, the seed-summary
extraction, and `--dry-run` writing nothing. Read the file itself for
the complete picture.

**The red run.** Before one line of implementation existed:

```text
$ poetry run pytest tests/test_bump_roadmap_header.py -q
ERROR tests/test_bump_roadmap_header.py - FileNotFoundError: [Errno 2] No suc...
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
1 error in 0.09s
```

(The truncated line is pytest's own `-q` output, unedited.)

**Why this is the most important step.** A test that was never red
proves nothing about what it checks. It can be green because it asks
the wrong question, because it never reaches the code, or because its
fixture contains nothing. This repository has paid for that lesson
more than once:

- Five consecutive "fixed" backup releases (#49, #57, #64, #115,
  #117) each shipped with passing unit tests, and none of them
  produced a working export/import round-trip in the real app.
  Green, and wrong: the tests asked a question the real data never
  asked. That history is why the manual backup round-trip gate
  exists (BACKUP-AKZEPTANZTEST in `.claude/rules/quality-checks.md`).
- The content availability oracle (#1816 / #1818) was green against
  hand-built `{source, id}` fixtures that encoded the author's own
  assumption about what `listSets` returns. Against the real
  `ContentSetEntry` shape the assumption was false in API mode;
  module and tests were green and wrong together. That is the most
  common trap: building the fixture to fit the test instead of
  copying the real data shape into the fixture.

A note on the quality of a red: the collection error above is
acceptable only because the module under test did not exist at all.
For a brand-new file, "cannot import" is the expected reason. The
moment the module exists, every test must fail for its own reason:
the missing-changelog test above goes red through `exit_code == 1`,
not through an import error. A test that is red because of a typo in
an import has proven nothing.

**The code that makes it green**, in its first version. The core is
an anchored replacement plus a fail-loud guard in the entry point:

```python
ROADMAP_ANCHOR = re.compile(r"Current state: \*\*v(\d+\.\d+\.\d+) \(released ")


def bump_roadmap(text: str, version: str, date: str, summary: str) -> str | None:
    """Prepend the new Current-state entry; None when already current."""
    match = ROADMAP_ANCHOR.search(text)
    if match is None:
        raise ValueError("ROADMAP.md: 'Current state: **vX.Y.Z (released' anchor not found")
    if match.group(1) == version:
        return None
    new_entry = (
        f"Current state: **v{version} (released {date} - {summary} "
        f"see changelog/releases/v{version}.md).** "
        f"Recent prior: **v{match.group(1)} (released "
    )
    return text.replace(match.group(0), new_entry, 1)
```

```python
    changelog_path = repo_root / "changelog" / "releases" / f"v{version}.md"
    if not changelog_path.exists():
        print(f"ERROR: {changelog_path} not found - draft the release notes first")
        return 1
```

**The green run:**

```text
$ poetry run pytest tests/test_bump_roadmap_header.py -q
......                                                                   [100%]
6 passed in 0.16s
```

**The cleanup afterwards.** In this cycle it was purely mechanical:
`ruff format` reformatted the new test file before the commit
("1 file reformatted"), no logic change, and the suite stayed green.
When a real refactor is needed (naming, extraction, deduplication),
the same contract holds: the tests are not touched and are green
before and after.

### Running the cycle in this project

```bash
cd backend && poetry run pytest tests/test_<yourfile>.py -q   # the tight loop
make test                                                     # the full gate before commit
```

The frontend equivalent of the tight loop is
`cd frontend && bunx vitest run src/path/to/file.test.tsx`. The
pre-commit hook runs the backend smoke suite on every commit either
way, and `make test` must be green after every change.

## Backend pytest

```bash
make test-backend
cd backend && poetry run pytest -k "test_session" -v
cd backend && poetry run pytest --pdb
```

Tests live in `backend/tests/`. Fixtures in `conftest.py`
provide a fresh in-memory SQLite DB per test, the
`TestClient`, and a mocked plugin manager. Test isolation is
hard - `ADAPTIVE_LEARNER_TEST=1` is set before any `app.*`
import.

## Plugin tests

Each plugin has its own `tests/` directory:

```bash
make test-plugins              # all 13
make test-plugin-session       # just one
cd plugins/adaptive-learner-plugin-session && poetry run pytest
```

Plugin tests don't load the FastAPI app - they exercise the
plugin's modules in isolation. Mock the `pluggy.PluginManager`
when testing hook firing.

## Frontend Vitest

```bash
make test-frontend                # runs Vitest from frontend/
cd frontend && bunx vitest         # watch mode
cd frontend && bunx vitest run src/storage/  # one directory
```

Run Vitest from `frontend/` (its config lives in
`frontend/vite.config.ts`), or via `make test-frontend`. From
the repo root the config is not found, the `node` environment
is used, and DOM-touching tests fail with
`ReferenceError: document is not defined`.

Tests live alongside the source: `Component.test.tsx` next to
`Component.tsx`. happy-dom is the environment; React 19 + RTL.
The i18n parity guard (11 languages), the theme-token parity
guard, and the design-token "no hardcoded colors" guard run as
Vitest tests inside this same suite.

## Mock patterns

**AI providers**: mock `global.fetch` and assert on the URL,
headers, body:

```typescript
beforeEach(() => {
  global.fetch = vi.fn(async (input, init) => {
    calls.push({url, method, body});
    return new Response(JSON.stringify({content: [{type: "text", text: "hi"}]}), {status: 200});
  });
});
```

**fake-indexeddb**: at the top of every Dexie test file:

```typescript
import "fake-indexeddb/auto";

beforeEach(async () => {
  await _resetDbForTests();
  const {IDBFactory} = await import("fake-indexeddb");
  (globalThis as unknown as {indexedDB: IDBFactory}).indexedDB = new IDBFactory();
});
```

Each test gets a fresh in-memory IndexedDB - no leakage.

**api/client.ts mocks** (legacy pages):

```typescript
vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {...actual, api: {...actual.api, users: {...actual.api.users, get: apiGetMock}}};
});
```

The page imports `getStorage()`, which delegates to
ApiStorage, which delegates to `api.*`. The mock cuts in at
the `api.*` layer and still fires through the storage stack.

## Playwright E2E

```bash
cd e2e && npx playwright test
cd e2e && npx playwright test --ui   # interactive
cd e2e && npx playwright test smoke/mobile-viewports.spec.ts
```

Smoke specs cover the critical user paths:

- Landing language picker + onboarding form
- Assessment 12 questions + radar render
- Session start + end + rate
- Settings language + API key
- Curriculum create
- Mobile viewports (iPhone SE, iPhone 14, Pixel 7, iPad)

Specs use `data-testid` selectors only - no brittle CSS
selectors. The smoke specs are NOT on the `make test` path;
they need a running app (`make dev-bg` first).

Beyond `e2e/smoke/`, the `e2e/` tree holds three more spec
families:

- `e2e/dexie/` - the Dexie-mode release gate. Builds the
  frontend with `VITE_STORAGE_MODE=dexie` (the GitHub-Pages
  shape, no backend) and walks every nav-reachable route; any
  error toast or page crash fails it. Run with
  `make test-dexie-smoke`.
- `e2e/visual/` - visual-baseline regression specs.
- `e2e/manual-automation/` - Playwright automation of the
  manual test plan.

## Coverage

```bash
make test-coverage   # opt-in; slow + thermally heavy
```

Coverage is a report, not a merge gate, so it does not run on
PRs. The `coverage.yml` workflow runs nightly (and on demand);
download the artifacts:

```bash
gh run download --name backend-coverage
gh run download --name frontend-coverage
```

Targets per `.claude/rules/quality-checks.md`:

- Services + business logic: 95% min
- API endpoints: 90% min
- Frontend components with logic: 85% min
- Hooks + utilities: 95% min

Overall: 85-95% project-wide.

## Pre-commit

```bash
cd backend && poetry run pre-commit install
```

Hooks: ruff check (auto-fix), ruff format, trailing
whitespace, end-of-file fixer, check-yaml, check-json,
check-added-large-files, check-merge-conflict, frontend
ESLint, a plugin lockfile/pyproject pairing guard, and a
bundled-content stats validator. In the CI pre-commit job the
`prettier-frontend` and `eslint` hooks are skipped (the
Frontend Tests job runs ESLint with deps installed instead).

## CI

CI splits into two tiers: correctness gates run on every PR
(they must pass to merge), and the expensive or warn-only
suites run on the night shift and at release time.

`.github/workflows/ci.yml` runs on push to `develop` / `main`
and on every PR (Python 3.12):

1. Backend tests (pytest)
2. Plugin tests (`make test-plugins`, all 13 via the backend venv)
3. Frontend: `tsc --noEmit`, ESLint (`--max-warnings 0`),
   circular-dependency check, Stylelint, Vitest, `vite build`,
   `npm audit`
4. Pre-commit hooks on all files
5. Backend ruff + mypy + pip-audit
6. Docs drift verifier (`verify_docs.py` + mkdocs-nav sync)

**Test Impact Analysis (#615):** on a PR only the impacted
tests run - `vitest run --changed origin/<base>` and
`pytest --testmon`. Push to `develop` / `main`, the nightly
runs, and release runs always run the FULL suite. The fallback
to the full suite is automatic (unresolvable base ref, or a
testmon cache miss).

Two more PR gates live in their own workflows:

- `complexity-check.yml` - the complexity ratchet gate
  (`make check-complexity-gate`, radon for Python + ESLint
  complexity for TS). It is a baseline ratchet: it fails only
  on NEW or regressed offenders versus `.complexity-baseline`,
  so it blocks new complexity without forcing a sweep of
  pre-existing debt. The full warn-only complexity report runs
  nightly.
- `cohesion-check.yml` - the file-size guard (gate against
  `.filesize-whitelist`) plus two class-name gates: dead CSS
  class names (`check-dead-classnames.py` against
  `.dead-classnames-baseline`) and the **unstyled-className
  gate** (`--unstyled`, a ratchet against
  `.unstyled-classnames-baseline`) - a `className` whose tokens
  are all dead blocks the PR. The companion folder-size guard
  runs locally via `make check-folder-size`.
- `visual-baseline-gate.yml` - a PR that changes
  visual-critical paths (lesson components, exercise renderers,
  theme/CSS files) must carry the affected baseline screenshots
  in the same PR; escape label `visual-baselines-unaffected`
  for provably inert changes.
- `testid-reference-gate.yml` - if a PR removes or renames a
  `data-testid` that an E2E spec statically references (on a
  high-user-visibility surface) without touching the spec, the
  gate fails (`make check-testid-refs`); escape label
  `testid-refs-unaffected`.
- `docker-build-smoke.yml` - build-only smoke of the production
  compose images (the launcher / install.sh path), path-filtered
  on PRs, plus on `release/**`, weekly, and on dispatch;
  locally `make docker-build-smoke`.

**Night shift / release (not on PRs):**

- `dexie-smoke.yml` - Dexie-mode E2E gate (daily + on
  `release/**` + dispatch; `make test-dexie-smoke` locally)
- `coverage.yml` - coverage report (daily + dispatch)
- `security-scan.yml` - pip-audit / npm audit / bandit
  (weekly + on `release/**` + dispatch; warn-only)
- `content-stats.yml` - content-stats drift vs a fresh content
  checkout (daily + dispatch)
- `mutation-frontend.yml` - Stryker mutation testing (nightly
  behind the repo variable `ENABLE_NIGHTLY_MUTATION` +
  dispatch; each run mutates one slice of the files so the run
  fits the job timeout); backend mutation testing uses mutmut
- `webkit-gate.yml` - the real-WebKit engine layout gate
  (iOS/Safari bug classes the Chromium gates structurally
  cannot see), daily behind the repo variable
  `ENABLE_NIGHTLY_WEBKIT`, always on `release/**` and on
  dispatch
- `visual-regression.yml` - the visual baseline matrix (daily +
  dispatch; `update_baselines=true` re-renders the baselines in
  CI and uploads them as an artifact)
- `visual-baseline-sync.yml` - service workflow: renders the
  baselines in CI and pushes them as a commit onto the PR
  branch (label `refresh-visual-baselines`, or dispatch with a
  PR number) - image review before merge stays mandatory

`.github/workflows/release-gate.yml` runs on tag pushes:
verifies version pins are synced across all version-bearing
files (no drift), plugin lockfiles match, and regenerated
artifacts are up to date.

## Manual test plan

What automation cannot cover (layout, readability, touch
interaction, theme contrast) is checked by a manual checklist
before every larger release:
[MANUAL-TESTPLAN.md](https://github.com/astrapi69/adaptive-learner/blob/main/docs/reference/MANUAL-TESTPLAN.md).
