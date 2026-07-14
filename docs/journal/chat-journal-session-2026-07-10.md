# Chat journal — 2026-07-10

## Schema-authority migration, app side: Phase 0 + Phase 2 (#1516, #1517)

### Summary

App counterpart of the cross-repo migration "Schema-Autorität von der App in
die Engine verlegen" (decisions D1a/D2/D3a; the engine repo ran Phase 1 in
parallel). Two PRs, both squash-merged to `develop` after green CI:

- **#1518 (Phase 0, Closes #1516)** — safety net BEFORE the flip. A byte
  baseline freezes today's generated `lesson.schema.json` +
  `content-manifest.schema.json`
  (`backend/tests/fixtures/lesson-schema-baseline/schema.baseline.json`);
  `test_lesson_schema_baseline.py` regenerates the schemas in memory from the
  Pydantic models (via `generate_lesson_schema.build_artefacts`) and compares,
  normalised by stripping exactly the two allowed-to-change keys (`$id` +
  `x-schema-version`). Behaviour fixtures pin what the app validation accepts
  and rejects on BOTH sides (Python `dict_to_lesson`, TS ajv
  `validateLessonShape`) over a shared corpus in
  `tests/fixtures/lesson-schema-behavior/` — `valid/` (incl. one lesson
  exercising all 5 exercise types), `invalid/` (structural, rejected by both
  layers), `invalid-semantic/` (cross-field, rejected by Pydantic; the ajv
  structural check passes them by design, documenting the layer split).
- **#1519 (Phase 2, Closes #1517)** — the app becomes schema CONSUMER.
  Coordination check verified on the npm tarball: `learn-content-engine@0.6.0`
  carries the engine-own `$id`
  (`https://astrapi69.github.io/learn-content-engine/schema/...`),
  `x-schema-version` 1.5, content byte-identical modulo `$id`. Flip:
  `SCHEMA_ID_BASE` → engine URL + `make sync-schema` (only the `$id` line
  changed in each `schema/*.json`); engine pin bumped 0.4.0 → 0.6.0 at BOTH
  locations (`frontend/package.json` exact + `schema/engine-version.txt`;
  0.5.0 skipped = author ergonomics, no schema change per its release notes);
  `CURRENT_SCHEMA_VERSION` stays `"1.5"`. Framing reversed in
  docstrings/docs only (the three byte gates stayed byte-exact, untouched):
  engine canonical → app generates conforming artefacts (Pydantic as
  editorial + runtime tool) → content repos mirror the engine; the
  format-change procedure is documented in `authoring-content.md` (EN + DE).
- **RED proof:** a temporary Pydantic field on `Lesson` turned
  `test_lesson_schema_baseline` red, `make sync-schema-check` red, and (after
  regeneration) `check_engine_schema_parity.py` red ("the chain is open"),
  then was reverted — the forgotten engine-first step is visible, never
  silent drift.
- **`$id` alias finding (D2):** the old `$id` URL was never actually served —
  `deploy-gh-pages.yml` copies only `frontend/dist` + the MkDocs site, no
  `schema/` in `frontend/public/`, live check HTTP 404. Both `$id`s are
  nominal identifiers; no alias, no redirect built.
- **Gates:** backend pytest 1383 passed / 2 skipped, vitest 6768 passed / 655
  files, tsc clean, ruff clean, `scripts/verify_docs.py` 0 FAIL; byte parity
  against the 0.6.0 tarball verified offline (`ENGINE_TARBALL`) and against
  the registry; the push-triggered `engine-schema-parity` workflow on
  `develop` after the merge: success.

Format-change procedure from now on: a lesson-format change starts in the
engine (or is ratified there) — engine PR + npm release first, then the app
bumps the pin + re-runs `make sync-schema`, then the content repos re-pin.
