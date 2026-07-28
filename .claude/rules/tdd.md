---
description: Test-Driven Development workflow - Red-Green-Refactor cycle, four-test-per-feature guideline, bug-fix discipline
globs:
  - backend/tests/**/*.py
  - plugins/*/tests/**/*.py
  - frontend/src/**/*.test.ts
  - frontend/src/**/*.test.tsx
alwaysApply: false
---

# Test-Driven Development (TDD)

This is the WORKFLOW rule for writing code. It sits on top of the test STRATEGY in `quality-checks.md` (pyramid, coverage targets, mutation testing) and the test bullets in `coding-standards.md` ("failing test FIRST, then fix"). Where those state what and how much to test, this rule states the order: test first, then the minimal code, then cleanup.

## Mandatory for code changes with logic

Code changes with behavior/logic follow the Red-Green-Refactor cycle.

"With logic" means: a new behavior, a changed code path, a condition, a calculation, a validation, a mapping. Pure mechanics without behavior change fall under the exceptions below.

### Phase 1: RED (test first)

Write a test that describes the desired change.

The test MUST fail (proves the feature/fix does not yet exist).

No production code before the failing test.

### Phase 2: GREEN (minimal implementation)

Write only the code that makes the test green.

YAGNI: no premature optimization, no code "for later" (aligns with `ai-workflow/implementation-workflow.md` "Only what is needed now").

`tsc --noEmit` + vitest (frontend) or pytest (backend) green.

### Phase 3: REFACTOR (cleanup)

Improve code smells, duplication, naming (Boy Scout Rule, `coding-standards.md`).

Tests stay green.

## Test count per feature/fix

The existing requirement in `quality-checks.md` ("New service or new function: at least a happy path + one error case"; "New endpoint: at least one happy-path test") is the MINIMAL floor for trivial cases.

For a real feature or fix, the TARGET is the following breakdown — at least four tests that together secure the behavior:

1. **Reproduction test** — the Red test before the fix/feature.
2. **Happy path** — the expected normal case.
3. **Edge cases** — empty/missing/unexpected inputs.
4. **Boundary values** — the edges of the valid range.

Floor (happy path + error case) and target (4-test breakdown) are NOT contradictory: the floor applies to trivial new functions, the target to features and fixes. More tests are allowed, fewer than the floor are not.

No artificial tests just for counting — every test checks a real behavior property (see "Meaningful coverage is the goal" in `quality-checks.md`).

## Bug fixes

ALWAYS write a test that reproduces the bug first (RED, proves the bug). This is the workflow form of the rule "Bug fixes: failing test FIRST, then fix" from `coding-standards.md` / `quality-checks.md`.

Then fix until GREEN.

The reproduction test stays in the repo as a regression guard.

Corresponds to the root-cause discipline: first make the error reproducible, then fix — no fix without an understood cause.

## Exceptions (established project practice)

TDD is NOT enforced for:

- Pure documentation changes (no code).
- Pure configuration (CI, Makefile, YAML) without logic.
- Mechanical refactors with existing test coverage: file splits, barrel/re-export moves, god-folder resolution, schema/type generation. Here the existing suite MUST stay green (proves nothing broke), but no new behavior tests are enforced. (Handled this way e.g. in the `lib/ai` split and TS type generation.)
- Visual/device-only aspects that are not testable in the container remain manual rest — TDD does not replace the Visual Device Check or the BACKUP-AKZEPTANZTEST from `quality-checks.md`, it complements them.

The exceptions do not exempt from the hard rule "`make test` must stay green after every change".
