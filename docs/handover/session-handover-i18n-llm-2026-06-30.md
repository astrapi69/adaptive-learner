# Session handover — i18n multilingual LLM quality review (2026-06-30)

Context for continuing the multilingual translation-quality work. The strategy
shifted mid-session from *mechanical fixes* to an **LLM content-check + native
review** pipeline. Most mechanical work shipped in **v1.98.0** (tagged +
published 2026-06-30 16:52); the LLM pipeline + tooling also shipped.

## 1. The strategy (current)

YAML catalogs in `backend/config/i18n/{lang}.yaml` are the **single source of
truth** (mirrored to `frontend/src/data/i18n/{lang}.json` via `make sync-i18n`;
backend serves `/api/i18n/{lang}` via pluginforge `load_i18n`). 11 languages:
de, en (references), + es, fr, el, hi, id, ja, ko, pt, tr (machine-translated
long tail). **DE is the source of truth** (verified informal/du; en is the
technical key reference).

Three layers, all in `make`:
1. **`make i18n-quality-check ARGS="--langs X"`** — two-tier LLM pass (Sonnet
   reviews all; Opus re-checks flagged; Opus verdict wins). Verdicts:
   `ok`/`minor` (clean) vs `wrong`/`untranslated`/`missing_diacritics`/
   `placeholder_mismatch`/`needs_recheck` (flagged). Writes a report +
   `findings.json` + a **DE-hash provenance cache** (`docs/review/i18n-status/
   <lang>.json`, committed). Re-runs are incremental; a changed DE source
   auto-re-checks. **Needs an Anthropic key** (env `ADAPTIVE_LEARNER_ANTHROPIC_API_KEY`
   or `~/.config/adaptive_learner/secrets.yaml`). `--dry-run` needs no key.
   Full run per lang ≈ 2776 keys, ~30 min, real $ on the user's key.
2. **`make i18n-csv-export ARGS="--langs X --flagged-only"`** — per-language CSV
   (`key, de, <lang>, llm_verdict, …, correction`) for native reviewers; the
   `correction` column is empty for them to fill. CSVs are **gitignored**
   (`docs/review/i18n-csv/`, local only).
3. **`make i18n-import-corrections ARGS="--langs X --source cache --verdict missing_diacritics"`**
   — surgical write-back (ruamel round-trip: quote/format preserving, a no-op
   load+dump is byte-identical; NO `yaml.safe_dump` noise). Sources: `cache`
   (LLM `suggestion`, verdict-filtered) or `csv` (reviewed `correction` column).

## 2. The diacritics guard — READ THIS BEFORE APPLYING ANYTHING

`scripts/import_i18n_corrections.py` auto-applies a correction **only** when it
differs from the current value by **accents alone**. Two hard-won rules
(`is_diacritics_only` / `strip_accents`, pinned by
`backend/tests/test_import_i18n_corrections.py`):

- **NFD, not NFKD** — NFKD folds compatibility chars (`…`→`...`, `ﬁ`→`fi`,
  NBSP→space), which would let typography changes slip through.
- **Latin-only (U+0300–U+036F), case-preserving** — only the Latin combining
  block is stripped. **Indic/CJK scripts: NOTHING auto-applies** — a Devanagari
  matra change is a *different vowel/word*, not a cosmetic accent (the litmus
  case: `languages.es` स्पेनिश→स्पैनिश = spenish→spainish). Case changes
  (`errores`→`Errores`) and the Spanish `¿` are NOT diacritics → skipped →
  native review.

