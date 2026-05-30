# Content-repo CI (mirror)

These files are the source of truth for the **content** repository's
CI, kept here so the validation contract lives alongside the app
that produces and consumes the content. They are deployed to the
separate [`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
repository (committed there; the maintainer pushes).

```
.github/workflows/validate-content.yml   # PR + push-to-main gate
scripts/validate_content.py               # self-contained validator
```

`validate_content.py` is the **second of the two validation layers**
(Phase 60 / v1.44.0, D-108). The Adaptive Learner app runs the same
schema + language-pair + quality checks client-side before a
community share (`frontend/src/lib/content/content-validator.ts`);
this script re-checks every set on a content-repo pull request so
manual PRs can't bypass the app's gate.

It is deliberately self-contained (Python stdlib + PyYAML only) so
the content repo needs no install of the application. When the
shared rules change, update **both** layers (the TS validator and
this script) and keep their thresholds in sync.
