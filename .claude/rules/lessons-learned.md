---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Index of the pitfall catalogue - points at the themed lessons/ files; the cross-cutting classes live in lessons/core.md
globs:
  - "**/*"
alwaysApply: true
---

# Known Pitfalls and Patterns

These rules come from real development and solve problems that would otherwise
come back over and over. The catalogue is split by theme (#2073) so a lesson is
easy to find, owns a small file, and a rule edit produces a readable diff.

**How these files load - observed, not guaranteed:** on 2026-07-28 Claude Code
injected EVERY `.claude/rules/**/*.md` into the session regardless of the
`alwaysApply` / `globs` frontmatter, and stripped that frontmatter before
injection. Evidence from that session: `architecture.md` carried
`alwaysApply: false` with backend-only globs and was still loaded in full,
before any file had been touched, so it cannot have been glob-triggered.

Treat this as **tool behaviour observed at a point in time, not a property you
can rely on**. It may change with a Claude Code release, in either direction.
Consequences today:

- the frontmatter fields document INTENT (which files a rule is about) and
  nothing else - every rule file carries that note at the top;
- the Scope column below is likewise intent, never enforcement;
- splitting the catalogue does not reduce context. Only removing or
  relocating content does. Any figure claiming otherwise was computed on the
  assumption that `alwaysApply` gates loading - it does not.

No automated probe exists for this, and one is not worth building: the loading
happens in the client before any repo code runs, so nothing in CI can observe
it. Re-verify by hand when Claude Code changes major version, or whenever a
session's injected context is visibly different, and update this paragraph
with the new date.

| File | Scope | Classes |
|---|---|---|
| [lessons/core.md](lessons/core.md) | always | Data-loss prevention (never bind the real `SessionLocal`), wired-vs-working, test through the real interface, real-data audit before implementing, atomic-commit bound, stale-vs-flaky, fresh-deploy confirmation, code structure |
| [lessons/backend.md](lessons/backend.md) | backend + plugins | Alembic (`fileConfig`, migrations), FastAPI lifespan async, filesystem isolation, plugin config location, module-level cache leaks, PluginForge filter-vs-error, per-plugin install paths |
| [lessons/frontend.md](lessons/frontend.md) | frontend | TipTap (storage format, `.ProseMirror`, storage reads), React effect + i18n-mock traps, CSS specificity, testid prefixes, Vitest/happy-dom, TypeScript/Vite toolchain, prettier hook |
| [lessons/content-storage.md](lessons/content-storage.md) | storage + content | Dexie-mode contract, dual-mode proof, ghost-content recurrence class, source-language inheritance |
| [lessons/ci-gates.md](lessons/ci-gates.md) | CI, Makefile, scripts | PR-CI vs nightly surfaces, local-vs-CI drift, i18n breaking a nightly gate, engine re-pin schema drift, GitHub Action majors |
| [lessons/release-packaging.md](lessons/release-packaging.md) | launcher, installers, pins | Version-pin single source, frozen-artifact proof, poetry `lock` vs `update`, transitive surfacing, hotfix tags, fail-open diagnostics |
| [lessons/docs-i18n.md](lessons/docs-i18n.md) | docs + i18n | Docs are specification, discoverability, versionless help, values from code, real umlauts, time claims |

Adding a lesson: put it in the themed file whose glob matches the code the
pitfall lives in. Only put it in `core.md` when it applies regardless of which
file is being touched. Keep the "Pairs with" cross-links - they are the
recurrence net.
