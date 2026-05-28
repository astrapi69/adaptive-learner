# Authoring lesson content

This guide walks through creating a new lesson set for the
Adaptive Learner content-loader. Anyone who wants to ship a
language or topic set — for personal use, or as a contribution
to the public content pool — should read this end-to-end before
writing any lessons.

## What a content set is

A **content set** is a versioned bundle of lessons that a user
can download from the Set Browser page (`/content`). The
Content-Loader plugin (shipped in v1.27.0) handles discovery,
download, caching, and version reconciliation in both storage
modes.

A set has three layers:

1. **Root manifest** (`manifest.yaml`) — lists every set the
   repo ships. Used by the Set Browser to render the source
   catalogue.
2. **Set manifest** (`sets/{set-id}/manifest.yaml`) — sister to
   the root manifest, lists the lesson files inside this
   specific set.
3. **Lesson files** (`sets/{set-id}/lessons/NN-slug.json`) —
   one JSON file per lesson, validated against schema v1.0
   on every download.

The two pilot sets that ship with Adaptive Learner (FR A1 + ES
A1) live at `docs/explorations/sample-content/{fr,es}-a1/` and
are good templates to copy.

## File-system layout

```
my-content-repo/
  manifest.yaml               # root: lists every set
  sets/
    language-en-b1/           # one directory per set
      manifest.yaml           # set: lists the lessons
      lessons/
        01-intro.json
        02-articles.json
        ...
      assets/
        img/                  # optional images for picture-choice
        audio/                # optional TTS recordings
```

## Manifest format

Both manifest files (root + set) use the same `schema_version:
'1.0'` shape. Required fields:

```yaml
schema_version: '1.0'
name: My English B1 set
description: >-
  Optional long-form description.
sets:
  - id: language-en-b1        # slug-safe, unique
    title: English B1 (Intermediate)
    language: en              # BCP-47 (e.g. en, fr, zh-Hans)
    level: B1                 # CEFR for languages, free-form otherwise
    version: '1.0.0'          # semver — bumped per set release
    lesson_count: 12
    domain: language          # 'language' / 'math' / 'programming' / ...
    description: >-
      Optional set-level description.
    tags:
      - intermediate
      - business
metadata:
  author: Your Name
  license: CC-BY-SA-4.0       # or whatever
```

The set manifest additionally lists every lesson file:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

The Content-Loader walks `metadata.lessons` in order; the file
order in the directory doesn't matter, only the manifest order.

## Lesson schema (v1.0)

Each lesson is a single JSON file. Top-level shape:

```json
{
  "id": "01-greetings",
  "title": "Greetings",
  "description": "Optional 1-2 sentence summary.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Cards

A card is the smallest learnable unit — typically a single term
or concept. Each card has a stable id (referenced from exercises)
and a front/back pair:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "the (masculine singular)",
  "notes": "Used before consonant-starting masculine nouns. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

Notes support Markdown. Use them for pronunciation tips,
false-friend warnings, irregular-form alerts — anything that
helps long-term retention. Tags drive SRS filtering.

### Steps

A lesson is a sequence of steps, each one either THEORY (a
Markdown block) or EXERCISE (one of the four exercise types):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Why articles matter",
  "body": "# Articles in French\n\nEvery French noun has a gender..."
}
```

Or an exercise:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Match greetings",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Match each greeting to its translation.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hello"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Exercise type reference

### matching

Drag-pair exercise. The renderer shuffles before display.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Match each French noun with its article.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Each pair must have exactly two keys: `left` + `right`.

### picture_choice

Multiple-choice with images. ≥ 2 images, exactly one marked
correct.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Which is the evening greeting?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optional Markdown hint shown on demand.",
  "distractors": ["Bonjour"]
}
```

Note: `is_correct` is a **string** `"true"`, not a JSON boolean.

If `src` points at an asset that doesn't exist, the renderer
falls back to the `label` text — picture-choice exercises are
still functional even without illustration assets.

### free_text

Type the answer. The renderer does exact-match first, then a
Levenshtein-tolerant fallback.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "How do you say 'Thank you' in French?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "It starts with M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` is the canonical answer shown after a wrong attempt.
Include ≥ 3 variants to cover case and punctuation; the
renderer normalises whitespace.

### word_tiles

Arrange tiles in order. The renderer shuffles before display.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Arrange: I see a cat.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Same word order as English."
}
```

If multiple word orders are correct, add `accept_orderings`:

```json
{
  "tiles": ["Je", "vois", "un", "chat"],
  "accept_orderings": [
    [0, 1, 2, 3],
    [0, 1, 3, 2]
  ]
}
```

Each ordering is a permutation of the tile indices.

### cloze (Phase 52 / v1.35.0 — schema 1.1)

Fill-in-the-blank with visible `___` markers in the sentence.
Each `___` corresponds to one entry in `blanks[]` (left-to-right
mapping; the loader enforces `sentence.count("___") ==
len(blanks)`).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Fill in the indefinite article.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "masculine indefinite article",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* is the masculine indefinite article."
}
```

