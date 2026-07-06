# Content-repo CI (historical reference — retired as deployment source)

**Retired as a sync source (mirror decoupling).** These files were the
source of truth for the **content** repository's CI and were deployed
from here to
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(committed there; the maintainer pushed). Since the mirror decoupling
the content repos **own their CI themselves** and take their schema
mirror from the
[`learn-content-engine`](https://github.com/astrapi69/learn-content-engine)
npm release, pinned in their `schema/engine-version.txt` — not from
this app. The app's only schema sync target is the engine (its
documented schema-sync procedure); the chain is closed on this side by
`scripts/check_engine_schema_parity.py`
(`.github/workflows/engine-schema-parity.yml`).

The copies below are kept as a **historical reference** of the
validation contract (and are still pinned runnable by
`backend/tests/test_content_ci_workflow.py`); do not deploy them
anywhere. The live versions are in the content repos.

```
.github/workflows/validate-content.yml   # PR + push-to-main gate
scripts/validate_content.py               # self-contained validator
```

`validate_content.py` is the **second of the two validation layers**
(Phase 60 / v1.44.0, D-108). The Adaptive Learner app runs the same
schema + language-pair + quality checks client-side before a
community share (`frontend/src/lib/content/content-validator.ts`);
the content-repo script re-checks every set on a content-repo pull
request so manual PRs can't bypass the app's gate.

It is deliberately self-contained (Python stdlib + PyYAML only) so
the content repo needs no install of the application. When the
shared rules change, update **both** layers (the TS validator and
the content repos' script) and keep their thresholds in sync.

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
