# Adaptive Learner — Latest Status Handover

**Generated:** 2026-05-30
**Purpose:** single-glance project status for resuming work. This
file is overwritten each time a fresh status snapshot is taken;
dated session journals (`handover-YYYY-MM-DD.md`) keep the
point-in-time detail.

---

## 1. HEAD + version

| | |
|---|---|
| **HEAD commit** | `aaa9c3b` (`docs: session handover 2026-05-30 …`) |
| **Branch** | `main` — clean working tree, fully pushed |
| **App version** | `v1.42.1` (canonical: `backend/pyproject.toml`) |
| **Last tag** | `v1.42.1` |
| **Unreleased on main** | 5 commits since the v1.42.1 tag (see §8/§9) |

Both repos in sync with remotes:
- App: `astrapi69/adaptive-learner` @ `aaa9c3b`
- Content: `astrapi69/adaptive-learner-content` @ `005b080`

---

## 2. Exact test counts (verified this session, not from memory)

| Suite | Count | How verified |
|---|---|---|
| **Backend** | **1027** collected (1 skipped at runtime) | `pytest --collect-only -q` |
| **Plugins (13)** | **975** | per-plugin `--collect-only`, summed |
| **Vitest (frontend)** | **2568** (230 files) | `npx vitest run` |
| **Backend + plugins + Vitest** | **4570** | sum |
| **Dexie-mode release gate** | **19** specs | `make test-dexie-smoke` (this session: 19 passed) |
| **E2E smoke** | 17 spec files | not re-run this session (separate from `make test`) |

Per-plugin breakdown (975 total):

```
ai-anthropic   35   assessment     110   notebooklm     27
ai-gemini      34   content-loader 259   session       215
ai-openai      32   gamification    54   tools          58
anki           20   learning-repo   53   tracking       64
                    missions        14
```

Delta vs the `v1.42.0` baseline (4556): backend 1027 (=),
plugins 970→975 (+5 dedupe pins), Vitest 2559→2568 (+9: Phase-59
/ Settings / dedupe + badge pins).

---

## 3. Open bugs from manual testing + recent fixes

All bugs surfaced in recent sessions are **resolved**. None
currently open.

| Bug | Status | Where fixed |
|---|---|---|
| Settings Help panel rendered in EVERY tab (`<HelpBrowser/>` unguarded) | **FIXED** | `7ccdd71` (Help/About split; panels now `hidden` per `activeTab`) |
| `saveUserSet` POST sent a double-stringified body → HTTP 422 (Save-as-Offline-Lesson in API mode) | **FIXED** | `7c40fe8` (v1.42.1); `body: input` not `JSON.stringify(input)`; api-client regression pin added |
| Settings "missing sections" after tab reorg | **NOT A BUG** | Audit proved nothing missing (`NotebookLMSection` is a Progress-page component, never belonged in Settings) |
| 59A built against spec fields that don't exist (`key_concepts`/`rules_learned`) | **FIXED** in dev | Rebuilt against real `ConversationAnalysisResult` fields before commit |
| i18n audit tripped on `{theory}` placeholder (contains "the") | **FIXED** in dev | Renamed to `{steps}` across 8 catalogs |
| Content repo would not load (3 structural problems) | **FIXED** | content-repo `005b080` (see §7) |
| `/content` listed each set twice (bundled + GitHub, same `set_id`) | **FIXED** | `37cf4dc` cross-source dedupe (see §7) |

---

## 4. Branches (committed/unmerged)

**None.** `main` is the only branch (local + remote). All prior
work branches are merged and gone:
- `feature/docs-verification` → merged at `2184f77`
- Phase-59 branch → merged at `c3e2593` (v1.42.0)
- `fix/settings-help-tab` → superseded; the real fix landed in
  `7ccdd71` on the phase branch

No stashes, no detached work, no uncommitted changes.

---

## 5. Pending prompts / tasks mentioned but not implemented

| Item | Source | State |
|---|---|---|
| **Cut a release for the 5 post-v1.42.1 commits** | implied by §8/§9 | **DECISION PENDING** — recommend `v1.43.0` (see §9) |
| Cross-source badge generalization (3rd source type) | this session, flagged | Deferred — current label is binary `bundled:` vs "GitHub" |
| Dedupe for `/content` | requested this session | **DONE** (`37cf4dc`) |
| Content repo review + fix | requested this session | **DONE** (content-repo `005b080`) |

