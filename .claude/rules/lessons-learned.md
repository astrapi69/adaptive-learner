---
description: Index of the pitfall catalogue - points at the themed lessons/ files; the cross-cutting classes live in lessons/core.md
globs:
  - "**/*"
alwaysApply: true
---

# Known Pitfalls and Patterns

These rules come from real development and solve problems that would otherwise
come back over and over. The catalogue is split by theme (#2073) so a lesson is
easy to find, owns a small file, and a rule edit produces a readable diff.

**How these files load (verified 2026-07-28, do not assume otherwise):** Claude
Code injects EVERY `.claude/rules/**/*.md` into the session regardless of the
`alwaysApply` / `globs` frontmatter - the frontmatter is stripped and ignored
(it is a Cursor convention). The Scope column below therefore documents
INTENT and ownership, not enforcement: today every file is loaded in every
session. Splitting the catalogue does not reduce context; only removing or
relocating content does.

| File | Scope | Classes |
|---|---|---|
| [lessons/core.md](lessons/core.md) | always | Data-loss prevention (never bind the real `SessionLocal`), wired-vs-working, test through the real interface, real-data audit before implementing, atomic-commit bound, stale-vs-flaky, fresh-deploy confirmation, code structure |
| [lessons/backend.md](lessons/backend.md) | backend + plugins | Alembic (`fileConfig`, migrations), FastAPI lifespan async, filesystem isolation, plugin config location, module-level cache leaks, PluginForge filter-vs-error, per-plugin install paths |
| [lessons/frontend.md](lessons/frontend.md) | frontend | TipTap (`imageFigure`, storage reads), React effect + i18n-mock traps, CSS specificity, testid prefixes, Vitest/happy-dom, TypeScript/Vite toolchain, prettier hook |
| [lessons/content-storage.md](lessons/content-storage.md) | storage + content | Dexie-mode contract, dual-mode proof, ghost-content recurrence class, source-language inheritance |
| [lessons/ci-gates.md](lessons/ci-gates.md) | CI, Makefile, scripts | PR-CI vs nightly surfaces, local-vs-CI drift, i18n breaking a nightly gate, engine re-pin schema drift, GitHub Action majors |
| [lessons/release-packaging.md](lessons/release-packaging.md) | launcher, installers, pins | Version-pin single source, frozen-artifact proof, poetry `lock` vs `update`, transitive surfacing, hotfix tags, fail-open diagnostics |
| [lessons/docs-i18n.md](lessons/docs-i18n.md) | docs + i18n | Docs are specification, discoverability, versionless help, values from code, real umlauts, time claims |

Adding a lesson: put it in the themed file whose glob matches the code the
pitfall lives in. Only put it in `core.md` when it applies regardless of which
file is being touched. Keep the "Pairs with" cross-links - they are the
recurrence net.
