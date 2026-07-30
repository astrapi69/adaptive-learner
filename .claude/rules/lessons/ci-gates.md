---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: CI + gate pitfalls - PR-vs-nightly surfaces, environment drift, engine re-pin schema drift, GitHub Action majors
globs:
  - .github/**/*
  - Makefile
  - scripts/**/*
alwaysApply: false
---

# CI + gate pitfalls
## CI vs local environment drift

Two patterns cause "passes locally, fails in CI" in Poetry-managed projects:

1. `poetry install` does not remove dependencies that vanished from pyproject.toml. Stale `.dist-info` directories in long-tenured local venvs keep importing modules that the lockfile no longer references. CI starts fresh and immediately fails. Mitigation: run `poetry install --sync` periodically, especially before assuming "local green = CI green".

2. Path-dependency declarations in pyproject.toml must include every plugin or sub-package whose code is exercised by tests. Plugin discovery via `importlib.metadata.entry_points()` only sees what's actually installed, not what exists on disk. When creating a new plugin, the path-dep declaration in backend/pyproject.toml is mandatory, not optional.

Detection: if local tests pass but CI fails on routes returning 404, suspect missing path-deps before suspecting code bugs.

## External GitHub Action major-version drift

Standard GitHub Actions (`actions/checkout`, `actions/setup-*`, `actions/upload-artifact`, `actions/cache`, the pages trio, plus common third-parties like `softprops/action-gh-release`) release new majors periodically — usually triggered by Node runtime deprecations or other GitHub-platform shifts. An audit finding "all standard actions are at their current majors" is correct AT THE TIME but stales within weeks-to-months after a deprecation announcement.

Concrete trigger from the 2026-05-14 sweep: GitHub deprecated the Node 20 runtime on 2025-09-19 (forced default 2026-06-02, removed 2026-09-16). Within 6 months, EVERY standard action listed above released a new major moving to Node 24. The previous CI-hygiene audit's `actions/checkout@v4` etc. was accurate at audit time but the warnings re-appeared in CI within weeks.

The original test-infrastructure audit categorized "all standard actions at current majors" as no action needed — accurate at the moment, no longer accurate weeks later. Re-classify as a periodic check, not a one-time verification.

### Periodic CI-hygiene check (every ~quarter, or after any GitHub runtime/platform deprecation announcement)

1. List every pinned action:

```bash
grep -rE 'uses: [a-zA-Z][a-zA-Z0-9-]+/[a-zA-Z][a-zA-Z0-9-]+@v[0-9]+' \
  .github/workflows/ | sort -u
```

2. For each, check the latest released major against the pin via `gh release list --repo <owner>/<repo> --limit 5`.

3. For each candidate version, read the action.yml runtime declaration directly (not the release-note prose). This is the authoritative source for "does this action actually run on Node N?":

```bash
gh api "repos/<owner>/<repo>/contents/action.yml?ref=<tag>" \
  --jq '.content' | base64 -d | grep '^[[:space:]]*using:'
```

Returns e.g. `using: 'node24'` (or `node20`, or `composite`). This is the field GitHub Actions reads to pick the runtime.

4. Cross-reference the release notes via `gh api repos/<owner>/<repo>/releases/tags/v<N>.0.0 --jq .body` for breaking-change context, but treat the notes as advisory — see "Release-notes-vs-action.yml trap" below.

5. Pin to the lowest new major that satisfies the deprecation target AND declares the target Node version in its action.yml. The latest major often bundles additional unrelated breaking changes — taking the minimum-Node-N major lets you adopt those changes deliberately later, not by accident.

6. One commit per action class for traceable bisect; push as a batch.

### Release-notes-vs-action.yml trap

Release notes describe intent and feature changes. action.yml declares the actual runtime. The two can diverge across a major version when an action adds preliminary Node 24 support without flipping the default. Always trust action.yml for audit purposes.

Concrete examples from the 2026-05-14 sweep that caught this:

- `actions/upload-artifact@v5.0.0` — release notes said "preliminary support for Node.js 24" and the bump from v4 was marked BREAKING CHANGE. Both signals pointed at "v5 is the Node-24 baseline". But `action.yml` at v5 declared `runs.using: 'node20'`. v6 was the actual transition (declared `node24`).
- **`actions/configure-pages@v5.0.0`** — release notes talked about Next.js breaking changes without mentioning the Node runtime at all, leading to inference (from sibling pages actions on Node 24) that v5 was Node-24. But `action.yml` declared `node20`. v6 added Node 24.

