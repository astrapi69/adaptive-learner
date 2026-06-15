# Vibe Coding Policy

> AI-assisted development accelerates delivery but risks technical debt and
> architectural decay when human oversight lapses. The AI operates as a
> high-speed junior developer without systemic understanding of the project.
> The human's role shifts from writing code to architecting and reviewing it.

This document codifies the rules that govern all AI agent work (CC, CCW, CCWa,
CCWc) on Adaptive Learner. Every principle listed here is either enforced by
CI or enforced by human review. Aspirational items are explicitly marked.

## 1. Prompt Precision and Context Steering

AI models have limited context windows and hallucinate on vague instructions.

**Rules:**

- Never issue commands like "optimize this file." Specify: which file, which
  function, which input/output behaviour, which pattern to follow.
- Always reference existing project patterns by name. Examples:
  `guardedFetch`, `IStorageService`, `useControlledExercise`, the
  Repository Pattern, the PluginForge hook contract.
- When a prompt references architecture, point the agent at the relevant
  `.claude/rules/` file or `docs/` document rather than restating it.

**Enforcement:**

- Human review (Sparring Partner writes or reviews all CC/CCW prompts).
- `.claude/rules/` files provide agent-readable architectural context.

**Open gap:** No automated check forces agents to reference existing patterns
instead of inventing new ones. This remains a human review responsibility.

## 2. Architectural Discipline

AI solves local problems with global workarounds. Every generated code block
must be verified against the layer architecture.

**Rules:**

- No business logic in React components. Components render UI from props.
- No direct database queries in backend routers. Routers delegate to services.
- No direct `fetch` calls. Use `guardedFetch` and the `IStorageService` seam.
- No cross-layer imports. The dependency direction is:
  Router -> Service -> Repository -> Models.
- Every new module must follow the PluginForge hook-based extension pattern.

**Enforcement:**

