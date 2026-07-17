# Known pitfalls and patterns

These rules come from real development and solve problems that would otherwise come back over and over.

## Never run an ad-hoc script against the real `SessionLocal`

Surfaced 2026-06-02 during BACKUP-API-RESTORE-01. While debugging a
failing test, a one-off `poetry run python -c "..."` script imported a
test helper (`_wipe_all_tables`) AND `app.database.SessionLocal`, then
ran it. Because the script set NO environment variables, `SessionLocal`
bound to the REAL engine pointed at the production-marked data dir
(`~/.local/share/adaptive_learner/`, carrying `.adaptive-learner-production`).
The helper's `DELETE FROM <every table>` + `db.commit()` wiped the DB.
With `PRAGMA secure_delete=ON`, the freed pages were zeroed — the data
was unrecoverable from the file. (This time it was only test data.)

### Why the existing protection didn't fire

The `conftest.py` tripwire (production marker -> `pytest.exit(2)`) only
runs under pytest. An ad-hoc `python`/`poetry run python` invocation,
a REPL, or a maintenance one-liner never loads conftest, so nothing
stopped the write. "We have a tripwire" was true and irrelevant — it
guarded the wrong entry point.

### Rules

1. **Never bind `app.database.SessionLocal` (or `engine`) in an ad-hoc
   script without first pointing it at a throwaway dir.** Set BOTH
   `ADAPTIVE_LEARNER_TEST=1` and `ADAPTIVE_LEARNER_DATA_DIR=$(mktemp -d)`
   BEFORE any `app.*` import, or — better — write the check as a real
   pytest test so conftest's isolation + tripwire apply.
2. **A repro that mutates the DB belongs in pytest, not in `python -c`.**
   The whole point of the test harness is the in-memory DB + the
   tripwire. Reaching for `poetry run python` to "just check something"
   bypasses both.
3. **Destructive helpers must self-guard.** Any function that bulk-deletes
   / wipes / drops calls `app.db_guard.assert_safe_for_destructive_use()`,
   which raises on a production-marked dir.

### The process-wide guard (the real fix)

`app/db_guard.py` (added in this session) installs a SQLAlchemy
`before_cursor_execute` listener on the sync engine that refuses
full-table `DELETE` (no `WHERE`) / `DROP TABLE` / `TRUNCATE` when the
data dir is production-marked AND the process is not the app runtime.
The FastAPI lifespan calls `db_guard.mark_app_runtime()` so the running
app is unaffected (and pays zero per-statement cost); scoped
`DELETE ... WHERE ...` is never touched. Intentional maintenance sets
`ADAPTIVE_LEARNER_ALLOW_PRODUCTION_DESTRUCTIVE=1`. This is the layer the
conftest tripwire was missing: it guards EVERY process, not just pytest.

### Pairs with

- "Filesystem isolation: production data lives outside the project tree"
  — same family. That rule covers test-vs-prod path resolution; this one
  covers the case where a human (or assistant) hand-runs code that
  resolves to prod anyway.
- "Module-level caches survive test boundaries" — both are about the gap
  between "the test harness is safe" and "this specific way of running
  code is safe". The harness's guarantees only hold for code that runs
  through the harness.

## Gitignored config + stale example = silent CI drift

Surfaced 2026-05-23 closing
`COVERAGE-WORKFLOW-PLUGIN-INTEGRATION-01`. When a config file
is gitignored (so contributors can keep local edits) AND the
app bootstraps a missing config by copying from a committed
`.example` sibling, the example MUST be updated every time the
production config gains a load-bearing entry. Otherwise CI —
and any other fresh-checkout environment — silently runs with
the example's shape, not the production shape.

### The trap

`backend/config/app.yaml` is gitignored. `app/main.py`
copies `app.yaml.example -> app.yaml` on first boot when no
local file exists. Three new plugins (`gamification`, `anki`,
`notebooklm`) were enabled in the developer's local `app.yaml`
when Phases 29A/30B/32 landed, but the example was never
updated. Every CI push for ~5 releases ran with only 7 of 10
plugins enabled. 55 plugin-integration tests failed silently
in the background.

The trap was reinforced by:

- Local `make test` was green for every developer (everyone's
  local `app.yaml` carried the right shape; the example never
  got exercised on those machines).
- The investigation that filed the backlog item hypothesised
  about `pytest-cov` instrumentation races and entry-point
  registration ordering — none of which the actual CI log
  supported. The smoking-gun log line
  `Plugins enabled in config (7): ...` named the 7 enabled
  plugins explicitly on every run, but the investigation
  never read that line.

### Rule

For any gitignored config that has a committed `.example`
fallback used to bootstrap fresh environments:

1. **Treat `.example` as part of the contract**, not a
   "for reference" file. It IS what CI / new contributors /
   docker-build runs against.
2. **When you add or remove a load-bearing entry in the
   real config, update the `.example` in the same commit.**
   Pre-commit hook ideas: a check that diffs the structural
   shape (top-level keys, list lengths under known paths)
   between the two files and warns on drift.
3. **The investigation of a CI-only failure must include
   the comparison `diff <real-file> <.example-file>`** as
   step 0, before any hypothesis about flaky tests or
   tooling races.

### Detection grep

For self-audit on any gitignored config in the project:

```bash
# Find every gitignored config that has a committed .example.
git ls-files --others --ignored --exclude-standard \
  | while read f; do
      if [ -f "$f.example" ] || [ -f "$(dirname "$f")/$(basename "$f" .yaml).yaml.example" ]; then
        echo "$f"
      fi
    done
```

Each match is a candidate for the drift pattern. Diff them
before assuming CI is correct.

### Anti-pattern: hypothesis chains that never read the log

The handover for this bug burned ~2-3 hours of investigation
across multiple sessions modelling `pytest-cov` / entry-point /
fixture-order interactions, then ranked four fix paths from
"highest confidence" downward. The actual CI log printed the
exact failure mode at INFO level on every run; the
investigation simply didn't read it. When debugging a CI
failure, the FIRST artifact to examine is the failing job's
log — specifically the application's own startup INFO lines.
Hypothesis-chain triage works for symptoms with no observable
diagnostic; it actively harms when the diagnostic is sitting
in plain text in the log.

### Pairs with

- "User-perceived bug ≠ code bug: the perception-lag class"
  — same family. Both rules push back against
  hypothesis-first triage when the evidence is one log-line
  away.
- "Real-world data audit BEFORE implementation prevents
  spec-vs-reality drift" — the corollary at the debugging
  end: audit the actual evidence before the spec.

## TipTap image node in AdaptiveLearner is `imageFigure`, not `image`

AdaptiveLearner's editor ([frontend/src/components/Editor.tsx](../../frontend/src/components/Editor.tsx)) does NOT load `@tiptap/extension-image`. It loads `@pentestpad/tiptap-extension-figure`, which registers its node under `name: "imageFigure"`. `@tiptap/extension-image` IS in `package.json` but is never imported.

Consequence: any TipTap doc that contains a plain `{type: "image", ...}` node fails the editor's strict ProseMirror schema. The unknown node breaks doc construction and the editor renders empty — for the WHOLE doc, not just the image.

Anyone writing an HTML→TipTap converter, a TipTap-emitting importer, or generating TipTap JSON from any other source (AI, scraper, migration) MUST emit `imageFigure`, not `image`. Same attrs (`{src, alt, title}`) — the imageFigure node spec is `content: "inline*"` so omitting `content` is fine; the schema accepts both `{type, attrs}` and `{type, attrs, content: []}`.

Symptom of the wrong type: title + metadata appear in the editor chrome, the editor body is empty, no console error in the browser (ProseMirror logs the schema rejection at debug level only). The article-list dashboard shows everything fine because it reads `Article.title` directly, not `content_json`. The bug is invisible until someone actually opens the editor.

Why this is easy to miss:
- TipTap's official docs and tutorials universally use `image` in code samples, so any importer modeled on those docs gets the type wrong by default.
- The toolbar's image-upload button works regardless: `Figure.addCommands.setImage(...)` dispatches an `imageFigure`-typed node internally, masking that the schema doesn't accept the literal name `image`.
- The editor's own markdown serializer at [Editor.tsx:1396](../../frontend/src/components/Editor.tsx#L1396) handles `type === "image"` as if it expected to see one, which is misleading; the serializer is reading nodes already in the doc, where they would only appear if some other extension produced them.

If a switch to `@tiptap/extension-image` ever happens (e.g. dropping the Figure extension), be aware that both extensions register a `setImage` command. Adding both side-by-side will silently shadow one toolbar behavior.

Walker shipped with this bug originally (commit `b986397`); fix landed in `cfd8b57` along with a regression-pin test in `tests/test_walker.py::test_image_node_type_is_imageFigure_not_image` that fails loudly with the actionable error message if the type ever regresses to `image`. A one-time data-fix script at `scripts/fix_medium_import_image_nodes.py` patched the 209 already-imported articles (152 had image nodes; 451 nodes total renamed).

## React 18 dev-mode double-effect-mount strands `mockImplementationOnce`

React 18 in development mode (Strict Mode and/or its testing-library equivalent) deliberately mounts components twice and runs effects twice to surface non-idempotent setup. Combined with happy-dom + Vitest, the result is that a `useEffect` calling an API mock fires twice on the first render.

If the test sets `mockImplementationOnce(returnValue)` per test, the FIRST useEffect call consumes the implementation and the SECOND call falls through to the default `vi.fn()` (which returns `undefined`) — the component then sees the default empty state and the test fails on a stale assertion.

Fixes:
- **Use `mockImplementation(...)` (no `Once`).** The implementation persists across both effect mounts. Per-test `afterEach { mock.mockClear() }` (NOT `mockReset`) keeps the implementation alive across test boundaries while still resetting call history.
- **Set a default implementation in the `vi.mock` factory itself**, e.g. `getPlugin: vi.fn(async () => ({ settings: {} }))`. Tests that don't care about the response can rely on the default; tests that do override per-test via `mockImplementation`. `mockClear` (not `mockReset`) preserves the factory default between tests.

The `mockClear` vs `mockReset` distinction matters specifically because of the factory-default pattern: `mockReset` strips the factory's implementation and the next test starts with a vanilla `vi.fn()` returning undefined, which crashes the next render's `useEffect` chain with `Cannot read properties of undefined (reading 'then')`.

## XHR mocks need a function constructor, not an arrow

`vi.stubGlobal("XMLHttpRequest", vi.fn(() => fakeXhr))` fails at runtime with `TypeError: () => fakeXhr is not a constructor`. Arrow functions cannot be invoked with `new`.

The simple fix: stub with a regular function expression, which JS allows as a constructor: `vi.stubGlobal("XMLHttpRequest", function () { return fakeXhr; })`. The `return` of an explicit object from a constructor-called function replaces the implicit `this` instance, which is exactly what we want here — the test's pre-built `fakeXhr` object becomes the result of `new XMLHttpRequest()`.

Generalizes to any global that callers invoke with `new` (`WebSocket`, `Worker`, etc.). Stubbing such globals with arrow functions silently breaks; stubbing with a regular function or a class works.

## Alembic `fileConfig` silences every existing logger

`migrations/env.py` is generated from Alembic's template, which calls `fileConfig(config.config_file_name)` unconditionally. Two side effects burn time on the day your INFO logs stop appearing:

