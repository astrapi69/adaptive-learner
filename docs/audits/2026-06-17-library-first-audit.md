# Library-First Audit — in-house utilities vs established libraries

**Date:** 2026-06-17
**Scope:** `frontend/src/lib/`, `frontend/src/shared/`, `backend/app/services/`,
and the analogous plugin helpers.
**Tracking issue:** #694
**Rule:** docs + audit only. No code changes. Every `ERSETZEN` / `PRUEFEN`
candidate gets its own follow-up issue (linked below).

---

## TL;DR

The starting hypothesis was "we reinvent a lot of wheels; replacing them with
libraries will shrink the bundle." The audit does **not** support that framing:

1. **The obvious candidates already use the library.** `content-hash.ts` already
   calls the Web Crypto API; `media-loader.ts` already imports the `yaml`
   package; `InlineMarkdown.tsx` is a thin wrapper over `react-markdown`. There
   is nothing to "replace" — these are already library-first.
2. **Most of the rest is genuinely domain-specific** (SRS / review queue, hint
   generation, streak calendar, content quality validation with i18n issue
   codes and a cross-language parity contract). No library models the domain.
3. **Several proposed replacements would *increase* the bundle**, not shrink it:
   `tiktoken` is a 1-2 MB WASM blob to replace a deliberately rough per-card
   cost estimate; `semver` is a parser+comparator to replace a plain string
   equality check; `fast-diff` is a Myers char-diff to replace a single
   common-prefix/suffix split.
4. **The genuine candidates are few:** `ImageCropDialog` (vs `react-easy-crop`),
   the LLM-prose JSON extractor in TS+Python (vs `jsonrepair`). Both carry a
   cross-language parity contract, so neither is a drop-in.

**Net estimated bundle saving from retroactive replacement: ~0 kB (likely
negative).** The value of this work is the **forward gate** — the
implementation hierarchy **Language → Framework → Library → Build** applied
before any new utility — not retroactive churn. Many "reinventions" here are
already at the top tier (Tier 1, native: `content-hash.ts` → `crypto.subtle`;
no `semver` needed in `version-check.ts`). That hierarchy is now codified in
`docs/policies/VIBE-CODING-POLICY.md` §7 (full 4-tier form), `docs/policies/REUSABILITY-POLICY.md`
§1.7, and `.claude/rules/reusability.md`.

### The codified hierarchy (walk top-down, stop at the first that fits)

1. **Language / runtime** — native APIs (JS `Intl`/`crypto.subtle`/`URL`/
   `structuredClone`; Python `pathlib`/`dataclasses`/`hashlib`/`unicodedata`).
2. **Framework** — what's already wired (React hooks/Context, Vite `define`,
   FastAPI `Depends`/`BackgroundTasks`).
3. **Library** — npm/PyPI, prefer an existing dep; a new one needs > 1000
   weekly downloads, last release < 6 months, < 100 kB for a < 50 LOC job, no CVEs.
4. **Build it yourself** — only when 1–3 don't fit; then Library-Grade,
   < 500 LOC, cc < 20, own tests, PR documents *why*.

