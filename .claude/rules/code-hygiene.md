---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Automated code quality enforcement, formatting, linting, pre-commit hooks, error handling architecture, API conventions, logging, docstrings
globs:
  - backend/**/*.py
  - plugins/**/*.py
  - frontend/src/**/*.ts
  - frontend/src/**/*.tsx
  - .pre-commit-config.yaml
alwaysApply: false
---

# Code hygiene

Automated enforcement of code quality. These rules make every commit look consistent, whether written by a human or an AI.

## Formatting and linting (automatic)

### Python (Backend + Plugins)

```toml
# backend/pyproject.toml
[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = [
  "E",    # pycodestyle errors
  "W",    # pycodestyle warnings
  "F",    # pyflakes
  "I",    # isort
  "N",    # pep8-naming
  "UP",   # pyupgrade
  "B",    # flake8-bugbear
  "SIM",  # flake8-simplify
  "TCH",  # flake8-type-checking
]
ignore = [
  "E501",  # line-length (handled by the formatter)
]

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

Commands:

```bash
cd backend && poetry run ruff check .         # lint
cd backend && poetry run ruff check --fix .   # auto-fix
cd backend && poetry run ruff format .        # format
```

### TypeScript (Frontend)

```json
// frontend/.eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

```json
// frontend/.prettierrc
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

Commands:

```bash
cd frontend && bunx eslint src/ --fix    # lint + auto-fix
cd frontend && bunx prettier --write src/ # format
```

### Setup (one-time)

```bash
# Backend
cd backend && poetry add --group dev ruff

# Frontend
cd frontend && bun add -d eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks prettier
```

## Pre-commit hooks

Automatic checks before every commit. Prevents unformatted or broken code from reaching the repo in the first place.

```yaml
# .pre-commit-config.yaml (in the project root)
repos:
  - repo: local
    hooks:
      - id: ruff-check
        name: ruff lint
        entry: bash -c 'cd backend && poetry run ruff check .'
        language: system
        pass_filenames: false
        files: ^backend/
      - id: ruff-format
        name: ruff format check
        entry: bash -c 'cd backend && poetry run ruff format --check .'
        language: system
        pass_filenames: false
        files: ^backend/
      - id: eslint
        name: eslint
        entry: bash -c 'cd frontend && bunx eslint src/ --max-warnings=0'
        language: system
        pass_filenames: false
        files: ^frontend/src/
      - id: prettier
        name: prettier check
        entry: bash -c 'cd frontend && bunx prettier --check src/'
        language: system
        pass_filenames: false
        files: ^frontend/src/
      - id: pytest-quick
        name: pytest (backend only)
        entry: bash -c 'cd backend && poetry run pytest tests/ -x -q'
        language: system
        pass_filenames: false
        files: ^backend/
```

Setup:

```bash
pip install pre-commit
pre-commit install
```

After that, on every `git commit` the following happens automatically:

1. Python code is checked for lint errors (ruff)
2. Python formatting is checked (ruff format)
3. TypeScript is checked for errors (ESLint)
4. TypeScript formatting is checked (Prettier)
5. Backend tests run (quick smoke test)

If anything fails: the commit is rejected and the errors are shown.

## Error handling architecture

**Principle: handle errors at the right layer**

```
Frontend       Shows the user what went wrong (toast). Catches ApiError.
    |
API client     Converts HTTP errors into ApiError. Only place for fetch().
    |
Router         Catches nothing. Global exception handler maps automatically.
    |
Service        Throws domain exceptions (NotFoundError, ValidationError, ...). No HTTP concepts.
    |
Plugin         Plugin code throws domain exceptions like any other service. Wrapped at the framework boundary if needed.
    |
External       AI providers (Anthropic / OpenAI / Gemini), Edge-TTS. Wrapped inside the service as ExternalServiceError.
```

Every layer catches only what it can handle itself. Everything else is passed up.

### Backend: exception hierarchy

```python
# backend/app/exceptions.py
class AdaptiveLearnerError(Exception):
    """Base class for all AdaptiveLearner errors."""
    def __init__(self, message: str, detail: str | None = None):
        self.message = message
        self.detail = detail or message
        super().__init__(self.message)

class NotFoundError(AdaptiveLearnerError):
    """Resource not found (-> HTTP 404)."""
    pass

