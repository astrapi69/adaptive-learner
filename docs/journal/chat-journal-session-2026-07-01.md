# Chat journal — 2026-07-01

## 1. LLM quality-check for the last 5 machine-translated catalogs (#1313)

- Goal: continue the i18n LLM-quality track (handover
  `session-handover-i18n-llm-2026-06-30.md`) — run the remaining five
  languages (id, ja, ko, tr, el) through the two-tier pass, completing all
  eight non-reference catalogs (es/fr/hi/pt shipped in v1.98.0).
- Run: `make i18n-quality-check ARGS="--langs id ja ko tr el"` in the
  background (`b1plxnub0`), ~2 h sequential (Sonnet reviews all 2776 keys/lang,
  Opus rechecks flagged). Anthropic key from `~/.config/adaptive_learner/
  secrets.yaml`. Exit 0.
- Verdicts (clean vs flagged): id 2743/33, ja 2759/17, ko 2757/19,
  tr 2712/64, el 2756/20 = 153 flags total.
- Estimated cost ~$8 for the run (Sonnet output at $15/1M is the driver;
  the script logs no usage — verified model IDs + pricing via the claude-api
  reference: sonnet-4-6 $3/$15, opus-4-8 $5/$25).

## 2. Diacritics auto-apply (commit 1)

- `make i18n-import-corrections --verdict missing_diacritics` (guard on):
  applied 10 accent-only fixes (tr 9, el 1 `Έτοιμο`). The Latin/Greek
  combining-block guard (`is_diacritics_only`, NFD, case-preserving) skipped
  the 15 non-accent "diacritics" (case/punct) to review. id/ja/ko: zero
  (Latin-none / CJK / Hangul).
- Commit `7a36949`.

## 3. Full mistranslation apply (commit 2, per user "mach alles fertig")

- Audited a sample of the `wrong` suggestions first: all carried specific
  reasoned notes (credits/financial->contributors, taught->learned,
  deductive->productive, missing `Sechs-Methoden-Modell` in every tagline) —
  objective mistranslation fixes, not the risky register class.
- Applied `wrong` + `untranslated` + the case/punct `missing_diacritics`
  remainder with `--no-diacritics-only` across all 5: 130 corrections
  (id 30, ja 14, ko 19, tr 48, el 19). Guard bypassed because these are
  content fixes.
- **`needs_recheck` (6: id 3, ja 3) deliberately excluded** — Opus did not
  converge, so applying its output would be unsafe; left flagged for review.
- Caches pruned of applied keys so the next quality-check re-verifies them
  against the unchanged DE-hash. Commit `33f47d0`.
- 140 of 153 flags addressed; ~13 (6 needs_recheck + no-change/path skips)
  remain flagged.

## 4. Gates + PR

- `make sync-i18n` regenerated all 5 frontend JSON both times.
- Backend i18n group (parity/structure/translation_audit/no_bool_values):
  139 passed. Frontend `i18n-sync.test.ts`: 17 passed.
- Branch `fix/i18n-quality-id-ja-ko-tr-el` -> PR #1314 (Closes #1313,
  Refs #1296). `gh pr edit` hit the Projects-classic GraphQL bug; updated
  title/body via the REST fallback (`gh api -X PATCH`).

## Summary

- Commits: 3 (2 i18n + this journal). Files: 5 YAML + 5 JSON catalogs, 5
  provenance caches. 140 translation corrections across id/ja/ko/tr/el.
- The German source of truth is untouched — only target-language values
  changed, each from a flagged machine translation to the LLM's reasoned fix.
- Remaining: register nuances (formal->informal) as future native-speaker
  polish (review CSVs preserve the flag set); Hindi native review is #754;
  6 `needs_recheck` items left for review.