No other outstanding user prompts. Everything explicitly requested
in recent sessions has shipped.

---

## 6. Settings tab structure (ACTUAL current state)

`SETTINGS_TABS = [general, ai, learning, plugins, data, help, about]`
— 7 tabs. All panels stay mounted; inactive ones are
`hidden={activeTab !== "<tab>"}` (deep links + testids keep
working). Source: `frontend/src/pages/Settings.tsx`.

| Tab | Sections / components (in render order) |
|---|---|
| **General** | Appearance (`<ThemePicker/>`) · Language selector · Interface (incl. **Developer Mode** toggle) · Storage mode selector |
| **AI** | AI provider · Model overrides (`<ModelPicker/>`) · API keys (per-provider key source) |
| **Learning** | Feedback (`<FeedbackIntensityControl/>`, `<SoundSettingsControl/>`) · `<MissionSettingsControl/>` · `<VoiceSettingsSection/>` · Interaction → **Swipe Gestures** toggle |
| **Plugins** | `<GamificationSettingsSection/>` · `<LearningRepoSettingsSection/>` |
| **Data** | `<SyncSection/>` · `<BackupSection/>` · `<ExportSection/>` · `<IdentitySection/>` *(API mode only)* · `<DangerZoneSection/>` |
| **Help** | `<HelpBrowser/>` (glossary) |
| **About** | `<AboutTab/>` (Version / SystemInfo / Credits / Donation / License) |

Reorg history (v1.42.1, `7ccdd71`): Help and About split into two
separate tabs; Swipe-gesture moved General→Learning; IdentitySection
moved out of Help/About → Data (API-mode-gated). No settings were
lost or duplicated.

---

## 7. Content system state

### Bundled content (offline fallback)
- Ships in the GH-Pages build via `copy-bundled-content.mjs`
  (predev/prebuild). Sources `bundled:fr-a1`, `bundled:es-a1`
  resolve to `/content/{key}/manifest.yaml`.
- Set ids: `language-fr-a1`, `language-es-a1`.

### External repo (`astrapi69/adaptive-learner-content` @ `005b080`)
- **Exists, validated end-to-end against live GitHub.**
- 15 lessons: French A1 (10) + Spanish A1 (5), all schema-v1.1 valid.
- Structure (working): root `manifest.yaml` (ContentManifest) →
  `sets/{set_id}/manifest.yaml` (carries `metadata.lessons`) →
  `sets/{set_id}/lessons/NN-slug.json`.
- Three problems fixed at creation (do not regress): root manifest
  was wrong shape; dirs `fr-a1`/`es-a1` didn't match set ids; per-set
  manifests lacked `metadata.lessons` (→ 404 on slug-named files).

### Dedupe status — **DONE** (`37cf4dc`)
- Both storage modes collapse same-`set_id` rows: higher version
  wins; tie → prefer external (GitHub) over `bundled:`; GitHub
  unreachable → bundled/cached survives (offline intact).
- Dexie: `dedupeContentEntries`/`compareVersions` in
  `content-loader-dexie.ts`. API:
  `_dedupe_content_entries`/`_compare_versions` in `service.py`.
- UI: subtle "Bundled"/"GitHub" badge per set card
  (`content.source.*` i18n, 8 langs; "GitHub" verbatim + in the
  audit allowlist).
- Community sharing: `COMMUNITY_SHARING_ENABLED = true`,
  `COMMUNITY_REPO = "astrapi69/adaptive-learner-content"`.

---

## 8. Commits since v1.42.0 (newest first)