class ValidationError(AdaptiveLearnerError):
    """Domain validation failed (-> HTTP 400)."""
    pass

class ConflictError(AdaptiveLearnerError):
    """Resource already exists (-> HTTP 409)."""
    pass

class PayloadTooLargeError(AdaptiveLearnerError):
    """Request payload exceeded the configured limit (-> HTTP 413)."""
    pass

class ExternalServiceError(AdaptiveLearnerError):
    """External service (AI provider, Edge-TTS, ...) unreachable (-> HTTP 502)."""
    def __init__(self, service: str, message: str):
        self.service = service
        super().__init__(f"{service}: {message}")
```

The actual hierarchy lives in `backend/app/exceptions.py`. Add a new subclass when a new domain error needs to map to a distinct HTTP status; do NOT overload an existing one.

### Backend: global exception handler

```python
# backend/app/main.py - register once
ERROR_STATUS_MAP = {
    NotFoundError: 404,
    ValidationError: 400,
    ConflictError: 409,
    PayloadTooLargeError: 413,
    ExternalServiceError: 502,
}

@app.exception_handler(AdaptiveLearnerError)
async def adaptive_learner_error_handler(request, exc: AdaptiveLearnerError):
    status = ERROR_STATUS_MAP.get(type(exc), 500)
    logger.error(exc.message, exc_info=exc if status >= 500 else None)
    content = {"detail": exc.detail}
    if settings.debug and status >= 500:
        import traceback
        content["traceback"] = traceback.format_exception(exc)
    return JSONResponse(status_code=status, content=content)
```

### Backend: who throws what

**Services throw domain exceptions, NEVER HTTPException:**

```python
# RIGHT
def get_learning_project(project_id: str, db: Session) -> LearningProject:
    project = db.get(LearningProject, project_id)
    if project is None:
        raise NotFoundError(f"LearningProject {project_id} not found")
    return project

def end_session(session_id: str, db: Session) -> LearningSession:
    session = db.get(LearningSession, session_id)
    if session is None:
        raise NotFoundError(f"LearningSession {session_id} not found")
    if session.status == "completed":
        raise ConflictError(f"LearningSession {session_id} already ended")
    session.status = "completed"
    session.ended_at = datetime.now(UTC)
    db.commit()
    return session

# WRONG: HTTPException in a service
def get_learning_project(project_id: str, db: Session) -> LearningProject:
    ...
    raise HTTPException(status_code=404, ...)  # NOT in services
```

**Routers are thin, the exception handler takes over:**

```python
# RIGHT
@router.get("/{project_id}")
def get_project_endpoint(project_id: str, db: Session = Depends(get_db)):
    return project_service.get_learning_project(project_id, db)
    # NotFoundError -> exception handler -> 404 automatically
```

**Plugins throw the same domain exceptions as core services:**

```python
class SessionPlugin(BasePlugin):
    def create_session_prompt(self, profile: dict, step: int) -> str:
        if step < 1 or step > 7:
            raise ValidationError(f"Invalid session step: {step}")
        return _build_prompt(profile, step)
