# Chat journal — 2026-05-25 — Phase 42 / BL-30

Single multi-hour session: closed Phase 42 (Git-Backed
Learning Repository) end-to-end. Started from the four
*Von Theorie zur Praxis* articles (Asterios Raptis, Medium)
shared at session start; ended with v1.26.0 tagged, pushed,
and the GitHub Release published.

## Eight commits shipped between `879dac1` (v1.25.1) and the
## release tag

| Step | Hash | Subject |
|---|---|---|
| Schema prerequisite | `ba0600f` | feat(models): add SessionNote.kind (note / meta_learning) for BL-30 |
| Plugin scaffold | `ddf4574` | feat(plugins): scaffold learning-repo plugin (Phase 42 / BL-30 commit 2) |
| Renderer | `e3251bb` | feat(learning-repo): renderer for 4 meta-files + topic stubs (BL-30 commit 3) |
| Routes + ZIP | `3c5f209` | feat(learning-repo): render + export-zip routes (BL-30 commit 4) |
| Optional git persistence | `a99153a` | feat(learning-repo): optional git persistence (BL-30 commit 5) |
| Frontend | `946ee92` | feat(learning-repo): frontend pages + Settings + Dashboard (BL-30 commit 6) |
| i18n + E2E | `f106d70` | feat(learning-repo): i18n catalogs + E2E smoke (BL-30 commit 7) |
| Release | `2461f91` | chore(release): bump version to v1.26.0 |

Tag `v1.26.0` published at
<https://github.com/astrapi69/adaptive-learner/releases/tag/v1.26.0>.

## Headline result

Article 3 of *Von Theorie zur Praxis* described a "learning
repository" pattern — versioned Markdown documentation of the
learning process, browsable with any git client. The
`learning-repo` plugin closes the loop: per-project
README / LEARNING_STATS / CHEATSHEET / ROADMAP files are
generated from existing DB state, downloadable as a ZIP, and
optionally committed to a real `git` repository under
`~/.local/share/adaptive_learner/repos/{project_id}/` with
semantic commit subjects (`Cycle N — U X/10, T Y/10`) and
`cycle-{N}-mastered` tags on the Article-1 § 8 exit
threshold.

Single source of truth for the exit-threshold logic in
`adaptive_learner_learning_repo/thresholds.py` — the
LEARNING_STATS.md table-pin and the git tagger consume the
same `meets_per_session_bar` / `latest_exit_threshold_cycle`
helpers.

## Side benefits

- **New generic `/api/plugin-settings/{plugin_name}`
  endpoint** (GET + PATCH) backstops the long-standing
  architecture-rule gap on UI-editable plugin settings.
  Until v1.26.0, every plugin's YAML was hand-edited only.
- **`SessionNote.kind` column** with `meta_learning` value
  is the canonical Article-3 "Meta-Learning Insight" slot.

## Test deltas

- Backend: 906 → 912 (+6 plugin-settings integration tests
  from commit 6).
- Plugin learning-repo: 0 → 52 tests
  (smoke + renderer + thresholds + git_writer).
- Vitest: 1470 → 1479 (+9 client + widget tests).
- E2E smoke: 16 → 17 spec files.
- Grand total: ~2965 → ~3061 tests green (+1 skipped).

## Decisions logged

- **Plugin name** `learning-repo` (not provisional).
- **Plugin version** 1.25.1 at create-time; `make
  sync-versions` bumped all 17 version-bearing files to
  1.26.0 in the release commit per established workflow
  (version bump is the LAST commit).
- **Subprocess `git`** (not dulwich) — matches the Pandoc /
  TTS external-tool pattern; missing binary surfaces as
  HTTP 502 via `ExternalServiceError("git", …)`.
- **`?language=` query param** defaulting to project
  owner's `User.language` (falls back to `"en"` on blank).
- **`POST /persist`** as a separate endpoint (not
  `?persist=true` on `/render`). Side-effects deserve their
  own verb.
- **ZIP filename** `{slug}-learning-repo.zip` — no
  timestamp; the file content carries `rendered_at`.
- **Topic folder triplet deferred**. Folders ship only the
  stub README in v1.26.0; `concepts.md` / `tasks.md` /
  `solutions.md` become a trigger-gated follow-up.
- **i18n**: ES / FR / EL / PT / TR / JA AI-translated,
  "pending native review" header comment (matches Phase 26
  PT/TR/JA approach). DE + EN native.

## Pitfalls + lessons applied along the way

- **Lazy `app.*` imports** in plugin source files matched
  the anki / notebooklm pattern — kept smoke tests
  loadable.
- **`LC_ALL=C`** forced on every `git` subprocess call
  after the German-locale "nichts zu committen" string
  bypassed the idempotency branch. Caught by the plugin
  test suite on first run.
- **Live `app.yaml` ≠ `app.yaml.example`** — the
  integration tests failed on first run because the
  gitignored live config still listed 10 plugins. Updated
  both in lockstep per the "gitignored-config drift" rule.
- **YAML labels resolution** had to use a relative path
  from `labels.py` to `backend/config/i18n/` (NOT
  `app.paths.get_config_dir()`, which is the user-runtime
  config dir, not the source-tree YAMLs).

## Post-release punch list completed

- ✅ Pushed `main` + tag `v1.26.0` to origin.
- ✅ Published GitHub Release with notes from
  `changelog/releases/v1.26.0.md`.
- ✅ Refreshed `CLAUDE.md` state line + test counts +
  plugin count (10 → 11) + plugin table row.
- ✅ Refreshed `docs/ROADMAP.md` state line + Phase 42 row +
  "Next phases (planned)" rewritten for Phase 43.
- ✅ Archived BL-30 from `docs/backlog.md` into
  `docs/roadmap-archive/2026-05.md`.
- ✅ This journal entry.

## Open follow-ups (no commitment yet)

- Per-topic-folder `concepts.md` / `tasks.md` /
  `solutions.md` (Article 3 "Drei-Datei-Prinzip").
- Method-experiment git branches (Article 3).
- GitHub-push automation for the `learning-repo` plugin.
- Native PT / TR / JA review of the new `repo.*` block in
  the i18n catalogs.

Phase 43 candidate not yet pulled from backlog — sets in
the v1.26.0 → v1.27.0 review.