The trap is amplified by the `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env-var: if it's already in place, runtime tests look green because the env-var coerces Node 24 regardless of the action.yml declaration. The action.yml read is the only honest signal.

### Composite-action transitivity

Some actions declare `runs.using: composite` (e.g. `actions/upload-pages-artifact@v5`). Composite actions don't run on any Node runtime directly — they wrap calls to other actions. For those, the audit must read the composite's internal `uses:` references and check THOSE actions' runtimes:

```bash
gh api "repos/<owner>/<repo>/contents/action.yml?ref=<tag>" \
  --jq '.content' | base64 -d | grep 'uses:'
```

Example: `actions/upload-pages-artifact@v5` internally calls `actions/upload-artifact@v7`, which declares `node24`. So upload-pages-artifact@v5 is effectively on Node 24 via its internal dependency — no bump needed at our level even though its own action.yml says `composite`.

### Difference between "external action" warnings

Two distinct sources of "external" warnings in CI:

1. **In-repo action pins**: workflow files reference outdated majors. Fixable in `.github/workflows/`. This rule covers them.
2. **GitHub-managed services**: e.g. the Dependabot scheduled service that's configured under Settings → Code security → Dependabot, not in workflow files. Annotations from those jobs are GitHub's responsibility, NOT the repo maintainer's. Don't conflate the two — always grep the codebase to confirm a warning has a local source before assuming a fix is locally implementable.

### Defensive env-var as a safety net

`FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"` in each workflow's `env:` block coerces any JavaScript-runtime action declaring Node 20 to run on Node 24. After all our standard-action pins are at Node-24-native majors, this env-var becomes a safety net for future additions (especially third-party actions that may lag) — not an active correction. Keep it in the workflow heads; it costs nothing and prevents reintroduction of the warning when a future contributor adds an old-major action by habit.

## An i18n string change can break a nightly-only E2E gate invisibly

Surfaced 2026-06-17 during the v1.86.0 release-test. Five EXP-023 dexie-smoke specs failed on `expect(content-repo-result).toContainText(/passed/i)` (and `/failed/i`). The app was correct — validation succeeded and rendered "Validierung erfolgreich: 1 Sets, 1 Lektionen." The cause: PR #662 ("translate repository management UI in all 9 catalogs") ADDED the German `content_repo.validation.passed` / `.failed` strings. The app's default locale is German; before #662 those keys had no German translation and fell back to the ENGLISH "Validation passed/failed…", which the specs matched. Adding the correct German translation removed the fallback, so the assertions broke.

### Why it surfaced only at release