1. **`disable_existing_loggers=True` is the default.** Every `logging.Logger` created BEFORE `init_db()` (in our app: at least `app.main`'s module-level logger) is disabled. Subsequent `logger.info(...)` calls drop to the floor.
2. **The root logger level is reset** to whatever `[logger_root] level = ...` says in `alembic.ini` (`WARNING` in this repo). So even fresh loggers created after the call inherit the lower level.

**Symptom**: you see `Starting AdaptiveLearner` (logged before `init_db()`), then alembic's own setup messages, then your subsequent INFO lines silently disappear. Plugin loading still WORKS — routes mount, the app responds — but the audit trail is dark. Burned several debugging hours on the v0.30.0+ medium-import session by treating "no plugin loading log = plugin not loading" as a true causal link.

**Fix**: in `migrations/env.py`, gate the `fileConfig` call so it only fires when the FastAPI app has not already configured logging:

```python
import logging
from logging.config import fileConfig
...
if config.config_file_name is not None and not logging.getLogger().handlers:
    fileConfig(config.config_file_name, disable_existing_loggers=False)
```

The standalone `alembic` CLI invokes env.py before any handler is attached (`logging.getLogger().handlers` is empty), so the guard preserves the documented CLI behaviour. Embedded use through `init_db()` runs under the FastAPI/uvicorn handler stack and skips the call.

**Generalises to**: any library that ships an env.py-style hook calling `fileConfig`/`dictConfig` at import time. Wrap the call in a "have handlers already?" check whenever the same module is imported in two contexts (CLI vs. embedded).

## Plugin settings YAML lives in `backend/config/plugins/`, not in the plugin's own directory

PluginForge reads each plugin's settings from the backend-wide `config_dir`, configured in `app.yaml` as `plugins.config_dir: config/plugins`. So the canonical path for a plugin's settings file is:

```
backend/config/plugins/{plugin_slug}.yaml
```

NOT `plugins/adaptive-learner-plugin-{slug}/config/{slug}.yaml`. The latter is fine for shipping the file inside the plugin's distributable ZIP, but at runtime PluginForge looks ONLY in the backend's config_dir.

**Symptom**: the plugin loads and activates, but `self._settings = self.config.get("settings", {})` returns an empty dict. User-visible settings silently fall back to in-code defaults; the YAML you wrote is never read. The startup log shows it as a single DEBUG line:

```
DEBUG  pluginforge.config: Config file not found, using empty defaults:
       backend/config/plugins/{slug}.yaml
```

That line has appeared in the wild for one shipped-without-defaults plugin (`medium-import` v1) and would have for any future plugin that follows the same wrong-place template.

**Mitigation**: when scaffolding a new plugin, drop the settings YAML directly into `backend/config/plugins/`. Mirror it inside the plugin's own `config/` only if the plugin's ZIP target needs it.

## Commit ordering for breaking-change dependency upgrades

- Pin the version bump BEFORE migrating call sites when the new code uses imports that only exist in the new release. Backward-compatible re-exports during a transition cycle keep the intermediate state green. Doing it the other way - migrate first, bump pin last - leaves the migration commit red against the still-installed old version and breaks the "each commit green individually" rule.
- Path-installed plugins do not auto-refresh when their `pyproject.toml` changes. After bumping a transitive dependency in a plugin (e.g. `httpx` in `plugins/adaptive-learner-plugin-ai-anthropic/pyproject.toml`), run `poetry lock` AND `poetry install` in the BACKEND directory too - the backend's `poetry.lock` caches the resolved deps of the plugin's old pin until you regenerate.

## Atomic commits are bounded by "green individually", not "one thing"

- The "atomic commit" rule is "each commit is the smallest reversible unit that leaves the tree green", not "each commit does one conceptual thing". When splitting a change creates a broken intermediate state - e.g. the source change deletes a function the existing tests still import - the split is wrong. Combine the pieces into one commit.
- Concrete example: a refactor that renames an exported helper. The source edit and the test edit MUST land together; otherwise either the source commit fails because tests still import the old name, or the test commit fails because the new name does not exist yet. Splitting along conceptual lines ("source change" / "test update") here produces a commit series that cannot bisect cleanly.
- Conceptual split is a goal; green-individually is a hard constraint. When they conflict, the constraint wins.

## CI vs local environment drift

Two patterns cause "passes locally, fails in CI" in Poetry-managed projects:

1. `poetry install` does not remove dependencies that vanished from pyproject.toml. Stale `.dist-info` directories in long-tenured local venvs keep importing modules that the lockfile no longer references. CI starts fresh and immediately fails. Mitigation: run `poetry install --sync` periodically, especially before assuming "local green = CI green".

2. Path-dependency declarations in pyproject.toml must include every plugin or sub-package whose code is exercised by tests. Plugin discovery via `importlib.metadata.entry_points()` only sees what's actually installed, not what exists on disk. When creating a new plugin, the path-dep declaration in backend/pyproject.toml is mandatory, not optional.

Detection: if local tests pass but CI fails on routes returning 404, suspect missing path-deps before suspecting code bugs.

## Doc files: existence is not discoverability

- When you add a new help page under `docs/help/{lang}/`, verify it appears in `docs/help/_meta.yaml`. The MkDocs nav generator (`scripts/generate_mkdocs_nav.py`) reads that file as the single source of truth; pages not listed there are unreachable from the side nav even though direct URLs and in-text links still work. We hit this with `ai.md` and `developers/plugins.md` - both had been merged for several releases but never showed up in the in-app help panel or the public docs site nav.
- Rule: file existence is not user discoverability. After creating a new help page, the same commit (or a paired one) must add the entry to `_meta.yaml` with a sensible icon and the appropriate placement among siblings.

## Doc values: read from code, not from memory

- Any specific number, threshold, default value, dropdown range, or feature flag mentioned in the docs MUST come from the code or config that defines it (`backend/config/app.yaml`, `backend/config/i18n/*.yaml`, the schema, the source of the relevant function), not from memory or approximation.
- If a value isn't easily findable in code, that is a signal to flag the question, not to guess. Wrong defaults in user docs erode trust faster than missing docs do.
- Example: trash auto-delete default came from `backend/config/app.yaml.example` (`trash_auto_delete_days: 90`); the configurable range came from the `trash_days_*` keys in `backend/config/i18n/*.yaml`. Both are single sources of truth that the docs cite without duplicating.

## Alembic migration + fresh test DB

- For every new Alembic migration that touches a core table (e.g. `learning_projects`, `learning_sessions`) via `ALTER TABLE`: the file at `~/.local/share/adaptive_learner/adaptive_learner.db` MUST be deleted before the next `make test`. Otherwise you get `sqlite3.OperationalError: duplicate column name: ...`.
- Reason: `backend/tests/conftest.py` calls `Base.metadata.create_all(engine)` before every test and creates the tables with the NEW schema. At the same time the on-disk DB still has `alembic_version` pinned to the old revision. `TestClient(app)` triggers the lifespan `init_db()`, which runs `upgrade head` when tables + `alembic_version` both exist - which tries to add the new column via ALTER TABLE a second time and crashes.
- Permanent fix: `rm backend/adaptive_learner.db` after `git pull` with a new migration, then `make test`. `init_db()` now sees no tables, runs `create_all` + `stamp head`, and subsequent test runs pass because `alembic_version` is already at the new head.
- The clean solution would be a real in-memory test DB setup (e.g. via a `ADAPTIVE_LEARNER_TEST=1` env var) that skips `init_db()` in test mode - does not exist yet.

## TipTap editor

### Storage format
- TipTap stores as JSON. NOT HTML, NOT Markdown.
- TipTap CANNOT render Markdown. Markdown must be converted to HTML before storage.
- On import: convert Markdown files to HTML with the Python `markdown` library, then store as TipTap JSON.
- When switching WYSIWYG -> Markdown: convert JSON to Markdown (nodeToMarkdown).
- When switching Markdown -> WYSIWYG: convert Markdown to HTML, then to JSON.

### Extensions
- StarterKit does NOT include an image extension. @tiptap/extension-image is required separately.
- Figure/Figcaption: use @pentestpad/tiptap-extension-figure, NO custom code.
- Character count: use @tiptap/extension-character-count, NO custom code.
- Currently 15 official + 1 community extension installed (see CLAUDE.md).
- Before writing custom code, ALWAYS check whether an official TipTap extension exists.

### Peer dependencies
- Community extensions (@pentestpad/tiptap-extension-figure, tiptap-footnotes) can silently upgrade to @tiptap/core v3. Always pin with --save-exact.
- @pentestpad/tiptap-extension-figure: pin to 1.0.12 (last v2-compatible); 1.1.0 requires @tiptap/core ^3.19.
- tiptap-footnotes: pin to 2.0.4 (last v2-compatible); 3.0.x requires @tiptap/core ^3.0.
- `npm ci` in CI fails on peer-dep conflicts. Do NOT use --legacy-peer-deps as a fix.

### CSS
- TipTap renders inside .ProseMirror. CSS selectors have to account for that.
- Specificity: `.ProseMirror p.classname` instead of `.tiptap-editor classname`.
- All styles MUST work through CSS variables (3 themes x light/dark = 6 variants).

## Docs are specification, not a wish list

- If a feature is in the help, it must exist in the code. Feature audits after every large docs addition are mandatory.
- Features that are not yet implemented but are described in the docs must be marked with `> Planned for a future version`. Do not promise what isn't there.
- Build an audit table with the current state, run a gap analysis in A/B/C categories, then implement. No blind coding.

## Help system: single source of truth

- Help content lives in `docs/help/`, not in plugin code. Both the in-app Help plugin and MkDocs read the same Markdown files.
- `docs/help/_meta.yaml` is the single source of truth for navigation. `scripts/generate_mkdocs_nav.py` converts it into the MkDocs format.
- Markdown rendering on the frontend via `react-markdown` with `remark-gfm` + `rehype-slug` + `rehype-autolink-headings`. Never `dangerouslySetInnerHTML` for user content.
- MkDocs dependencies live in `docs/pyproject.toml` (its own venv), not in the backend venv. `make docs-install` / `docs-build` / `docs-serve` from the root.
- Context-sensitive help via `<HelpLink slug="export/epub"/>` - opens the HelpPanel directly on the relevant page.

## Async in the FastAPI lifespan

- Inside the `async def lifespan(app)` handler the uvicorn event loop is already running. `asyncio.new_event_loop()` + `loop.run_until_complete(...)` is forbidden there and crashes with "Cannot run the event loop while another loop is running".
- When a helper like `sync_edge_tts_voices` needs to run a coroutine during startup: make the function `async` and `await` it in the lifespan, do NOT build your own loop.
- Symptoms when done wrong: `RuntimeWarning: coroutine '...' was never awaited` plus the loop conflict ERROR in the startup log.
- Other callers of the same function (CLI targets in the Makefile, sync FastAPI endpoints) have to follow along: `asyncio.run(...)` in the CLI, `async def` + `await` in endpoints.

## Deployment

- Default ports: 18001 (backend), 15174 (frontend dev). Both visible in the Makefile dev targets.
- /api/test/reset ONLY in debug mode (ADAPTIVE_LEARNER_DEBUG=true).
- CORS configurable via ADAPTIVE_LEARNER_CORS_ORIGINS (not hardcoded).
- SQLite path defaults to ``~/.local/share/adaptive_learner/adaptive_learner.db`` (XDG via platformdirs); configurable via ADAPTIVE_LEARNER_DATA_DIR.
- ADAPTIVE_LEARNER_SECRET_KEY is auto-generated by start.sh when not set.
- Non-root user in the Dockerfile.

## Licensing

### license_tier attribute
- PluginForge's BasePlugin is an external PyPI package - do NOT modify. Instead set `license_tier` as a class attribute directly on the plugin classes.
- `_check_license` in main.py reads `getattr(plugin, "license_tier", "core")` - the default is "core" (backward-compatible).

### Trial keys
- Trial keys use `plugin="*"` as a wildcard in the payload. `LicensePayload.matches_plugin()` must treat `"*"` explicitly as match-all.
- Trial keys are stored under the key `"*"` in `licenses.json`, not under the plugin name.
- Expiry: always use `date.today()` (UTC), not `datetime.now()`. `date.fromisoformat()` expects the "YYYY-MM-DD" format.
- `_check_license` must check both the per-plugin key and the wildcard key (fallback chain).

### Settings UI
- The `discoveredPlugins` API delivers `license_tier` and `has_license` per plugin. Currently all plugins are free (`license_tier = "core"`). The Licenses tab has been removed from Settings.

## General patterns

- Before writing a custom implementation: check whether a library/extension already solves it.
- On CSS problems: check specificity first (.ProseMirror context).
- On import problems: check whether the source format (Markdown) is converted to HTML correctly.
- On export problems: check whether HTML is converted back to Markdown correctly.
- Test roundtrips: import -> edit -> re-export -> diff against the original input.

## Code structure

### Avoid God Methods
- Route handlers longer than 50 lines must be decomposed.
- Typical symptom: if/elif cascades for different formats/types in one handler.
- Solution: ExportContext dataclass + one function per format group + testable helper functions.
- Every extracted function must be testable without reconstructing the whole request context.
- See coding-standards.md "Function design" for the correct pattern.

### Testability as a design criterion
- If a function is hard to test (lots of mocking needed), that is a signal of bad design.
- Service functions must have no FastAPI dependencies (no Request, no Response, no Depends).
- Helper functions (validate_format, build_filename, detect_manual_toc) must be callable with simple parameters.
- Data classes (dataclass, TypedDict) instead of loose dicts for context between functions.

### Error-handling mistakes we made
- HTTPException thrown directly from services. Makes services untestable without a FastAPI context. Solution: our own exception hierarchy (AdaptiveLearnerError).
- Bare `except Exception: pass` in plugin code. Errors vanish silently. Solution: catch specific exceptions, at least log them.
- External tool errors (AI provider HTTP errors, edge-TTS unavailable) passed up unwrapped. The user sees a cryptic error message. Solution: ExternalServiceError with a clear service name.
- Frontend: API calls without catch. User clicks "Export" and nothing happens. Solution: always try/catch with toast feedback and finally for the loading state.

### Error reporting rules
- Error details must make a GitHub Issue directly actionable, without follow-up questions.
- Chain: AdaptiveLearnerError (detail + str(e)) -> API response (detail + traceback in debug mode) -> frontend ApiError -> toast with "Report issue" button -> GitHub Issue (title, stacktrace, browser, app version).
- EVERY except block MUST call logger.error() with exc_info=True.
- EVERY except block MUST include str(e) in the AdaptiveLearnerError subclass (NOT HTTPException).
- EVERY frontend catch block MUST call toast.error() with the ApiError object, NOT just with a string.
- Generic error messages like "Export failed" or "Import failed" without details are FORBIDDEN. They make GitHub Issues worthless.
- File upload functions (fetch instead of request()) must throw ApiError on failure, not Error.
- The global exception handler in main.py logs every unhandled error with its stacktrace.
- In debug mode the backend response includes the stacktrace (for the "Report issue" button).

## Plugin settings: visible or INTERNAL, never hidden

Plugin settings are either UI-visible (user-relevant) or marked `# INTERNAL` (YAML-only). Hidden active settings that influence user behavior are a bug, because the user has no way to change the behavior without a YAML editor and repo access.

Dead settings (in the YAML but not read by the code) are just as bad: they are a lie to the user. When refactoring a plugin, always check whether old YAML fields are still consumed before leaving them in place.

Generic plugin settings panel on the frontend: renders booleans as a checkbox, numbers as a number input, strings as a text input, arrays as an OrderedListEditor, objects as a JSON textarea with an "Advanced" hint. Rendering a boolean as a text input (`value="true"`) is a UX bug because the user cannot tell it is a switch.

Configuration values that vary between learning projects MUST live on the `LearningProject` model, NOT in the plugin YAML. Plugin YAML is plugin-global and applies to all projects at once - anyone who needs per-project granularity adds a column (see the pattern on `LearningProject.daily_minutes`, `LearningProject.current_problem`).

## Review architectural decisions before implementing

From the V-02 incident: there was a near-implementation of a
backup-compare feature (V-02) that would have been built in
parallel with the already-planned Git-based backup feature. Only
by cross-checking against todo-prompts.md did the conflict
become visible.

Rule: before implementing a larger architectural decision, check:
1. ROADMAP entries in the area
2. todo-prompts.md for already-planned changes
3. docs/journal/ for earlier discussed decisions

On a conflict between a user instruction and documented planning:
STOP and explicitly ask the user which version applies.
Never build parallel systems that are already slated for deletion.

## Dependency currency in active development

In active development projects, dependency versions should be kept current from day one. Shipping with end-of-life or deprecation-imminent versions creates technical debt immediately.

Rules:
- Only stable releases, no beta/RC/alpha versions ever in production code
- "Latest stable" means most recent version that has proven stable (minimum 2 weeks since release)
- For LTS products (Node.js), prefer Active LTS over Current
- Review dependencies at each release cycle: run `poetry show --outdated` and `npm outdated` before cutting any release
- Major version bumps get their own commit with migration notes
- Routine minor/patch bumps can be batched by category

Red flags for outdated dependencies:
- Deprecation warnings in build output
- End-of-life announcements in package READMEs
- Security advisories against installed versions
- Upstream pins blocking other upgrades (e.g. PluginForge restricting a transitive bump)

Upstream blockers: when an external dependency (e.g. PluginForge) pins a transitive dep with an upper bound we cannot move past, the bump is deferred until the upstream releases a compatible version. Document the blocker in the commit that updates what it can, so the next sweep picks it up.

## Release-cycle dependency review

Before cutting any release, run dependency currency check:
- `poetry show --outdated` in backend and each plugin
- `poetry show --outdated` in launcher
- `npm outdated` in frontend

Apply routine bumps (patch + minor + low-risk minor) as part of release prep. Defer major bumps to dedicated sessions with their own testing cycle.

Never ship with:
- End-of-life versions
- Deprecation-imminent versions (forced migration within 6 months)
- Versions with known unpatched P0 bugs

Stability filter:
- Latest stable only, never beta/RC/alpha
- Minimum 2 weeks since release for new major versions
- For LTS products (Node.js), prefer Active LTS over Current

## install.sh VERSION drift

- `install.sh` pinned `VERSION="v0.7.0"` as the default, but Dockerfile and docker-compose.prod.yml evolved significantly after that tag. The v0.7.0 compose used `build: ./backend` (backend-only context), while current uses `context: .` (repo root). Plugins live at `<repo>/plugins/` which is entirely outside the v0.7.0 build context, so `poetry install` inside the container could never find them.
- The fix for the original Docker bug (commit 59cf3d6) was verified by building from the local working tree, not by running install.sh end-to-end. The local build used the current compose/Dockerfile; install.sh used the ancient tagged version. The verification test was wrong because it didn't test the actual user flow.
- Rule: when fixing an install/deployment script, always test THE SCRIPT, not just the artifacts it references. `docker build -f Dockerfile .` is not the same test as `./install.sh` because the script may select a different version of the files.
- install.sh now pins to the latest release tag (updated as part of the release workflow, Step 4). Users can override with `ADAPTIVE_LEARNER_VERSION=vX.Y.Z` for older versions.
- Corollary: install scripts are a special class of code where the test must simulate the actual distribution path. CI that tests scripts should run them the way users run them, not the way developers run them. `docker build -f Dockerfile .` from a working tree is not the same test as `curl ... | bash` which downloads, checks out a tag, and then builds.
- 2026-05-04 SSoT refactor: install.sh became a generated artifact built from `install.sh.template` + `backend/pyproject.toml` via `scripts/generate_install_sh.sh`. The committed install.sh stays in git because users curl-pipe it directly from the raw GitHub URL; it cannot be a build-time artifact hidden behind .gitignore. Treat it like generated docs: edit the template, regenerate at release time, commit both. `verify_version_pins.sh` runs `--check` to catch drift between template and committed output.

## Single source of truth for version pins

Every duplicated version constant is a stale-pin bug waiting to happen. The 2026-05-04 audit chain found seven such pins across launcher, frontend, install.sh, and one plugin - three were already stale (8 versions, 13 versions, and 3 versions behind the canonical pyproject.toml / package.json). Each had drifted because the release workflow listed them as bullets to manually update, with no enforcement.

Architecture goal (Java/Maven precedent): ONE version per subsystem in a canonical packaging file; everything else derives.

**Canonical sources (hand-edited at release):**
- `backend/pyproject.toml` for the Python subsystem
- `frontend/package.json` for the JS subsystem
- Each `plugins/<name>/pyproject.toml` for its own plugin (plugins have independent versions)

**Derivation patterns by language and runtime:**

| Subsystem | Pattern | Why |
|-----------|---------|-----|
| Python (publishable distribution) | `importlib.metadata.version("<dist-name>")` with `PackageNotFoundError` fallback | Standard. Reads packaging metadata; cannot drift. |
| Python (`package-mode = false`, e.g. backend app) | `tomllib.load(open("pyproject.toml", "rb"))["tool"]["poetry"]["version"]` | importlib.metadata is unavailable when Poetry doesn't register a distribution. tomllib is stdlib in 3.11+. |
| Bash installer (chicken-and-egg before clone) | Generate the script at release time from a template; substitute placeholder from canonical pyproject. Commit the generated artifact. | Runtime parse impossible because pyproject doesn't exist when curl-pipe runs. GitHub-API-at-runtime is non-deterministic and brittle. |
| Frozen binary (PyInstaller) | Build-time injection: spec script writes a generated `_build_info.py`, gitignored, that the binary embeds. Dev fallback reads pyproject directly. | importlib.metadata is unreliable inside PyInstaller's frozen tree. |
| Frontend (Vite) | `define` block reads package.json at build, exposes `__APP_VERSION__` literal. TypeScript declares `declare const __APP_VERSION__: string;` in `vite-env.d.ts`. | Build-time literal substitution. Zero runtime cost, zero bundle overhead. |

**Always include a fallback sentinel** (e.g. `"0.0.0+unknown"` with a `logger.warning`) when the derivation can fail at runtime (file missing, distribution not registered). Silent fall-through to a hardcoded number masks environmental problems.

**Always include regression detectors** in `verify_version_pins.sh`: grep patterns that fail the check if a hardcoded literal reappears in the "DO NOT EDIT" tier. Workflow checklists alone are not enforcement; a script that exits non-zero on regression is.

**Never** add a hardcoded version constant "for convenience" (e.g. for use in a GitHub-Issue body template, a footer string, or an OpenAPI metadata field). Always reference the derived single source.

## Hotfix cluster tag policy

When a release tag fails CI for a mechanical reason (chmod bit
missing, formatter nit, type-check escape, build-time spec error)
and a fix lands quickly via point-release bumps, the failed tag
stays in the repository as historical record - it does not get
deleted. Reasons:

- The v0.26.0 release-gate run, even though it failed, is part
  of the release audit trail (run ID `25328065614`).
- Deleting a published tag is a force-push class operation per
  CLAUDE.md security rules; allowed only when nobody pulled the
  tag and no GitHub Release was published. The latter is
  satisfied for failed-gate tags but the former requires
  asserting nobody fetched in the meantime.
- Each tag's commit reflects the state at the moment of the
  bump. Future bisects can use them.
- The shipped tag's `changelog/releases/v0.X.Y.md` file
  documents the hotfix history (see v0.26.3.md "Hotfix
  history" section as the template).

Current cluster preserved as-is: `v0.26.0` (release-gate failed
on chmod), `v0.26.1` (launcher builds failed on PyInstaller
spec `__file__`, CI failed on mypy), `v0.26.2` (CI failed on
ruff-format), `v0.26.3` (all green; the shippable tag).

Do delete a tag only when it was pushed in the last few minutes
and the user explicitly confirms no one could have pulled. The
default is keep + document.

## Subsystem lock-step + tooling, not checklists

Per-subsystem SSoT (one canonical pyproject per Python subsystem, one canonical package.json for the JS subsystem) was the first half of the fix. The second half is **lock-step propagation by tooling, not by human attention**. A 7-row checklist that says "edit every file" fails every time someone forgets a row; the 2026-05-04 audit chain found three pins that had drifted by 8, 13, and 3 versions respectively across multiple releases.

Architecture, post-2026-05-04 lock-step:

- **One canonical version per language subsystem** (backend/pyproject.toml, frontend/package.json). Hand-edited at release time.
- **`make sync-versions`** (`scripts/sync_versions.py`) propagates the canonical to every other version-bearing field: launcher pyproject + spec plist + `__init__.py` literal, all plugin pyprojects, frontend package.json (when needed), `install.sh` regen via the existing template helper. The tool is the only thing that touches those files.
- **`make sync-versions-check`** + `verify_version_pins.sh` enforce lock-step in a tight loop. The verify script also runs the subsystem-lock-step check inline.
- **CI gate** (`.github/workflows/release-gate.yml` on tag-push, plus the same checks inlined as the first step of every launcher build job's `release: created` path). Artifact attachment is blocked on drift. Tag pushes cannot be retroactively undone, but the gate failure surfaces the drift loudly and prevents downstream artifact publication.

Rules for working in this codebase:

- **Do not hand-edit any version field except `backend/pyproject.toml`.** Even the assistant doing the work follows this rule. If the assistant bypasses the tool and edits a downstream pyproject directly, the tool's value is zero from day one. Run `make sync-versions` and let the diff speak.
- **Each release commit's diff for non-canonical version fields must be reproducible by re-running `make sync-versions` from a clean checkout.** That's the bisect contract: any historical commit can be re-derived from `backend/pyproject.toml` + the tool.
- **A new subsystem with its own version field**: add it to `scripts/sync_versions.py`'s `collect_targets()` AND the regression detector in `verify_version_pins.sh` AND the CI gate. Three artifacts per new pin; never one or two.
- **The `--check` mode of every sync/verify script must be idempotent**: running it twice in a row produces the same answer, never writes, never depends on environment state beyond the repo. CI relies on that property.
## Diagnostic features must fail open

- Diagnostic and convenience features should fail open. A feature that prevents bad behavior (double-launch, stale cache, etc.) must not block the application's primary function when it fails. Crashing the app because a convenience check crashed is always worse than silently skipping the convenience check.
- Concrete example: the launcher's lockfile check (`another_instance_alive`) crashed with `TypeError: argument of type 'NoneType' is not iterable` because `tasklist` returned `stdout=None` on a Windows locale edge case. This prevented every user from starting the launcher at all. The fix: wrap in try/except that fails open (log warning, proceed).
- This applies beyond lockfiles. Any startup check, guard, or health probe that gates the main application flow should be wrapped so that a failure in the check degrades gracefully rather than killing the app.

- Shallow clone update trap: `git clone --depth 1 --branch v0.7.0` creates a repo where `origin/main` does not exist as a remote ref. A later `git fetch origin` does not fix this because the fetch refspec was configured for the tag, not for branch tracking. `git checkout -B main origin/main` then fails with "pathspec 'main' did not match". The fix is to not try to update shallow clones in place at all. Delete and re-clone (backing up .env first) is the only reliable cross-platform approach. Surgical git state repair across shallow clone versions, platforms, and git implementations is a losing battle.

## TypeScript 6 no longer auto-includes all `@types/*`

- TS 5 silently included every `@types/*` package from `node_modules` when the `types` compilerOption was absent. TS 6 stopped doing this: if `@types/node` is installed transitively but not named in `types`, `import fs from "node:fs"` fails with `TS2591: Cannot find name 'node:fs'`.
- Concrete: `frontend/src/components/ChapterSidebar.test.tsx` imports `node:fs`/`node:path` to load fixture data. Worked under TS 5 (`@types/node` came in transitively via `happy-dom`/`vite`/`vitest`). Broke on TS 6 bump.
- Fix: add an explicit `@types/node` devDependency AND list it in `tsconfig.json` under `"types": ["node", "vite/client"]`. Both halves are needed - installing the package alone does not bring it in on TS 6.
- Applies going forward: any `@types/*` you want in scope under TS 6 must be named in `types` explicitly.

## `@types/node` major bumps cascade into tsconfig `lib`

- `@types/node@22` shipped polyfilled lib augmentations (e.g. typing `Array.prototype.at()` even under `lib: ES2020`). `@types/node@24` dropped them, deferring entirely to whatever lib the project declares. Symptom on a ^22 → ^24 bump: `TS2550: Property 'at' does not exist on type 'any[][]'. Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.` even though no source code changed.
- This is NOT a breakage in `@types/node`; it is correct behavior. The earlier convenience was the anomaly.
- Fix at the consuming repo: bump `tsconfig.json` `target` and `lib` to `ES2022` together with the `@types/node` major bump. `Array.prototype.at()` is ES2022 standard library. Vite 8 / esbuild emit ES2022 fine; runtime is Node 24 / modern browsers. Zero source-side changes required.
- General rule: when bumping `@types/node` across majors, run `tsc --noEmit` in the same change window. If it newly fails on stdlib globals, bump `lib` to match the runtime ES level - do NOT carry per-call workarounds (`as any[]`, casts) and do NOT pin `@types/node` back to the old major.
- Concrete bump landed 2026-05-07 in commit on `main` after the v0.28.0 cycle: `^22.19.17` → `^24.12.2`, `target` + `lib` ES2020 → ES2022, 8 `.at(-1)` sites in `PreviewPanel.test.tsx` cleared without modification.

## Vite 7 requires Node 20.19+ / 22.12+

- Vite 7 uses Node's `crypto.hash` top-level API which landed in Node 20.12+ / 21.7+ (backported to 22 LTS). On Node 18, `vite build` fails with `[postcss] crypto.hash is not a function` coming from `vite-plugin-pwa`'s postcss handling. The error is misleading: it is not a PWA/postcss bug, it is a Node version issue.
- Vitest 4 does NOT exercise the same code path, so `npm run test` can still pass on Node 18 even though `npm run build` fails. Do not rely on tests alone to validate a Vite major bump; always build too.
- CI runs Node 24 (`.github/workflows/{ci,coverage}.yml`), which is fine. Local envs on Node 18 must upgrade to Node 24+.

## Vite 8 migration (DEP-09 + SEC-01)

- `vite-plugin-pwa@1.3.0` (published 2026-05-06) added Vite 8 to its peer-dep range (`^3.1.0 || ^4 || ^5 || ^6 || ^7 || ^8`) and unblocked the bump. The CVE chain `workbox-build` -> `@rollup/plugin-terser` -> `serialize-javascript` (3 high-severity advisories: GHSA-5c6j-r48x-rmvq RCE + GHSA-qj8w-gfj5-8c6v DoS) clears as a side effect; `npm audit --audit-level=high` returns zero high findings after the bump. The unrelated moderate `uuid` advisory (GHSA-w5hq-g745-h8pq) stays open and is its own track.
- **Vite 8 (Rolldown) requires `manualChunks` as a function, not an object.** Vite 7 used Rollup, which accepted both forms. Vite 8 ships Rolldown by default, which only accepts the function form. Symptom: `Invalid output options ... For the "manualChunks". Invalid type: Expected Function but received Object` followed by `TypeError: manualChunks is not a function at rolldown/dist/shared/...`. Fix: convert the package-list-per-chunk object to a function that matches the module id and returns the chunk name. Use a trailing slash (`id.includes('/node_modules/${pkg}/')`) to prevent prefix collisions (`react` vs `react-dom` vs `react-router-dom`). The `id` is always an absolute path; bare-package matching is unreliable.
- DEP-04 landed Vite 6 -> 7 deliberately because vite-plugin-pwa 1.2.0 did not yet ship Vite 8 compat; DEP-09 + SEC-01 paired in one session because both items resolve on the same upstream release.
- Vitest 4 covers the matrix `vite: ^6 || ^7 || ^8`; bumping Vite alone keeps Vitest configuration untouched. The `@vitest/coverage-v8` peer-dep is exact-pinned to its own Vitest version, so when bumping Vitest itself bump both in lockstep or `npm install` will downgrade the parent.
- The check that caught this in production was the build step, not the test step (per `lessons-learned.md` rule "Do not rely on tests alone to validate a Vite major bump; always build too"). Vitest 707/707 passed with the broken `manualChunks` config. `npm run build` was the first signal.

## CSS specificity trap: `h2 + p` loses to `p:not(:first-child)`

- Specificity for `[data-app-theme="classic"] .ProseMirror h2 + p`: (0, 1, 1, 2) - 1 attr, 1 class, 2 elements.
- For `[data-app-theme="classic"] .ProseMirror p:not(:first-child)`: (0, 1, 2, 1) - 1 attr, 1 class + 1 pseudo-class = 2 "classes", 1 element. The pseudo-class pushes the base rule ahead of the adjacent-sibling override.
- When both rules match (a paragraph that directly follows a heading AND is not the first child), the higher-specificity `:not(:first-child)` wins and the heading override never applies.
- Fix: append `:not(:first-child)` to each `h* + p` override. Combined (0, 1, 2, 2) beats the base (0, 1, 2, 1).
- Generalizes: any CSS override against a `:not(:first-child)` base rule needs at least the same pseudo-class weight.

## TipTap `useEditor` does NOT flush `editor.storage` reads to React

- Inline reads like `{editor?.storage.characterCount?.words()}` in JSX do not update reliably on every content transaction. TipTap's built-in re-render fires on selection changes, not every content edit.
- Two viable patterns:
  1. **`useEditorState` selector** (TipTap-idiomatic). Wraps `useSyncExternalStore`, subscribes to the editor's transactionNumber, re-runs the selector per transaction.
  2. **`useState` + `editor.on('update')` listener** (plain React). Manually `setWordCount(...)` on every update event.
- Choose pattern 2 when running under React `StrictMode` + Playwright + Vite dev server. `useSyncExternalStore` under that combination produced stale renders even though storage updates fired. The plain-listener path bypasses `useSyncExternalStore` entirely.
- Cleanup: always pair `editor.on('update', cb)` with `editor.off('update', cb)` in the same `useEffect` cleanup to avoid leaks across hot-reload cycles.

## Prefix testid selectors match every nested testid that shares the prefix

- A selector like `[data-testid^='session-card-']` cleanly matches each card root AND every nested child testid that shares the prefix (`session-card-menu-{id}`, `session-card-menu-delete-{id}`). `toHaveCount(N)` returns `2N` or more per visible card.
- Fix: `[data-testid^='session-card-']:not([data-testid*='-menu-'])`, or give the root a distinct testid like `session-card-root-{id}`.
- Same shape as the `[class^=""]` overmatch antipattern. Always test a prefix selector against the full rendered surface before shipping.

## German content uses real umlauts

Production German content uses proper UTF-8 umlauts (ä, ö, ü, ß),
NOT ASCII transliterations (ae, oe, ue, ss).

### Where this applies (real umlauts required)

- i18n catalogs (`backend/config/i18n/de.yaml`).
- User documentation (`docs/help/de/**/*.md`).
- Plugin German content (under any `*/content/de/`).
- README German sections (currently none; English-only).
- CHANGELOG German entries (rare; quoted UI strings only).
- Journal entries written in German prose.
- Any other user-facing German text.

### Where ASCII stays

- Source code (`*.py`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`).
- Code comments, docstrings (English convention).
- Variable / function / class / identifier names.
- File names, directory names.
- Git branch names, commit messages.
- This chat with the user (per the user's style preference,
  ASCII-only in chat communication).

The chat-style rule and the production-content rule are
deliberately different. Production text is authored for end
readers; the chat is a working channel.

### Tooling (#1755, since 2026-07-17)

`scripts/verify_i18n_scripts.py` is the AUTOMATED gate for this
class (the earlier interactive `find_umlaut_candidates.py` /
`replace_umlauts.py` / `build_in_scope_list.py` /
`discover_unknown_umlauts.py` workflow has been removed):

- **Stage 1 (de):** flags substitute-spelling forms in
  `backend/config/i18n/de.yaml` via a curated whole-word list
  (`DE_SUBSTITUTE_WORDS`). Legitimate digraph words (Quelle, Dauer,
  aktuell) are not listed and can never fire; "musst" is correct
  post-reform German and must never be added. Extend the list when a
  new degraded form slips through — never loosen it into a bare
  digraph scan.
- **Stage 2 (el/hi):** flags latin TRANSLITERATION (the severest
  class — functionally a missing translation) when a value's letters
  are mostly latin in the Greek/Devanagari catalog, after stripping
  `{placeholders}` and allowlisted technical/brand tokens
  (`LATIN_ALLOWED_TOKENS` + `KEY_ALLOWLIST_PATTERNS` for theme names
  etc.). False positives go into the allowlists, not into a weaker
  threshold.
- Runs via `make verify-i18n-scripts` and the `i18n-script-sanity`
  pre-commit hook (scoped to the de/el/hi catalogs, so it also runs
  in the CI pre-commit job). Hard gate, no baseline.
- NOT covered by design: missing accents in otherwise-correct-script
  es/fr/pt/tr values — not machine-detectable without a dictionary;
  the LLM quality pass (`make i18n-quality-check`, #1296) is the tool
  for that.
- German PROSE outside the catalogs (docs/help/de, journal, README
  German sections) is not gated; review it manually when authoring.

### Why this matters

ASCII transliteration looks unprofessional to German readers and
can confuse the Learning Repository Markdown renderer when the
surrounding text uses proper umlauts (mixed encodings in the
same file is the worst case — same paragraph, two styles, output
reads as broken to native speakers).

### Known regression pattern

Mixed-encoding files (BOTH real umlauts AND ASCII transliterations
in the same paragraph) are not tooling regressions but author-
style drift: typing in an environment without a German IME, then
copy-pasting UTF-8 text from elsewhere. There is no
heading / code-fence / section boundary to predict it. The class
recurred at scale twice (#1753: the whole #1743 i18n surface
degraded in 7 of 11 catalogs incl. el/hi latin transliteration;
#1758: the v1.86.0 ai_check block, found by the first #1755 lint
run). Mitigation: the `i18n-script-sanity` pre-commit hook now
gates the de/el/hi CATALOGS automatically (see Tooling above);
German prose in docs stays a manual-review surface.

## Global CSS rules: distinguish viewport containers from app container

Setting `overflow: hidden` on `html, body, #root` as a single rule blocks document scroll but also blocks every full-page component that relied on scroll (Settings, Dashboard, GetStarted, Help).

Correct pattern when preventing document-level scroll for editor zoom behavior:

```css
html, body { height: 100%; overflow: hidden; }  /* viewport lock */
#root { height: 100%; overflow-y: auto; }       /* app scroll */
```

html and body control the browser viewport. `#root` is the React application root and must remain scrollable for pages that don't implement their own scroll container.

When a layout fix requires setting `overflow: hidden` on one of the three, think explicitly about whether full-page components inside the app need internal scroll, and expose it via `#root`.

### Incident record

- `ef7ce5c`: added `html, body, #root { overflow: hidden; }` as fix for a zoom-related layout bug. Broke scroll on Settings, Dashboard, Onboarding, Help pages.
- `c25483e`: split the rule. Kept html/body locked (preserves zoom fix), restored `#root overflow-y: auto`.

## Filesystem isolation: production data lives outside the project tree

Production AdaptiveLearner data NEVER lives in the project tree. All paths resolve via `app.paths` helpers (`get_data_dir`, `get_config_dir`, `get_cache_dir`, `get_upload_dir`, `get_db_path`) which use platformdirs (XDG-conformant) by default and respect a `ADAPTIVE_LEARNER_DATA_DIR` (etc.) env-var override. Resolution is **always** via fresh function calls, never via frozen module-level imports.

Default locations (Phase 2 swap, 2026-05-04):

- Linux/macOS: `~/.local/share/adaptive_learner/`
- Windows: `%LOCALAPPDATA%\adaptive_learner\`
- Tests: a `tmp_path_factory`-managed dir, set by `backend/tests/conftest.py` before any `app.*` import
- Docker: `/app/data/` via `ADAPTIVE_LEARNER_DATA_DIR=/app/data` in compose, mounted as the named `adaptive-learner-data` volume

Three layers of protection prevent test runs from touching production data:

1. **Production marker file**. Production directories contain a `.adaptive-learner-production` marker (written by the FastAPI lifespan via `app.paths.mark_data_dir_as_production`). If tests ever see one, the entire run aborts with `pytest.exit(returncode=2)`.
2. **Test conftest sets `ADAPTIVE_LEARNER_DATA_DIR`** to a tmp dir before any `app.*` import. The autouse session fixture also asserts the resolved path looks like a tmp location.
3. **All path access via helpers**, never via CWD-relative `Path("foo")` and never via frozen module-level imports.

**Forbidden patterns:**

- `UPLOAD_DIR = Path("uploads")` at module top level
- `from app.routers.assets import UPLOAD_DIR` (frozen import)
- `Path("data") / "X"` anywhere in production code

**Required pattern:**

- `upload_dir = get_upload_dir()` inside the function that uses it.

If `make test` aborts with exit code 2, check what path was mounted via `ADAPTIVE_LEARNER_DATA_DIR`. NEVER delete the marker just to make the test pass; investigate why a test pointed at production. Origin: April 2026 data-loss incident — DB tripwire landed in `a4cf7cf`, filesystem tripwire + paths.py in the same period.

### Phase 2 migration

Users with v0.25.0-and-earlier data in the project tree (`backend/adaptive_learner.db`, `backend/uploads/`) get auto-migrated on first start after the platformdirs swap. Helper: `app.data_dir_migration.migrate_data_dir_if_needed`, run from the FastAPI lifespan BEFORE `init_db()`. Properties:

- Idempotent (`.migration-complete` marker short-circuits)
- Fail-loud on conflict (RuntimeError if both legacy and target hold the same item; silent merge would corrupt data)
- Breadcrumb at old paths (`.migrated-YYYY-MM-DD` file beside each moved item)
- Skipped in test mode (`ADAPTIVE_LEARNER_TEST=1`)

Rule: when adding a new persistent path under `get_data_dir()`, also add it to `_legacy_paths()` in `data_dir_migration.py` if a v0.25.0-and-earlier code path could have written to a different location. Otherwise users lose data on the next upgrade.

## Two installation paths diverge: `make test` vs per-plugin CI

AdaptiveLearner's plugins are installed two different ways depending on context:

- **`make test` path:** the backend's combined `poetry.lock` resolves every plugin as a path-dep (`adaptive-learner-plugin-{name} = {path = "../plugins/...", develop = true}`). One `poetry install` from `backend/` brings every plugin's external deps in via the backend's lock.
- **CI plugin-matrix path:** `.github/workflows/ci.yml` and `.github/workflows/coverage.yml` run `poetry install --no-interaction --no-ansi` **inside each plugin directory** against THAT plugin's own `poetry.lock`. The backend lock is irrelevant here.

When a shared external dep (e.g. fastapi) bumps in every pyproject (backend + 10 plugins), the backend lock and the per-plugin locks drift independently. If only the backend lock gets regenerated:

- `make test` is green (the backend lock satisfies all path-deps; the per-plugin locks are not consulted).
- CI is red (the per-plugin `poetry install --no-interaction` aborts with `pyproject.toml changed significantly since poetry.lock was last generated`).

This shape bit during the v0.30.0 release: the pre-v0.30.0 dep sweep bumped fastapi `^0.135.0 → ^0.136.0` in 11 pyproject.toml files, but `poetry lock` was only run in `backend/`. Local `make test` passed; CI was red on main from `be4b6f3` until hotfix `3232fad` re-locked all 10 plugin lockfiles.

**Generalization:** any time there are two installation paths for the same code, BOTH must be tested at gate time. The backend's combined lock and the per-plugin locks are different gates; verifying one does not verify the other. The pre-v0.30.0 retro called this out at the meta level ("verify the gate before trusting it"); this is the concrete recurrence.

**Mitigation pattern (now enforced):**

- `make lock-all-plugins` (Makefile target shipped in PLUGIN-LOCKFILE-DRIFT-01 commit `1b43aec`): iterates `plugins/adaptive-learner-plugin-*/` and runs `poetry lock` in each. Use after any shared-dep pin bump.
- `make verify-plugin-locks` (Makefile target shipped in the same commit): runs `poetry install --dry-run --no-interaction --no-ansi` per plugin and greps for "changed significantly". Exits 1 with a remediation hint on drift; manual diagnostic, NOT in the pre-tag chain (the pre-commit hook below + the CI per-plugin matrix already cover the right times).
- Pre-commit hook `plugin-lock-paired-with-pyproject` (shipped in commit `8f6fcea`): scoped via `files: ^plugins/adaptive-learner-plugin-[^/]+/pyproject\.toml$`, fails when a staged plugin pyproject lacks a paired staged `poetry.lock`. Catches the operational mistake at commit time. Verified by 6 hook self-check tests in `backend/tests/test_plugin_lock_drift_hook.py` (commit `e31c4fd`), all green at 0.22 s.
- Discovery channel without these gates: CI red on main, AFTER a release tag has already been cut. The retro's commitment to "discrete pre-release dep sweep commits" pays off (rollback granularity stays intact), but the better gate is to catch the drift before push, not from the GitHub Actions red badge.

## React `useEffect` deps + i18n test mocks: the `t` function isn't stable

Symptom: a component's fetch-on-open effect kept failing in tests
because the `setError` call in the rejection branch never landed.
Looked like a race condition but wasn't. The effect's dep array
included the i18n `t` helper:

```typescript
useEffect(() => {
    let cancelled = false
    api.something.fetch(...)
        .then(...)
        .catch((err) => {
            if (cancelled) return
            setError(...)
        })
    return () => { cancelled = true }
}, [open, kind, ids, t])  // <-- t here
```

In production the i18n provider memoises `t` so the dep is stable.
In the test setup, the i18n mock returns a fresh `t` function on
every render:

```typescript
vi.mock("../hooks/useI18n", () => ({
    useI18n: () => ({t: (_k, fallback) => fallback, ...}),
}))
```

Result: every parent re-render produces a new `t`, so the effect
cancels its prior run and refetches. The rejection from the
previous run lands while the new run's `cancelled` closure is
still false, BUT the previous run set `cancelled=true` in its own
closure. The catch sees `if (cancelled) return` and bails out
before `setError` fires. The error never surfaces to the user.

Fix: omit `t` from the dep array when the request shape doesn't
actually depend on it (the fallback string in the toast was the
only consumer). Add an `eslint-disable-next-line` with a comment
explaining why:

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, kind, ids])
```

Generalises to any hook function the i18n mock returns fresh per
render — `useDialog`, `useNavigate` (when its callback closure
captures state), etc. When a test fails because a state update
"never happens" but the production code looks correct, check the
effect dep array against the hooks consumed inside it.

The right fix is NOT to memoise the mock's `t` per-render (that
defeats the point of mocks). The right fix is to scope the
effect's deps to what genuinely affects the request.

## Real-world data audit BEFORE implementation prevents spec-vs-reality drift

MEDIUM-COMMENTS-IMPORT-01 shipped with a three-criteria
detection heuristic in the original spec: body_length < 500
chars **AND** empty subtitle **AND** no structural elements.
Pre-inspection ran that heuristic against the actual 209-file
Medium export in the user's home directory before any code
landed. Two findings forced a spec revision:

1. **6 / 209 matched the original three-criteria heuristic.**
   That seemed reasonable on paper.
2. **The user's own reference comment case** ("Thanks for
   pointing that out — you're right, the link was missing.")
   was a **false negative**. The audit dug deeper: Medium
   auto-fills the `data-field="subtitle"` section with the
   second paragraph of the reply body when the author wrote
   no explicit subtitle. So the "empty subtitle" criterion
   never holds for those auto-filled cases, even though they
   are unambiguously comments.

Dropping the empty-subtitle criterion lifted detection from
**6 / 209 to 8 / 209** with zero new false positives across
the corpus. The two cases the original spec would have missed
both carry Medium's auto-filled subtitle.

The lesson generalizes:

- **Specs that predict a data shape are predictions, not
  contracts.** A heuristic that looks principled on paper can
  silently miss the cases that matter once you point it at
  real data.
- **Run the audit against actual data BEFORE writing code,
  not after.** "After" means the code is committed, possibly
  shipped, and the regression is harder to undo than to
  prevent. The medium-import walker session (2026-04-23) had
  the inverse cost: a `find` vs `find_all` bug silently
  truncated ~33% of imports for an entire release cycle, and
  the fix needed a one-off data-fix script + a regression-pin
  test. The MEDIUM-COMMENTS-IMPORT-01 audit caught the same
  class of bug BEFORE landing — no data-fix script needed,
  no production rows mis-classified.
- **The audit input doesn't have to be production data.** In
  the MEDIUM-COMMENTS-IMPORT-01 session, the production DB
  was empty (the user had cleared it), so the audit ran
  directly against the raw Medium HTML export in the user's
  Downloads directory. Working from the source bytes instead
  of the parsed-and-imported rows is often cleaner: the audit
  isolates the heuristic from walker / importer drift.
- **Surfacing the audit in the pre-inspection report** is
  what makes the decision visible. Without the report saying
  "6 / 209 under the spec, 8 / 209 with empty-subtitle
  dropped, the user's own reference case is in the missing
  2," the spec would have been confirmed unchanged. The
  report makes the discrepancy a decision point instead of an
  implementation surprise.

Concrete rule: when a feature ships with a heuristic, a
detection rule, a threshold, or any other prediction about
data shape, run the prediction against real data in
pre-inspection. Report counts + sample cases. Treat the spec
as the starting hypothesis, not the final design.

## Operational gaps masquerade as wired infrastructure

The 2026-05-12 test-infrastructure audit surfaced a concrete
example: the mutmut workflow at
``.github/workflows/mutation-import.yml`` had been WIRED in
the repo for 10 days (since 2026-05-02, commit ``28fe59c``)
but had NEVER produced a successful run. The nightly cron
was gated by the ``ENABLE_NIGHTLY_MUTATION`` repo variable
(not enabled); no maintainer had manually
``workflow_dispatch``-ed the workflow either. The audit
trigger was the first invocation.

The job completed in 1m12s (vs. 20-40min expected) because
``mutmut run`` errored during its initial
``run_stats_collection`` phase with
``BadTestExecutionCommandsException``. The exact pytest
invocation mutmut used (``--rootdir=. --tb=native -x -q
tests/``) succeeded cleanly when run by hand — so the
failure was inside mutmut's own pytest plugin, not pytest.
But until the workflow was actually triggered, this bug was
invisible: the YAML existed, the audit-doc
(``docs/audits/mutmut-2026-05-02-import.md``) carried the
note "TBD — pending first CI run", and the AGAR-feeling of
having mutation-testing-infra was at full strength.

The lesson generalizes:

- **"Wired" ≠ "working".** A workflow / hook / cron /
  scheduled job that was committed without being executed
  end-to-end is a hypothesis, not a feature. Audits should
  validate that wired infrastructure actually runs to
  completion, not just that the YAML / config exists.
- **The right time to flip such switches is at wire time,
  not at audit time.** A maintainer who wires mutmut /
  Hypothesis / any new pipeline should
  ``workflow_dispatch`` the workflow at least once before
  declaring the work done, and surface the artifact + result
  in the same PR / commit. The 2026-05-02 mutmut wiring
  shipped without this validation; the bug then lay dormant
  for 10 days.
- **Audits that find these gaps are doing their job.** The
  audit didn't fail to "implement mutmut"; it accurately
  reported that the wired mutmut workflow is operationally
  blocked, which is a more useful data point than another
  abstract "we should adopt mutmut" recommendation.

Concrete rule: when wiring a new CI workflow, schedule it,
or otherwise add infrastructure that runs on a delayed
trigger (nightly cron, on-tag, on-paths-only, gated by repo
variable), trigger it manually at least once in the same
session, download the artifact, and confirm the result is
what you intended. Document the first run's outcome in the
PR description or the related audit doc. A workflow that
ships without a known-good first run is technical debt
masquerading as feature delivery.

## Run vitest from `frontend/`, not the repo root

Vitest's config lives in ``frontend/vite.config.ts``.
Running ``npx vitest run`` from the repo root finds no
config, defaults to the `node` environment, and produces
``ReferenceError: document is not defined`` across every
test that touches the DOM. In a real 2026-05-12 incident,
**101 of 120 test files failed** with this error before
I noticed the cwd was wrong — completely misleading red
flag suggesting something I'd just edited broke the entire
test environment.

Tells in the failure output:

- Per-file ``setup: 0ms`` (happy-dom didn't initialise).
- ``environment: 0ms`` in the summary line.
- The error itself: ``ReferenceError: document is not
  defined`` (or ``window`` / ``HTMLElement`` / similar).
- Files that passed earlier in the same session
  suddenly all fail.

Three reliable invocations:

- ``make test-frontend`` from anywhere (the Makefile
  cd's into ``frontend/`` before running vitest).
- ``cd frontend && npx vitest run`` — direct, fast,
  same result as the Makefile target.
- ``cd frontend && npx vitest run src/path/to/file.test.tsx``
  for a targeted re-run.

Failure modes:

- ``npx vitest run`` from repo root → no config found
  → wrong environment → 100% red flag on DOM-touching
  tests.
- ``poetry run vitest`` (mixed up with backend tooling)
  → vitest not in the Python venv → command-not-found.

Concrete rule: when a recent edit "breaks every vitest
file at once," check the cwd before suspecting the code.
A green run minutes ago in the same session and a red
run now with ``setup: 0ms`` is the cwd diagnostic, not a
regression.

## `poetry update` vs `poetry lock` semantics

Surfaced during the 2026-05-12 dep-update audit Phase 3.
The ``make lock-all-plugins`` target runs ``poetry lock``
per plugin. ``poetry lock`` validates that existing
resolutions still satisfy current pyproject constraints —
it does NOT refresh transitives to their latest within the
allowed range. ``poetry update`` does that.

So:

- **``poetry lock``** = "re-resolve from pyproject specs."
  Only meaningful after a pyproject pin changed. No-op when
  nothing in pyproject changed (the existing lock is still
  a valid resolution).
- **``poetry update <pkg>``** = "move this package (and its
  transitives) to the latest within range." Touches the
  lock; pyproject is unchanged unless the new version
  exceeds the caret.
- **``poetry update`` (bare)** = "move EVERY package within
  every range." Maximally aggressive; pulls every patch +
  every minor + every transitive-of-transitive. Risky:
  one low-risk direct bump can pull a high-risk transitive
  via the upstream's relaxed bounds (see next rule below).

The ``make lock-all-plugins`` target serves the "pyproject
changed" case (e.g. after a shared-dep pin bump propagated
to every plugin via ``sync-versions``). It is NOT a "pull
patch transitives" tool. Use ``poetry update <allowlist>``
per plugin for that purpose.

Concrete rule: when "the lockfile didn't change after
``make lock-all-plugins``", check whether any pyproject
changed. If none, the no-op is correct. If patch
transitives are still wanted, switch to a per-plugin
``poetry update`` with an explicit allowlist.

## Transitive deps can surface high-risk packages from low-risk direct bumps

Surfaced during the 2026-05-12 dep-update audit Phase 3,
on a single test plugin run before going wider.

Bare ``poetry update`` on ``adaptive-learner-plugin-help`` (one of
11 plugins, used as a pre-flight test) pulled:

- ✅ ``pydantic 2.12.5 -> 2.13.4`` (low-risk patch)
- ✅ ``idna``, ``packaging``, ``coverage``, ``pygments``
  (audit-low-risk batch)
- ⚠️ ``fastapi 0.135.3 -> 0.136.1`` (the plugin pins
  ``^0.136.0``, so 0.136.1 is in-range; backend is at
  0.136.0)
- 🚨 ``starlette 0.46.2 -> 1.0.0`` — explicitly
  audit-deferred as high-risk

Cause: FastAPI 0.136.1 relaxed its upper bound on
starlette. A transitive walk through this relaxed bound
pulled starlette 1.0, the package the audit had
specifically deferred. The plugin's lock was reverted
immediately (``git checkout`` + ``poetry install``
downgraded back to 0.46.2).

The general shape: **low-risk direct bumps can pull
high-risk packages transitively when the upstream
relaxes a bound.** Even an audit that correctly
categorised packages by direct risk can miss this if
the audit didn't model transitive cascades.

Concrete rule for any bulk-bump pass:

1. **Pre-flight a single instance before bulk-applying.**
   One test plugin / one test environment, never blind
   bulk. The 2026-05-12 audit caught the starlette
   surfacing on plugin #1 of 11; revert was cheap.
2. **Prefer ``poetry update <allowlist>`` over bare
   ``poetry update``.** The allowlist constrains which
   packages can move; transitives only move if their
   own version constraint demands it. Example for the
   plugin-Pydantic alignment use case:
   ``poetry update pydantic pydantic-core`` (NOT
   ``poetry update``).
3. **If the audit deferred a package as high-risk, add
   a regression check.** Grep for the package name in
   the resulting lock-diff before committing; if it
   appears in the diff despite not being in your
   allowlist, surface and revert.
4. **The "two installation paths" rule still applies.**
   A backend-only lock-resolution test is not enough;
   a transitive surfacing in a plugin lock would only
   appear when you actually run that plugin's
   ``poetry install``. Per-plugin CI catches this; a
   one-time pre-flight runs faster.

## Audit findings need production-vs-dev environment classification before urgency-tier

Surfaced during the v0.31.0 pre-release verification (2026-05-13).

The D2 verification audit reported "GET /api/backup/export
returns HTTP 500 with `PermissionError: 'config/backup_history.json'`
in Docker" and classified it as a data-loss-class release-
blocker. The technical finding was correct: the path was a
CWD-relative literal that violated the explicit
"Filesystem isolation: production data lives outside the
project tree" rule. But the urgency classification was
overstated by one environment-class. The actual breakdown:

- **Dev Docker** (the `docker-compose.yml` bind-mount path
  `./backend:/app`): the bind mount inherits the host's UID,
  so the container's `adaptive_learner` user cannot write to the
  project tree. The endpoint crashes; the bug is real for
  every contributor who runs `docker compose up` from the dev
  compose.
- **Production Docker** (`docker-compose.prod.yml`, no bind
  mount on `/app`): the Dockerfile does
  `RUN groupadd -r adaptive_learner && useradd -r -g adaptive_learner
  adaptive_learner && mkdir -p /app/data && chown -R adaptive_learner:adaptive_learner
  /app` then `USER adaptive_learner`. The container's user OWNS the
  entire `/app/` tree including `config/`. The CWD-relative
  write happens to land in a writable directory. The bug
  **never fired in production**.

The fix still ships (defense-in-depth + the filesystem-
isolation rule still applies + alignment to a consistent
behaviour across both environments), but the urgency tier is
"correct architectural cleanup" not "data-loss class
release-blocker". Verification command for any future audit
that suspects a Docker write-path failure:

```bash
docker exec <prod-container> sh -c \
    "ls -la /app/<the-path-under-suspicion> && \
     touch /app/<dir>/probe-write && rm /app/<dir>/probe-write && \
     echo WRITABLE || echo READONLY"
```

This separates "broken in dev only" from "broken in prod
also" before scope-setting any fix.

**Rule for future audit reports**: when a finding is "X
crashes with PermissionError in Docker", the audit MUST
distinguish which Docker setup (dev with bind mount vs prod
with named volume) before assigning urgency. The same code
path can be fatal in one and harmless in the other. Audit
reports that omit the environment distinction will lead to
either over- or under-urgent triage.

**Concrete artefact from the v0.31.0 cycle**: the Phase 2
path-isolation fix (commit `a341b57`) is correct, ships,
and is properly motivated by the architecture rule. But the
"prod blocker" framing was wrong — it was a dev-environment
blocker AND an architecture-consistency improvement, NOT a
production data-loss bug. The broader fix for the 10+
remaining `_base_dir / "config" / "app.yaml"` writes in
`backend/app/routers/settings.py` was deferred as
`PROD-WRITES-ARCHITECTURE-01` (P3) on the same reasoning:
production is fine, dev quirk eventually deserves the
broader cleanup but not at v0.31.0 release-blocker urgency.

## User-facing time estimates must scale with input size or be omitted

Surfaced 2026-05-14 from a manual smoke test of v0.31.0.

The Medium-import upload UI shipped with the message
"Verarbeitung auf dem Server … das kann bis zu einer Minute
dauern." (and direct translations in all 7 other catalogs).
The "up to one minute" claim is false for large archives — a
500MB Medium export takes substantially longer than 60s on
the same hardware that handles a 50MB archive in under 10s.
User sees no progress feedback past the minute mark and
assumes AdaptiveLearner has crashed.

Wrong:

- "X seconds" / "X minutes" / "up to N minutes" claims in
  user-facing strings for any operation whose cost scales
  with input size: uploads, imports, exports, bulk
  operations, AI batch calls.

Right:

- Omit the time bound, OR
- Frame the dependency: "Larger archives may take longer."
  / "Bei großen Archiven kann das länger dauern." / etc.
- For operations with truly bounded cost (sub-second SQL
  bulk DELETE, single-record fetch), no time language is
  needed.

A user-facing string with a hard time bound is a promise to
the user. Promising "≤ 1 minute" creates a "false-crash"
impression for any input that breaks the promise. The cost
of the bound is the trust the user loses; the value is near
zero because they would have waited regardless.

This pairs with the existing rule **Bulk-operation limits
should be per-operation cost-profile**. Same principle —
cost depends on input — applied to text rather than caps.

Audit checkpoint: at release time, grep i18n catalogs for
hard time bounds:

```bash
grep -rniE "minute|sekund|second|dakika|分" \
  backend/config/i18n/*.yaml | grep -iE "dauer|takes|tardar|prendre|demor|sürebilir|かかります"
```

False-positives: config-field labels (e.g. "Timeout
(Sekunden)") and ordinal markers (e.g. "First session").
True positives: any wait-time claim a user reads while
waiting.

## Radix DropdownMenu + happy-dom is brittle for Vitest

Radix DropdownMenu (`@radix-ui/react-dropdown-menu`) renders its
menu content through a portal and uses pointer events plus
focus-scope state for the open transition. happy-dom's
portal + focus-scope simulation is incomplete, so a Vitest
that mounts a component using DropdownMenu can:

- Render the trigger button correctly (works).
- Open the menu on `fireEvent.click(trigger)` —
  intermittent. Sometimes the menu content never lands in
  the DOM; sometimes it lands but `findByTestId` for an
  item inside `<DropdownMenu.Portal>` returns nothing.
- Throw `setState during render` from
  `@radix-ui/react-focus-scope` when both
  `fireEvent.pointerDown` + `fireEvent.click` fire in
  rapid succession (the workaround pattern most
  documentation suggests).

The F2c session burned ~30 min trying every combination of
`fireEvent.click`, `fireEvent.pointerDown` +
`fireEvent.pointerUp`, `userEvent.click`, and adding
`act()` wrappers. None of them produced a stable test.

Concrete rule for new Vitest files that exercise a Radix
DropdownMenu:

1. **Test the trigger button's existence** via
   `findByTestId` on the trigger. This works reliably and
   pins regressions where the trigger disappears entirely
   (e.g. the kebab gets accidentally hidden behind a
   conditional).
2. **Do NOT attempt to assert on the menu content** via
   `findByTestId` inside `<DropdownMenu.Portal>`. The portal
   timing in happy-dom makes this flaky. Defer the assertion
   to an E2E spec in a real browser.
3. **Test the action handler in isolation** when the
   handler is non-trivial — pass the handler in by prop or
   extract it from the component so the unit test can invoke
   it directly. The F3 Toolbar tests do this: the primary
   Copy button (not behind a portal) gets full Vitest
   coverage including clipboard write and toast assertions;
   the chevron dropdown's two items are covered only by the
   matching Playwright spec.

If a future test needs reliable DropdownMenu-open in unit
tests, consider:

- A test-only `defaultOpen` prop on the wrapping component.
- A controlled-open variant in production code that the test
  can force open.
- Switching to a non-portal alternative for the menu.

None of these is worth the complexity for the current use
cases; the E2E split is the cleaner answer.

## Split-button (default + chevron disclosure) for primary + alternative outputs

Surfaced 2026-05-14 designing the v0.32.0 F3 Copy button.
When a feature has two outputs where one is the obvious
90%-case default and the other is a discrete alternative
("Copy as Markdown" vs "Copy as plain text"), use a
split-button: a primary action button glued to a chevron
disclosure that exposes the alternative.

Anti-patterns this avoids:

- **Two equal-weight buttons** ("[Copy MD] [Copy plain]"):
  forces the user to make a format decision in technical
  jargon every time, even when they know they want the
  default. Doubles the toolbar footprint.
- **A modal "Copy options" dialog**: extra round-trip for
  the 90%-case; users have to read + click to confirm what
  they already wanted.
- **Right-click context menu only**: invisible to anyone
  who doesn't know to right-click. Discoverability dies.

Implementation pattern (verified in F3):

- Primary button + chevron use the same Radix
  DropdownMenu trigger that's already in the codebase.
- The dropdown menu has the primary action first (so a
  user who opens the menu by mistake doesn't have to
  re-orient) plus the alternative below it.
- The primary button's default click bypasses the menu
  entirely — one click, no flicker.
- Tooltip on the chevron says "More options" / "Copy
  options" so users know it expands the action set.

Cross-platform precedent: GitHub's "Squash and merge" /
"Create a merge commit" / "Rebase and merge" split button,
Notion's "Copy" → "Copy link" / "Copy as Markdown" picker,
Linear's view-switcher. The pattern is well-understood.

When NOT to use a split-button:

- Three or more alternatives at roughly equal weight: use
  a full menu, not a split. Cognitive load of "pick one of
  three" is higher than "default plus one alternative".
- The alternatives have no clear primary: use a regular
  dropdown.
- The action is destructive: a split-button can fire the
  primary by accident. Use a confirm dialog instead.

## External GitHub Action major-version drift

Standard GitHub Actions (`actions/checkout`, `actions/setup-*`,
`actions/upload-artifact`, `actions/cache`, the pages trio, plus
common third-parties like `softprops/action-gh-release`) release new
majors periodically — usually triggered by Node runtime
deprecations or other GitHub-platform shifts. An audit finding "all
standard actions are at their current majors" is correct AT THE
TIME but stales within weeks-to-months after a deprecation
announcement.

Concrete trigger from the 2026-05-14 sweep: GitHub deprecated the
Node 20 runtime on 2025-09-19 (forced default 2026-06-02, removed
2026-09-16). Within 6 months, EVERY standard action listed above
released a new major moving to Node 24. The previous CI-hygiene
audit's `actions/checkout@v4` etc. was accurate at audit time but
the warnings re-appeared in CI within weeks.

The original test-infrastructure audit categorized "all standard
actions at current majors" as **no action needed** — accurate at the
moment, no longer accurate weeks later. Re-classify as a periodic
check, not a one-time verification.

### Periodic CI-hygiene check (every ~quarter, or after any GitHub
runtime/platform deprecation announcement)

1. List every pinned action:
   ```
   grep -rE 'uses: [a-zA-Z][a-zA-Z0-9-]+/[a-zA-Z][a-zA-Z0-9-]+@v[0-9]+' \
     .github/workflows/ | sort -u
   ```
2. For each, check the latest released major against the pin via
   `gh release list --repo <owner>/<repo> --limit 5`.
3. **For each candidate version, read the action.yml runtime
   declaration directly** (not the release-note prose). This is
   the authoritative source for "does this action actually run
   on Node N?":
   ```
   gh api "repos/<owner>/<repo>/contents/action.yml?ref=<tag>" \
     --jq '.content' | base64 -d | grep '^[[:space:]]*using:'
   ```
   Returns e.g. `using: 'node24'` (or `node20`, or `composite`).
   This is the field GitHub Actions reads to pick the runtime.
4. Cross-reference the release notes via
   `gh api repos/<owner>/<repo>/releases/tags/v<N>.0.0 --jq .body`
   for breaking-change context, but treat the notes as
   advisory — see "Release-notes-vs-action.yml trap" below.
5. Pin to the **lowest** new major that satisfies the deprecation
   target AND declares the target Node version in its
   action.yml. The latest major often bundles additional
   unrelated breaking changes — taking the minimum-Node-N major
   lets you adopt those changes deliberately later, not by
   accident.
6. One commit per action class for traceable bisect; push as a
   batch.

### Release-notes-vs-action.yml trap

Release notes describe **intent and feature changes**. action.yml
declares the **actual runtime**. The two can diverge across a
major version when an action adds preliminary Node 24 support
without flipping the default. Always trust action.yml for audit
purposes.

Concrete examples from the 2026-05-14 sweep that caught this:

- **`actions/upload-artifact@v5.0.0`** — release notes said
  *"preliminary support for Node.js 24"* and the bump from v4
  was marked **BREAKING CHANGE**. Both signals pointed at "v5 is
  the Node-24 baseline". But `action.yml` at v5 declared
  `runs.using: 'node20'`. v6 was the actual transition (declared
  `node24`).
- **`actions/configure-pages@v5.0.0`** — release notes talked
  about Next.js breaking changes without mentioning the Node
  runtime at all, leading to inference (from sibling pages
  actions on Node 24) that v5 was Node-24. But `action.yml`
  declared `node20`. v6 added Node 24.

The trap is amplified by the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`
env-var: if it's already in place, runtime tests look green
because the env-var coerces Node 24 regardless of the action.yml
declaration. The action.yml read is the only honest signal.

### Composite-action transitivity

Some actions declare `runs.using: composite` (e.g.
`actions/upload-pages-artifact@v5`). Composite actions don't run
on any Node runtime directly — they wrap calls to other actions.
For those, the audit must read the composite's internal `uses:`
references and check THOSE actions' runtimes:

```
gh api "repos/<owner>/<repo>/contents/action.yml?ref=<tag>" \
  --jq '.content' | base64 -d | grep 'uses:'
```

Example: `actions/upload-pages-artifact@v5` internally calls
`actions/upload-artifact@v7`, which declares `node24`. So
upload-pages-artifact@v5 is effectively on Node 24 via its
internal dependency — no bump needed at our level even though
its own action.yml says `composite`.

### Difference between "external action" warnings

Two distinct sources of "external" warnings in CI:

- **In-repo action pins**: workflow files reference outdated
  majors. Fixable in `.github/workflows/`. This rule covers them.
- **GitHub-managed services**: e.g. the Dependabot scheduled
  service that's configured under *Settings → Code security →
  Dependabot*, not in workflow files. Annotations from those jobs
  are GitHub's responsibility, NOT the repo maintainer's. Don't
  conflate the two — always grep the codebase to confirm a warning
  has a local source before assuming a fix is locally
  implementable.

### Defensive env-var as a safety net

`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"` in each workflow's
`env:` block coerces any JavaScript-runtime action declaring Node
20 to run on Node 24. After all our standard-action pins are at
Node-24-native majors, this env-var becomes a **safety net** for
future additions (especially third-party actions that may lag) —
not an active correction. Keep it in the workflow heads; it costs
nothing and prevents reintroduction of the warning when a future
contributor adds an old-major action by habit.

## Module-level caches survive test boundaries (test isolation,
   in-memory edition)

AdaptiveLearner's filesystem and DB test isolation is well-documented
in `CLAUDE.md` ("Test isolation" section) — the `ADAPTIVE_LEARNER_TEST=1`
+ `ADAPTIVE_LEARNER_DATA_DIR` chain plus the production marker tripwire
cover those layers. But **in-memory caches in service modules
have no equivalent guard**, and they survive ALL test boundaries
inside a single pytest process.

The 2026-05-14 platform_schema regression is the canonical
example. `app/services/platform_schema.py` decorates
`load_platform_schemas` with `@lru_cache(maxsize=1)` (intentional
— production wants the YAML read once at startup). The new
`tests/test_platform_schema.py` introduced fixtures that
monkeypatch `_SCHEMA_PATH` to a tmp file with a fake schema and
calls `load_platform_schemas.cache_clear()` once in an autouse
fixture. Symptoms:

- The autouse fixture cleared the cache **before** each test
  but not **after** — `return None` instead of `yield`.
- The fake-schema dict from the last test in the file got
  cached; monkeypatch reverted `_SCHEMA_PATH` at teardown but
  the LRU cache stayed populated.
- The NEXT test file that called `load_platform_schemas()` via
  the real `/api/article-platforms` endpoint hit the LRU cache,
  saw the stale fake dict, and 5 publications tests failed with
  `ResponseValidationError: 'twitter' missing display_name` (the
  shape `test_validate_max_chars_enforced` had written).

Caught only in CI (the local pytest invocation in the same
session ran `test_platform_schema.py` in isolation, missing the
cross-file poisoning). Fix: change the autouse fixture from
`return None` to `yield`, and clear the cache on both sides.

### Rule

Any service module that uses module-level mutable state visible
to multiple tests needs a teardown hook in the fixtures that
touch it. Concretely:

- `@functools.lru_cache` decorators → tests that monkeypatch the
  underlying read must `cache_clear()` in BOTH the setup AND the
  teardown of every fixture/test that touches them. The
  `yield`-based autouse fixture pattern is the simplest shape:
  ```python
  @pytest.fixture(autouse=True)
  def _clear_module_cache():
      module.cached_function.cache_clear()
      yield
      module.cached_function.cache_clear()
  ```
- Module-level globals (singletons, registries, dicts assigned
  at import time) → same shape, reset state in both directions.
- Class-level state on a service singleton → same.

### Anti-pattern

Setup-only cache clears (`return None` instead of `yield`) look
correct in isolation — the test file's own tests pass green —
but pytest runs all collected tests in one process. The cache
written by the LAST test in your file is what subsequent test
files see. The bug is invisible inside the file's own boundary,
which is exactly why CI catches it and local single-file runs
don't.

### Detection heuristic

When adding a new test file that fakes out a service module's
inputs, grep that service module for:
```
grep -E '@(lru_|.*_)cache|_cache *=|^[A-Z_]+ *= *' \
  backend/app/services/<module>.py
```

Any match is a candidate for state-survival-across-tests. Either
add the bidirectional `cache_clear()` fixture pattern, or
document why the state is OK to leak (rare, but
``platform_schema``'s `lru_cache(maxsize=1)` IS production
behaviour we wanted, so tests need to isolate, not remove).

### Pairs with

The existing `CLAUDE.md` "Test isolation" section covers
filesystem + DB. This rule covers the third layer: in-process
in-memory state. All three layers need explicit handling.

## PluginForge v0.9.0: filtered plugins are NOT load errors

PluginForge v0.9.0 made `target_application` enforcement a hard
filter (retired the v0.7.0 deprecation warning). When the host's
`PluginManager(app_id="adaptive_learner", ...)` encounters a
discovered plugin whose `target_application` is missing or
mismatched, the plugin is dropped at discovery time and the
event is recorded in `DiscoveryResult.filtered` — NOT in
`DiscoveryResult.errors` or in `manager.get_load_errors()`.

The two channels mean different things:

- **`get_load_errors()` / `DiscoveryResult.errors`**: a plugin
  that the manager TRIED to load and that FAILED (import error,
  hookspec mismatch, missing required attribute, activation
  exception). This is a real fault the operator should see.
- **`DiscoveryResult.filtered`** (v0.9.0+): a plugin that was
  intentionally not loaded because its identity gate said "not
  for this host." This is correct behaviour, not a failure.

Operational consequence for the v0.9.0+ era: our existing
`get_load_errors()` consumers
([backend/app/main.py:414](../../backend/app/main.py#L414)
diagnostics log,
[backend/app/main.py:532](../../backend/app/main.py#L532)
`/api/plugins/errors` endpoint) do NOT need severity-tagging
or a "filtered vs errored" split. Filter events never appear
in the error channel under v0.9.0+. Our current boot log
confirms this: `Plugins loaded (N/N enabled)` reports the
expected count with zero filter warnings, zero load errors,
across all 7 shipped plugins (all of which declare
`target_application = "adaptive_learner"` since v1.7.0).

This is why the v1.11.0 PluginForge-adoption audit closed the
"severity filter" question as docs-only rather than code-only:
the framework already separates filters from errors at the API
layer, so the host doesn't need to.

### When this would change

If we ever add a third-party plugin path (Settings → Plugins →
Install from ZIP, or any other surface that loads plugins
authored against a DIFFERENT host), those plugins would be
filtered by `target_application`. To surface the filter event
to the user (e.g. "This plugin was built for X, not Adaptive
Learner — installation refused"), call
`manager.get_last_discovery_result().filtered` directly and
emit a UI message. Do NOT promote filter events into the
error channel; they are not the same severity class and
conflating them re-creates the bug v0.9.0 fixed at the
framework level.

### Pairs with

- `architecture.md` § "Plugin installation (ZIP)" — the future
  third-party install path is where filter-event surfacing
  becomes user-visible value.
- `.claude/rules/code-hygiene.md` § "Error handling
  architecture" — filters are not errors, the same way a 401
  is not a 500. Keep the channels separate.

## Dexie-mode is part of the contract: same-commit or not at all

Surfaced 2026-05-26 from the v1.26.0 Phase 42 / Learning
Repository incident. The new ``LearningRepoSettingsSection``,
``LearningRepo`` page, and ``LearningRepoWidget`` all called
``api.pluginSettings.*`` / ``api.learningRepo.*`` directly,
bypassing ``IStorageService``. The feature shipped to main,
the GH-Pages workflow rebuilt with ``VITE_STORAGE_MODE=dexie``,
and every user landing on the public deployment got a raw
``HTTP 404`` toast on Settings, Dashboard, and the
Learning-Repo page. The bug went undetected for ~24h because
no automated gate exercised the GH-Pages-shape build.

### Rule

**Any new feature whose default path makes an API call MUST
either:**

1. Route through ``getStorage()`` so ``DexieStorage`` carries
   the client-side path (preferred — keeps both modes alive),
   **OR**
2. Gracefully degrade in Dexie mode with a friendly,
   user-facing "not available in browser mode" message —
   shipped IN THE SAME COMMIT as the feature.

"We'll add the Dexie path in a follow-up" is exactly the
pattern this rule exists to ban. Follow-ups land at "as soon
as someone has time"; the GH-Pages deploy runs in minutes.
The half-shipped state spends ~all of its time in production.

### Why the rule lives at this scope

The GitHub Pages deployment at
``https://astrapi69.github.io/adaptive-learner/`` is the
**first impression** for every prospective user. Modern users
have zero tolerance for raw HTTP errors and stack traces —
one error toast and the tab is closed forever. Server-mode
users (the dev's own machine) can take a degraded experience;
public visitors cannot.

### Enforcement

- ``make test-dexie-smoke`` walks every nav-reachable route
  against the ``VITE_STORAGE_MODE=dexie`` build with NO
  backend. Any error toast or uncaught error fails the gate.
- Aggregated into ``make release-test`` so it cannot be
  skipped at release time.
- The gate exists in ``e2e/dexie/dexie-mode.spec.ts`` +
  ``e2e/playwright.dexie.config.ts`` and runs in ~20 seconds
  (vite preview + 15 chromium navigations + assertions).

### Concrete failure modes the rule prevents

- A component that imports ``api.*`` directly and crashes
  with 404 in Dexie mode (Phase 42 / Learning Repository).
- A settings panel that fetches plugin config from a
  backend-only endpoint (``/api/plugin-settings/{name}``)
  with no DexieStorage equivalent.
- A "save" button that toasts a raw ``ApiError.detail`` on
  failure instead of routing through the friendly mapper
  shipped in DEV-MODE-FRIENDLY-ERRORS-01.
- A new plugin route surfaced from a Settings tab where the
  plugin's manifest only mounts under ApiStorage's plugin
  discovery.

### Pairs with

- "Operational gaps masquerade as wired infrastructure" —
  same family. A feature that works in API mode is not the
  same as a feature that works. A gate that only exercises
  one mode is operationally half-wired.
- ``DEV-MODE-FRIENDLY-ERRORS-01`` (closed in commit 3eae5e4)
  — the friendly-error mapper handles "API errors should
  never reach the user" at the toast layer; this rule
  handles the same problem at the architectural layer
  ("the API call shouldn't happen in the first place when
  Dexie has the data").
- ``PHASE-42-STORAGE-ABSTRACTION-01`` (open backlog) —
  retroactive cleanup of the v1.26.0 incident; ports the
  Learning Repository to the storage abstraction so the
  Dexie-mode path works for real instead of merely degrading
  gracefully.

## Source-language default: set at import time, inherited downstream

Languages are captured at IMPORT time (v1.54.0): the import detail page
sets ``ImportedConversation.source_language`` (the chat language the
learner SPEAKS) + ``target_language`` (what they LEARN), and they flow
through the pipeline (analysis prompt -> save-as-lesson -> share). The
root cause of the recurring "source shows en" bug was that NOTHING set
the languages at the source, so every downstream form guessed/patched
the previous step's bad data.

### Rule (current, v1.54.0+)

- **At import**: source defaults to the app language (``useI18n().lang``);
  target is auto-detected from the chat content
  (``detectLearningLanguage``) — both editable, then persisted on the
  import via ``imports.update``.
- **Downstream forms INHERIT** the language pair instead of guessing:
  - ``SaveOfflineLessonModal`` reads the import's pair (props), guessing
    only when absent (old imports).
  - ``ShareWizard`` SOURCE default = the lesson's ``source_language``
    when it is a valid ISO code DIFFERENT from the target; otherwise the
    app language (fallback for missing / invalid / source==target
    collisions in old pre-pipeline lessons). TARGET keeps the saved
    value when valid + different, else content detection, else empty.
- Every form keeps the field EDITABLE so an old bad value is correctable.

### History (do not repeat)

The bug recurred THREE times before the root-cause fix. e0ddef6 patched
only ``SaveOfflineLessonModal``; v1.53.2 (commit c624bb2) made the
ShareWizard source "always the app language" as a stopgap. v1.54.0
replaced that stopgap with the import-time pipeline + the
inherit-valid-only rule above (the app-language default now lives at the
import step, where it is correct, instead of overriding good data
downstream). Do NOT reintroduce a downstream "always app language"
override OR a guess that ignores the inherited pair — fix it at import
time and inherit.

### Pairs with

- Validation must run against the FORM STATE (the edited values), not the
  original lesson object. The ShareWizard step-1 gate recomputes inline
  every render from the ``editSource`` / ``editTarget`` / ``editLevel``
  state, so a dropdown change re-validates immediately.

## A "flaky" test that fails deterministically on unchanged code is stale, not flaky

Surfaced 2026-06-10 during the v1.71.1 release gate. The `lesson-tts`
Dexie-smoke spec failed the gate; it carried a `#165` comment declaring
it an intermittent **timeout flake** on loaded runners (it had been given
`timeout: 60_000, retries: 2`). The first instinct — "loaded machine,
re-run it" — was wrong twice over:

1. It failed again on a full re-run, and again **in isolation on an idle
   machine in 10-30s** (nowhere near the 60s timeout). A genuine timeout
   flake does not reproduce 3/3 on an idle box in a fraction of the cap.
2. The assertion (`getByTestId("lesson-read-along")` visible) targeted a
   view that a **prior release intentionally removed** (#147 in v1.68.0:
   "read-aloud no longer swaps the theory body to a follow-along"). The
   `ReadAlongText` component that renders that testid had **zero
   consumers** — so the element never rendered and the test failed 100%.

The diagnosis that cracked it, in order:
- **Re-run in isolation, watch the wall-clock.** Deterministic + fast =
  not a timeout flake, regardless of any "flaky" comment on the test.
- **`grep` the asserted testid's consumers.** A testid that exists in a
  component file but has **no JSX consumer** is dead — the element never
  mounts. (`grep -rn '<ComponentName' src` returning only the definition
  is the tell.)
- **`git log <last-release-tag>..HEAD -- <spec> <component-dir>`.** Empty
  output proves the current change set didn't touch it — so a failure is
  either pre-existing or environmental, never "your diff broke it".

Rules:
- A comment calling a test "flaky" is a **hypothesis, not a diagnosis**.
  Verify it (isolate + time it) before trusting `retries`/`timeout` band-aids.
- When a feature is **removed/changed by design**, delete or update its
  tests in the SAME change. A leftover assertion against a removed view is
  a 100%-failing test that a `retries: 2` will mask as "flaky" until a
  loaded run finally exposes it. (Pairs with "Operational gaps masquerade
  as wired infrastructure" — `#193` "stabilised" the spec without a
  verified green run; the stabilisation hid a stale assertion.)
- The fix for a stale test is to align it with the intended behaviour
  (here: drop the follow-along assertions, keep the mini-player + engine
  checks), not to re-add the removed UI.

## User-reported UI bugs: confirm against a FRESH deploy before fixing

Surfaced 2026-06-10. Aster reported a stream of dark-theme contrast /
spacing bugs from manual testing of the GitHub-Pages deployment. Several
(matching result feedback, correction-round Enter, LearningPath tabs,
"Meine Lektionen" overflow, the FocusAreas/Review buttons) were **already
correct in `main`** — the deployed build was many merges behind, so they
were **stale-build artifacts**, not code bugs. Static analysis (and
compiled-CSS inspection: `bg-card`→`var(--bg-surface)`, `text-fg-*`→
runtime `var()`) confirmed the source was right.

But the inverse trap is just as real: after Aster **hard-refreshed**, a
subset persisted and were **genuinely real** ("nicht als stale build
abtun"). Dismissing those as stale would have been the mirror-image error.

Rules:
- For a UI bug reported against a **deployed** build, first establish
  *which build* the user saw. If `main` already contains the fix, the
  action is **deploy/refresh**, not a code change — say so and verify the
  deploy is current (the GH-Pages deploy here had silently failed on a
  transient `actions/deploy-pages` 401, so the fixes weren't even live).
- Do **not** file or ship a "fix" for code that is already correct
  (GITHUB-ISSUE-PFLICHT: a false issue is worse than none). Confirm the
  defect exists in current source first (read the component + the
  compiled CSS, not just the symptom).
- Equally, do **not** dismiss a hard-refreshed, still-failing report as
  "stale build". When static analysis says the code looks correct but the
  user insists post-refresh, the gap is in the rendered runtime you can't
  see — ask for the screenshot / DevTools computed `background-color` +
  `color` + active `data-theme` rather than guess-fixing.

## The `prettier-frontend` pre-commit hook reformats whole files (no config + 4-space code)

Surfaced 2026-06-12 during the TipTap v2->v3 migration (#311 / #315).

`frontend/` has **no prettier config** (no `.prettierrc`, no `prettier`
key in `package.json`), but the entire `frontend/src` tree is authored in
**4-space indent + `{x}` (no inner brace spaces)**. The `prettier-frontend`
pre-commit hook (`.pre-commit-config.yaml`, `entry: cd frontend && npx
prettier --write`) therefore runs prettier with its **defaults** (2-space,
`{ x }`, 80-col) and rewrites *every staged `frontend/src` file in full* to
a style nothing else in the repo uses. Touch one line, the hook reformats
the whole file.

**CI already skips this hook**: `.github/workflows/ci.yml` sets
`SKIP: prettier-frontend,eslint` for the pre-commit job. So prettier is
enforced *nowhere* except this misconfigured local hook. Committing its
output is wrong — it produces hundreds of lines of churn inconsistent with
the codebase.

Rules until the config is fixed (a 4-space `.prettierrc` or dropping the
hook — filed as a follow-up):

1. **Commit `frontend/src` changes with `SKIP=prettier-frontend git commit`.**
   The ESLint hook still runs (and is the real gate); only the spurious
   reformatter is skipped. This mirrors CI exactly.
2. **Never commit the hook's reformatting.** If a commit aborted *after*
   the prettier hook ran, the 2-space rewrite is sitting in your worktree —
   see the stash trap below.

### Corollary: `git stash` captures pre-commit-hook worktree edits

The same session lost time to this. Sequence that bites:

1. `git add` a `frontend/src` file (clean 4-space edit), `git commit`.
2. The `prettier-frontend` hook rewrites the file to 2-space **in the
   worktree**, then the commit aborts (e.g. the ESLint hook failed on an
   unrelated pre-existing error). pre-commit restores *unstaged* changes
   but leaves the prettier rewrite in the worktree (the file shows `MM`).
3. `git stash push -- <file>` now captures the **2-space rewrite**, not
   your clean edit.
4. Later `git stash pop` + commit (with prettier skipped) silently commits
   the whole-file reformat. (This actually happened in #314 and needed the
   follow-up #315 to undo.)

Tells + fix:
- After an aborted commit, check `git diff --stat`: a ~20-line change
  showing as 200+ changed lines means the hook reformatted the file.
- Recover the clean edit with `git restore <file>` **before stashing** —
  `git restore` pulls from the index (your staged clean edit), discarding
  the worktree reformat. Verify with `git diff --cached` (should be only
  your real change) before committing.
- General rule: a pre-commit hook that mutates files (`prettier --write`,
  `ruff format`, `--fix`) leaves those mutations in the worktree when the
  commit fails. Treat the worktree as dirty-with-hook-output after any
  aborted commit; don't stash or re-commit blind.

## An i18n string change can break a nightly-only E2E gate invisibly

Surfaced 2026-06-17 during the v1.86.0 release-test. Five EXP-023 dexie-smoke
specs failed on `expect(content-repo-result).toContainText(/passed/i)` (and
`/failed/i`). The app was correct — validation succeeded and rendered
`"Validierung erfolgreich: 1 Sets, 1 Lektionen."`. The cause: PR #662
("translate repository management UI in all 9 catalogs") ADDED the German
`content_repo.validation.passed` / `.failed` strings. The app's default locale
is German; before #662 those keys had no German translation and fell back to
the ENGLISH "Validation passed/failed…", which the specs matched. Adding the
correct German translation removed the fallback, so the assertions broke.

Why it surfaced only at release: the **Dexie-mode E2E gate runs nightly +
release-only, NOT on PRs** (#552 cadence). So #662's PR was green (it doesn't
run dexie-smoke), and the drift sat latent until `make release-test` ran the
gate. This is the same class as "wired != working" and the stale-assertion
rule, with an i18n-specific trigger.

Rules:
- **E2E text assertions must not hardcode one locale's wording** when the app
  renders in a different default locale (German here). Match a locale-robust
  pattern (`/passed|erfolgreich/i`) or assert on a stable, non-translated
  signal (a testid state, a count, a success CSS token), not the prose.
- **Any i18n PR that adds/changes a translated string that an E2E spec asserts
  on is a latent break** for the nightly/release gates. When translating a
  string, grep the E2E specs for the old English wording
  (`grep -rn "toContainText(/<word>/" e2e/`) and update the assertion in the
  same PR — even though the PR's own CI won't run the affected gate.
- **A previously-passing assertion that depended on an i18n FALLBACK is
  fragile by construction.** If a test passes only because a translation is
  missing, completing the translation breaks it. Prefer locale-agnostic
  assertions from the start.
