---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Reusability rules - props-driven components, barrel exports, generic naming, token-backed utilities, implementation hierarchy
globs:
  - frontend/src/**/*.ts
  - frontend/src/**/*.tsx
  - backend/app/**/*.py
  - plugins/**/*.py
alwaysApply: false
---

# Reusability Rules

Full policy: `docs/policies/REUSABILITY-POLICY.md`

## Core Rules

- **Props-driven:** all data/callbacks via Props or Seams
- **No side effects on import**
- **Barrel Exports** (`index.ts` / `__init__.py`) for module boundaries
- **Generic naming** (`MatchingTile`, not `LessonMatchingTile`)
- **Token-backed Tailwind utilities**, no fixed-palette classes, no hardcodes
- **Reusable parts in `frontend/src/shared/`** (app-independent)
- **TSDoc/Docstring with usage example** mandatory
- **App-specific state only via Props**, never import directly

## Implementation Hierarchy (Language → Framework → Library → Self)

Before every new utility, go through the hierarchy top-down, stop at the first matching level:

### 1. Language/Runtime first (native APIs, no bundle cost)

**JS/TS:** `Intl`, `crypto.subtle`, `URL`, `fetch`, `structuredClone`, `Array` / `Set` / `Map`, `IntersectionObserver`

**Python:** `pathlib`, `dataclasses`, `json`, `hashlib`, `functools`, `unicodedata`

### 2. Framework (what's already there)

**React:** Hooks/Context, Vite `define`/`import.meta.env`

**FastAPI:** `Depends`/`BackgroundTasks`

### 3. Library (npm/PyPI, only if 1+2 don't suffice)

- Existing dependency before new one
- New must have > 1000 weekly downloads
- Last release < 6 months
- < 100 kB for < 50 LOC
- No CVEs

### 4. Write yourself (only if 1-3 don't fit)

- Library-grade (no app imports, own types, TSDoc, usable standalone)
- Cohesion < 500 lines / one concern
- Complexity cc < 20
- Own tests
- PR documents WHY self-built (which level, which reason)

## References

- Full policy: `docs/policies/VIBE-CODING-POLICY.md` §7
- Worked reference: `docs/audits/2026-06-17-library-first-audit.md`
