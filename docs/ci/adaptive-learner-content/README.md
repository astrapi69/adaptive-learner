# Content-repo CI (app-side reference copy — retired as source of truth)

> **Ownership moved (mirror decoupling, #1393).** The
> [`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
> repository now **owns its CI**: an engine-pinned schema-mirror drift gate
> plus an engine-conformance gate that run against the
> [`learn-content-engine`](https://github.com/astrapi69/learn-content-engine)
> npm release pinned there — the content repo no longer reads this app
> repo. This directory is **no longer deployed anywhere**; it stays only as
> the app-side reference copy of the shared validator logic, so
> `scripts/validate_bundled_content.py` (the app's bundled-content check)
> has a comparable twin in-tree.
>
> Source-of-truth chain for the lesson format: **adaptive-learner Pydantic
> (`make sync-schema`) → learn-content-engine (documented schema-sync
> procedure, bundles the schema) → content repos (pinned mirror)**. The
> app-side gate closing the chain is
> `scripts/check_engine_schema_parity.py`.

```
.github/workflows/validate-content.yml   # reference copy of the content repo's structural gate
scripts/validate_content.py               # reference copy of the self-contained validator
```

`validate_content.py` is the **second of the two validation layers**
(Phase 60 / v1.44.0, D-108). The Adaptive Learner app runs the same
schema + language-pair + quality checks client-side before a
community share (`frontend/src/lib/content/content-validator.ts`);
the content repo re-checks every set on a pull request so manual PRs
can't bypass the app's gate.

It is deliberately self-contained (Python stdlib + PyYAML only) so
the content repo needs no install of the application. When the shared
rules change, the canonical copy to update is **in the content repo**;
refresh this reference copy afterwards so the TS validator comparison
stays honest.

## Optional book companion (EXP-025 / AUTH-01)

A content repo that accompanies a published book may declare an
**optional** `book` block at the root of `manifest.yaml` (one book per
repo). The block is additive — repos without it validate unchanged.

```yaml
book:
  title: "KI für Einsteiger"        # required
  author: "Asterios Raptis"         # required
  url: "https://example.com/book"   # required, http(s), DIRECT (no affiliate)
  # optional metadata the Content Browser surfaces:
  subtitle: "Eine praktische Einführung"
  edition: "2. Auflage"
  isbn: "978-3-16-148410-0"
  asin: "B0XXXXXXX"
  language: "de"
  pages: 320
  year: 2026
  description: "Begleitlektionen zum Buch."
  cover: "cover.png"
```

The validator rejects a missing required field, a non-http(s) url, an
affiliate link (house convention #141), and unknown fields. The app
shows a discreet "Zum Buch" link (`rel="noopener noreferrer"`, no
auto-redirect, no in-app purchase — decision E5).