```

**External tools are wrapped:**

```python
async def call_ai_provider(prompt: str, model: str) -> str:
    try:
        response = await anthropic_client.messages.create(
            model=model, max_tokens=4096, messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    except anthropic.APIConnectionError as e:
        raise ExternalServiceError("anthropic", str(e))
    except anthropic.APIStatusError as e:
        raise ExternalServiceError("anthropic", f"HTTP {e.status_code}: {e.message}")
```

### Backend: rules

- Services throw `AdaptiveLearnerError` subclasses, NEVER `HTTPException`.
- Routers catch NOTHING. The global exception handler takes over.
- No bare `except Exception`. Catch specific exceptions.
- Always wrap external errors (AI providers, Edge-TTS, ...) into `ExternalServiceError` with the service name.
- Plugin errors surface as domain exceptions (`NotFoundError` / `ValidationError` / `ExternalServiceError`) — same shapes the core uses.
- HTTP 422 comes from Pydantic automatically.
- Logging: 4xx as WARNING, 5xx as ERROR with traceback.

### Frontend: ApiError class

```typescript
// api/errors.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public traceback?: string[],  // Only delivered by the backend in debug mode
  ) {
    super(detail)
    this.name = 'ApiError'
  }

  get isNotFound(): boolean { return this.status === 404 }
  get isValidation(): boolean { return this.status === 400 || this.status === 422 }
  get isServerError(): boolean { return this.status >= 500 }

  /** Builds a GitHub Issue URL with all error details. */
  toGitHubIssueUrl(repo: string, appVersion: string): string {
    const title = encodeURIComponent(`[Bug] ${this.detail}`)
    const body = encodeURIComponent([
      `**Error:** ${this.detail}`,
      `**Status:** ${this.status}`,
      `**Version:** ${appVersion}`,
      `**Browser:** ${navigator.userAgent}`,
      this.traceback ? `\n**Stacktrace:**\n\`\`\`\n${this.traceback.join('')}\`\`\`` : '',
    ].filter(Boolean).join('\n'))
    return `https://github.com/${repo}/issues/new?title=${title}&body=${body}`
  }
}
```

### Frontend: central API client

```typescript
// api/client.ts
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new ApiError(response.status, body.detail, body.traceback)
  }
  return response.json()
}
```

### Frontend: errors in components

```typescript
// RIGHT: specific + i18n + loading + issue button on 5xx
async function handleEndSession(sessionId: string) {
  setLoading(true)
  try {
    await getStorage().tracking.end(sessionId)
    toast.success(t('session.end_success'))
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isNotFound) {
        toast.error(t('ui.errors.session_not_found'))
      } else if (error.isServerError) {
        // Toast with a "Report issue" link for GitHub
        const issueUrl = error.toGitHubIssueUrl('astrapi69/adaptive-learner', APP_VERSION)
        toast.error(`${error.detail} | ${t('ui.report_issue')}: ${issueUrl}`)
      } else {
        toast.error(error.detail)
      }
    } else {
      toast.error(t('ui.errors.unexpected'))
    }
  } finally {
    setLoading(false)
  }
}

// WRONG: ignore the error
await getStorage().tracking.end(sessionId)  // no catch

// WRONG: generic, no context
catch (error) {
  toast.error('Something went wrong')  // not helpful, not i18n
}
```

### Frontend: rules

- ALWAYS show API errors to the user (toast), never swallow them.
- No `console.log` for user feedback. Only toasts (react-toastify).
- Set loading states during API calls (no "dead" UI).
- `ApiError` class for all API errors, not generic `Error`.
- Error messages via i18n, no hardcoded strings.
- `finally` block for the loading-state reset.
- Toast on server errors (5xx) with a "Report issue" button that opens a GitHub Issue.
- The GitHub Issue contains: error detail as title, stacktrace (from the debug response), browser info, app version.
- Generic error messages ("Session failed", "Import failed") are forbidden, they make issues worthless.
- Production users see friendly `ui.errors.*` strings, not raw HTTP detail or stack traces. Developer Mode in Settings (off by default) flips this on for debugging.

## API conventions

Uniform REST design so humans and AI immediately understand how endpoints behave.

### URL schema

```
GET    /api/projects                    # list
GET    /api/projects/{id}               # single
POST   /api/projects                    # create
PUT    /api/projects/{id}               # full update
PATCH  /api/projects/{id}               # partial update
DELETE /api/projects/{id}               # delete
GET    /api/projects/{id}/sessions      # subresource list
POST   /api/projects/{id}/sessions      # subresource create
```

### Response format

```typescript
// Success (single)
{ "id": "abc", "topic": "Spanish", "goal": "Conversational fluency in 3 months" }

// Success (list)
[{ "id": "abc", "topic": "Spanish" }, ...]

// Error (automatically from FastAPI/Pydantic)
{ "detail": "LearningProject abc not found" }

// Validation error (automatically from Pydantic)
{ "detail": [{ "loc": ["body", "topic"], "msg": "field required", "type": "value_error.missing" }] }
```

### Rules:

- No envelope (no `{ "data": ..., "status": "ok" }`). The HTTP status is enough.
- IDs are UUIDs as strings.
- Timestamps as ISO 8601 (UTC).
- Lists are NOT paginated. Pagination only when needed.
- Plugin endpoints under `/api/plugins/{plugin-name}/...` (e.g. `/api/plugins/learning-repo/render/{project_id}`).

## Logging

### Backend

```python
import logging
logger = logging.getLogger(__name__)

