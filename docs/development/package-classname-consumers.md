# Package-consumed classNames

An inventory of npm packages under `node_modules/@astrapi69/` whose
React components render **app-styled classNames** - a "headless-styled"
pattern: the package emits semantic classNames (`api-key-row`,
`pwa-update-prompt-hint`, ...), and THIS project's own CSS supplies the
rule. The package ships no CSS of its own for these classes.

## Why this list exists

`scripts/check-dead-classnames.py` (#1491) proves whether a `className`
used in `frontend/src` has a CSS rule or Tailwind utility behind it. It
scans `frontend/src` only. A CSS-removal audit (#2452/#2476) grepped
`frontend/src` for a selector's consumers, found none, and declared it
orphaned - but the real (only) consumer was inside
`@astrapi69/ai-key-vault-react`'s dist. The rule was removed; Settings >
AI shipped unstyled (#2477, restored #2485). Root-cause + tooling limit
documented in `check-dead-classnames.py`'s own module docstring
(#2486/#2487).

The fix: `PACKAGE_CONSUMER_FILES` in that script now also scans these
packages' dist. This file is the human-readable half - the list a future
audit reads before trusting a "0 consumers" verdict, and the place a new
package gets added when it joins the pattern.

## Confirmed emitters (in `PACKAGE_CONSUMER_FILES`)

| Package | Evidence | Example classNames |
|---|---|---|
| `@astrapi69/ai-key-vault-react` | `grep -o 'className:[^,}]*' dist/index.js` - dozens of hits, e.g. `api-key-row`, `api-key-required-compact`, `akv-secret-toggle` | Settings > AI provider-key UI |
| `@astrapi69/pwa-update-react` | Same grep - `pwa-update-prompt-hint`, `pwa-update-prompt-apply`, `pwa-update-prompt-dismiss` | The PWA update-available banner |

## Checked, ruled out (verified 2026-08-13, not a silent gap)

| Package | Evidence |
|---|---|
| `@astrapi69/feature-strategy-react` | `grep -c className dist/index.js` → 0. Logic-only (hooks/utilities), no JSX rendering at all. |

## Two halves: the classNames AND the utilities (#2587)

A listed package needs **two** registrations, and they answer different
questions:

| Registration | Where | Question it answers |
|---|---|---|
| `PACKAGE_CONSUMER_FILES` | `scripts/check-dead-classnames.py` | Do the package's *semantic* classNames (`api-key-row`, ...) have a CSS rule in this project? |
| `@source "..."` | `frontend/src/styles/tailwind.css` | Do the package's *plain Tailwind utilities* (`min-h-4`, `rounded-app`, ...) actually get generated? |

The second half was missing until #2587. Tailwind v4's automatic content
detection honours `.gitignore` and therefore **never** descends into
`node_modules`, so a utility used only by a package was silently not
emitted. This stayed invisible for the worst possible reason: every other
package utility happened to be used somewhere under `frontend/src` too, so
it was emitted for an unrelated reason. The packages were styled by
*coincidence*, not by construction - and `min-h-4` (used by no file under
`frontend/src`) was the one place the coincidence ran out. Same shape as
the byte-gate lesson in `.claude/rules/lessons/ci-gates.md` (#2265): a
check that is green because two independent things happen to agree.

The lockstep is pinned by `frontend/src/styles/package-source-scan.test.ts`,
which reads the package list out of the Python gate rather than restating
it, and fails closed if that list cannot be parsed.

## When a new `@astrapi69/*-react` package is added

Before assuming it needs no entry here: `grep -o 'className:[^,}]*' node_modules/@astrapi69/<pkg>/dist/index.js \| head`. Any hit beyond generic Tailwind-only strings (no project-specific semantic name) means it belongs in `PACKAGE_CONSUMER_FILES`. Zero hits (like `feature-strategy-react`) means it doesn't - note it here anyway so the check isn't silently re-done later.

A package that goes into `PACKAGE_CONSUMER_FILES` also gets an `@source`
line in `tailwind.css` - the test above fails otherwise. Note that the
`@source` half applies even to a package that renders *only* generic
Tailwind utilities and no semantic classNames at all: it has no dead-class
risk, but its utilities still need generating.

## Host-supplied rules for kit elements

Where this project supplies a rule for a kit-rendered element, it lives in
`frontend/src/styles/legacy/01-base.css` next to its siblings:

| Class | Rule | Why the kit doesn't ship it |
|---|---|---|
| `akv-file-input` (#2556) | file-selector-button appearance | Kit stays app-agnostic; see the package README. |
| `akv-secret-toggle` (#2587) | hover background on the reveal toggle | Kit ships geometry only. The reference treatment is this project's own `shared/forms/SecretInput.tsx`; it uses a text colour there because it renders lucide icons, while the kit renders colour-emoji (👁/🙈), which ignore `color` - hence a background here. |

Not every semantic classname a kit emits is a gap. `pwa-update-prompt-apply`
/ `-dismiss` / `-hint` carry their full treatment in the *same* className
(`bg-accent hover:bg-accent-hover`, `hover:bg-bg-elevated`, ...); the
semantic token is an optional override anchor for the host, not a missing
rule. Before "fixing" one, read the whole className in the dist and ask
whether the element is actually unstyled.

## Using the tool for a dead-CSS-removal audit

```bash
python3 scripts/check-dead-classnames.py --consumers <selector-name>
```

Reports every file (src OR a listed package's dist) that references the
name. `0 Konsumenten` is real evidence for removal; a plain
`frontend/src` grep is not - see the incident above.
