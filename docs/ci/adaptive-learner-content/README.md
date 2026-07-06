# Content-repo CI (retired mirror)

This directory used to carry a copy of the
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
repository's CI (validation workflow + self-contained validator), with the
app as its declared source of truth.

**Retired with the mirror decoupling (#1394).** The content repos own their
CI themselves and no longer depend on this app repo:

- Their structural schema mirror comes from **learn-content-engine**, pinned
  to its npm release (`schema/engine-version.txt` over there) — see the
  source-of-truth chain: adaptive-learner Pydantic → engine → content-repo
  mirror.
- Their validator (`scripts/validate_content.py`) and workflows live and
  evolve in the content repos directly
  ([adaptive-learner-content](https://github.com/astrapi69/adaptive-learner-content/tree/main/scripts),
  [adaptive-learner-content-test](https://github.com/astrapi69/adaptive-learner-content-test/tree/main/scripts)).
- The app side keeps the chain closed via the app-vs-engine parity test
  (`frontend/src/lib/content/validation/engine-schema-parity.test.ts`):
  the generated `schema/*.json` must be byte-identical to the schemas
  bundled by the pinned engine release.

The copies that used to live here had already drifted from the content
repo's actual CI (pre-EXP-039 validator) — a mirror without a drift gate
rots; the engine pin + parity test replace it with checked guarantees.
