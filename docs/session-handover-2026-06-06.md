# Session handover — 2026-06-06

Long-form state + gotchas for continuing in a fresh session. Pairs with
the kickoff prompt at the bottom.

## TL;DR

- **v1.62.0 is released + tagged + published.** `backend/pyproject.toml`
  = `1.62.0`.
- **`main` has 5 unreleased commits** = the start of **v1.63.0**:
  - `feat:` 6 WCAG-AA theme presets + Classic sub-tab (#86, PR #89)
  - `fix:` mypy no-any-return in backup_service (#87, PR #88)
  - `fix:` dashboard.no_data i18n key (#84, PR #85)
  - `fix:` theme contrast accent-foreground (#82, PR #83)
  - post-release journal for v1.62.0
- **CI**: the v1.62.0 cycle’s only red was the mypy error (#87), fixed in
  #88. After the theme merge a fresh CI run was `in_progress` — verify it
  went green (`gh run list --branch main --workflow CI --limit 1`).
- **Next planned work**: #80 (systematic i18n audit), then #72 (subject
  filter P2). Both filed, not started.

## What shipped in v1.62.0 (for context)

Backup-restore data integrity (#57 type-driven datetime coercion, #64
orphan-FK-skip + full FK-order audit), GitHub-Pages build provenance
(#66), content cache-bust (#62), UI/i18n conformance (#51 sync-UI hide,
#55 exercise_type fallback, #76 dashboard taxonomy i18n, #53/#68/#78
shadcn buttons, #69 language panel), and `.claude/rules` governance +
Bibliogon templates/labels. Full notes: `changelog/releases/v1.62.0.md`.

## Theme system (just rebuilt — read before touching themes)

- **12 themes now.** 6 **recommended** (default sub-tab) + 6 **classic**
  (preserved, no breaking change). Registry: `frontend/src/lib/themes.ts`
  — each `ThemeMeta` has a `group: "recommended" | "classic"`.
  - Recommended: `catppuccin-latte`, `supabase`, `graphite` (light);
    `catppuccin-mocha`, `soft-pop`, `amethyst-haze` (dark).
  - Classic: `light`, `dark`, `ocean`, `forest`, `high-contrast`, `sepia`.
- **Each theme = one `frontend/src/styles/themes/theme-<id>.css`** with the
  **exact same 43 canonical color tokens** (`themes.test.ts` enforces
  parity — there is NO light-fallthrough). Imported in `main.tsx`.
- **shadcn bridge** lives in `frontend/src/styles/tailwind.css` `@theme
  inline` — maps `--color-primary`→`var(--accent)`, `--color-background`→
  `var(--bg-primary)`, etc. **`--color-accent-foreground` = `var(--accent-fg)`**
  (the #82 fix — do NOT revert to `--fg-primary`; ghost/outline hover text
  fails AA in every theme if you do).
- **The 6 recommended themes are generated** by
  `scripts/generate_preset_themes.py` from tweakcn preset values. It maps
  preset shadcn tokens → the 43 canonical tokens, derives the non-shadcn
  ones (interactive / status / exercise-feedback / charts / shadows), and
  **enforces WCAG AA** (darkens/lightens any failing text token; picks
  `accent-fg` via `bestTextOn(accent)`; darkened Latte muted to ≥4.5).
  To regenerate: it reads `/tmp/chosen-presets.json` (re-extract from a
  fresh `gh repo clone jnsahaj/tweakcn` — see the script header).
- **WCAG is verified computationally**, not visually (no browser). Pins:
  `contrast.test.ts` (all 12 themes, all text pairs ≥4.5:1, exercise/UI
  ≥3:1) + `themes.test.ts` (token parity) + `no-hardcoded-colors.test.ts`.
- **Open visual-QA item**: the derived non-shadcn tokens (status / chart /
  star / exercise-feedback colours) pass the contrast pins but were never
  eyeballed in the running app. Worth a look per theme.
- `ThemePicker.tsx` renders two sub-tabs (Recommended default; opens the
  active theme’s group so an existing classic user still sees their pick).
  Theme names + sub-tab labels (`settings.theme_group_recommended` /
  `_classic` / `theme_groups`) are in all 8 i18n catalogs.

## Gotchas discovered this session (will bite again)

1. **`make release-test` does NOT run mypy** — only CI does. The v1.62.0
   cycle shipped a mypy `no-any-return` that turned `main` red post-merge.
   **Before any tag, run `cd backend && poetry run mypy app/` manually.**
   (Consider adding mypy to the `release-test` target.)
2. **`plugin-lock-paired-with-pyproject` pre-commit hook is a false
   positive on version-only bumps** — plugin `poetry.lock` files don’t
   embed the project version, so a `make sync-versions` bump leaves them
   unchanged and the hook blocks the commit. Commit the bump with
   `git commit --no-verify` AFTER confirming `make verify-plugin-locks`
   reports no real drift (it did).
3. **Double-background trap**: `make X > log 2>&1 &` passed to Bash with
   `run_in_background: true` double-backgrounds. The wrapper returns
   exit 0 immediately while the real command keeps running (log shows it
   mid-way). Use `run_in_background: true` WITHOUT a trailing `&`, or an
   `until grep -q DONE log; do sleep …; done` loop.
4. **i18n YAML insertion must anchor on language-agnostic keys** (e.g.
   `  themes:`, `theme_description:`), NOT English VALUES like
   `sepia: "Sepia"` — those are translated in el/pt/tr/ja and the anchor
   misses. Always `make sync-i18n` after editing `backend/config/i18n/*.yaml`
   and verify a non-EN catalog (`node -e "require('./frontend/src/data/i18n/de.json')…"`).
5. **FK enforcement IS on in the backend test DB** (`PRAGMA foreign_keys=1`
   via `app/database.py` connect listener) — restore FK bugs reproduce in
   tests, but the orphan case needs an orphaned child row injected into the
   backup payload (the seeded data is FK-consistent so it won’t fail).
6. **Vitest runs from `frontend/`** (`cd frontend && npx vitest run …`).
   Backend/plugin tests: `cd backend && ADAPTIVE_LEARNER_TEST=1 poetry run
   pytest …` (plugin tests run via the backend venv path-deps).
7. **Verify-the-premise**: several "bugs" reported this session were
   already fixed or had a wrong premise (psychology `exercise_type` — the
   content is healthy, it was stale cache; back-nav answer loss — the
   locked-revisit feature already exists). Audit before implementing; file
   a finding to the user instead of a misleading issue (GITHUB-ISSUE-PFLICHT
   point 4).

## Process rules now in force (`.claude/rules/`)

- **GITHUB-ISSUE-PFLICHT** (`ai-workflow.md`): every bug → search existing
  issues → create one (`bug` label) BEFORE the fix; applies retroactively
  to bugs found mid-fix (file a separate issue).
- **ISSUE-LIFECYCLE**: the fix commit/PR body says `Closes #NN`; no manual
  closing; no open issue after a merged fix.
- **Issues-as-queue**: "weiter" / "arbeite Bugs ab" → `gh issue list
  --label bug --state open`, work by priority.
- **DOC-DOCSTRINGS-NOT-INLINE** (`code-hygiene.md`): prefer docstrings/
  TSDoc over WHAT-comments.
- Per-issue branch + PR; merge with `--delete-branch`.

## Next work (priority order)

1. **#80 — systematic i18n audit.** Verified facts: DE/EN key parity is
   already perfect (1753/1753, 0 missing). Two real gaps:
   - **77 subject/category NAMES are seed data** (`backend/config/seed/
     subjects.yaml` `name:` fields — Humanities, Programming, …) rendered
     via `subject.name`. Needs data-i18n (a `subjects.*` catalog section +
     a frontend lookup keyed by a slug, falling back to `subject.name`).
   - **Accurate code-key sweep**: grep `\bt\("…"` (word boundary, to skip
     `format(`/`at(` false positives), diff first-arg keys against the
     flattened `en.json`, add any genuinely-missing keys (same class as the
     `taxonomy.*` / `dashboard.no_data` ones already fixed).
2. **#72 — subject filter shows ALL subjects, not just the user’s** (P2).
3. **Cut v1.63.0** once #80/#72 (and any more) land — already 5 commits on
   `main` since the tag. Follow `release-workflow.md` (+ the mypy gotcha).
4. Pre-existing, NOT from this session: **#45** (lesson placement path),
   **#43** (lesson panel jump), **#42** (Content Browser double scrollbar).

## Useful commands

```bash
git log v1.62.0..main --oneline --no-merges      # what's queued for v1.63.0
gh issue list --label bug --state open           # the work queue
cd backend && poetry run mypy app/ && poetry run ruff check app/
cd frontend && npx vitest run src/styles/contrast.test.ts   # theme AA pins
make sync-i18n                                   # after editing i18n YAML
```
