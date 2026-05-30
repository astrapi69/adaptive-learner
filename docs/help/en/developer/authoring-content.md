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

The pilot sets that ship with Adaptive Learner live at
`docs/explorations/sample-content/` and are good templates to copy.

## Language pairs (v1.44.0)

Every content set declares the language PAIR it teaches:

- **`target_language`** — what the learner is LEARNING (e.g. `fr`).
- **`source_language`** — what the learner ALREADY SPEAKS, i.e. the
  language the card **`back`** fields, **`notes`**, and **theory**
  text are written in (e.g. `de`).

This is what makes "French for English speakers" a *different* set
from "French for German speakers": same target (`fr`), different
source (`en` vs `de`), different explanation language. A learner
only sees sets whose `source_language` matches a language they
speak (their app language, plus any extras opted into in
Settings → Learning).

Set ids encode the pair as `{target}-{level}-from-{source}`
(e.g. `fr-a1-from-de`), and each set declares a **`path`** pointing
at its source-language directory (`sets/de/fr-a1`). A set also
carries **`title`** (in the source language, what the learner reads)
and **`title_native`** (in the target language, shown as a
secondary label).

Both codes must be 2-letter ISO 639-1, and `source_language` must
differ from `target_language`. Pre-v1.2 sets without these fields
still load: the old `language` key is accepted as `target_language`
and `source_language` defaults to `en`.

## File-system layout

The tree is organised by SOURCE language, then target+level:

```
my-content-repo/
  manifest.yaml               # root: lists every set (with path + pair)
  sets/
    de/                       # source language: German
      fr-a1/                  # target French, level A1  -> id fr-a1-from-de
        manifest.yaml         # set: lists the lessons
        lessons/
          01-begruessung.json
          ...
        assets/               # optional images / audio
    en/                       # source language: English
      fr-a1/                  # -> id fr-a1-from-en
        ...
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

## Exercise direction (v1.46.0 / EXP-018)

Every exercise accepts an optional `direction` field that says
which way the learner drills the card:

- `target_to_source` (default) — RECEPTIVE: the learner is shown
  the target language and recognises the source language (easier).
- `source_to_target` — PRODUCTIVE: the learner is shown the source
  language and produces the target (harder).
- `both` / `random` — let the renderer / adaptive generator pick a
  concrete direction per attempt.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

The field is additive — the schema stays at version 1.2 and
lessons without `direction` behave exactly as before (receptive).
The SRS tracks mastery per direction, so a card mastered
receptively is not yet mastered productively. Cloze exercises are
in-context and ignore `direction`. For a difficulty progression,
keep early lessons receptive and introduce `source_to_target` in
later lessons (the bundled pilot content does exactly this).

### Annotations that help the adaptive lesson generator (v1.36.0+)

The Phase 53 adaptive lesson generator
(`/adaptive-lesson/:setId`, F-114) recombines authored
exercises to drill the learner's specific weaknesses. The
generator works without any extra annotations, but two
fields make it materially smarter:

1. **Broader `token_roles` coverage on cards.** The generator
   uses `token_roles` to:
   - Pick semantically-meaningful blanks when generating
     cloze variants from errors (covered already in v1.35.0)
   - Classify errors as `article_gender` / `verb_conjugation`
     for the Dashboard "Focus areas" chips (53E)
   - Find ALTERNATIVE exercises that test the same element
     when the user got the original wrong (53D variation
     logic — finds candidates whose card has a matching
     `token_roles` entry)

   Add a `token_roles` entry to EVERY card that teaches a
   discrete grammatical unit — articles, conjugated verb
   forms, gendered nouns. The cost is one extra JSON entry
   per card; the payoff is much richer adaptive generation.

2. **Card-level grammar tags (`tags: ["article", "masculine"]`,
   etc.)** are read by the error classifier as a fallback
   when `token_roles` is absent. They don't replace
   `token_roles` — they're a low-effort halfway annotation.

What we DON'T need yet (deferred to a future schema bump):

- `related_cards` cross-references between cards in different
  lessons
- Per-exercise difficulty ratings (the generator estimates
  difficulty from `exercise.type` today)
- Per-card example sentences in `notes` parseable as
  alternative cloze contexts (the cloze generator uses
  `front` only)

When in doubt: add `token_roles` to every card teaching a
grammatical token. That's the single highest-leverage
authoring habit for the adaptive system.

## Assets (images bundled with a set) — v1.37.0+

Picture-choice exercises and card cover images come from
either:
1. **Authored asset files**, declared in the set-level
   manifest and shipped alongside the lesson JSON
2. **Placeholder SVGs**, generated by the runtime when no
   asset exists (color swatches for color labels, large
   numerals for digits, avatar-style for everything else)

If you publish a set without any assets, picture-choice
still works — the placeholder SVG generator handles colors
+ numbers automatically, and falls back to a deterministic
avatar for everything else.

### Directory layout

Inside a set's directory, assets live under `assets/`:

```
sets/
  language-fr-a1/
    manifest.yaml
    lessons/
      01-greetings.json
      02-numbers.json
      ...
    assets/
      img/
        chat.png
        chien.png
        oiseau.png