# RIGHT: structured, with context
logger.info("Session ended", extra={"session_id": session.id, "method": session.method})
logger.warning("Plugin load failed", extra={"plugin": name, "error": str(e)})
logger.error("AI provider call failed", extra={"provider": "anthropic", "model": model}, exc_info=True)

# WRONG:
print("session done")              # no print
logger.info(f"Ended {session}")   # no objects inside messages, use extra
```

Log levels:

- **DEBUG**: detailed developer info (only with `ADAPTIVE_LEARNER_DEBUG=true`).
- **INFO**: important actions (session started, plugin loaded, backup created).
- **WARNING**: unexpected behavior that is not critical (plugin not found, fallback used).
- **ERROR**: errors that affect the user (AI provider unreachable, DB error).

### Frontend

- No `console.log` in production code.
- `console.warn` and `console.error` only for real developer warnings.
- User feedback exclusively via toast notifications (react-toastify).

## Documentation: docstrings over inline comments

**DOC-DOCSTRINGS-NOT-INLINE** (applies to all agents and all repos): prefer self-explanatory code (speaking variable + function names) and put explanation in a docstring / doc-block, NOT in an inline comment.

**Forbidden:**

- Inline `#` / `//` comments that explain WHAT the code does (`# increment counter`, `// set the value`).
- Inline comments that belong in the commit message (`# this fixes the bug`).
- Authorship / tooling markers (`# added by CC`, `# AI-generated`) — already banned in coding-standards.md.
- Commented-out code. Delete it; git keeps the history.

**Still allowed:**

- `TODO:` / `FIXME:` WITH an issue reference (`# TODO(#53): extract to shared util`).
- A short inline note for a genuinely non-obvious WHY that has no natural docstring home — a regex, a tricky algorithm step, a workaround for an external quirk. Reach for this last, not first.
- License headers.

**Required:**

- Google-style docstrings for every public Python function, class, and method (see the format below).
- TSDoc (`/** ... */`) for every exported TS function, hook, and component.

```python
def restore_backup(backup_data: dict, user_id: str) -> RestoreResult:
    """Restore a user's data from a backup archive.

    Matches seeded catalog rows by natural key to avoid UNIQUE
    constraint violations on re-seeded databases.

    Args:
        backup_data: Parsed backup archive contents.
        user_id: Target user for the restore operation.

    Returns:
        RestoreResult with counts of added, updated, skipped rows.

    Raises:
        IntegrityError: If a natural key conflict cannot be resolved.
    """
```

```typescript
/**
 * Renders the backup section in Settings > Data.
 * Hidden in Dexie mode (no backend available).
 *
 * @param userId - Active user ID for backup operations.
 */
export function BackupSection({userId}: BackupSectionProps) {
```

### Docstring format (Python)

```python
def award_xp_for_session(
    db: Session,
    *,
    session: dict[str, Any],
    rating: dict[str, Any] | None = None,
) -> XPAward | None:
    """Persist XP for a completed session and return the award.

    Composes the session-XP rule
    (:func:`calculate_session_xp`) with the DB-derived inputs
    (streak days, first-method bonus eligibility), upserts the
    UserXP row, and returns the breakdown so the frontend can
    render the floating-toast animation.

    Args:
        db: SQLAlchemy session.
        session: ``LearningSession.to_dict()`` payload (id +
            project_id + method + cycle_step + cycle_count).
        rating: kept for hook parity; not consumed by the
            calculator today.

    Returns:
        ``XPAward`` instance, or ``None`` when the session
        payload is incomplete (missing ``project_id`` or
        ``method``).

    Raises:
        NotFoundError: when the project FK doesn't resolve.
    """
```

## Summary: what happens automatically on every commit

```
git commit
  -> pre-commit hooks run:
     1. ruff check (Python lint)
     2. ruff format --check (Python format)
     3. eslint (TypeScript lint)
     4. prettier --check (TypeScript format)
     5. pytest -x -q (backend smoke test)
  -> all green? commit goes through.
  -> anything red? commit rejected, errors shown.
```

No code reaches the repo that isn't formatted, linted, and tested.
