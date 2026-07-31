# Ratchet auto-lower audit (2026-07-31, #2230)

## Why

A ratchet freezes a measurement and forbids it from getting worse. When the
measurement gets BETTER (a fall), the ceiling must follow - otherwise the
gained space is headroom that a later change can spend again for free. That is
exactly what happened to the docs-hygiene umlaut ratchet: a foreign cleanup
lowered the count on develop, the baseline was not banked, and the next PRs sat
on the headroom.

But "auto-lower every fall" is too broad. Whether a fall may be banked
automatically is a three-way call on **what the number is** (now recorded in
`quality-checks.md` "Gate test contract", point 5):

| Class | Growth ever legitimate? | On a fall | On a rise |
|---|---|---|---|
| **Error-counter** (should be zero) | No | **auto-lower** (bank it) | fail (regression) |
| **Budget** (some growth is real) | Yes | keep as headroom; lower by a deliberate act | raise by a deliberate, justified act |
| **Drifting-oracle** (foreign tool) | n/a | **never** auto-lower (a fall may be drift) | fail |

## The checked set (every ratchet in the repo)

| Ratchet | Baseline | Oracle | Class | Auto-lower? |
|---|---|---|---|---|
| docs-hygiene umlaut | `docs/.docs-hygiene-baseline.json` | substring count (stdlib) | **error-counter** | **BUILT** (this PR: `--auto-lower`, wired into the pre-commit hook) |
| rule-corpus size | `.claude/rules/.corpus-baseline.json` | char count (stdlib) | **budget** | No, by design (#2140): a fall is banked headroom for the next legitimate rule; raise/lower stay deliberate |
| css-size | `.css-size-baseline` | `wc -l` of global.css + legacy/*.css (source) | budget | No (deliberate: legitimate token/foundation growth is real; hand-raised with a comment) |
| file-sizes | `.filesize-baseline` | `wc -l` (source) | budget | No (god-file split budget; growth via a split is legitimate) |
| directory-size | `.dirsize-baseline` | file counts | budget | No (god-folder budget) |
| theme | `.theme-baseline.json` | WCAG/token matrix (stdlib) | error-counter-ish | Already shrink-only on `--update-baseline`; refuses to grow without `--allow-baseline-growth`. Deferred: no auto-lower, but growth is already gated. |
| complexity gate | `.complexity-baseline` | **radon + eslint** | **drifting-oracle** | **NEVER** (#2083: radon can drift; a fall may be a version change, not a real simplification) |
| image-size | `verify_image_size.py` baseline | **docker image inspect .Size** | **drifting-oracle** | **NEVER** (#2083/#2132: containerd vs graphdriver report 113 MB vs 491 MB for the same image) |
| dead-classnames / no-hardcoded-colors | built Tailwind CSS | **built Tailwind** | **drifting-oracle** | **NEVER** (#2083: the built CSS drifts with the toolchain) |

## What this PR builds

- **docs-hygiene** (error-counter) gets `--auto-lower`: a fall writes the lower
  baseline and passes; a rise still fails; the read-only check still FAILS on an
  unbanked fall (the CI catch for a stale baseline). The pre-commit hook runs
  `--auto-lower`, so the gain rides the same commit like a `ruff-format` fix -
  no manual `--update-baseline`.
- The three-way distinction is recorded as one sentence in the Gate test
  contract, superseding a too-general "ratchets follow improvements down".

## What this PR deliberately does NOT build

- **The corpus and the other budgets** keep banking headroom. Auto-lowering a
  budget would make the next legitimate addition pay for someone else's
  deletion (#2140) - the opposite of what a budget is for.
- **Drifting-oracle gates** (complexity/radon, image-size/docker, built-Tailwind
  classname gates) never auto-lower: a fall there can be tool drift, and
  auto-banking would freeze the drift as a permanent "improvement" (#2083).