```

### Manifest declaration

Each asset must be declared in the set-level `manifest.yaml`
so the downloader knows what to fetch:

```yaml
sets:
  - id: language-fr-a1
    title: French A1
    language: fr
    level: A1
    version: '1.0.0'
    lesson_count: 10
    assets:
      - path: img/chat.png
        size_kb: 45
      - path: img/chien.png
        size_kb: 38
```

The `path` is relative to the set's `assets/` directory
(NOT to the lesson JSON). Inside lesson JSON, picture-choice
exercises reference assets WITH the `assets/` prefix:

```json
{
  "type": "picture_choice",
  "prompt": "Which one is 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Cat", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Dog"}
  ]
}
```

The frontend strips the `assets/` prefix automatically when
calling the asset resolver, so the lesson JSON keeps the
intuitive form authors expect.

### Size + format limits

- **Per-asset cap**: 500 KiB. The manifest validator rejects
  assets whose declared `size_kb` exceeds this. The
  downloader also rejects assets whose actual byte length
  exceeds the declared `size_kb` by more than 10% — keeps
  the manifest honest.
- **Per-set soft cap**: 10 MiB total assets. The validator
  warns but doesn't reject.
- **Accepted formats**: `.png` / `.jpg` / `.jpeg` / `.webp`
  / `.svg`. No GIF (animated content is a distraction) and
  no BMP (no compression). For photos, prefer WebP — much
  smaller than PNG at comparable quality. For icons +
  diagrams, prefer SVG — scales cleanly + tiny file size.

### Sizing recommendations

Picture-choice tiles render at max 150x150 px on desktop,
100x100 px on mobile (`object-fit: contain`). Source images
of 300x300 px give the best result on retina screens
without bloat. PNGs above 150 KiB rarely look better than a
properly-compressed WebP at half the size.

### Skip authored images — let the runtime placeholder cover it

Three lesson types where the runtime placeholder is good
enough that authored images add no learning value:

- **Colour lessons** (`rouge` / `rojo` / `rot` / `red`):
  the placeholder generator produces a solid hex swatch
  keyed to the colour name. Authored swatches are
  redundant.
- **Number lessons** (`7` / `42` / `1492`): the placeholder
  renders the digits large + centred. Authored images
  would only matter for non-Arabic numeral systems.
- **Abstract concepts** without an obvious visual
  representation (`patience`, `liberté`): the avatar
  placeholder gives a clean visual anchor without forcing
  a contested icon choice.

For everything else (animals, objects, food, places, body
parts), authored images materially help recognition + recall.

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
- [ ] **Language pair**: `target_language` + `source_language` set (ISO 639-1, different), `title_native` present

## Validation (two layers, v1.44.0)

Content is gated by two validation layers that run the SAME checks:

1. **In-app, before sharing.** When a learner shares a lesson via
   *My Lessons → Share with Community*, a rule-based check runs
   first (always, no AI needed). It enforces the **minimums** below;
   a set under any of them cannot be shared. If it passes AND an AI
   key is configured, the learner can OPT IN to a supplementary AI
   review (translation accuracy, distractor plausibility, grammar,
   level fit, cultural sensitivity, naturalness). The AI step is
   never automatic, requires explicit consent (lesson content is
   sent to the configured provider), and never blocks sharing — the
   rule-based pass is the gate.
2. **In the content repo's CI.** A pull request to
   `astrapi69/adaptive-learner-content` runs `scripts/validate_content.py`
   (mirrored in `docs/ci/adaptive-learner-content/`), which re-checks
   every set with the same rules so a manual PR can't bypass the gate.

**Quality minimums (hard gate):** ≥ 5 exercises per lesson, ≥ 2
exercise types, ≥ 1 theory step, free-text ≥ 2 accepted answers +
distractors, matching ≥ 3 pairs, picture-choice distractors, no
empty card front/back, and (for non-Latin source scripts) card
backs in the source script. These are minimums, not targets — the
checklist above asks for more.

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

---

## Community contribution pathway (v1.42.0)

You don't have to hand-author lessons from scratch. The fastest
way to contribute is to **create a lesson in the app and share
it**:

1. Import a chat and analyse it, then **Save as Offline Lesson**
   (or finish an adaptive lesson and **Save this lesson?**). The
   lesson appears under **My Lessons** in the Set Browser.
2. From My Lessons, click **Export as set** to download a
   content-set `.zip` (manifest + lessons). Exports contain only
   the lesson content — no progress, no error history, nothing
   personal.
3. Click **Share with Community** to open a pre-filled GitHub
   issue on the content repo. Attach the exported `.zip`.
4. A maintainer reviews the lesson, tidies the manifest (id,
   title, language, level, tags) to match the conventions above,
   and adds it under `sets/`. Once merged, everyone can download
   it from the Set Browser.

This is the social path: review is **manual** (a maintainer
curates every addition — nothing is auto-published), and the
whole flow needs only GitHub. Generated lessons already validate
against the schema, so a contributed lesson usually needs only
manifest polish before it ships.
