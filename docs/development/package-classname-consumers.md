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

## When a new `@astrapi69/*-react` package is added

Before assuming it needs no entry here: `grep -o 'className:[^,}]*' node_modules/@astrapi69/<pkg>/dist/index.js \| head`. Any hit beyond generic Tailwind-only strings (no project-specific semantic name) means it belongs in `PACKAGE_CONSUMER_FILES`. Zero hits (like `feature-strategy-react`) means it doesn't - note it here anyway so the check isn't silently re-done later.

## Using the tool for a dead-CSS-removal audit

```bash
python3 scripts/check-dead-classnames.py --consumers <selector-name>
```

Reports every file (src OR a listed package's dist) that references the
name. `0 Konsumenten` is real evidence for removal; a plain
`frontend/src` grep is not - see the incident above.