After applying from cache, the importer **prunes** the applied keys from the
provenance cache so the next quality-check re-verifies them (the cache keys on
the DE hash, which a target fix doesn't change).

## 3. Per-language status

| Lang | LLM pass | flagged | diacritics auto-applied | remaining → native review |
|------|----------|---------|--------------------------|----------------------------|
| es | ✅ | 61 | ✅ app-wide (incl. 124 mechanical + 26 LLM) | 20 wrong, 2 untranslated, case/¿ skips |
| fr | ✅ | 115 | ✅ app-wide (incl. 127 mechanical + 67 LLM) | 31 wrong, case/punct skips |
| hi | ✅ | 32 | **0** (Devanagari → all to review) | 27 wrong (register aap→tum) + 5 non-cosmetic "diacritics" |
| pt | ✅ | 48 | ✅ 20 | 17 wrong + PT-PT/PT-BR vs tu/você register |
| id, ja, ko, el, tr | ❌ not run | — | — | — |

Mechanical pre-LLM work (shipped v1.98.0): es/fr accents app-wide, fr `Sûr`/
`Terminé` + tu/vous register, es `¿`/question-words, ja stray-space fixes,
`common.yes/no` YAML-boolean bug (en/hi/id/ko), `discover.filter.yes/no` dedup.

## 4. Next steps

1. **Run the remaining 5 languages** through the LLM pass (cost/time on the
   user's key): `make i18n-quality-check ARGS="--langs id ja ko el tr"` (or one
   at a time). Pick order by native-speaker count if desired: id (~43M native /
   ~200M total), ja (~125M), ko (~80M), tr (~80M), el (~13M).
2. For each: `make i18n-csv-export ARGS="--langs X --flagged-only"`, then apply
   the **Latin** diacritics subset (id/tr are Latin → safe; **ja/ko are not →
   nothing auto-applies**, all to review), commit the pruned cache.
3. **Native review** of the flagged CSVs is the human deliverable — register
   (formal→informal: hi aap→tum, id Anda→kamu, ko haseyo→informal, el
   eseis→esy, tr siz→sen), mistranslations, and the **pt PT-PT/PT-BR product
   decision** (reviewer recommended PT-BR; needs the architect's call). Hindi
   native review is tracked in **#754**.

## 5. Gotchas

- **Long runs in the background** (~30 min). One Anthropic key → run languages
  **sequentially**, not in parallel (rate limits).
- **Pre-commit stash conflict**: committing i18n files while unrelated doc files
  are unstaged can abort the commit ("Stashed changes conflicted with hook
  auto-fixes"). Fix: `git stash push -- <unrelated files>`, commit, `git stash pop`.
- **`ruamel` lives in the backend venv** — run the importer via
  `cd backend && poetry run python ../scripts/import_i18n_corrections.py …`
  (the Makefile target already does this). System `python3` lacks ruamel.
- **The `subjects.algebra` / `lesson.resume.*` traps**: whole-file accent
  scripts must not touch KEYS — `algebra` is a subject key, `resume` is an
  English key. The committed importer is key-safe; ad-hoc scripts must guard.
- **Gates**: `make sync-i18n` after any catalog edit; the i18n test group
  (`test_i18n_parity/structure/translation_audit`, frontend `i18n-sync.test.ts`)
  must stay green. `test_no_bool_values_anywhere` guards the YAML-boolean class.

## 6. Loose ends from this session

- **Uncommitted doc edits (the user's, intentionally not committed by the
  assistant):** `CLAUDE.md` + `README.md` — series name corrected to the English
  **"From Theory to Practice: The Series"** (was the German *Von Theorie zur
  Praxis*). `README.md` also has a separate **unstaged content-stats refresh**
  (432→460 lessons / 26→31 sets). German files (`README-de.md`,
  `docs/adaptive-learner-project-reference.md` German prose) correctly keep the
  German title; historical journals/ROADMAP left as-is. The user wants to commit
  these themselves; re-stage as needed (the assistant's stash/pop reset README
  staging, content preserved).
- **Closed this session:** #1279 (docs sweep — was done in #1280, only `Refs`),
  #1287 (es/fr/pt accents + fr tu/vous + pt register), #1296 (i18n tooling),
  #1284/#1286/#1292.
- **Open i18n:** #754 (Hindi native review). The cross-language register +
  mistranslation CSVs are the ongoing native-review track (not a single issue).

## 7. Key files

- Scripts: `scripts/{i18n_quality_check,export_i18n_csv,import_i18n_corrections,export_i18n_review}.py`
- Tests: `backend/tests/test_{i18n_quality_check,export_i18n_csv,import_i18n_corrections,i18n_parity,i18n_structure,i18n_translation_audit}.py`
- Provenance caches (committed): `docs/review/i18n-status/{es,fr,hi,pt}.json`
- Review CSVs (gitignored, local): `docs/review/i18n-csv/{lang}.csv`
- Docs: `docs/development/i18n-quality-check.md`
