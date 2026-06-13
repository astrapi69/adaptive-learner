# Coding standards

## General

- Developer: Asterios Raptis (solo developer, AI-assisted).
- Goal: pragmatic, maintainable, quickly deliverable. No over-engineering.
- When unclear: ask rather than guess.

## Python (Backend + Plugins)

- Python 3.11+, Poetry for dependency management.
- Type hints ALWAYS. No `Any` without a comment.
- Docstrings for public functions (Google style).
- pytest for tests. Prefer fixtures, no setUp/tearDown.
- Prefer async where FastAPI supports it.
- Import order: stdlib, third-party, local (isort-compatible).
- Pydantic v2 for schemas. Field validators instead of manual checks.

## TypeScript (Frontend)

- Strict mode enabled. No `any` without a comment.
- Interfaces for data models, types for unions/aliases.
- Functional components with hooks. No class components.
- Props defined as an interface.
- Extract complex logic into utility functions or the API client, not into components.
- Styling: Tailwind CSS (v4) utility classes preferred (adopted v1.54.0+). Do NOT add new entries to global.css; utilities resolve to the existing CSS variables, so theming still works. Existing component CSS is migrated when the component is touched, not proactively. See docs/development/tailwind-migration.md.
- shadcn/ui: use for UI primitives (Dialog, Tabs, Toast, Button, Input, Select). Add components with `npx shadcn@latest add {component}`. shadcn wraps Radix; prefer it over wiring Radix directly for new UI.
- Radix UI for dialogs, dropdowns, tooltips, tabs, select where shadcn/ui is not yet wired. No custom DOM handling for those.
- @dnd-kit for drag-and-drop. No manual DnD.
- Lucide React for icons. No other icon libraries.
- react-toastify for user feedback. No window.alert(), no console.log for user info.

## Naming

- Python: snake_case (files, functions, variables), PascalCase (classes).
- TypeScript: PascalCase (components, interfaces), camelCase (functions, variables).
- Plugin folders: adaptive-learner-plugin-{name} (kebab-case).
- Python package inside a plugin: adaptive_learner_{name} (snake_case).
- Events/hooks: snake_case (on_session_complete, get_progress_summary).
- No I-prefix for interfaces. `LearningProject`, not `ILearningProject`.
- Backup format: JSON via `/api/backup/export` + `/api/backup/import`. No proprietary archive extension.
- No generic names: data, info, result, temp, item, obj, val, tmp, x are forbidden.
  Use instead: session_data, plugin_info, evaluation_result, lesson_item.
  Exception: loop variables (i, j) and lambdas.

## Formatting

- No em-dash (-- or Unicode U+2014). Use hyphens (-) or commas.
- Standard UTF-8 characters only.
- No emojis in code or comments.
- Indentation: 4 spaces (Python), 2 spaces (TypeScript/CSS).
- Automatic formatting: ruff (Python), Prettier (TypeScript). See code-hygiene.md.
- Automatic linting: ruff (Python), ESLint (TypeScript). See code-hygiene.md.
- Pre-commit hooks enforce formatting and linting before every commit.

## Git