The Dexie-mode E2E gate runs nightly + release-only, NOT on PRs (#552 cadence). So #662's PR was green (it doesn't run dexie-smoke), and the drift sat latent until `make release-test` ran the gate. This is the same class as "wired != working" and the stale-assertion rule, with an i18n-specific trigger.

### Rules

- **E2E text assertions must not hardcode one locale's wording** when the app renders in a different default locale (German here). Match a locale-robust pattern (`/passed|erfolgreich/i`) or assert on a stable, non-translated signal (a testid state, a count, a success CSS token), not the prose.
- **Any i18n PR that adds/changes a translated string that an E2E spec asserts on is a latent break** for the nightly/release gates. When translating a string, grep the E2E specs for the old English wording (`grep -rn "toContainText(/<word>/" e2e/`) and update the assertion in the same PR — even though the PR's own CI won't run the affected gate.
- **A previously-passing assertion that depended on an i18n FALLBACK is fragile by construction.** If a test passes only because a translation is missing, completing the translation breaks it. Prefer locale-agnostic assertions from the start.

## PR-CI vs nightly gates: different test surfaces (green PR -> red nightly/push)

A green PR merge proves only that the surface the PR-CI looks at is green. By the #552 cadence, PR-CI runs correctness gates only; the visual-baselines, the e2e specs (dexie-smoke, manual-automation, FeatureShots) and the Dexie-mode journeys run nightly / on develop-push only. So any change to a surface only a nightly covers can merge a clean PR and turn the next nightly/push run red. This is not a one-off chain - it is a recurring risk category (#1661): "green PR -> red nightly/push, because the PR-CI never looked at the affected surface."

### Sub-classes (same signature, different fix lever)

1. **Nightly-only surface** (#1638, #1656). The PR-CI does not run the workflow at all. A lesson-header rework left every `lesson-*` visual baseline stale (#1638); a panel rework moved testid carriers into a collapsed `hidden` panel without touching the e2e specs (#1656).

2. **Selection mechanics** (#1620, #1665, #1614). The test IS in the PR-CI suite but the selective runner (`vitest --changed` #615, `pytest --testmon`) does not pick it, because it reads its subject via `readFileSync` (invisible to the module graph) instead of importing it. A moved CSS token broke a `readFileSync` hue-pin the PR-CI never ran (#1665); an `index.html` guard kept develop red across five PRs (#1614). Mitigation candidate: Vitest `forceRerunTriggers` for `src/styles/**/*.css` + `index.html` + `data/i18n/*.json`.

3. **Stale base / semantic merge conflict** (#1729). Two PRs, each tsc-green and textually conflict-free, combine on develop to a type error. `strict: false` branch protection let a PR with 32-minute-old CI merge behind a fresh neighbor. Decided + shipped (2026-07-16): Merge Queue is an Org-only feature (422 on this user-owned repo), so the fallback `strict: true` is active on develop - PR merges now require an up-to-date branch, re-running CI on the combined state. `enforce_admins=false` keeps `make release-finish`'s direct back-merge working.

4. **No cadence at all** (#1771). The verified variant: the surface is not even nightly-covered. The bun migration (#1496) dropped `package-lock.json`; `frontend/Dockerfile` still ran `npm ci` and broke the entire self-hosted/desktop path for ~2 release cycles. No automated consumer existed - discovery was manual. Shipped (#1990): `docker-build-smoke.yml` - a build-only `docker compose -f docker-compose.prod.yml build`, path-filtered on the Docker inputs on PRs + on `release/**` + weekly, analogous to the dexie-smoke pattern (#552).

(Orthogonal, listed for contrast: #1653 `settings-data` baseline churn from live `recommended-repos.json` is the external-data class (#575), not this "spec-not-dragged-along" class.)

### The reviewer rule

A green PR is NOT authoritative for nightly-only surfaces. When a PR touches a visual-critical path, an e2e-covered surface, or a `readFileSync`-pinned subject, the safety net is the full/nightly run - which lands after the merge. Treat the green PR as "the PR-CI slice is green", not "develop is green".

### Shipped mitigations (make the gap PR-visible, targeted)

- **`visual-baseline-gate.yml`** (#1641) - a PR touching visual-critical paths must carry the baseline PNGs; escape label `visual-baselines-unaffected`.
- `testid-reference-gate.yml` (#1661) - a statically spec-referenced `data-testid` that is net-removed/renamed on a high-user-visibility surface (lesson runner, exercises, dashboard, content browser, settings core) without any e2e spec change fails a fast PR gate (`scripts/testid_reference_gate.py`, `make check-testid-refs`); escape label `testid-refs-unaffected`. Catches the rename/remove sub-class only - the #1656 wrap-into-`hidden` case (literal survives) is not literal-diffable and stays a reviewer + nightly concern.
- **`docker-build-smoke.yml`** (#1990) - build-only `docker compose -f docker-compose.prod.yml build` (the launcher/install.sh path, which no other gate builds), path-filtered on the Docker inputs on PRs + on `release/**` + weekly + dispatch; `make docker-build-smoke` locally. The release checklist's Docker step moves from "if active" to mandatory.

### The scope discipline (why these gates stay targeted)

Not every nightly-only surface earns a PR gate. Pulling every nightly surface into PR-CI collapses the fast-PR/#552 separation and a too-broad gate produces false positives and gets bypassed. The criterion: gate the high-user-visibility surfaces where a silent nightly break masks a real user regression (lesson runner, dashboard, content, settings core); accept the short red-develop window as the safety net for internal/rarely-changed/tooling surfaces. Prefer a precise gate (an actual diff of the referenced artifact) over a coarse "touched X -> must touch Y" presence check, so the false-positive rate stays near zero.

## Engine re-pin without `make sync-schema` is invisible until the release gate

Surfaced 2026-07-24 as the single red gate of the v2.6.0 release run. The #1993 engine re-pin (`learn-content-engine` 0.13.3 -> 0.14.0, the manifest `visibility` field) merged green through every PR gate - but the mirrored `schema/content-set.schema.json` was never regenerated. The drift sat latent because `sync-schema-check` runs ONLY inside `make release-test` (release cycle), not on PRs: the first signal was a red `make release-test` while cutting the release, fixed on the release branch (commit b67e6043 on release/2.6.0).

### Rule

Every PR that re-pins `learn-content-engine` runs `make sync-schema` in the SAME PR and commits the regenerated mirror (schema files + generated plugin/TS artefacts). "The pin bump is green" proves nothing about the mirror - no PR gate compares them.

When reviewing an engine re-pin, the tell is cheap: a bump of the `learn-content-engine` pin with NO diff under `schema/` or the generated artefacts is suspicious by default; verify with `make sync-schema-check` before merging.

Same shape as the #575 PR-CI-vs-nightly classes: a gate that runs on a slower cadence than the change class it guards leaves a latent window. If engine re-pins become frequent, promote `sync-schema-check` into the PR path filter for `frontend/package.json` changes touching the engine pin.

Pairs with "PR-CI vs nightly gates: different test surfaces" - the cadence-gap family this belongs to. "Cross-layer assumptions must be pinned against REAL data shapes" - the mirror IS the pinned shape; regenerating it is how the pin stays honest.