A separate, real **dependency-hygiene finding** surfaced: backend code imports
PyYAML (`import yaml`) in 10 modules but PyYAML is not declared as a runtime
dependency in `backend/pyproject.toml` (only `types-pyyaml` is). See
[Finding F-1](#finding-f-1-pyyaml-is-an-undeclared-backend-runtime-dependency).

---

## Frontend audit — `lib/` + `shared/`

Legend: **BEHALTEN** = keep in-house · **ERSETZEN** = replace with a library ·
**PRUEFEN** = worth a scoped spike, outcome uncertain.

| Utility | LOC | Function | Candidate library | Already a dep? | Verdict | Reason |
|---|---|---|---|---|---|---|
| `lib/ai/content-hash.ts` | 57 | SHA-256 content hash | Web Crypto API (native) | n/a (native) | **BEHALTEN** | Already uses `crypto.subtle.digest`. The LOC is canonical serialisation + a documented cross-language parity contract (CI checker must produce the byte-identical hash), not crypto. Nothing to replace. |
| `lib/content/media-loader.ts` | 274 | YAML parse + domain validation | `js-yaml` | **yes (`yaml`)** | **BEHALTEN** | Already imports `parse` from the declared `yaml` package. The rest is domain validation (reciprocity gate, affiliate-link rejection). Swapping `yaml`→`js-yaml` is a lateral move, no gain. |
| `shared/InlineMarkdown.tsx` | 63 | Inline-only Markdown | `react-markdown` | **yes** | **BEHALTEN** | Already a thin `react-markdown` config (inline allow-list + safe links). This *is* the library-first implementation. |
| `lib/ai/validation-cost.ts` | 90 | Token + USD cost estimate | `tiktoken` | no | **BEHALTEN** | `tiktoken` is a ~1-2 MB WASM tokenizer, OpenAI-only, exact. This is a deliberately rough order-of-magnitude guard (200 tokens/card, fixed price table). Adding 1-2 MB to make a "~$0.004" estimate exact is disproportionate and provider-narrow. |
| `lib/pwa/version-check.ts` | 86 | Build-version freshness | `semver` | no | **BEHALTEN** | Does **not** do range/ordering comparison — only version-string equality + a build-hash compare. `semver` (parser + range engine) solves a problem this file does not have. |
| `lib/media/youtube.ts` | 86 | Video-ID extraction + thumbnail | `get-youtube-id` | no | **BEHALTEN** | Uses native `URL`. Does more than the lib (thumbnail URL, `isYouTubeUrl`, nocookie host), is privacy-scoped (no embed), fully tested. `get-youtube-id` only extracts an ID and adds a dep for ~40 lines. |
| `shared/AnswerDiff.tsx` | 114 | Your-vs-correct answer highlight | `diff` / `fast-diff` | no | **BEHALTEN** | A single common-prefix/suffix split (one differing middle span). `fast-diff` is a char-level Myers diff producing a token list — different semantics, and the presentational component would still own all the rendering. Overkill. |
| `shared/useKeyboardShortcuts.ts` | 176 | Declarative shortcut registry | `hotkeys-js` / `mousetrap` | no | **BEHALTEN** | App-agnostic, with editable-target skip, ctrl/⌘ unification, React-lifecycle binding, and dev-time conflict detection. `mousetrap` is effectively unmaintained; `hotkeys-js` doesn't do the editable-skip + React-cleanup the same way. Tailored + tested. |
| `utils/eventRecorder.ts` (`EventRingBuffer`) | 392 | Circular event buffer | (none single-purpose) | no | **BEHALTEN** | A ring buffer is ~20 lines of the file; the rest is the app's event schema + redaction. No proportionate library. |
| `lib/hints/generate-hint.ts` | 167 | Per-error hint generation | — | — | **BEHALTEN** | Domain-specific (language-learning hint shapes). No library models it. |
| `lib/review-lesson.ts` | 323 | SRS review-queue synthesis | — | — | **BEHALTEN** | Domain-specific spaced-repetition logic with a Python parity contract. No library models it. |
| `shared/StreakCalendar.tsx` | 128 | Streak calendar widget | (date lib) | no | **BEHALTEN** | Domain-shaped (streak semantics), token-backed, a11y. A generic date-picker/calendar lib would fight the token system and not model streaks. |
| `lib/content/content-validator.ts` | 445 | Lesson schema + quality validation | `zod` / `valibot` | no | **PRUEFEN** | The *schema-shape* layer could move to `zod`, but the file's value is the **quality minimums** (≥5 exercises, ≥2 types, distractor rules) and a **byte-for-byte parity contract** with the content-repo's `validate_content.py`. `zod` would cover maybe 20% and the two validators must stay in lock-step. Low ROI, real regression risk. → [follow-up #-A](#follow-ups). |
| `shared/ImageCropDialog.tsx` + `lib/avatar/crop-image.ts` | 363 + 215 | Interactive image crop | `react-easy-crop` | no | **PRUEFEN** | The strongest replace candidate: `react-easy-crop` is well-maintained (~1 M weekly downloads, ~15 kB) and covers the pan/zoom/pinch interaction. But it does **not** render to a Blob (the `crop-image.ts` canvas helper is still needed) and ships its own (non-token) styling. A spike should weigh ~15 kB + restyling vs ~580 LOC removed. → [follow-up #-B](#follow-ups). |
| `shared/ActivityHeatmap.tsx` | 145 | GitHub-style daily heatmap | `react-activity-calendar` | no | **PRUEFEN** | Lean toward BEHALTEN: the in-house grid is token-backed (recolors across all 12 themes), a11y-labelled, props-driven, zero-dep. `react-activity-calendar` pulls `date-fns` + its own colour theming that would have to be re-bridged to the design tokens. Marginal. → [follow-up #-C](#follow-ups). |
| `lib/extract-json.ts` | 127 | Balanced-brace JSON from LLM prose | `jsonrepair` / `best-effort-json-parser` | no | **PRUEFEN** | `jsonrepair` is mature and would replace the brace-scan. **But** there is a sibling `backend/app/services/extract_json.py` and the two are expected to behave identically; replacing one means replacing both (or accepting drift). Treat as a paired TS+Python decision. → [follow-up #-D](#follow-ups). |

### Already-confirmed library-first (no action)

These were on the suspicion list but are already thin wrappers over a declared
dependency, so they are listed for completeness only: `content-hash.ts`
(Web Crypto), `media-loader.ts` (`yaml`), `InlineMarkdown.tsx` (`react-markdown`).

---

## Backend audit — `services/` + plugin helpers

| Utility | LOC | Function | Candidate library | Verdict | Reason |
|---|---|---|---|---|---|
| `content-loader/version.py` (`compare_versions`) | 113 | Semver-ish ordering | `packaging` | **BEHALTEN** | The module docstring records this as a **deliberate** decision to avoid the `packaging` transitive dep; the comparator is tailored to the content schema's relaxed `X.Y[.Z]` regex. Re-evaluate only if `packaging` becomes a dep for another reason. |
| `content-loader/analysis_to_lesson.py` (`slugify`) | ~7 | Text → slug | `python-slugify` | **BEHALTEN** | Already does the correct `NFKD` + ASCII-transliteration (handles ä/ö/ü/é). `python-slugify` (~30 kB + `text-unidecode`) replaces 7 correct lines. Disproportionate. |
| `content-loader/cache.py` (`slugify_source`) | ~3 | `owner/name` ↔ filesystem key | `python-slugify` | **BEHALTEN** | Not a slug — an **invertible** `/`↔`--` mapping (`unslugify_source` must round-trip). `python-slugify` is lossy and cannot satisfy the round-trip contract. |
| `services/extract_json.py` | 132 | Balanced-brace JSON from LLM prose | `jsonrepair` (py port) | **PRUEFEN** | Mirror of the frontend `extract-json.ts`; same paired-decision caveat. → [follow-up #-D](#follow-ups). |
| `services/yaml_io.py`, `config_overlay.py` | — | Comment-preserving YAML round-trip | `ruamel.yaml` | **BEHALTEN** | Already library-first — uses the declared `ruamel-yaml` for `# INTERNAL`-comment-preserving writes. Correct tool. |

---

## Finding F-1: PyYAML is an undeclared backend runtime dependency

`backend/app/` imports PyYAML (`import yaml`) in **10 modules**
(`config.py`, `middleware/rate_limit.py`, `services/help_glossary.py`,
`services/secrets_service.py`, `services/reset_service.py`,
`services/github_service.py`, `services/subjects_seed.py`,
`services/identity_service.py`, `services/content_backup.py`,
`routers/plugin_settings.py`), but `backend/pyproject.toml` declares only
`ruamel-yaml` (a different package, module `ruamel.yaml`) as a runtime dep and
`types-pyyaml` as a dev dep. PyYAML itself reaches the backend **transitively**
(declared as a runtime dep only in some plugin pyprojects).

This is the inverse of a library-first problem (a library *is* used) but it is a
real hygiene gap: the backend's runtime correctness depends on an undeclared
package. If the transitive provider ever drops it, the backend breaks with an
`ImportError` that `make test` on a stale venv would not catch (see
lessons-learned "CI vs local environment drift").

**Recommendation:** add `pyyaml = "^6.0"` to `backend/pyproject.toml` runtime
deps and re-lock. Tracked as a follow-up.

---

## Bundle-size reality check

| Replacement | Direction | Estimate |
|---|---|---|
| `tiktoken` for `validation-cost.ts` | **+** | +1–2 MB (WASM) |
| `semver` for `version-check.ts` | **+** | +~15 kB, solves a non-problem |
| `fast-diff` for `AnswerDiff.tsx` | **+** | +~5 kB, different semantics |
| `react-activity-calendar` for `ActivityHeatmap.tsx` | **+** | +`date-fns` slice + lib, token re-bridge |
| `react-easy-crop` for `ImageCropDialog.tsx` | **−/0** | −~580 LOC, +~15 kB lib (canvas helper still needed) |
| `jsonrepair` for `extract-json.ts` | **−/0** | −~127 LOC, +~10 kB; paired Python change |

The only candidates that could be bundle-neutral-or-better are `react-easy-crop`
and `jsonrepair`, and both carry parity/restyling caveats. **Retroactive
replacement is not a bundle-size win.** The win is preventing the *next*
in-house utility when a proportionate library exists.

---

## Follow-ups

Created as separate issues (no code in the audit PR):

- **#747** (#-A) `content-validator.ts` — spike `zod` for the schema-shape layer
  only, keeping the quality minimums + content-repo parity. (PRUEFEN, low priority.)
- **#748** (#-B) `ImageCropDialog` — spike `react-easy-crop` (the strongest candidate).
- **#749** (#-C) `ActivityHeatmap` — evaluate `react-activity-calendar` vs token
  re-bridge cost (lean BEHALTEN).
- **#750** (#-D) `extract-json.ts` + `extract_json.py` — paired TS+Python evaluation of
  `jsonrepair`, preserving the cross-language behavioural contract.
- **#696** (F-1) Declare PyYAML in `backend/pyproject.toml` runtime deps.

All five follow-ups are filed. The umbrella audit (#694) is complete — its
deliverables (this doc + the VIBE-CODING / REUSABILITY policies + the
`.claude/rules/reusability.md` rule) shipped in #695; the candidates above are
tracked independently at the priority noted.

---

## Method notes

- LOC via `wc -l`; "already a dep?" via `frontend/package.json` /
  `backend/pyproject.toml`.
- Each in-house file was read in full before a verdict; verdicts cite the
  concrete reason (native API already used, domain-specificity, parity
  contract, or disproportionate dep), not a blanket preference.
- No numbers in this doc are load-bearing version pins; bundle sizes are
  order-of-magnitude estimates for triage, not measured figures.