- Conventional Commits: feat:, fix:, refactor:, docs:, test:, chore:
- Provide a scope when it's clear: feat(export): ..., fix(editor): ...
- One commit per logical change, not everything in one.
- **Gitflow (#334):** `develop` is the active development branch; `main`
  holds releases only (tags vX.Y.Z). Branch `feature/*` / `fix/*` / `chore/*`
  FROM `develop` and open PRs AGAINST `develop`, never `main`. `main` is
  written only by a `release/*` merge (or a `hotfix/*` for emergencies — the
  one case that branches from `main`). Do NOT develop on `main`.
- Branch naming: feature/{name}, fix/{name}, chore/{name} (from develop);
  release/vX.Y.Z (from develop, merges to main + back to develop);
  hotfix/vX.Y.Z (from main, merges to main + develop).
- Do not add `Co-Authored-By` trailers attributing non-human
  collaborators (AI tools, automation bots, MCP agents). Human
  co-authors are attributed via the standard GitHub mechanism.
  Exceptions require an explicit note in the commit body
  stating who authorized the attribution.

## Function design and cohesion

### Ground rules

- Every function has exactly one responsibility.
- Max 40 lines per function. Anything over 50 is an immediate refactoring signal.
- Functions that do multiple things (parse AND save, validate AND transform) get split into separate functions.
- Indicator of low cohesion: comments like "# Step 1", "# Step 2", "# Now do X" inside a single function. Every step is its own function.

### Do not mix abstraction levels

- A function operates at ONE abstraction level.
- WRONG: db.query() and string formatting in the same function.
- RIGHT: a high-level function calls low-level helper functions.

### Route handlers

- routes.py contains ONLY routing logic: validate input, call a service, return the response.
- Business logic belongs in service modules or helper functions, NOT in route handlers.
- Different code paths (if/elif cascades for formats, types, etc.) get extracted into their own functions.

### Data between functions

- Shared data: a dataclass or TypedDict, NOT loose dicts passed around.
- Every extracted function must be individually testable without reconstructing the whole context.

### Crash early

- Catch invalid inputs at the start of the function, not deeply nested.
- Pydantic validation for API input.
- Guard clauses instead of deeply nested if/else.

**Anti-pattern (God Method):**
```python
# WRONG: 150+ lines, 8 responsibilities
@router.post("/{session_id}/message")
def message(session_id, body, ...):
    # load session + project + profile, build prompt,
    # call AI provider, parse response, persist message,
    # award XP, evaluate badges, update streak, ...
```

**Right (decomposed):**
```python
# routes.py - ONLY routing
@router.post("/{session_id}/message")
def message(session_id, body, ...):
    context = build_message_context(session_id, body)
    return run_session_step(context)

# session_runner.py - orchestration only
def run_session_step(ctx: MessageContext) -> MessageResponse: ...

# helpers.py - individually testable
def validate_session_open(session_id: str, db: Session) -> LearningSession: ...
def build_prompt(profile: LearningProfile, history: list, step: int) -> str: ...
def persist_step_evaluation(db: Session, eval_input: StepEvaluationInput) -> None: ...
```

## DRY - Don't Repeat Yourself

- Same logic in two places: extract into a shared function.
- Same constants in two places: move them into a central file.
- Three duplicates: refactor immediately, not later.

## Boy Scout Rule

- Leave code cleaner than you found it. Small improvements on every change.
- This also applies to Claude Code: if you touch a function and it violates rules, fix the violation along with it.

## Error reporting

Error details must be precise enough that a GitHub Issue built from them is directly actionable, without follow-up questions.

Chain: AdaptiveLearnerError -> API response (detail + traceback) -> ApiError -> toast with "Report issue" -> GitHub Issue

- No `except` without logger.error(). Never swallow an exception.
- Exception detail must contain the reason, not just the function name.
- Services: include str(e) in AdaptiveLearnerError subclasses (NOT HTTPException, see code-hygiene.md).
- In debug mode: include the stacktrace in the response (global exception handler in main.py). Consumed by the "Report issue" button as the issue body.
- On the frontend: pass the ApiError object to toast.error(), not just a string.
- "Report issue" button in the toast: opens a GitHub Issue with title (error detail), body (stacktrace, browser, app version).
- Generic error messages like "Export failed" or "Import failed" without details are FORBIDDEN. They make GitHub Issues worthless.
- Every fetch call on the frontend must throw ApiError on failure, not Error.

## Tests

- Backend: pytest. Plugin tests in plugins/{name}/tests/.
- Frontend: Vitest (happy-dom).
- E2E: Playwright.
- Mutation testing: mutmut (Python).
- New endpoints: at least one happy-path test.
- Bug fixes: failing test FIRST, then fix.
- Mocking: mock external services (LanguageTool, Pandoc), no real calls in tests.
- `make test` must stay green after every change.
- Surviving mutants in critical code: add tests. In trivial code: ignore.
- See quality-checks.md for the full test strategy and mutmut configuration.

## Security

- Never commit ADAPTIVE_LEARNER_SECRET_KEY.
- .env files in .gitignore.
- License keys only through LicenseStore (backend/app/licensing.py).
- Validate user uploads (file type, size) before storage.
- Plugin ZIP installation: name validation + path traversal check.

## Performance

- SQLite is single-writer. Minimize writes, batch where possible.
- TipTap JSON can get large. Autosave with debounce (not on every keystroke).
- Plugin loading at app startup. Lazy-load plugin UI where possible.

## Dependencies

New dependencies only after asking. Existing stack:

Backend: FastAPI, SQLAlchemy 2.0, Pydantic v2, pluginforge, aiosqlite, cryptography (Fernet), platformdirs, PyYAML
Frontend: React 19, TypeScript 6 (strict), TipTap 2 (15+1 extensions), Vite 8, Tailwind CSS 4 + shadcn/ui, Radix UI, Lucide, react-toastify, Recharts 3, Dexie 4, sql.js + jszip
Testing: pytest, Playwright (E2E), Vitest 4 (happy-dom)
Linting/formatting: ruff (Python), ESLint + Prettier (TypeScript), pre-commit
Tooling: Poetry, npm, Docker, Make
