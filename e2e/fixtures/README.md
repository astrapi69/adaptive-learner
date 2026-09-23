# E2E fixtures

Binary/text fixtures consumed by the Playwright smoke specs.
Keep this directory small; reviewers need to understand each
byte on disk.

## minimal-book.bgb

Minimum valid AdaptiveLearner backup archive: one book with one
chapter, no assets. Used by `smoke/import-wizard-bgb.spec.ts`.

Regenerate with:

```bash
python3 e2e/fixtures/regen_minimal_bgb.py
```

The generator script is committed alongside so the fixture is
reproducible without a AdaptiveLearner backend running.

## explanation-post-answer.lesson.json

Reference lesson for the post-answer `explanation` field (engine schema
1.13, #2991): one theory step, one multiple_choice exercise WITH an
authored Markdown explanation (rule, word-by-word gloss, examples,
typical mistake), one WITHOUT. Hand-written, Spanish A1 for German
speakers. Served through a page.route-mocked content repo by
`dexie/exercise-explanation.spec.ts` and the feature screenshot
`exercise-explanation/falsche-antwort`.

## matching-long-word.lesson.json

Reference lesson for a matching tile whose word is wider than the tile
(#3174): the "Sprachebenen zuordnen" pairs of alc-psychology lesson 32
(`sets/de/psych-intro/lessons/32-kognition-vertieft.json`), the content the
bug was reported from. The right tile "kleinste bedeutungsunterscheidende
Lauteinheit" carries a 25-character word that overflows a 375px tile
unless it hyphenates or wraps. One theory step, one matching exercise,
domain `psychology` (German on both sides). Served through a
page.route-mocked content repo by the feature screenshots
`matching-animation/matching-long-word` and
`matching-animation/matching-long-word-resolved`.
