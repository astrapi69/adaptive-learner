# i18n translation quality check (#1296)

DE is the source of truth, EN the key reference (both maintainer-verified);
EL is verified by hand. The other eight catalogs (`es, fr, hi, id, ja, ko,
pt, tr`) are machine-translated and partly wrong — e.g. fr/es with stripped
diacritics (`s'adapte a toi` instead of `à`). The mechanical gates
(`test_i18n_parity` / `_structure` / `_translation_audit`) cannot judge
*content*; this tooling adds an LLM content review plus a CSV review export.

The YAML catalogs stay the single source of truth — **nothing here ever
rewrites them.** The pass only produces a report + a per-key provenance cache.

## Tools

| Command | What it does |
|---|---|
| `make i18n-quality-check-dry ARGS="--langs ja"` | Coverage/cache stats, **no API calls** (works without a key). |
| `make i18n-quality-check` | Two-tier LLM review of the 8 target catalogs (needs an Anthropic key). |
| `make i18n-csv-export ARGS="--flagged-only"` | Per-language review CSV for native reviewers. |

Pass script flags via `ARGS="..."` (e.g. `--langs ja fr`, `--limit 50`,
`--force`, `--model-tier1`, `--model-tier2`).

## Two-tier review

Tier 1 (default `claude-sonnet-4-6`) reviews every reviewable key against the
DE source. Keys it flags as a hard problem (`wrong` / `untranslated` /
`placeholder_mismatch` / `needs_recheck`) or `high` severity are re-checked by
tier 2 (default `claude-opus-4-8`); the tier-2 verdict wins. Verdict vocabulary:
`ok`, `minor` (not flagged) and `wrong`, `untranslated`, `missing_diacritics`,
`placeholder_mismatch`, `needs_recheck` (flagged).

## Provenance + incremental re-runs

Each checked key is cached in `docs/review/i18n-status/<lang>.json` keyed by
the dotted key, storing a **hash of the DE source value** at check time. On a
re-run a key is skipped when its DE source is unchanged and it already has a
verdict; if the DE source changed, the key is re-checked (drift detection).
The status cache is committed (it records what was checked); the report
(`docs/review/i18n-quality/`) and CSVs (`docs/review/i18n-csv/`) are generated
artifacts and gitignored.

## Key resolution

The pass runs locally where the key lives: env
`ADAPTIVE_LEARNER_ANTHROPIC_API_KEY`, else
`~/.config/adaptive_learner/secrets.yaml` (`ai.anthropic`). It reuses the
ai-anthropic plugin's `complete()` and the catalog helpers from
`scripts/export_i18n_review.py`.

## Review loop

1. `make i18n-quality-check` → report + status cache.
2. `make i18n-csv-export ARGS="--flagged-only"` → hand the per-language CSV to
   a native reviewer (German source, current translation, LLM verdict +
   suggestion, empty `correction` column).
3. Reviewer fills `correction`. Re-importing those corrections into the YAML
   is a planned follow-up (`scripts/import_i18n_csv.py`, surgical value-only
   replacement + `make sync-i18n`).

Pure helpers are unit-tested (LLM mocked) in
`backend/tests/test_i18n_quality_check.py` and
`backend/tests/test_export_i18n_csv.py`.
