# Dead-CSS audit v2 (#1485), 2026-08-13 - three named blind spots, no tranche

Exploratory pass after the #2486 tranche-stop lifted (package-aware
gate shipped, #2588). Goal: find a safe removal candidate list for the
next dead-CSS tranche. Result: **no tranche filed.** The pass earned
its keep anyway - it converts the #2486 architect note ("a name-
occurrence check is not proof") from one proven incident into three
named, reproducible failure classes.

## Method

Cross-referenced every simple single-class CSS selector in
`frontend/src/styles/legacy/*.css` + `global.css` (604 found) against
the package-aware `used` set from `check-dead-classnames.py`'s
`compute_dead()` (1442 entries, now including
`ai-key-vault-react`/`pwa-update-react` dist per #2588). 53 selectors
had zero match.

The 8 selectors with the STRONGEST signal (zero match even as a bare
substring anywhere in `frontend/src/**/*.{ts,tsx}`, not just as a
clean className) were verified individually by hand - reading the
actual consuming code, not trusting the grep. **8 of 8 were false
positives.** Given that failure rate on the strongest subset, the
remaining 45 are presumed similarly contaminated; none were reviewed
individually and none are proposed for removal.

## The three blind spots (named, with the concrete example each)

1. **Third-party library selectors.** `react-flow`,
   `react-flow__controls-button`, `react-flow__minimap-mask` - xyflow
   renders these classes itself; `styles/legacy/42-learning-path.css`
   exists to override them, never to be found as a `className` in our
   own JSX. Structural, not a gate gap: `architecture.md`'s Option A
   already names third-party overrides (ProseMirror, xyflow, QR) as
   deliberately unlayered and exempt. Any future audit must exclude
   this class outright, not attempt to verify it away.

2. **Dynamic template stems, more suffix shapes than the gate's
   `--modifier` check handles.** The existing dynamic-stem skip in
   `check-dead-classnames.py` handles ``foo-${x}`` immediately glued to
   the interpolation. This pass found the SAME live-class problem
   through three different concrete shapes in this codebase:
   - `` `nav-mode-badge-${mode}` `` (`NavIndicators.tsx` - the ORIGINAL
     #2477-adjacent case, already documented in the 2026-08-06 tranche
     comment on #1485).
   - `` `configured-provider-row${row.isActive ? " is-active-provider" : ""}` ``
     (`ai-key-vault-react` dist - a package-side dynamic stem, not
     even in our own src).
   - `` `api-key-source-${source}` `` (same package) - explains BOTH
     `api-key-source-env` and `api-key-source-secrets_yaml` in the
     candidate list; they are runtime-substituted VALUES of `source`,
     not independent dead names.
   - `` `diff-marker-${kind}` `` (`BackupCompare.tsx:432`) - a
     SINGLE-dash suffix, not the `--` BEM modifier shape the gate's
     existing skip logic was written for. `diff-marker-changed` even
     appears as a literal string three lines later in the same file
     (line 477), confirming the class family is very much alive.
   Lesson: "dynamic stem" is not one shape in this codebase. A
   verification pass (or a tooling fix) that only recognizes the `--`
   BEM form will miss the single-dash and fully-computed forms.

3. **Indirect variable reference.** `diff-highlight`
   (`DiffHighlight.tsx:22-24`): the literal string is assigned to a
   local `wrapperClass` variable, and the `className` PROP receives
   the identifier, not the string. Every extraction approach that reads
   only the `className` attribute's own expression - src-only or
   package-aware, static or dynamic-template-capable - is blind to a
   value that is DEFINED one line away and merely referenced at the
   attribute. This is a data-flow problem, not a pattern-matching one;
   no regex-based tool closes it without becoming a small type
   checker.

## Decision: leave it (#2091-style ratchet reasoning applied to a debt item)

The 2026-08-06 tranche (#2476/#2477/#2485) already consumed the
previous audit's confirmed-dead card (-313 lines). This pass found 53
FRESH candidate selectors against the current tree (7699 lines across
`styles/legacy/*.css` + `global.css` today) - none confirmed, 8 of 8
checked were false positives. Whatever fraction of the 53 might be
genuinely dead is unknown; finding out safely needs either full
per-candidate manual verification (the exact process that already
missed one real case in #2477) or new tooling that understands
arbitrary dynamic-stem shapes and simple data-flow (a real, separate
engineering effort, not a quick pass). Dead CSS costs nothing at
runtime regardless of its line count - the cost here is entirely in
the auditor's time and the regression risk, not in what ships.

Given the size of the debt (small), its cost (zero, it's dead code),
and the size of the risk (a repeat of #2477, or worse since the
easiest, highest-confidence-looking candidates are exactly the ones
that turned out wrong) - **not pursued further on this pass.** Left as
a named, understood cleanup item, not reattempted blind.

## What DOES reduce risk here, for whoever picks this up next

- Exclude third-party-library selector prefixes outright before
  auditing (`react-flow`, similarly `ProseMirror`/`.tiptap`, QR-scanner
  vendor classes) - they will never resolve via any src/package scan.
- Grep every candidate for BOTH `${stem}` (whitespace/boundary variant
  the current tool already skips) AND `stem` as a bare word inside a
  template literal with a SINGLE dash before the interpolation
  (`` `foo-${x}` `` vs `` `foo${x}` `` vs `` `foo--${x}` `` are three
  different textual shapes for the same "dynamic modifier" concept).
- For any candidate that resolves to zero in both of the above, still
  grep the WHOLE file it appears in for a local variable holding the
  literal, in case the className prop indirects through an identifier.
- After all of that, this is still a name-occurrence check, not proof
  - the `check-dead-classnames.py` docstring's four blind spots
  (dynamic names, selector-less rules, inherited effects, foreign
  sources) apply regardless. A rendered-application check of the
  affected surfaces stays mandatory before any removal lands, per the
  #2486 architect decision.

## Redirect: Option C (god-classes to shared components)

Per the 2026-07-09 EXP-044 decision, Option C runs in parallel to
dead-CSS tranches: replace large legacy component classes with shared
components, then delete their legacy rules as a NATURAL consequence of
the replacement - the removal is validated by "the component no longer
emits the old className," not by a name-occurrence proof. Lower risk
for the same family of cleanup, because it substitutes verified
behavior instead of deleting rules on an unprovable "0 consumers"
claim. The visual-regression caveat from the 2026-08-07 architect
decision still applies to this track too - every slice needs a
reviewed CI baseline diff, not just a green name-based gate.
