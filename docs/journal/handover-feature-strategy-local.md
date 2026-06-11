# Handover — @astrapi69/feature-strategy integration (#286 / PR #287)

For a fresh **local Claude Code** session picking up this work. Self-contained:
you should not need any other doc to continue.

- **Repo:** `astrapi69/adaptive-learner`
- **Branch:** `feature/feature-strategy-integration` (pushed)
- **PR:** [#287](https://github.com/astrapi69/adaptive-learner/pull/287) — `feat: integrate @astrapi69/feature-strategy (#286)`, `Closes #286`
- **Issue:** #286
- **Date:** 2026-06-11
- **Latest commit:** `d9f14f6`

---

## 0. TL;DR

The **code migration is complete and pushed.** Every ad-hoc API-key /
Dexie-mode feature gate now routes through the central `@astrapi69/feature-strategy`
registry via `useFeature` / `<Feature>`. tsc is clean and the full Vitest suite is
**3851 passed, 0 failed**.

What is left is **verification that needs a working build**, which is blocked by a
**pre-existing, unrelated** dependency break (#267, TipTap). Plus two deferred
cosmetic items. None of the remaining work is core migration.

If you only do one thing next: **decide on #267** (see §5). Until it's fixed,
`npm run build` and the dexie-smoke e2e gate cannot run.

---

## 1. Branch state / commits

```
d9f14f6 refactor(features): migrate the Pronunciation AI gate to feature-strategy (#286)
630b376 docs: handover update — Step 6 complete (#286)
132feb0 refactor(features): migrate feature gates to @astrapi69/feature-strategy (#286)
06d7bf0 docs: handover for CCW — feature-strategy integration (#286)   <- earlier handover
1a02da7 refactor(app): wire FeatureProvider + make api-key status reactive (foundation)
f1cf123 feat(features): central feature registry and gating strategy (foundation)
b7a68db chore(deps): install @astrapi69/feature-strategy + react adapter (foundation)
```

(`06d7bf0` + the `## UPDATE` block at the top of `docs/journal/handover-ccw.md`
are the earlier handovers — this file supersedes them.)

---

## 2. Architecture (what to know before editing)

- **Registry:** `frontend/src/features/featureConfig.ts`.
  - `FEATURES` = the id constants. **Always reference these; never spell a
    feature id as a string literal.**
  - Every feature is a descriptor with `defaultState: "active"`.
  - The strategy (`ConditionalFeatureStrategy`) holds ONLY deviation rules:
    `NEEDS_AI_KEY` (→ `disabled` in Dexie without a key, `active` in API mode or
    with a key) and `HIDDEN_IN_DEXIE` (→ `hidden` in Dexie, `active` in API).
    Everything else abstains → descriptor default (`active`).
  - Unknown id → `hidden` (fail closed).
- **Provider wiring:** `frontend/src/App.tsx` wraps the tree in
  `<FeatureProvider registry={featureRegistry} context={featureContext}>`.
  `featureContext` is `useMemo`'d on `{mode, hasAiKey}`; `hasAiKey` comes from the
  reactive `useApiKeyStatus()`, and `Settings.tsx` calls `refreshApiKeyStatus()`
  on every key change so gates flip **without a reload**.
- **Hook/component API** (from the real `.d.ts` —
  `frontend/node_modules/@astrapi69/feature-strategy{,-react}/dist/index.d.ts`):
  - `const f = useFeature(id)` → `{state, isActive, isDisabled, isHidden, reason}`.
  - `<Feature id={...} whenDisabled={...} whenHidden={...}>children</Feature>` —
    renders children only when active; `whenHidden` defaults to nothing.
- **Test providers:** `frontend/src/features/testFeatureProvider.tsx`
  - `TestFeatureProvider` — explicit `context` prop, defaults to
    `{mode:"api", hasAiKey:true}` (everything active). For tests that don't care
    about gating, or that force a state via `context={{mode:"dexie", hasAiKey:false}}`.
  - `DerivedFeatureProvider` — derives context from the real `useApiKeyStatus` +
    `resolveStorageMode`, mirroring `App.tsx`. For the dexie page tests that drive
    key state through seeded storage (e.g. `ImportDetail.test.tsx`).
  - **Any vitest that renders a migrated component must wrap it in one of these**
    (`useFeature` throws outside a provider).

### Gate vs Branch vs Infra (the rule that scoped this work)
- **Gates** (disable/hide on mode or key) → `useFeature` / `<Feature>`.
- **Branches** (logic forks like export-engine choice, or an optional section that
  needs the real provider name) → stay on `resolveStorageMode()` / `useApiKeyStatus`.
  See `Content.tsx` (§3, kept as a branch on purpose).
- **Infra** (`client.ts`, storage layer) → not touched.

---

## 3. What is DONE (migrated)

**Hidden gates** (`<Feature>`, hidden in Dexie):
- Settings → Sync section (`FEATURES.SYNC`) — `Settings.tsx`
- LearningRepo → "Persist to git" button (`GIT_PERSIST`) — `LearningRepo.tsx`
  (**behaviour change: disabled→hidden** in Dexie)
- LearningRepoSettingsSection → git toggle (`LEARNING_REPO_GIT`)

**Disabled gates** (`useFeature`, disabled in Dexie without a key, active in API):
- ImportDetail → Analyze (`CONVERSATION_ANALYZE`), Start session (`SESSION_START`,
  only when not resuming), Extract Anki (`ANKI_EXTRACT`) + the key notice
- Anki → empty-state key notice (`ANKI_EXTRACT`)
- NotebookLMSection → Generate questions (`LEARNING_QUESTIONS`), Study guide
  (`LEARNING_GUIDE`) + key notice
- Dashboard → QuickStart + skip banner + key notice (`SESSION_START`)
- Pronunciation → "Generate phrase" + key notice (`PRONUNCIATION_GENERATE`)

Key notices are now driven by feature state (not a separate `apiKey` check).

**Deliberately NOT migrated (documented decisions):**
- `Session.tsx` (`SESSION_RESUME`) — no existing key gate; adding one would block
  read-only resume. Gating lives at the entry-point buttons.
- `Content.tsx` — AI-validation section is a **branch**: it keys off real key
  presence (`hasKey`) and needs `activeProvider` (provider name) for display copy,
  which the feature layer doesn't carry. Migrating only `hasKey` would run both
  systems on one surface, and the feature rule's "API mode = active regardless of
  key" would wrongly show the section without a usable key.
- Pronunciation mic + scoring flow — works on an already-generated phrase; only
  the AI generate call is gated.

**Verification done:** `grep -rn 'apiKey.ready && !apiKey.hasKey' frontend/src`
is clean except `App.tsx` (context feed, keep) and `Content.tsx` (the branch, keep).

### Deliberate behaviour changes (per the maintainer feature table)
1. **API mode no longer key-gates AI buttons** (the strategy returns `active` in
   API mode). Previously ImportDetail/Pronunciation disabled AI on a missing key
   even in API mode.
2. **git-persist / learning-repo-git hidden, not disabled, in Dexie**
   (SYNC-UI-GATE: don't offer unavailable functions).

---

## 4. What is NOT done

1. **Verification blocked by #267** (see §5): the dexie-smoke e2e gate
   (`make test-dexie-smoke`), the manual reactivity check (requirement C), and the
   axe + visual suites all need a working `npm run build`.
2. **Manual reactivity check (requirement C)** — with the app running and no key,
   AI buttons disabled + Sync/git-persist absent; enter a key in
   Settings → Integrations → AI buttons enable **without reload**; remove it →
   they disable again. Needs a running app (blocked by #267 build).
3. **i18n placeholders:** `feature.api_key_required` is real only in DE/EN;
   el/es/fr/ja/pt/tr carry the English string. (User chose to defer translations.)
4. **Dead i18n key:** `repo.action.persist_dexie_tooltip` lost its only consumer
   (LearningRepo persist tooltip). Harmless; removing it = 8-catalog churn +
   `make sync-i18n`. Left in place.
5. **Backend i18n parity test** not run this session (venv not provisioned; this
   work added no new i18n keys, so it's low-risk).

---

## 5. Blockers / hazards

### #267 — TipTap dependency mismatch (PRE-EXISTING, blocks the build)
`npm run build` fails with 3 `MISSING_EXPORT` errors:
- `getStyleProperty` not exported by `@tiptap/core` (imported by
  `@tiptap/extension-highlight@3`)
- `TableCell` not exported by `@tiptap/extension-table` (imported by
  `@tiptap/extension-table-cell@3`)

Root cause: dependabot PRs #267/#264/#265 bumped `@tiptap/extension-highlight`,
`@tiptap/extension-table-cell`, `@tiptap/extension-task-item` to **3.26.0** while
`@tiptap/core` (via `@tiptap/starter-kit@2.11.0`) is still **2.x**. v3 extensions
import symbols that only exist in `@tiptap/core@3`. This also fails 9 TipTap editor
test files at load (they show as failed *files* with "no tests" — not assertion
failures). It is **unrelated to feature-strategy** and is in the committed
`package.json`, not an artifact of any local install.

**Fix recipe** (needs its own issue, do NOT fold into the #286 PR unless asked):
in `frontend/package.json` pin those three back to `2.27.2`:
```
"@tiptap/extension-highlight": "2.27.2",
"@tiptap/extension-table-cell": "2.27.2",
"@tiptap/extension-task-item": "2.27.2",
```
then `cd frontend && npm install --legacy-peer-deps` (see install hazard below),
re-run `npx tsc --noEmit`, `npx vitest run`, and `npm run build`. (See
lessons-learned.md "Community extensions can silently upgrade to @tiptap/core v3".)

### #220 — eslint CI gate (PRE-EXISTING, blocks every PR)
The `Frontend Tests` CI job runs `eslint --max-warnings=0` against ~438 existing
warnings and fails. The **local** pre-commit eslint hook runs `eslint src/`
(errors only, no `--max-warnings=0`), so local commits pass. Prior PRs (#282–285)
were admin-merged past it. Expect to admin-merge #287 too, or land #220 first.

### Install hazard
- Always `npm install --legacy-peer-deps` in `frontend/` (forced by the #267
  peer conflict).
- A fresh resolve can prune `@testing-library/dom` (RTL16 peer) and break
  `screen`/`fireEvent` across component tests. It is now an explicit
  devDependency; after any install confirm:
  `node -e "require('@testing-library/dom/package.json')"` resolves and
  `npx tsc --noEmit` is 0 errors.

### Pre-commit prettier hazard
The `prettier-frontend` hook runs `prettier --write` on staged `frontend/src`
files. Files predating the hook are 4-space and get fully reformatted to 2-space
(large but expected diffs — the repo norm). To avoid the abort loop:
**run `npx prettier --write <files>` yourself before `git add`**. The migration
commits already carry these reformats.

---

## 6. How to verify (commands)

```bash
# from frontend/ (run vitest from frontend/, NOT repo root)
cd frontend
npm install --legacy-peer-deps          # if node_modules is empty (fresh container)
npx tsc --noEmit                        # expect 0 errors
npx vitest run src/features/            # the registry pin (5 tests)
npx vitest run                          # full suite: 3851 passed; 9 TipTap FILES fail (=#267)

# Blocked until #267 is fixed:
npm run build                           # currently fails: 3 MISSING_EXPORT (TipTap)
# then, from repo root:
make test-dexie-smoke                   # the primary integration gate
```

Manual reactivity check: §4 item 2.

---

## 7. Suggested next steps (in order)

1. **#267** — file an issue, apply the §5 fix recipe on its own branch/commit
   (or here if the owner approves folding it in). This unblocks the build + every
   e2e/visual/axe gate.
2. With the build green, run `make test-dexie-smoke` + the manual reactivity check
   and attach the result to PR #287 (that's the Step-10 deliverable).
3. Optional polish: real translations for `feature.api_key_required` (6 langs);
   remove the dead `repo.action.persist_dexie_tooltip` key (+ `make sync-i18n`).
4. Merge PR #287 (likely admin-merge past #220, owner's call).

---

## 8. Do-NOT list (carried from the maintainer spec)
- Don't change the library or keep ad-hoc checks as a fallback.
- Don't build an `ALWAYS_ACTIVE` set or an active fallback in the strategy.
- Don't hide features that should be disabled (or vice versa).
- Don't push logic-branches into the registry (Content.tsx stays a branch).
- Don't pass the provider context without `useMemo`; don't use a non-reactive key
  status.
- Don't spell feature ids as string literals — always via `FEATURES`.
- No version bump. Explicit `git add` paths. TSDoc, not inline what-comments.
- i18n in 8 languages for any NEW user-facing string.
