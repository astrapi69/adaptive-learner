# Handover — @astrapi69/feature-strategy integration (#286)

Branch: **`feature/feature-strategy-integration`** (pushed to origin, 3 commits ahead of `main`).
Issue: **#286** — "Integrate @astrapi69/feature-strategy to replace ad-hoc feature gating".
Date handed over: 2026-06-11.

---

## UPDATE — Step 6 done (session 2, 2026-06-11, commit 132feb0)

Step 6 (migrate gates) is **implemented, committed, pushed**. Also folds in
Step 7 (no new reason strings needed), Step 8 (notices are now feature-driven),
and Step 9 (legacy in-scope `useApiKeyStatus`-gating removed).

- **Hidden gates** (`<Feature>`, hidden in Dexie): Settings Sync (SYNC),
  LearningRepo persist button (GIT_PERSIST, disabled→hidden),
  LearningRepoSettingsSection git toggle (LEARNING_REPO_GIT).
- **Disabled gates** (`useFeature`): ImportDetail Analyze/Start-session/
  Extract-Anki (+notice), Anki empty-state notice, NotebookLM
  Generate-questions/Study-guide (+notice), Dashboard QuickStart/banner/notice.
- **Skipped:** Session.tsx (#9) — no existing key gate; adding one would block
  read-only resume (deviation #3). SESSION_START gating lives at the entry-point
  buttons (Dashboard, ImportDetail).
- **Test infra:** `src/features/testFeatureProvider.tsx` exports
  `TestFeatureProvider` (explicit context, default active) +
  `DerivedFeatureProvider` (derives from the real hooks, for the dexie page
  tests). Affected tests wrapped; Dashboard "no-key" + LearningRepoSettings
  git-toggle tests moved to Dexie/API contexts to match the maintainer table.

**Verification:** `tsc --noEmit` clean; full Vitest **3851 passed, 0 failed**;
eslint 0 errors on touched files.

**BLOCKER for Step 10's dexie-smoke gate (pre-existing, NOT this work):**
`npm run build` fails with 3 MISSING_EXPORT errors from the #267/#264/#265
dependabot TipTap bumps (`@tiptap/extension-highlight@3`,
`extension-table-cell@3`, `extension-task-item@3` against `@tiptap/core@2` —
`getStyleProperty` / `TableCell` not exported). Same root cause fails 9 TipTap
editor test *files* at load. Fix = pin those three extensions back to 2.27.2
(lessons-learned "Community extensions can silently upgrade to @tiptap/core
v3"). Needs its own issue; do NOT fold into the #286 PR.

**Not run this session:** backend i18n parity (venv not provisioned; Step 6
added no i18n keys) and the manual reactivity check (requirement C — needs a
running app; build is blocked anyway).

---

## 0. TL;DR for the next worker

The **foundation is built, committed, pushed, and green** (tsc clean, the
feature-config unit test passes). What remains is the **mechanical migration of
the ~11 gating sites** to `useFeature` / `<Feature>`, the legacy-artifact
cleanup, and the full verification sweep. The hard, correctness-critical part
(registry/strategy design per the author's requirements A–D, reactive key
status) is done. Pick up at **Step 6 (migrate sites)**.

Do NOT re-run `npm install` casually — see the **install hazard** in §5.

---

## 1. What is DONE (committed on the branch)

Three commits, in order:

1. `b7a68db6 chore(deps): install @astrapi69/feature-strategy + react adapter`
   - `@astrapi69/feature-strategy@^0.1.0` + `@astrapi69/feature-strategy-react@^0.1.0` added to `frontend/package.json`.
   - **Also declared `@testing-library/dom@^10.4.1` explicitly** (it is a *peer* of RTL 16, not a transitive install; a fresh resolve prunes it and breaks `screen`/`fireEvent`/`waitFor` re-exports across ~all component tests). This was a real breakage I hit and fixed — keep it.

2. `f1cf1236 feat(features): central feature registry and gating strategy`
   - `frontend/src/features/featureConfig.ts` — the registry + strategy.
   - `frontend/src/features/featureConfig.test.ts` — 5 tests, all green, pinning the maintainer table + fail-closed.

3. `1a02da7e refactor(app): wire FeatureProvider + make api-key status reactive`
   - `frontend/src/App.tsx` — wraps the tree in `<FeatureProvider registry={featureRegistry} context={featureContext}>`, with `featureContext` **memoised** on `{mode, hasAiKey}`.
   - `frontend/src/pages/Settings.tsx` — the key save / provider-switch / restore / delete handlers now call `refreshApiKeyStatus()` so AI gates flip **without a reload** (requirement C).
   - `feature.api_key_required` i18n string added to all 8 catalogs (DE + EN real, English placeholder for the other 6) + `make sync-i18n` regenerated the frontend JSON.

### Requirements A–D status (author-verified, non-negotiable)

- **A (read the real .d.ts):** done. The real API differs from earlier prompt snippets. Captured in `featureConfig.ts`. Key facts: `FeatureProvider` takes `registry` + `context`; `ConditionalFeatureStrategy` takes a `Record<id, FeatureCondition>`; `FeatureCondition = {evaluate(ctx) => state|undefined, reason?}`; `useFeature(id) => {state, isActive, isDisabled, isHidden, reason}`; `<Feature id whenDisabled whenHidden>`; unknown id → `hidden` (fail closed).
- **B (descriptor + abstention, no total function):** done. Every feature is a descriptor with `defaultState: "active"`. The strategy holds ONLY the ~10 deviation rules (NEEDS_AI_KEY + HIDDEN_IN_DEXIE) and abstains (`undefined`) otherwise. No `ALWAYS_ACTIVE` set in the strategy, no active fallback.
- **C (memoised AND reactive context):** done. `featureContext` is `useMemo`'d; `hasAiKey` comes from `useApiKeyStatus()` which is reactive (subscriber set), and Settings now calls `refreshApiKeyStatus()` on every key-state change. **VERIFY THIS MANUALLY** (see §6.2).
- **D (cheap, pure conditions):** done. Conditions read only `ctx.mode` / `ctx.hasAiKey`. No async/DOM/storage.

---

## 2. What is NOT done yet (your work)

### Step 6 — migrate the ad-hoc gating sites to `useFeature` / `<Feature>`

The provider is wired but **no component consumes it yet** — so the foundation
is currently "wired but not working" until you migrate at least the real sites.
This is the next task.

Migration table (feature id → site). The `FEATURES.*` constants live in
`featureConfig.ts`. Verify each site's current code before editing.

| # | File | Current gating | Feature | Target |
|---|------|----------------|---------|--------|
| 1 | `pages/ImportDetail.tsx` "Analyze" (`analyze-button`) | `disabled={... \|\| (apiKey.ready && !apiKey.hasKey) \|\| !online}` | `CONVERSATION_ANALYZE` | `useFeature` disabled |
| 2 | `pages/ImportDetail.tsx` "Start session" (`start-session-button`) | `disabled={... \|\| (!activeSession && apiKey.ready && !apiKey.hasKey)}` | `SESSION_START` | `useFeature` disabled (only when NOT resuming) |
| 3 | `pages/ImportDetail.tsx` "Extract Anki" (`extract-anki-button`) | `disabled={... \|\| !apiKey.ready \|\| !apiKey.hasKey}` | `ANKI_EXTRACT` | `useFeature` disabled |
| 4 | `pages/Anki.tsx` empty-state notice | `{apiKey.ready && !apiKey.hasKey && <ApiKeyRequiredNotice .../>}` | `ANKI_EXTRACT` | render notice when `useFeature(ANKI_EXTRACT).isDisabled` |
| 5 | `components/NotebookLMSection.tsx` "Generate questions" (`notebooklm-generate-questions`) | **#281 ad-hoc** `disabled={generating \|\| aiUnavailable}` | `LEARNING_QUESTIONS` | `useFeature` disabled |
| 6 | `components/NotebookLMSection.tsx` "Download package" (`notebooklm-download-zip`) | enabled (client-side) | `NOTEBOOKLM_DOWNLOAD` | active, no gate (leave it) |
| 7 | `components/NotebookLMSection.tsx` "Study guide" (`notebooklm-study-guide`) | **#281 ad-hoc** `disabled={generatingGuide \|\| aiUnavailable}` | `LEARNING_GUIDE` | `useFeature` disabled |
| 8 | `pages/Dashboard.tsx` "New session" | check current state | `SESSION_START` | `useFeature` disabled |
| 9 | `pages/Session.tsx` resume/start | check current state | `SESSION_RESUME` | `useFeature` disabled |
| 10 | `pages/Settings.tsx:~1165` Sync section | `{resolveStorageMode() === "api" && <SyncSection />}` | `SYNC` | `<Feature id={FEATURES.SYNC}><SyncSection/></Feature>` (hidden in Dexie) |
| 11 | `pages/LearningRepo.tsx:~189` "Persist to git" (`repo-persist-btn`) | `disabled={persisting \|\| storageMode !== "api"}` (disabled+tooltip today) | `GIT_PERSIST` | `<Feature id={FEATURES.GIT_PERSIST}>` → **hidden** in Dexie (table says hidden, not disabled — this is a deliberate behaviour change; SYNC-UI-GATE rule agrees: don't offer dead buttons) |
| (12) | `components/LearningRepoSettingsSection.tsx` "Enable git persistence" toggle | `disabled={saving}` | `LEARNING_REPO_GIT` | `<Feature id={...}>` → hidden in Dexie |

Patterns (confirm prop names against the .d.ts — they are real):

```tsx
// Disabled gate (programmatic) — when the button already has other disabled logic:
const analyze = useFeature(FEATURES.CONVERSATION_ANALYZE);
<Button
  disabled={analyzing || !online || !analyze.isActive}
  title={analyze.isDisabled ? t(`feature.${analyze.reason}`) : undefined}
  ...
/>

// Hidden gate (declarative) — whenHidden defaults to nothing, so just:
<Feature id={FEATURES.SYNC}>
  <SyncSection />
</Feature>
```

### Step 7 — i18n
`feature.api_key_required` is already added (all 8). Hidden features need **no**
text (the author was explicit: do NOT add a `desktop_only` key — nothing renders
a reason for hidden). If a migration needs another reason string, add it to all 8
catalogs + `make sync-i18n`.

### Step 8 — unify `ApiKeyRequiredNotice`
Make the yellow banner driven by feature state (render only when the relevant
`useFeature(...).isDisabled`), not by a separate hardcoded `apiKey` check. Don't
run both systems in parallel.

### Step 9 — delete legacy artifacts (only after the site is migrated)
- `grep -rn 'useOfflineFeatureGate\|OfflineFeatureNotice' frontend/src` → currently **0 hits** (these never existed here; nothing to delete).
- After migrating each site, remove its now-dead `useApiKeyStatus()`-for-gating usage. Do NOT remove `useApiKeyStatus` from `App.tsx` (it feeds the context) or from non-gating uses.
- `grep -rn 'apiKey.ready && !apiKey.hasKey' frontend/src` should trend to 0 as you migrate (the App-root use in `App.tsx` is `apiKeyStatus.ready && apiKeyStatus.hasKey` — different, keep it).

### Step 10 — verify (see §6).

---

## 3. Branch / PR state

- On branch `feature/feature-strategy-integration`, pushed.
- **No PR opened yet** — open it after the migrations land (or open a draft now if you prefer). Title: `feat: integrate @astrapi69/feature-strategy (#286)`. Body: cite `Closes #286`, list the migrated sites, note the deliberate git-persist disabled→hidden change.
- Commit strategy (author-specified, one PR, squash-merge): keep the phased commits — next ones are `refactor: migrate hidden gates`, `refactor: migrate disabled gates`, `refactor: remove legacy gating artifacts`, `test: verify`.

---

## 4. Open decisions / deviations already taken

1. **API-mode = active for AI features** (per the maintainer table). This means in API mode AI buttons are NOT key-gated by the strategy. The strategy implements the table verbatim. (The pre-existing ImportDetail code DID gate AI on key in API mode; migrating to `useFeature` will *remove* that gate in API mode. This matches the table. Flag it in the PR.)
2. **git-persist / learning-repo-git: disabled → hidden** in Dexie. The table says hidden; today they are disabled-with-tooltip. Hiding matches the table and the SYNC-UI-GATE rule. Deliberate.
3. **`SESSION_RESUME` gating nuance:** today ImportDetail only gates *new* session start on the key (resuming an existing session is allowed without AI). The table lists `session-resume` as disabled-without-key. Decide per-site whether "resume" means "continue the conversation" (needs AI → gate) vs "view the existing session" (no AI → don't over-gate). Lean on the table but don't make a read-only view unreachable.
4. **Reason key naming:** the strategy reason is `"api_key_required"` (underscore) so `t(\`feature.${reason}\`)` resolves to `feature.api_key_required`. Keep underscores.

---

## 5. Blockers / hazards

### Install hazard (IMPORTANT)
`npm install` re-resolves and **prunes `@testing-library/dom`** (RTL16 peer) →
breaks ~all component tests' `screen`/`fireEvent` imports. Mitigations already in
place: `@testing-library/dom` is now an explicit devDependency. Still:
- Always install with `--legacy-peer-deps` (forced by a **pre-existing** `@tiptap/extension-highlight@3` vs `@tiptap/core@2` peer conflict from merged #267 — unrelated to this work; surfaced to the user separately).
- After any install, re-check: `node -e "require('@testing-library/dom/package.json')"` resolves, and `npx tsc --noEmit` is 0 errors.

### Pre-commit prettier hazard
The `prettier-frontend` hook runs `prettier --write` on staged `frontend/src`
`.ts/.tsx/.css` files and **aborts the commit if it modifies them**. Touched
files predating the hook are 4-space and get fully reformatted to 2-space (big
but expected diffs — this is the repo norm). To avoid the abort loop:
**run `npx prettier --write <files>` yourself before `git add`**, then commit.
Don't run two `frontend/src`-touching commits back-to-back (the stash/restore
conflicts — commit one, confirm HEAD moved, then the next).

### Pre-existing CI red (not your bug)
The `Frontend Tests` CI job fails on `eslint --max-warnings=0` against 438
**pre-existing** warnings (issue **#220**). It blocks every PR. The local
pre-commit `eslint` hook only fails on **errors** (no `--max-warnings=0`), so
local commits pass. The earlier test PRs (#282–284) and #281 were **admin-merged**
past this. Expect to admin-merge this PR too (owner's call), or land #220 first.

### Component tests need the provider
`useFeature` throws outside a `FeatureProvider`. Every vitest test that renders a
**migrated** component (`ImportDetail.test`, `Anki.test`, `Progress.test`,
`Dashboard.test`, `Session.test`, `Settings.test`, `LearningRepo.test`, …) must
wrap the render in a provider. Recommended: add a tiny test helper, e.g.
`frontend/src/features/testFeatureProvider.tsx` exporting a wrapper that mounts
`<FeatureProvider registry={featureRegistry} context={{mode, hasAiKey}}>`, and
use it (or RTL's `wrapper` option) in the affected tests. The **dexie-smoke e2e**
runs the real App (real provider) so it needs no wrapping — lean on it as the
primary integration gate.

---

## 6. Tests that MUST run

### 6.1 Automated
```bash
# from repo root unless noted
cd frontend && npx tsc --noEmit                 # 0 errors
cd frontend && npx vitest run src/features/     # feature-config tests
cd frontend && npx vitest run                   # full unit suite (fix provider-wrapping breakage)
cd backend  && poetry run pytest tests/test_i18n_parity.py tests/test_i18n_structure.py -q

# Dexie-mode e2e (the real integration gate — primary proof):
cd frontend && VITE_STORAGE_MODE=dexie npm run build
cd e2e && npx playwright test --config=playwright.dexie.config.ts \
  anki-workflow notebooklm-workflow content-repo-import
# (notebooklm-workflow already asserts the two AI buttons are disabled w/o key)

# Full dexie gate + axe + visual (author's Step 10):
make test-dexie-smoke        # all dexie specs, no backend
# axe: e2e/smoke/a11y-audit.spec.ts ;  visual: make test-visual (rebuilds baselines)
```

### 6.2 Manual (requirement C — do NOT skip)
1. Dexie build, **no key**: AI buttons disabled with explanation; Sync section + git-persist button **absent** (not greyed). Zero dead buttons.
2. **Reactivity:** with the app open (no reload), enter a key in Settings > Integrations → all AI buttons become active **without reload**. Remove the key → they go disabled again, no reload. This proves the `refreshApiKeyStatus()` wiring.
3. Fail-closed: temporarily `useFeature('does-not-exist')` in a component → `hidden`. Remove after.

---

## 7. The full feature-strategy spec (reference)

The authoritative, latest prompt is the **third** message from the author in this
session's history (the one beginning "KRITISCHE VORAB-ANFORDERUNGEN" with points
**A–D**, the Gate/Branch/Infra split, Steps 1–10, the maintainer feature table,
and the Do-NOT list). If that transcript is unavailable, the essentials are
captured above plus:

- **Gate vs Branch vs Infra:** true gates (disable/hide on mode/key) → `useFeature`/`<Feature>`. Logic branches (export engine, danger-zone reset path) → stay on `resolveStorageMode()`, do NOT push into the registry. Infra (`client.ts`, `api-storage.ts`) → don't touch.
- **Maintainer feature table** (API / Dexie-no-key / Dexie-key): everything `active` except the 7 AI features (`active` / **disabled** / `active`) and the 3 desktop features sync/git-persist/learning-repo-git (`active` / **hidden** / **hidden**). The 19 always-active features (incl. `notebooklm-download`) are `active` everywhere.
- **Do NOT:** change the library; keep ad-hoc checks as fallback; build an ALWAYS_ACTIVE set or active fallback in the strategy; hide features that should be disabled; push logic-branches into the registry; pass context without useMemo; use a non-reactive key status; spell feature ids as string literals (always via `FEATURES`); copy prompt code instead of the .d.ts. No version bump. Explicit `git add` paths. TSDoc only. i18n in 8 languages. Tailwind for UI.

The real `.d.ts` files are at
`frontend/node_modules/@astrapi69/feature-strategy/dist/index.d.ts` and
`.../feature-strategy-react/dist/index.d.ts` — read them, they are the contract.

---

## 8. Session context (what shipped before this branch)

Earlier in the same session (already on `main`, merged):
- **#278/#279/#280** — Dexie-mode E2E specs for content-repo import, Anki, NotebookLM (PRs #282/#283/#284, admin-merged).
- **#281** — NotebookLM AI buttons key-gated with the ad-hoc pattern (PR #285, merged). **This branch will convert that ad-hoc fix to `useFeature` (sites #5/#7 above).**

Nothing is lost; everything is committed and pushed.
