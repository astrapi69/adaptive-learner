---
# globs/alwaysApply below document INTENT only - Claude Code loads every rule
# file regardless and strips this frontmatter (verified 2026-07-28, see #2089).
description: Documentation + i18n pitfalls - docs as specification, discoverability, versionless help, umlauts, time claims
globs:
  - docs/**/*
  - backend/config/i18n/**/*
  - **/*.md
alwaysApply: false
---

# Documentation + i18n pitfalls
## Doc files: existence is not discoverability

When you add a new help page under `docs/help/{lang}/`, verify it appears in `docs/help/_meta.yaml`. The MkDocs nav generator (`scripts/generate_mkdocs_nav.py`) reads that file as the single source of truth; pages not listed there are unreachable from the side nav even though direct URLs and in-text links still work. We hit this with `ai.md` and `developers/plugins.md` - both had been merged for several releases but never showed up in the in-app help panel or the public docs site nav.

Rule: file existence is not user discoverability. After creating a new help page, the same commit (or a paired one) must add the entry to `_meta.yaml` with a sensible icon and the appropriate placement among siblings.

## Doc values: read from code, not from memory

Any specific number, threshold, default value, dropdown range, or feature flag mentioned in the docs MUST come from the code or config that defines it (`backend/config/app.yaml`, `backend/config/i18n/*.yaml`, the schema, the source of the relevant function), not from memory or approximation.

If a value isn't easily findable in code, that is a signal to flag the question, not to guess. Wrong defaults in user docs erode trust faster than missing docs do.

Example: trash auto-delete default came from `backend/config/app.yaml.example` (`trash_auto_delete_days: 90`); the configurable range came from the `trash_days_*` keys in `backend/config/i18n/*.yaml`. Both are single sources of truth that the docs cite without duplicating.

This file is not exempt from its own rule. The #1903 issue text claimed `backend/tests/test_plugin_lock_drift_hook.py` "pins the hook with 6 self-checks" — quoted from THIS file, never checked against the tree. The file had been removed by the skeleton strip (`76baa114`) long before. A rule file ages exactly like any other doc: when it names a path, a count, or a gate, verify the artifact still exists before repeating the claim downstream. `git log --all -- <path>` answers it in one command.

## End-user help is versionless; provenance belongs to the changelog

Surfaced across #1766 (index pages) and #1767 (the whole help tree) — a recurrence class, not a one-off. End-user help under `docs/help/**` had drifted into ~1000 `since vX.Y` / `New in vX.Y` / `(Phase N / vX.Y)` feature-provenance markers across 8 locales, each frozen at a different release and drifting per-locale (tr/el stalled at v1.20-era wording). To a user on the current version, "since v1.35.0" is noise at best and implies a recency/optionality that is long gone.

### Rule

User help describes the CURRENT behaviour in present tense. Release provenance (what shipped when) belongs to `changelog/releases/` and the per-locale `changelog.md` "What's new" page — never to the feature prose. Rewrite "since vX the editor is TipTap" to "the editor is TipTap".

No `vX.Y[.Z]` literal in end-user help prose. Gated hard by `check_help_prose_versions` in `scripts/verify_docs.py`, which scans `docs/help/*/**` and FAILs on any v-version literal. It skips the `developer/` + `api/` reference trees (contributor/integrator docs that legitimately cite schema + hook versions), `changelog.md` (version-based by definition), and `index.md` (its own `check_help_index_versions` gate, #1766).

A genuine exception carries an inline marker. `<!-- version-exempt: <reason> -->` on the same line, mirroring the design-token `token-exempt:` precedent. Reach for it only when a version literal carries real current meaning (a format/schema contract) — a stale pin like "schema v1.3+; current is v1.4" is NOT that; reword it or link to the authoritative reference instead.

While touching a provenance line, verify the surrounding claim against current behaviour (docs are specification). The #1767 sweep found the es/el/pt/tr/ja/fr lessons pages still calling the library "the v1.27.0 pilot set — French A1, 2 lessons" long after it grew to hundreds; the rewrite dropped both the version and the stale count rather than pinning a new number that would drift again.

Pairs with "Doc values: read from code, not from memory" — a version marker is the degenerate case: the value that is ALWAYS wrong to hardcode in present-tense help.

## Docs are specification, not a wish list

If a feature is in the help, it must exist in the code. Feature audits after every large docs addition are mandatory.

Features that are not yet implemented but are described in the docs must be marked with `> Planned for a future version`. Do not promise what isn't there.

Build an audit table with the current state, run a gap analysis in A/B/C categories, then implement. No blind coding.

## Help system: single source of truth

Help content lives in `docs/help/`, not in plugin code. Both the in-app Help plugin and MkDocs read the same Markdown files.

- `docs/help/_meta.yaml` is the single source of truth for navigation. `scripts/generate_mkdocs_nav.py` converts it into the MkDocs format.
- Markdown rendering on the frontend via `react-markdown` with `remark-gfm` + `rehype-slug` + `rehype-autolink-headings`. Never `dangerouslySetInnerHTML` for user content.
- MkDocs dependencies live in `docs/pyproject.toml` (its own venv), not in the backend venv. `make docs-install` / `docs-build` / `docs-serve` from the root.
- Context-sensitive help via `<HelpLink slug="export/epub"/>` - opens the HelpPanel directly on the relevant page.

## German content uses real umlauts

Production German content uses proper UTF-8 umlauts (ä, ö, ü, ß), NOT ASCII transliterations (ae, oe, ue, ss).

### Where this applies (real umlauts required)

- i18n catalogs (`backend/config/i18n/de.yaml`).
- User documentation (`docs/help/de/**/*.md`).
- Plugin German content (under any `*/content/de/`).
- README German sections (currently none; English-only).
- CHANGELOG German entries (rare; quoted UI strings only).
- Journal entries written in German prose.
- Any other user-facing German text.

### Where ASCII stays

- Source code (`*.py`, `*.ts`, `*.tsx`, `*.js`, `*.jsx`).
- Code comments, docstrings (English convention).
- Variable / function / class / identifier names.
- File names, directory names.
- Git branch names, commit messages.
- This chat with the user (per the user's style preference, ASCII-only in chat communication).

The chat-style rule and the production-content rule are deliberately different. Production text is authored for end readers; the chat is a working channel.

### Tooling (#1755, since 2026-07-17)

`scripts/verify_i18n_scripts.py` is the AUTOMATED gate for this class (the earlier interactive `find_umlaut_candidates.py` / `replace_umlauts.py` / `build_in_scope_list.py` / `discover_unknown_umlauts.py` workflow has been removed):

- **Stage 1 (de):** flags substitute-spelling forms in `backend/config/i18n/de.yaml` via a curated whole-word list (`DE_SUBSTITUTE_WORDS`). Legitimate digraph words (Quelle, Dauer, aktuell) are not listed and can never fire; "musst" is correct post-reform German and must never be added. Extend the list when a new degraded form slips through — never loosen it into a bare digraph scan.
- **Stage 2 (el/hi):** flags latin TRANSLITERATION (the severest class — functionally a missing translation) when a value's letters are mostly latin in the Greek/Devanagari catalog, after stripping `{placeholders}` and allowlisted technical/brand tokens (`LATIN_ALLOWED_TOKENS` + `KEY_ALLOWLIST_PATTERNS` for theme names etc.). False positives go into the allowlists, not into a weaker threshold.

Runs via `make verify-i18n-scripts` and the `i18n-script-sanity` pre-commit hook (scoped to the de/el/hi catalogs, so it also runs in the CI pre-commit job). Hard gate, no baseline.

NOT covered by design: missing accents in otherwise-correct-script es/fr/pt/tr values — not machine-detectable without a dictionary; the LLM quality pass (`make i18n-quality-check`, #1296) is the tool for that.

German PROSE outside the catalogs (docs/help/de, journal, README German sections) is not gated; review it manually when authoring.

### Why this matters

ASCII transliteration looks unprofessional to German readers and can confuse the Learning Repository Markdown renderer when the surrounding text uses proper umlauts (mixed encodings in the same file is the worst case — same paragraph, two styles, output reads as broken to native speakers).

### Known regression pattern

Mixed-encoding files (BOTH real umlauts AND ASCII transliterations in the same paragraph) are not tooling regressions but author-style drift: typing in an environment without a German IME, then copy-pasting UTF-8 text from elsewhere. There is no heading / code-fence / section boundary to predict it. The class recurred at scale twice (#1753: the whole #1743 i18n surface degraded in 7 of 11 catalogs incl. el/hi latin transliteration; #1758: the v1.86.0 ai_check block, found by the first #1755 lint run). Mitigation: the `i18n-script-sanity` pre-commit hook now gates the de/el/hi CATALOGS automatically (see Tooling above); German prose in docs stays a manual-review surface.

## User-facing time estimates must scale with input size or be omitted

Surfaced 2026-05-14 from a manual smoke test of v0.31.0.

The Medium-import upload UI shipped with the message "Verarbeitung auf dem Server … das kann bis zu einer Minute dauern." (and direct translations in all 7 other catalogs). The "up to one minute" claim is false for large archives — a 500MB Medium export takes substantially longer than 60s on the same hardware that handles a 50MB archive in under 10s. User sees no progress feedback past the minute mark and assumes AdaptiveLearner has crashed.

### Wrong

"X seconds" / "X minutes" / "up to N minutes" claims in user-facing strings for any operation whose cost scales with input size: uploads, imports, exports, bulk operations, AI batch calls.

### Right

- Omit the time bound, OR
- Frame the dependency: "Larger archives may take longer." / "Bei großen Archiven kann das länger dauern." / etc.

For operations with truly bounded cost (sub-second SQL bulk DELETE, single-record fetch), no time language is needed.

A user-facing string with a hard time bound is a promise to the user. Promising "≤ 1 minute" creates a "false-crash" impression for any input that breaks the promise. The cost of the bound is the trust the user loses; the value is near zero because they would have waited regardless.

This pairs with the existing rule Bulk-operation limits should be per-operation cost-profile. Same principle — cost depends on input — applied to text rather than caps.

Audit checkpoint: at release time, grep i18n catalogs for hard time bounds:

```bash
grep -rniE "minute|sekund|second|dakika|分" \
  backend/config/i18n/*.yaml | grep -iE "dauer|takes|tardar|prendre|demor|sürebilir|かかります"
```

False-positives: config-field labels (e.g. "Timeout (Sekunden)") and ordinal markers (e.g. "First session"). True positives: any wait-time claim a user reads while waiting.