- `.claude/rules/architecture.md` — agents read this before every task.
- Cohesion Audit (`docs/COHESION-AUDIT.md`) — periodic measurement.
- Cohesion Watcher (`scripts/check-file-sizes.sh`, #371) — CI gate, WARN >500
  lines, ERROR >1000 lines (blocks merge).
- Ratchet Baseline (`.filesize-baseline`) — now **EMPTY**: the god-file
  decomposition campaign (#372) is complete, so the >1000-line hard gate
  stands with no exceptions.
- Complexity Watcher (#400) — radon (Python) + eslint (TS); the Phase 2 radon
  hard gate (#494/#495) **blocks cc > 20, warns > 15**. `.complexity-baseline`
  is also **EMPTY** (burn-down complete).
- Security-scan watcher (#378) — pip-audit + npm audit + bandit (warn-only).
- plugin-tests CI job (#471) — runs the full plugin suite per PR.
- `madge` — zero circular dependency guarantee (verified per PR in #354).

**Open gap:** No automated CI check for layer boundary violations (e.g. a
component importing from `repositories/`). Currently caught by human review
and the `madge` cycle check.

## 3. Verification Through Tests

Generated code is not correct by default. Every change must pass the full
test suite before merge.

**Rules:**

- Every PR must pass: `tsc --noEmit` (strict), `ESLint --max-warnings 0`,
  `ruff check + format`, `mypy`, the full pytest suite (1215 backend + 1018
  plugin tests), the full Vitest suite (4139 tests), and the Dexie Smoke Gate
  (73 specs). (Test counts verified 2026-06-15; see `docs/audits/` for the
  canonical coverage figures.)
- Behaviour-changing code requires accompanying tests. Code without test
  coverage is not merged.
- Backup-touching changes require a manual round-trip test (export -> import
  -> verify) in addition to unit tests. Unit tests are necessary but not
  sufficient (BACKUP-AKZEPTANZTEST rule).

**Enforcement:**

- CI gates: `ci.yml`, `dexie-smoke.yml`, `release-gate.yml`.
- Pre-commit hooks: ruff, ESLint, formatting.
- Human verification for backup round-trips.

## 4. Security and Dependency Hygiene

AI sometimes suggests outdated, insecure, or nonexistent libraries.

**Rules:**

- Every new dependency must be manually verified for maintenance status,
  license compatibility, and known vulnerabilities before adding.
- No secrets, API keys, or hardcoded credentials in generated code.
- No `pip install` without `--break-system-packages` awareness in CI.
- Prefer existing project dependencies over new ones.

**Enforcement:**

- `security-scan.yml` — CI workflow (warn-only, Phase 1):
  - `pip-audit` for Python dependencies.
  - `npm audit` for frontend dependencies.
  - `bandit` for static Python security analysis.
- Weekly scheduled scan catches new CVEs without code changes.
- Pre-commit hooks catch formatting/linting issues.

## 5. Regular Refactoring

Fast iteration leads to code duplication, bloated functions, and inconsistent
naming. Refactoring is not optional, it is scheduled.

**Rules:**

- Plan fixed intervals for cleanup. Do not let AI-generated code calcify
  in the main branch without review.
- Touch old code when you change it anyway, not prophylactically. No sweeps
  across historical code without clear scope.
- God-files with mixed concerns are split, not whitelisted.
- Whitelisting requires justification: only files with a single concern
  (data models, schemas, static data) qualify.

**Enforcement:**

- God-File Initiative (#353 backend, #354 frontend) — completed.
- Cohesion Watcher (#371) — prevents new god-files from forming.
- Ratchet Baseline (#372) — **complete**: all baselined god-files split,
  `.filesize-baseline` empty, the >1000-line hard gate stands with no
  exceptions. The complexity burn-down (#498–#504) is likewise complete,
  `.complexity-baseline` empty.
- Kohäsions-Audit — periodic measurement, score re-rated 7/10 → 9/10 (2026-06-15).

## 6. Git Hygiene and Code Review

Do not blindly commit AI-generated blocks.

**Rules:**

- Review `git diff` line by line before committing.
- Every bug and issue must have a GitHub Issue BEFORE the fix begins
  (GITHUB-ISSUE-PFLICHT). Search existing issues first.
- Every commit message references its issue (`Closes #XX`).
- No inline comments in code. Use docstrings (Google Style for Python,
  TSDoc for TypeScript). Exception: `TODO`/`FIXME` with issue reference.
- One concern per PR. Small PRs, feature branches from `develop`.

**Enforcement:**

- Pre-commit hooks (ruff-format, ESLint, trailing whitespace).
- `.claude/rules/` — GITHUB-ISSUE-PFLICHT rule.
- Docstring rule (#61).
- Human review (Sparring Partner reviews all agent output).

## Priority Hierarchy

When multiple tasks compete, this ordering applies:

1. **Merge open PRs** — no new code on a dirty base.
2. **P0/P1 Bugs** — blockers first.
3. **Infrastructure** — security, CI, architecture guards.
4. **UI Fixes** — user-visible improvements.
5. **Cleanup/Refactoring** — tech debt reduction.
6. **Features** — new functionality.
7. **Release** — tag when everything above is done.

Cross-cutting principle: **Foundation before features.** Audit before guard.
Measure before enforce. Design document before implementation. No feature on
shaky ground.

### Release Freeze

Once a release branch (`release/X.Y.Z`) is cut, the following holds until the
release is tagged AND published:

- No new PRs opened against `develop`.
- No merges into `develop`.
- No new code — only the release workflow (`release-test`, `release-finish`,
  `release-publish`, journal).
- Exception: a P0 hotfix that blocks the release itself.

Tag first, then resume. This prevents a moving base (and parallel-session
worktree races) from corrupting an in-flight release.

## Agent Roles

| Agent | Scope | Lane |
|-------|-------|------|
| CC (lCC) | Backend, infrastructure, CI, releases | Python, bash, workflows |
| CCW | Frontend components, hooks, storage | TypeScript, React, Dexie |
| CCWa | Cross-cutting features, architecture | Full-stack, EXP documents |
| CCWc | Content repository | Content validation, manifests |
| Sparring Partner | Architecture, review, coordination | Prompts, decisions, strategy |

Agents do not cross lanes without explicit instruction. The Sparring Partner
coordinates handoffs and resolves conflicts with reality.

## Enforcement Summary

| Principle | Automated | Human |
|-----------|-----------|-------|
| Prompt precision | `.claude/rules/` | Sparring Partner writes/reviews prompts |
| Layer architecture | `madge` (cycles), cohesion watcher (size) | Code review for boundary violations |
| Test coverage | CI gates (pytest, vitest, dexie-smoke) | Backup round-trip test |
| Security/deps | `security-scan.yml` (pip-audit, npm audit, bandit) | Manual dependency review |
| Refactoring | Cohesion watcher, ratchet baseline | Refactoring intervals, scope decisions |
| Git hygiene | Pre-commit hooks, linting | Diff review, issue discipline |
