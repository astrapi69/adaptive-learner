# Pilot content for `astrapi69/adaptive-learner-content`

This directory mirrors the layout of the canonical content
repo so you can copy it 1:1 when creating the public repo
(D-105 in `docs/explorations/BACKLOG.md`).

## Files

```
sample-content/fr-a1/
├── manifest.yaml                          # repo-level (lists every set)
└── sets/
    └── language-fr-a1/
        ├── manifest.yaml                  # set-level (lists every lesson)
        └── lessons/
            ├── 01-greetings.json
            └── 02-numbers.json
```

## Layout convention

- **Repo manifest** at the repo root catalogues every set the
  repo ships. The Content-Loader fetches it first
  (`astrapi69/adaptive-learner-content/main/manifest.yaml`)
  to populate the Set Browser.
- **Set manifest** at `sets/{set_id}/manifest.yaml` declares
  the lesson file list under `metadata.lessons` so the
  loader knows which files to fetch on download.
- **Lesson files** at `sets/{set_id}/lessons/{filename}.json`
  carry the actual content per the lesson schema v1.0
  (see [`plugins/adaptive-learner-plugin-content-loader/`](../../../../plugins/adaptive-learner-plugin-content-loader/)).

## How to publish

1. Create the public repo `astrapi69/adaptive-learner-content`
   (D-105 — manual step).
2. Copy this whole directory tree to the repo root, keeping
   the same paths.
3. Commit + push to `main`. The Content-Loader's default
   source (`backend/config/plugins/content-loader.yaml`)
   already points at `astrapi69/adaptive-learner-content @
   main`, so the Set Browser will pick the set up on the
   next refresh.

## Schema validation

The lesson JSON files validate against
`Lesson.model_json_schema()` from the plugin
(`adaptive_learner_content_loader.schema`). The content repo
can ship a GitHub Actions workflow that runs the schema
validation on every PR — this is a separate task
(Phase 44+) and not required for the v1.27.0 ship.

## Pilot scope (D-106)

Two lessons covering:

1. **Greetings** — Bonjour / Bonsoir / Salut / Merci / Au revoir.
   4 cards, 3 theory steps, 4 exercises. Mix of matching,
   picture-choice, free-text, and word-tiles.
2. **Numbers (1-10)** — un / deux / trois / quatre / cinq /
   six / sept / huit / neuf / dix. 10 cards, 2 theory
   steps, 5 exercises.

Together: 14 cards, 5 theory steps, 9 exercises. Roughly 20
minutes of total content. Enough to demonstrate every
exercise type and let the user verify the storage / cache /
viewer round-trip end to end once Phase 44 ships.
