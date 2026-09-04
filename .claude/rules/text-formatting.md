# Text Formatting

Code formatting (ruff, Prettier, indentation) is `coding-standards.md`
§Formatting + `code-hygiene.md`. This file is about TEXT: prose,
documentation, i18n strings, commit messages, PR/issue bodies. Any place
words are written for this project, not just code comments.

## Universal rules (everywhere text is written)

- **No em-dash** (`--` or Unicode U+2014). Use a hyphen (`-`), a comma, or
  restructure the sentence. Applies in code comments, documentation,
  i18n strings, commit messages, and PR/issue bodies alike - not only
  inside code.
- **Real UTF-8 characters**, no ASCII-transliteration substitutes. Most
  visible for German (ä/ö/ü/ß, never ae/oe/ue/ss) - the umlaut-specific
  tooling and gate (`verify-i18n-scripts`) live in
  `lessons/docs-i18n.md` "German prose"; this rule is the general form
  for every language.
- **No emojis**, anywhere text is written for this project (code, docs,
  commit messages, PR/issue bodies), unless the user explicitly asks for
  them in that specific context.

## Documentation / prose (`.md` files)

- Heading hierarchy: `#` title, `##` sections, `###` subsections - never
  skip a level.
- Bullets use `-`, not `*`.
- File paths, commands, identifiers, and code go in backticks.
- Reference issues/PRs as `#NNN`, not a bare URL, when the number alone
  reads fine.
- Bold is for genuinely load-bearing terms (a PFLICHT-style keyword, one
  key term per paragraph) - not whole sentences, not decoration.
- A new or grown rule section respects the corpus ceiling - see
  `quality-checks.md` "The rule corpus has a ceiling".

## Commit messages / PR descriptions

- Type/scope/format (Conventional Commits, one commit per logical
  change) is `coding-standards.md` §Git; this section only adds
  prose-formatting on top of that contract.
- No em-dash, no emojis - see Universal rules above; a commit message or
  PR body is text too, not exempt because it isn't a code comment.
- The body explains WHY, not WHAT - the diff already shows what changed.

## What this does NOT cover

- Code formatting itself (ruff/Prettier/indentation) - `code-hygiene.md`.
- Umlaut/transliteration detection tooling - `lessons/docs-i18n.md`.
- Commit type/scope conventions, branch naming - `coding-standards.md` §Git.
- PR-PFLICHT / GITHUB-ISSUE-PFLICHT / TESTPLAN-PFLICHT process rules -
  `ai-workflow/*.md`.