```
aaa9c3b docs: session handover 2026-05-30 (cross-source dedupe + content repo)
37cf4dc feat(content-loader): dedupe sets across sources, prefer external over bundled
f5b78b1 feat(content): re-enable Share with Community (content repo now exists)
c78c13b fix(content-loader): graceful handling when default content source repo is unavailable
1842a7b docs: reconcile README/ROADMAP/backlog to v1.42.1 (post-merge)
2184f77 Merge branch 'feature/docs-verification'
16e07ee fix(docs): update README version badge to v1.42.1
e70a0b0 chore(release): bump version to v1.42.1        ← v1.42.1 TAG
fbedc72 docs: changelog for v1.42.1
7ccdd71 feat(settings): split Help/About tabs; swipe-gesture to Learning; identity to Data
7c40fe8 fix(content): saveUserSet POST sent a double-stringified body (422)
7c4dcb3 docs: document the documentation verification system
eb21731 feat(docs): add generate_docs_checklist.py post-release helper
86ba997 ci(docs): gate releases on verify-docs-discipline + CI doc verification
04897ec docs: bring README/ROADMAP/backlog current to v1.41.0 (verify-docs green)
0fd1b13 feat(docs): add i18n coverage check (key-set parity vs en)
4039e96 feat(docs): add help-coverage check (en/de parity + route mapping)
fcd97c0 chore(make): declare verify-docs targets PHONY
5a054fe feat(docs): add mkdocs orphan + dead-link check and discipline targets
349f870 feat(docs): add verify_docs.py drift verifier (version/count/theme checks)
```

The 5 commits **above** the `v1.42.1` tag line (`1842a7b` …
`aaa9c3b`) are unreleased. The docs-verification cluster
(`349f870`…`7c4dcb3`) was authored on a branch and merged at
`2184f77`, so it linearizes after the tag but predates it in intent.

---

## 9. Next release candidate

**Recommendation: `v1.43.0`** (minor).

Per `.claude/rules/release-workflow.md` SemVer table, a `feat:`
since the last tag → minor bump. The 5 unreleased commits include
two user-facing `feat:`:
- `f5b78b1` re-enable Share with Community
- `37cf4dc` cross-source set dedupe + source badges

…plus one `fix:`-class graceful-fallback (`c78c13b`) and docs. A
patch (`v1.42.2`) would undersell the two user-facing features.

**If released, the mandatory gate chain (do not skip any):**
hand-edit `backend/pyproject.toml` version → `make sync-versions`
→ `make test` → `cd frontend && npx tsc --noEmit && npm run test`
→ `make test-dexie-smoke` → `ruff check` + `mypy app/` →
`pre-commit run --all-files` → `make verify-docs-discipline` →
`npm run build` → tag → push → `gh release create`. Changelog
highlights: cross-source dedupe + provenance badges, Share with
Community live, graceful content-source fallback.

---

## 10. Known issues / regressions / tech debt (flagged, not addressed)

**No known regressions.** Everything below is pre-existing or
deliberately deferred debt.

- **Unreleased commits** (§9) — ship decision pending.
- **API-mode source badge is always "GitHub"** — the label logic
  is binary (`source.startsWith("bundled:")` vs everything-else).
  API mode has no bundled sources, so every card shows "GitHub".
  If a non-GitHub external source is ever configured, generalize
  the label in `Content.tsx`.
- **Backlog (P3, `docs/backlog.md`):**
  - `DEP-MYPY-2-01` — mypy 1.x→2.0 (dedicated session; caret caps it).
  - `DEP-ANTHROPIC-105-01` — anthropic SDK 0.55→0.105 (tests mock
    the SDK; needs a live-key test before bumping).
  - `PLUGINFORGE-LIFECYCLE-UI-01` — frontend half pending; no
    Settings→Plugins lifecycle panel exists (~150-200 LOC).
  - `HELP-CONTENT-TRANSLATIONS-01` — help glossary EN-passthrough
    for ES/FR/EL/PT/TR/JA.
  - `BACKUP-DIR-EXPORT-01` — interactive "Save backup to disk" for
    Dexie mode.
  - `BL-23` — `get_or_create_settings` race under strict-mode
    double-effect.
  - `BL-24` — E2E `page.route` GET matcher for `/api/imports/{id}`.

### Recurring landmines (full list in `handover-2026-05-30.md` §5)
- `apiCall` already JSON.stringifies `opts.body` — pass a raw
  object (double-stringify = 422).
- i18n placeholders must avoid English stopword substrings
  ("the", "and", "for"); brand tokens must be in the audit
  allowlist.
- Run Vitest from `frontend/`, never repo root (root → `document
  is not defined`).
- Dexie-mode is part of the contract: API-calling features need a
  Dexie path or graceful degrade in the same commit.
- Use canonical CSS tokens (`--bg-secondary`, not `--bg-subtle`).
