# Authoring lesson content

This guide describes, step by step, how to set up a new lesson set
for the Adaptive Learner content loader. Anyone who wants to build
a language or topic set — for their own use or as a contribution
to the public content pool — should read it through once before
the first lesson.

## What is a content set?

A **content set** is a versioned bundle of lessons that a user can
download via the set browser page (`/content`). The content-loader
plugin (v1.27.0) handles discovery, download, caching and version
reconciliation in both storage modes.

A set has three levels:

1. **Root manifest** (`manifest.yaml`) — lists every set in the
   repo. Read by the set browser for the source catalog.
2. **Set manifest** (`sets/{set-id}/manifest.yaml`) — sibling of
   the root manifest, lists the lesson files of the specific set.
3. **Lesson files** (`sets/{set-id}/lessons/NN-slug.json`) — one
   JSON file per lesson, validated against the lesson schema on
   every download (see *The schema is the single source of truth*
   below).

The sets shipped with Adaptive Learner live in the separate
content repo [`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
(checked out as a sibling checkout `../adaptive-learner-content` and
bundled offline into the GitHub Pages build via
`frontend/scripts/copy-bundled-content.mjs`) and serve well as a
template. The current size of the library (lesson / set / domain
counts, the per-set table, and the active domains) is the
CONTENT-STATS block in the project [`README.md`](https://github.com/astrapi69/adaptive-learner#readme) —
that block is the single source of truth, generated from a fresh
content checkout, so this guide does not duplicate the numbers.

## The schema is the single source of truth (EXP-039)

The lesson/exercise format has **one authoritative definition**: the
Pydantic models in the content-loader plugin
(`adaptive_learner_content_loader.schema`). Every other artefact is
**generated** from them via `make sync-schema`, so the places that
used to drift can no longer:

- `schema/lesson.schema.json` (+ siblings) — the machine-readable
  JSON Schema (Draft 2020-12). Reference it from a lesson `.json`
  via a top-level `"$schema"` key to get IDE autocomplete and
  inline validation.
- `schema/quality-rules.json` — the shared quality minimums (e.g.
  exercise counts, free-text accept counts), consumed by the
  client-side content validator instead of a second hand-kept copy.
- The frontend TypeScript lesson types and the
  [Lesson format reference](lesson-format-reference.md) MkDocs page
  are generated too — **do not hand-edit them**; edit the models and
  re-run the generator.

A drift gate (`make sync-schema-check`, part of `release-test`,
plus `backend/tests/test_lesson_schema_drift.py` in `make test`)
fails if any generated artefact diverges from the models. The
content repo mirrors `schema/lesson.schema.json` +
`schema/quality-rules.json` (the app is the source) and validates
structure against them in its own CI.

## Language pairs (v1.44.0)

Every content set declares the language PAIR it teaches:

- **`target_language`** — what the learner LEARNS (e.g. `fr`).
- **`source_language`** — what the learner already SPEAKS, i.e.
  the language in which the card **`back`** fields, **`notes`** and
  the **theory** text are written (e.g. `de`).

This is exactly what makes "French for English speakers" a
*different* set from "French for German speakers": same target
(`fr`), different source language (`en` vs. `de`), different
explanation language. A learner only sees sets whose
`source_language` matches a language they speak (app language plus
optional additional languages in Settings → Learning).

Set IDs encode the pair as `{target}-{level}-from-{source}`
(e.g. `fr-a1-from-de`), and every set declares a **`path`** that
points to its source-language directory (`sets/de/fr-a1`). A set
also carries **`title`** (in the source language, what the learner
reads) and **`title_native`** (in the target language, as a
secondary title).

Both codes must be ISO 639-1 (two letters), and `source_language`
must differ from `target_language`. Sets before v1.2 without these
fields still load: the old `language` key is accepted as
`target_language`, and `source_language` falls back to `en`.

## Directory layout

The tree is organized by SOURCE LANGUAGE, then target+level:

```
my-content-repo/
  manifest.yaml               # Root: lists every set (with path + pair)
  sets/
    de/                       # Source language: German
      fr-a1/                  # Target French, level A1  -> ID fr-a1-from-de
        manifest.yaml         # Set: lists the lessons
        lessons/
          01-begruessung.json
          ...
        assets/               # optional images / audio
    en/                       # Source language: English
      fr-a1/                  # -> ID fr-a1-from-en
        ...
```

### Search index (`search-index.json`)

Content discovery and search (the *Discover* surface) is driven by
a lean `search-index.json` published at the repo root (~4 KB,
metadata only — no card content). The official content repo
provides it, and the app fetches the indices of every configured
repo client-side (CORS-safe, cached in localStorage with a 24 h
stale-while-revalidate TTL) so a learner can FIND a set before
downloading it. Each entry advertises the set's `id`, `name`,
`description`, `source_language` / `target_language`, `level`,
`domain`, `lesson_count`, `card_count`, `tags`, an `ai_validated`
flag, a `trust_level`, an optional companion `book`, and an
`updated_at` timestamp. Keep it in sync with the set manifests; a
PR to the official repo regenerates it.

## Manifest format

Both manifest files (root + set) use the same shape with
`schema_version: '1.0'`. Required fields:

```yaml
schema_version: '1.0'
name: Mein Englisch-B1-Set
description: >-
  Optionale Langbeschreibung.
sets:
  - id: language-en-b1        # slug-sicher, eindeutig
    title: Englisch B1 (Fortgeschrittene)
    language: en              # BCP-47 (z.B. en, fr, zh-Hans)
    level: B1                 # CEFR für Sprachen, frei für andere Domänen
    version: '1.0.0'          # Semver — pro Set-Release erhöht
    lesson_count: 12
    domain: language          # active domains: ai / language / programming / psychology / technology
    description: >-
      Optionale Set-Beschreibung.
    tags:
      - intermediate
      - business
metadata:
  author: Dein Name
  license: CC-BY-SA-4.0       # oder die Lizenz deiner Wahl
```

The set manifest additionally lists every lesson file:

```yaml
metadata:
  lessons:
    - 01-intro.json
    - 02-articles.json
    - ...
```

The content loader iterates `metadata.lessons` in the given order;
the file names on disk are irrelevant — only the manifest order
counts.

## Lesson schema (v1.0)

Each lesson is a single JSON file. Top-level structure:

```json
{
  "id": "01-greetings",
  "title": "Begrüßungen",
  "description": "Optionale 1-2-Satz-Zusammenfassung.",
  "estimated_minutes": 12,
  "cards": [ ... ],
  "steps": [ ... ]
}
```

### Cards

A card is the smallest learnable unit — typically a single term or
concept. Every card has a stable id (referenced from exercises)
and a front/back pair:

```json
{
  "id": "art-le",
  "front": "le",
  "back": "der (männlich Singular)",
  "notes": "Vor konsonantenanfangenden männlichen Substantiven. **le chat**, **le livre**.",
  "tags": ["article", "definite"]
}
```

`notes` accepts Markdown. Use it for pronunciation rules,
false-friend warnings, exception hints — anything that improves
long-term retention. `tags` drive the SRS filtering.

### Steps

A lesson is a step-by-step sequence, each step either THEORY (a
Markdown block) or EXERCISE (one of the four exercise types):

```json
{
  "id": "intro",
  "type": "theory",
  "title": "Warum Artikel wichtig sind",
  "body": "# Artikel im Französischen\n\nJedes französische Nomen hat ein Geschlecht..."
}
```

A theory step can optionally carry an **example link** (schema
v1.4, additive — existing lessons stay valid without it). If
present, the viewer renders a button below it to open the example:

```json
{
  "id": "intro",
  "type": "theory",
  "body": "Die Korrelation misst den Zusammenhang...",
  "example_url": "https://example.com/correlation-visualizer",
  "example_label": "Interaktive Visualisierung"
}
```

- `example_url` (optional): must be an `http(s)` URL.
- `example_label` (optional): the link text; empty becomes a
  localized "View example".

Or an exercise:

```json
{
  "id": "ex-match-greetings",
  "type": "exercise",
  "title": "Begrüßungen zuordnen",
  "exercise": {
    "id": "ex-match-greetings",
    "type": "matching",
    "prompt": "Ordne jede Begrüßung ihrer Übersetzung zu.",
    "card_ids": ["bonjour", "salut"],
    "pairs": [
      {"left": "Bonjour", "right": "Hallo"},
      {"left": "Salut", "right": "Hi"}
    ]
  }
}
```

## Which exercise type for which learning goal

Pick the exercise type by the **learning goal**, not by variety. Word-by-word
exact-match grading — a whole-sentence `word_tiles`, or a full-sentence
`free_text` — fails for **free production**: a concept can be phrased many
correct ways, so a content-correct learner gets marked wrong word by word. That
is the most demotivating moment an authored lesson can produce. Match the type
to the goal instead:

| Learning goal | Right type |
|---|---|
| A fact with one answer | `cloze` (a blank) |
| Recognise a concept | multiple choice (`cloze` in `select` mode) / `matching` |
| Define a concept | `cloze` with key-term blanks |
| Free explanation / transfer / comparison | no exact-match type yet — use `cloze` / multiple choice for now; self-assessment is planned |
| Sentence with one unambiguous word order (language learning) | `word_tiles` |

Rule of thumb: reserve `word_tiles` for sentences whose word order is genuinely
unique (a translation drill), and author definitions and facts as `cloze` (or
multiple choice via `cloze` `select` mode). Never put a free-form definition
into `word_tiles` or full-sentence `free_text` — there is no fair exact-match
grading for it. Full analysis: see EXP-041
(`docs/explorations/EXP-041-aufgabentyp-eignung-und-faire-bewertung.md`).

## Exercise type reference

### matching

Drag-pair exercise. The renderer shuffles before display.

```json
{
  "id": "ex-id",
  "type": "matching",
  "prompt": "Ordne jedem französischen Nomen seinen Artikel zu.",
  "card_ids": ["noun-1", "noun-2"],
  "pairs": [
    {"left": "chat", "right": "le"},
    {"left": "chaise", "right": "la"}
  ]
}
```

Each pair must have exactly two keys: `left` + `right`.

### picture_choice

Multiple choice with images. ≥ 2 images, exactly one marked
correct.

```json
{
  "id": "ex-id",
  "type": "picture_choice",
  "prompt": "Welche Begrüßung passt zum Abend?",
  "card_ids": ["card-1"],
  "images": [
    {"src": "assets/img/morning.png", "label": "Bonjour"},
    {"src": "assets/img/evening.png", "label": "Bonsoir", "is_correct": "true"}
  ],
  "hint": "Optionaler Markdown-Tipp auf Knopfdruck.",
  "distractors": ["Bonjour"]
}
```

Important: `is_correct` is a **string** `"true"`, not a JSON
boolean.

If the `src` path points to a non-existent file, the renderer
falls back to the `label` — so picture_choice also works without
illustration assets.

### free_text

Type the answer. The renderer matches exactly first, then
Levenshtein-tolerant.

```json
{
  "id": "ex-id",
  "type": "free_text",
  "prompt": "Wie sagt man 'Danke' auf Französisch?",
  "card_ids": ["card-merci"],
  "accept": ["Merci", "merci", "MERCI"],
  "hint": "Beginnt mit M.",
  "distractors": ["Bonjour", "Salut"]
}
```

`accept[0]` is the canonical answer shown after a wrong attempt.
List ≥ 3 variants to cover case + punctuation; whitespace is
normalized by the renderer.

### word_tiles

Put the tiles in the correct order. The renderer shuffles before
display.

```json
{
  "id": "ex-id",
  "type": "word_tiles",
  "prompt": "Bring die Kacheln in die Reihenfolge: Ich sehe eine Katze.",
  "card_ids": ["card-1"],
  "tiles": ["Je", "vois", "un", "chat"],
  "hint": "Gleiche Wortreihenfolge wie im Deutschen."
}
```

If several word orderings are correct, add `accept_orderings`:

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

Fill-in-the-blank with visible `___` markers in the sentence. Each
`___` corresponds to an entry in `blanks[]` (mapped left to right;
the loader checks `sentence.count("___") == len(blanks)`).

```json
{
  "id": "ex-id",
  "type": "cloze",
  "prompt": "Setze den unbestimmten Artikel ein.",
  "card_ids": ["art-un", "noun-chat"],
  "sentence": "Je vois ___ chat dans le jardin.",
  "blanks": [
    {
      "accept": ["un"],
      "hint": "männlicher unbestimmter Artikel",
      "placeholder": "?"
    }
  ],
  "cloze_mode": "type",
  "distractors": ["le", "la", "les"],
  "hint": "*un* ist der männliche unbestimmte Artikel."
}
```

**Render modes** — set per exercise via `cloze_mode`:

- `"type"` (default when not set): one `<input>` per blank.
  Validated with the same NFC + Levenshtein-≤-1 matcher as
  free-text, so authors only need to list semantic variants (no
  typos).
- `"select"`: one `<select>` per blank. Options from `accept[0]` +
  the exercise's `distractors`, shuffled per blank with a stable
  seed. **Requires non-empty `distractors`** — the schema
  validator rejects `cloze_mode: "select"` without them.
- `"multiselect"` (#1195): a "select all that apply" question. No
  `___` markers and no `blanks` — the `sentence` is the question
  stem, rendered above a checkbox group. Reuses `accept` and
  `distractors` with a mode-specific meaning: **every** `accept`
  entry is a correct option (not just `accept[0]`), and
  `distractors` are the wrong options. Graded by **exact-set**
  match — the learner must check every correct option and no
  distractor. **Requires** non-empty `accept`, non-empty
  `distractors`, and the two lists must be **disjoint** (the same
  option may not be both correct and a distractor).

**Multiple choice is authored this way** — there is no separate
`multiple_choice` exercise type (by design, see EXP-036 §4.3). A
single-answer multiple-choice question is a one-blank cloze in
`select` mode: the `sentence` (ending in `___`) is the question, the
blank's `accept[0]` is the correct option, and `distractors` are the
wrong options. Example: `"sentence": "The capital of France is ___."`,
`"blanks": [{"accept": ["Paris"]}]`, `"cloze_mode": "select"`,
`"distractors": ["Berlin", "Madrid", "Rome"]`.

**"Select all that apply"** (two or more correct answers, e.g. a
driving-licence exam question) uses `cloze_mode: "multiselect"`:

```json
{
  "type": "cloze",
  "cloze_mode": "multiselect",
  "sentence": "Which cities are in Germany?",
  "accept": ["Berlin", "Hamburg"],
  "distractors": ["Vienna", "Zurich"]
}
```

**Multiple blanks per cloze** are supported: each `___` in the
sentence is mapped in order to the next entry in `blanks`. Each
blank can have its own hint + placeholder + accept list. The
element SRS fans out one ElementAttempt per blank — someone who
fills blank A fluently but constantly misses blank B gets
blank-granular mastery tracking.

**Token roles on cards (Phase 52I / v1.35.0)** — optional card
metadata that lets the cloze generator at runtime (review sessions
+ the end-of-lesson correction round) choose a semantically
meaningful blank:

```json
{
  "id": "art-un",
  "front": "un chat",
  "back": "eine Katze",
  "tags": ["article"],
  "token_roles": [
    {"token": "un", "role": "article"}
  ]
}
```

Closed enum of roles: `article` / `verb` / `noun` /
`adjective` / `preposition` / `gender_marker` / `tense_marker`.
Adding a role is a minor schema version bump — do not extend it
inline.

## Exercise direction (v1.46.0 / EXP-018)

Every exercise accepts an optional `direction` field that
specifies in which direction the learner practices the card:

- `target_to_source` (default) — RECEPTIVE: the target language is
  shown, the source language is recognized (easier).
- `source_to_target` — PRODUCTIVE: the source language is shown,
  the target language is produced (harder).
- `both` / `random` — leaves the choice of a concrete direction
  per attempt to the renderer / adaptive generator.

```json
{
  "type": "matching",
  "direction": "source_to_target",
  "card_ids": ["bonjour"],
  "pairs": [{ "left": "Bonjour", "right": "Guten Tag" }]
}
```

The field is additive — the schema stays at version 1.2, and
lessons without `direction` behave exactly as before (receptive).
The SRS tracks mastery per direction: a receptively mastered card
is not yet productively mastered. Cloze exercises are
context-bound and ignore `direction`. For a difficulty
progression, keep early lessons receptive and introduce
`source_to_target` in later lessons (which is exactly what the
bundled pilot content does).

### Annotations for the adaptive lesson generator (v1.36.0+)

The adaptive lesson generator from Phase 53
(`/adaptive-lesson/:setId`, F-114) recombines the existing
exercises to target the learner's specific weaknesses. The
generator works without additional annotations, but two fields
make it considerably smarter:

1. **Broader `token_roles` coverage on cards.** The generator uses
   `token_roles` to:
   - Choose semantically sensible blanks when generating cloze
     variants from mistakes (already in v1.35.0)
   - Classify mistakes as `article_gender` / `verb_conjugation`,
     for the "focus area" chips on the Dashboard (53E)
   - Find ALTERNATIVE exercises that test the same element when
     the original exercise was wrong (53D variation logic — finds
     candidates whose card has a matching `token_roles` entry)

   Add a `token_roles` entry to EVERY card that teaches a distinct
   grammatical unit (article, conjugated verb forms,
   gender-marked nouns). Cost: one extra JSON entry per card;
   benefit: considerably richer adaptive generation.

2. **Card tags like `tags: ["article", "masculine"]`** are read by
   the mistake classifier as a fallback when `token_roles` is
   missing. They do not replace `token_roles` — they are a cheap
   halfway annotation.

What we do NOT need yet (deferred to a future schema bump):

- `related_cards` cross-references between cards from different
  lessons
- Difficulty ratings per exercise (the generator currently
  estimates difficulty from `exercise.type`)
- Per-card example sentences in `notes`, parsable as alternative
  cloze contexts (the cloze generator uses `front` exclusively)

Rule of thumb: add `token_roles` to every card that teaches a
grammatical token. This is by far the most impactful authoring
habit for the adaptive system.

## Assets (images a set ships with) — v1.37.0+

Picture-choice exercises and card cover images come from two
sources:
1. **Author asset files**, declared in the set manifest and
   shipped alongside the lesson JSON
2. **Placeholder SVGs**, generated at runtime when no asset
   exists (color swatches for color words, large numerals for
   numbers, avatar style for everything else)

If you publish a set without assets, picture-choice still works —
the placeholder SVG generator covers colors + numbers
automatically and falls back to a deterministic avatar for
everything else.

### Directory layout

Within the set directory, assets live under `assets/`:

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

Every asset must be declared in the set manifest, so the
downloader knows what to fetch:

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

The `path` is relative to the set's `assets/` directory (NOT to
the lesson JSON). In the lesson JSON, picture-choice exercises
reference assets WITH the `assets/` prefix:

```json
{
  "type": "picture_choice",
  "prompt": "Welches ist 'chat'?",
  "images": [
    {"src": "assets/img/chat.png", "label": "Katze", "is_correct": "true"},
    {"src": "assets/img/chien.png", "label": "Hund"}
  ]
}
```

The frontend strips the `assets/` prefix automatically when
calling the asset resolver, so the lesson JSON stays in the form
intuitive to authors.

### Size + format limits

- **Per-asset limit**: 500 KiB. The manifest validator rejects
  assets whose declared `size_kb` exceeds this limit. The
  downloader also rejects assets whose actual byte size exceeds
  the declaration by more than 10% — keeps the manifest honest.
- **Per-set soft limit**: 10 MiB total size. The validator warns
  but does not reject.
- **Accepted formats**: `.png` / `.jpg` / `.jpeg` / `.webp` /
  `.svg`. No GIF (animated content distracts), no BMP (no
  compression). For photos, prefer WebP — considerably smaller
  than PNG at comparable quality. For icons + diagrams, prefer
  SVG — scales cleanly + tiny file size.

### Size recommendations

Picture-choice tiles are rendered up to a maximum of 150x150 px on
desktop and 100x100 px on mobile (`object-fit: contain`). Source
images at 300x300 px give the best result on Retina screens
without unnecessary data demand. PNGs over 150 KiB rarely look
better than a well-compressed WebP of half the size.

### When the runtime placeholder is enough

Three lesson types where the runtime placeholder is so good that
author images add no learning benefit:

- **Color lessons** (`rouge` / `rojo` / `rot` / `red`): the
  placeholder generator produces a colored hex tile matching the
  color name. Author tiles are redundant.
- **Number lessons** (`7` / `42` / `1492`): the placeholder
  renders the digits large + centered. Author images would only
  make sense for non-Arabic numeral systems.
- **Abstract concepts** without an obvious visual representation
  (`patience`, `liberté`): the avatar placeholder provides a clear
  visual anchor without forcing a contentious icon choice.

For everything else (animals, objects, food, places, body parts)
author images measurably help recognition + recall.

## Quality checklist

Check before the PR for a new lesson:

- [ ] **3-5 theory steps** + **8-12 exercises** per lesson
- [ ] **At least 3 exercise types** represented (matching, picture-choice, free-text, word-tiles or cloze — cloze since v1.35.0)
- [ ] **Theory steps ≤ 200 words** per step
- [ ] **Free-text exercises**: ≥ 3 accept variants + ≥ 3 distractors
- [ ] **Word tiles**: ≥ 3 tiles per exercise
- [ ] **estimated_minutes**: 10-15 (realistic, not idealized)
- [ ] **Distractors are wrong-but-plausible** — semantically related, never random
- [ ] **Card notes** provide real added value (pronunciation, false friends, exception flag)
- [ ] **Progressive structure**: later concepts build on earlier ones in the same set
- [ ] **Cultural accuracy**: real language use, not just textbook phrases
- [ ] **Schema validation**: the lesson loads cleanly via `dict_to_lesson()` (see Local testing)
- [ ] **Card ID integrity**: every `exercise.card_ids[i]` exists in the lesson's `cards[]`
- [ ] **Language pair**: `target_language` + `source_language` set (ISO 639-1, different), `title_native` present

## Validation (two layers, v1.44.0)

Content is secured by two validation layers with the SAME checks:

1. **In the app, before sharing.** When sharing via *My Lessons →
   Share with Community*, a rule-based check runs first (always,
   without AI). It enforces the **minimums** below; a set below
   them cannot be shared. If it passes and an AI key is
   configured, the learner can OPTIONALLY start a supplementary AI
   check (translation accuracy, distractor plausibility, grammar,
   level, cultural sensitivity, naturalness). The AI step is never
   automatic, requires explicit consent (the lesson content is
   sent to the configured provider) and never blocks sharing — the
   rule-based check is the gate.
2. **In the content repo's CI.** A pull request to
   `astrapi69/adaptive-learner-content` runs
   `scripts/validate_content.py` (mirrored under
   `docs/ci/adaptive-learner-content/`) and checks every set with
   the same rules, so a manual PR cannot bypass the gate.

**Quality minimums (hard gate):** ≥ 5 exercises per lesson, ≥ 2
exercise types, ≥ 1 theory step, free-text ≥ 2 accepted answers +
distractors, matching ≥ 3 pairs, picture-choice with distractors,
no empty card fronts/backs and (for non-Latin source scripts) card
backs in the source script. These are minimums, not goals — the
checklist above asks for more.

### Set-wide AI content check (optional)

Besides the share-time check, a downloaded set can be reviewed
set-wide via *Check with AI*. This is fully optional and uses the
**provider + model** the learner has configured (Anthropic /
OpenAI / Gemini); the cards are sent in batches to that provider
for review. The flow shows a cost estimate, runs with a progress
bar + cancel, and produces a **per-card report** that is cached in
the browser and can be exported as **Markdown** (with a line
recording which provider + model ran the check). When the report
passes, the set earns an **"AI-Checked" badge** backed by a
content hash + a signature, so a later edit to the cards
invalidates the badge until the set is re-checked. The AI check is
never a gate — it is advisory provenance, not a publishing
requirement.

## Local testing

The content loader's schema validator runs as part of `make test`.
To validate a single lesson by hand:

```bash
cd plugins/adaptive-learner-plugin-content-loader
poetry run python -c "
import json, sys
from adaptive_learner_content_loader.schema import dict_to_lesson
path = '../adaptive-learner-content/sets/en/fr-a1/lessons/01-greetings.json'
with open(path) as f:
    lesson = dict_to_lesson(json.load(f))
print(f'OK: {lesson.id} — {len(lesson.cards)} Cards, {len(lesson.steps)} Steps')
"
```

To validate all lessons of a content repo at once — with the content
repo's validator (the same script its CI runs on every PR):

```bash
cd ../adaptive-learner-content
python3 scripts/validate_content.py
```

It finds every set under `sets/{source}/{target-level}/` and checks the
schema plus the quality minimums (≥5 exercises, ≥2 exercise types, ≥1
theory step, free-text accepts + distractors, matching pairs, no empty
cards, card-ID integrity). New lessons are detected automatically — no
test change needed.

## PR workflow

Once your set is ready:

1. Open a PR against the main repo (for sets that should ship with
   the app), OR
2. Create your own content repo under your GitHub account and
   configure the content loader via
   `backend/config/plugins/content-loader.yaml` (under
   `default_sources`).

The content loader supports any public GitHub repo as a source.
Private repos need a personal access token, set via the
three-layer key management
(`~/.config/adaptive_learner/secrets.yaml`).

## Common pitfalls

**Card ID references**: Every `card_ids` entry in an exercise must
exist in the lesson's `cards[]`. If you copy an exercise between
lessons and forget to bring along the associated card, validation
fails.

**Slug-safe IDs**: All IDs (lesson, card, step, exercise) must
match `^[a-z0-9]+(-[a-z0-9]+)*$`. No underscores, no apostrophes,
no uppercase letters, no leading/trailing hyphens.

**`is_correct: "true"`**: It is a string, not a JSON boolean. The
schema explicitly requires `"true"`, because the picture_choice
fields are internally modeled as dict[str, str].

**Extra fields**: Every model has `extra="forbid"`. An
undocumented field leads to the rejection of the entire lesson.
Stick to the documented fields.

**Theory body**: Theory steps need a non-empty `body` field
(Markdown). Exercise steps must not carry a `body` — use the
exercise's `prompt` instead.

## Reference: the bundled sets

Adaptive Learner ships a sizeable library across several domains
(languages, programming, psychology, AI, technology — see the
README CONTENT-STATS block for the live counts + the full
per-set table). A few good canonical references in the
`adaptive-learner-content` repo:

- `sets/en/fr-a1/` — French A1 for English speakers;
  `sets/de/fr-a1/` is the German-source counterpart.
- `sets/en/es-a1/` + `sets/de/es-a1/` — Spanish A1 (one per source
  language).
- The "Python — Grundlagen" set under `sets/de/` is a
  `domain: programming` example (German source == target), useful
  as a non-language reference.

They all follow the conventions described in this guide. Reading
through a complete lesson is the fastest way to internalize the
structure.

---

## Path to community contribution (v1.42.0)

You do not have to create lessons from scratch by hand. The
fastest way to contribute is to **create and share a lesson in the
app**:

1. Import a chat and analyze it, then **Save as offline lesson**
   (or finish an adaptive lesson and **Save this lesson?**). The
   lesson appears under **My Lessons** in the set browser.
2. In "My Lessons", click **Export as content set** to download a
   content set as `.zip` (manifest + lessons). Exports contain
   only the lesson content — no progress, no error history,
   nothing personal.
3. Click **Share with Community** to open a pre-filled **pull
   request** in the content repository — the lesson JSON is
   committed at the correct path in the tree, no `.zip` attachment
   needed.
4. The repo's CI validates the PR automatically; a maintainer
   reviews the lesson, brings the manifest (id, title, language,
   level, tags) in line with the conventions above and merges it
   under `sets/`. After the merge, everyone can download it from
   the set browser.

This is the social path: the review is **manual** (a maintainer
curates every addition — nothing is published automatically), and
the whole flow needs only GitHub. Generated lessons are already
validated against the schema, so a contributed lesson usually only
needs a bit of manifest polishing.

## Share wizard, variations and author credit (Phase 64)

Sharing a lesson from **My Lessons** opens a four-step wizard
instead of jumping straight to GitHub:

1. **Preview + placement.** The app computes exactly where the
   lesson lands in the tree (`sets/{source}/{target}-{level}/`) and
   an auto-numbered file name (`{nn}-{slug}.json`, the next number
   after the existing lessons). A brand-new pair + level shows
   *"New set! You're the first."*
2. **Duplicate scan.** The lesson is compared with the lessons
   already present in this path (card and exercise overlap —
   advisory, never blocking). If something similar exists, you
   can:
   - **Share as a variation** — the lesson is marked with
     `variation_of: "{original_id}"` plus an optional
     `variation_note` ("How does your version differ?").
   - **Suggest only the new exercises** (for near-duplicates) —
     the wizard extracts exactly the exercises that the original
     lacks, along with the associated cards, as a supplement
     variation.
3. **Quality summary.** The findings of the rule-based validator
   (plus the optional AI check); warnings are shown but never
   block.
4. **Share + celebrate.** One click opens the GitHub pull request
   (file editor for small lessons, upload page for large ones),
   and the app thanks you with a small celebration.

### Variation and credit fields (schema 1.3, all optional)

```json
{
  "variation_of": "10-passe-compose",
  "variation_note": "Mehr Übungen zur Angleichung",
  "contributed_by": "Maria S.",
  "contributed_at": "2026-06-01T14:30:00Z"
}
```

All four are additive and optional; lessons without them behave
exactly as before. `contributed_by` is set when the author enables
the credit on sharing (a *"Your name (optional)"* field, remembered
locally for next time). If present, the viewer shows a subtle line
*"Contributed by {name}"* below the title, and the pull request
body lists the author in its metadata table.

### Contribution history and gaps

Shared lessons are remembered locally (no account needed) under
**My Contributions** with a counter and a *Community Contributor*
distinction from five shared lessons on. The set browser also
shows **Missing Lessons** — encouraging suggestions for the next
CEFR level of an existing pair or a target language that exists for
one source language but is missing for another ("Can you help?").

---

## Related pages

- [Creating lessons — overview](../content-creation/overview.md) — getting started + the in-app Lesson Creator
- [Book recommendations](../content-creation/books.md) — maintaining `books.yaml` per domain
- [Multiple content repositories](../features/content-repos.md) — connect your own repo
