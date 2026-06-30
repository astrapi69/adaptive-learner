# Reusability audit — `frontend/src/shared/` (2026-06-22, #1021)

Dedicated audit of every component under `frontend/src/shared/` against the
reusability policy (`docs/policies/REUSABILITY-POLICY.md` / `.claude/rules/reusability.md`):
props-driven, no app-specific imports, no import-time side effects, TSDoc
present, app-agnostic.

## Scope

- **58** component/module files under `src/shared/` (excluding tests).

## Method

```bash
# Runtime (value) imports of app-specific modules — hard coupling
grep -rn '^import [^t]' src/shared --include=*.tsx --include=*.ts \
  | grep -E 'storage|/pages/|/api/client|hooks/(lesson|content)|lib/(content|adaptive|learning|gamification|srs)'

# Type-only app imports — softer coupling
grep -rn '^import type' src/shared --include=*.tsx --include=*.ts \
  | grep -E 'lib/content|lib/adaptive|lib/learning|storage'

# i18n coupling (shared should take labels via props)
grep -rln 'useI18n' src/shared --include=*.tsx

# File-level TSDoc presence
for f in $(find src/shared -name '*.tsx' | grep -v test); do
  head -1 "$f" | grep -q '/\*\*' || echo "MISSING DOC: $f"
done
```

## Findings

| Check | Result |
|-------|--------|
| Runtime (value) imports of app modules | **0** — clean |
| Import-time side effects | **0** — clean |
| File-level TSDoc | **complete** — every `.tsx` opens with `/** … */` |
| App-specific **type** imports | **2** (fixed in this PR) |
| i18n coupling (`useI18n`) | **2** (documented deviation) |

### Fixed in this PR

1. **`media/SetDiscoveryCard.tsx`** imported the app type `SearchableSet`
   from `lib/content/repos/search-index-loader`. Replaced with a local
   structural `DiscoverableSet` (the 6 fields the card renders) and made the
   component **generic** (`<T extends DiscoverableSet>`) so the app's richer
   `SearchableSet` flows through `set` / `onDownload` / `onRemove` unchanged
   — no call-site changes.
2. **`media/ResourceCard.tsx`** imported the app types `MediaResource` /
   `MediaType` from `lib/content/media/media-loader`. Replaced with a local
   `ResourceMediaType` union + `DisplayResource` structural type and made the
   component generic. Same structural compatibility; no call-site changes.

### Documented deviations (tracked, not changed here)

3. **`media/ResourceCard.tsx`** and **`forms/SecretInput.tsx`** call
   `useI18n()` directly for a handful of labels. The policy prefers labels via
   props (app-agnostic). These are pragmatic "app-aware shared" components;
   decoupling i18n changes their public API and every call site, so it is left
   as a follow-up rather than risked in this audit PR. Recommendation: convert
   the few `t()` calls to a `labels` prop (the pattern `SetDiscoveryCard`
   already follows) when these components are next touched.

## Outcome

`src/shared/` is in good shape: no runtime app coupling, no side effects,
full TSDoc. The two type-coupling violations are removed (components are now
truly app-agnostic + generic). Two i18n deviations are documented with a
concrete remediation path.