**Render modes** — set per exercise via `cloze_mode`:

- `"type"` (default when omitted): an `<input>` per blank.
  Validated with the same NFC + Levenshtein-≤-1 matcher
  free-text uses, so authors only need to enumerate semantic
  variants (not typos).
- `"select"`: a `<select>` per blank. Options drawn from
  `accept[0]` + the exercise's `distractors`, shuffled per
  blank by a stable seed. **Requires non-empty `distractors`**
  — the schema validator rejects `cloze_mode: "select"`
  exercises without them.

**Multi-blank cloze** is supported: every `___` in the sentence
maps to the next entry in `blanks`, in order. Each blank can
have its own hint + placeholder + accept list. Element-level
SRS fans out one ElementAttempt per blank, so a learner who
fluently fills blank A but consistently misses blank B gets
per-blank mastery tracking.

**Token-roles on cards (Phase 52I / v1.35.0)** — optional
metadata on Card that lets the runtime cloze generator (review
sessions + the lesson-end correction round) target a
semantically-meaningful blank:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "a cat",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Closed enum of roles: `article` / `verb` / `noun` / `adjective`
/ `preposition` / `gender_marker` / `tense_marker`. Adding a
role is a minor schema_version bump — don't extend in place.

## Quality checklist

Before opening a PR for a new lesson, verify:

- [ ] **3-5 theory steps** + **8-12 exercises** per lesson
- [ ] **At least 3 exercise types** represented (matching, picture-choice, free-text, word-tiles, or cloze — cloze ships in v1.35.0+)
- [ ] **Theory steps ≤ 200 words** each
- [ ] **Free-text exercises**: ≥ 3 accept variants + ≥ 3 distractors
- [ ] **Word-tiles**: ≥ 3 tiles per exercise
- [ ] **estimated_minutes**: 10-15 (realistic, not aspirational)
- [ ] **Distractors are wrong-but-plausible** — semantically related, never random
- [ ] **Card notes** carry real value (pronunciation, false-friend, exception flag)
- [ ] **Progressive structure**: later concepts build on earlier ones in the same set
- [ ] **Cultural accuracy**: real-world usage, not textbook-only phrases
- [ ] **Schema validation**: the lesson loads cleanly via `dict_to_lesson()` (see Local testing)
- [ ] **Card-id integrity**: every `exercise.card_ids[i]` exists in the lesson's `cards[]`

## Local testing

The Content-Loader's schema validator runs as part of `make
test`. To validate a single lesson by hand:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = 'docs/explorations/sample-content/fr-a1/sets/language-fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} cards, {len(lesson.steps)} steps')
"
```

To validate every lesson in the pilot tree at once:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run pytest tests/test_pilot_content.py -v
```

This parametrized test discovers every JSON file under
`docs/explorations/sample-content/*/sets/*/lessons/` and
validates each against the schema. Adding a new lesson picks up
automatically — no test edit needed.

## PR workflow

Once your set is ready:

1. Open a PR against the main adaptive-learner repo (for sets
   that should ship with the app), OR
2. Create your own content repo under your GitHub account and
   point the Content-Loader at it from
   `backend/config/plugins/content-loader.yaml` (under
   `default_sources`).

The Content-Loader supports any public GitHub repo as a source.
Private repos require a personal access token configured via the
three-layer key chain (`~/.config/adaptive_learner/secrets.yaml`).

## Common pitfalls

**Card-id references**: every `card_ids` entry in an exercise
must exist in the lesson's `cards[]`. If you copy an exercise
between lessons and forget to copy the card, validation fails.

**Slug-safe ids**: all ids (lesson, card, step, exercise) must
match `^[a-z0-9]+(-[a-z0-9]+)*$`. No underscores, no apostrophes,
no uppercase letters, no leading/trailing hyphens.

**`is_correct: "true"`**: it's a string, not a JSON boolean.
The schema specifically requires `"true"` because the picture-
choice fields are all dict[str, str] under the hood.

**Extra fields**: every model has `extra="forbid"`. Adding a
field the schema doesn't know about will reject the whole
lesson. Stick to the documented fields.

**Theory body**: theory steps require a non-empty `body` field
(Markdown). Exercise steps must not carry `body` — use the
exercise's `prompt` instead.

## Reference: the pilot sets

The two sets shipped with Adaptive Learner are the canonical
references:

- `docs/explorations/sample-content/fr-a1/` — French A1
  (10 lessons, ~2 hours total)
- `docs/explorations/sample-content/es-a1/` — Spanish A1
  (5 lessons, ~70 minutes total)

Both follow the conventions described in this guide. Reading
one full lesson end-to-end before authoring your own is the
fastest way to internalise the structure.
