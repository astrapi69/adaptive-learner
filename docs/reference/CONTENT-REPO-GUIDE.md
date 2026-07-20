# Content-Repo Guide

A guide for content authors who want to publish their own lessons for
Adaptive Learner from their own GitHub repository.

Adaptive Learner ships with an official content library, but the
content system is open: anyone can host a **content repository** of
their own, connect it in the app, and (optionally) have it recommended
to other learners. This guide explains what a content repo is, how to
build one, how it is listed in the app, and what the trust levels mean.

> New to authoring? The fastest path is to fork the ready-made starter
> kit and replace the example lesson. See
> [Use the starter kit as a template](#use-the-starter-kit-as-a-template).

---

## 1. What is a content repo?

A content repo is a public (or private) GitHub repository that holds
**content sets** in the Adaptive Learner content format. A content set
is a collection of lessons for one language pair and level (for example
"Spanish A1 for German speakers") or one knowledge domain (for example
"Python basics" or a psychology course).

The app reads a repo's root `manifest.yaml`, discovers the sets it
declares, and lets the learner download and play them. The official
library and any user-added repos use the **exact same format** -- there
is no separate "official" schema. Your repo is a first-class content
source the moment it validates.

Content repos work in both storage modes:

- **API mode** (desktop app with a backend): the backend fetches and
  caches the sets.
- **Dexie mode** (the GitHub Pages build, no backend): the browser
  fetches the sets directly from GitHub raw URLs and caches them in
  IndexedDB.

No backend of your own is ever required. A content repo is just files
in a Git repository.

---

## 2. Prerequisites

You need:

- A **public GitHub repository** (private is possible too, via a
  per-repo token -- see [Listing a private repo](#listing-a-private-repo)).
- A root **`manifest.yaml`** that declares your sets.
- Lessons that conform to the **lesson format (schema v1.3+; current is
  v1.4)**.
- Python 3 with PyYAML, to run the local validator before you publish.

The two authoritative format references live in the official content
repo and are kept in lock-step with the app:

- Getting started:
  <https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md>
- Lesson format spec:
  <https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md>

This guide is the conceptual overview; those two files are the field
reference for every field and exercise type.

---

## 3. Repository layout

A content repo follows a fixed directory tree. The source language (the
language the learner already speaks, in which the explanations are
written) is the top folder; the target language and level form the next
folder.

```
your-content-repo/
  manifest.yaml                      # root manifest: lists every set
  recommended-repos.json             # optional: discovery catalogue
  books.yaml                         # optional: book recommendations per domain
  scripts/
    validate_content.py              # the validator (copy from the starter kit)
  .github/workflows/
    validate-content.yml             # optional CI that runs the validator on PRs
  sets/
    {source_language}/               # e.g. "de" (German speakers)
      {target}-{level}/              # e.g. "es-a1" (Spanish A1)
        manifest.yaml                # set manifest: lists the lessons
        lessons/
          01-greetings.json          # one JSON file per lesson, NN-slug.json
          02-numbers.json
          ...
        assets/                      # optional images / audio
          img/
            bonjour.png
```

A language-pair example: `sets/de/fr-a1/` is "French A1 for German
speakers". A knowledge example: `sets/de/inception-example/` is a
single-language psychology set (source == target is allowed for
non-language domains).

---

## 4. Step by step

### 4.1 Create the repo and the root manifest

Create a GitHub repo and add a root `manifest.yaml`. The root manifest
names the repo and lists every set:

```yaml
schema_version: "1.4"
name: My Spanish Course
description: A1 Spanish lessons for German speakers.
sets:
  - id: es-a1-from-de            # slug-safe, unique within the manifest
    title: Spanisch A1           # title in the SOURCE language
    title_native: Espanol A1     # optional title in the target language
    target_language: es          # what the learner LEARNS (BCP-47)
    source_language: de          # what the learner SPEAKS (BCP-47)
    domain: language             # default "language"; also psychology, programming, ...
    level: A1                    # CEFR for languages, free text otherwise
    path: sets/de/es-a1          # repo-relative directory of the set
    version: "1.0.0"             # semver; higher version wins on a same-id clash
    lesson_count: 15             # number of lessons in the set
    description: >-
      Greetings, numbers, articles, ser/estar, and a restaurant scene.
metadata:
  author: Your Name
  license: CC-BY-4.0
  homepage: https://github.com/you/my-spanish-course
```

Key points:

- `target_language` != `source_language` for `domain: language`. For
  non-language domains (`psychology`, `programming`, ...) they may be
  equal.
- `path` must match the on-disk directory exactly
  (`sets/{source_language}/{target}-{level}`). The validator enforces
  this.
- On a same-`id` clash between repos, the higher `version` wins; on a
  tie the official repo is preferred.

### 4.2 Write the lessons

Each lesson is a JSON file under `lessons/`, named `NN-slug.json`. A
lesson is built from **cards** (the vocabulary / facts) and **steps**
(theory steps with Markdown, plus exercise steps). The six core exercise
types are `matching`, `picture_choice`, `free_text`, `word_tiles`,
`cloze`, and `multiple_choice` (native since schema v1.6, #1525);
additional `ext:` extension types exist — see the
[exercise type catalog](../help/en/developer/authoring-content.md#exercise-type-catalog-status).

The minimum shape:

```json
{
  "id": "01-greetings",
  "title": "Greetings",
  "target_language": "es",
  "source_language": "de",
  "estimated_minutes": 10,
  "cards": [
    { "id": "c1", "front": "hola", "back": "hallo" },
    { "id": "c2", "front": "buenos dias", "back": "guten Morgen" }
  ],
  "steps": [
    { "id": "s1", "type": "theory", "title": "Begruessung",
      "body": "Im Spanischen gruesst man mit **hola**." },
    { "id": "s2", "type": "exercise",
      "exercise": {
        "id": "e1", "type": "matching", "prompt": "Ordne zu",
        "card_ids": ["c1", "c2"],
        "pairs": [
          { "left": "hola", "right": "hallo" },
          { "left": "buenos dias", "right": "guten Morgen" }
        ]
      }
    }
  ]
}
```

For the full set of card fields (`notes`, `image`, `audio`,
`code_snippet`, `token_roles`, ...), step fields (`example_url`), and
the type-specific exercise fields, see the
[lesson format spec](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md).

A matching set-level `manifest.yaml` inside the set lists the lessons:

```yaml
schema_version: "1.4"
name: Spanisch A1
sets:
  - id: es-a1-from-de
    title: Spanisch A1
    target_language: es
    source_language: de
    level: A1
    version: "1.0.0"
    lesson_count: 15
metadata:
  lessons:
    - 01-greetings.json
    - 02-numbers.json
```

### 4.3 Validate locally

Copy `scripts/validate_content.py` from the starter kit (or from the
official content repo) and run it from your repo root:

```bash
pip install pyyaml
python3 scripts/validate_content.py
```

It auto-discovers `sets/`, checks every manifest and lesson, and exits
`0` when everything passes or `1` with a per-file report otherwise. The
validator needs only Python 3 and PyYAML -- no app, no backend.

What it checks (the same rules the app and the official CI enforce):

- **Schema**: required manifest fields, ISO language codes,
  `target_language != source_language` for language sets.
- **Structure**: `path` matches `sets/{source}/{target}-{level}`.
- **Quality minimums per lesson**: at least 5 exercises, at least 2
  distinct exercise types, at least 1 theory step; `free_text` needs 2+
  accepted answers and distractors; `matching` needs 3+ pairs;
  `picture_choice` needs distractors; no empty card fronts/backs.

These quality minimums are what every shared lesson must clear -- they
are also the bar for the **Validated** trust level below.

### 4.4 Add CI (optional but recommended)

Drop a GitHub Action that runs the validator on every pull request, so
contributors get immediate feedback. The official content repo's
`validate-content.yml` is a ready template; mirror it under
`.github/workflows/`.

---

## 5. How is it listed in the app?

Once your repo validates, a learner connects it in
**Settings > Data > Content repositories**:

1. Paste your repo URL (and a branch, default `main`).
2. The app fetches the root `manifest.yaml`, runs technical validation,
   syncs the sets, and caches them.
3. Your sets appear in the **Content Browser**, tagged with a source
   badge so the learner can tell where each set came from.

Repos can also be **shared** via an `/add-repo` deep link plus a QR
code, so an author can hand a learner a one-tap connect link.

To reach the in-app **Recommended repositories** discovery section, a
repo must be listed in the official `recommended-repos.json`. That is a
curated list maintained by the project team; it is the channel for
official endorsement and the Official trust level.

### Listing a private repo

Private and coach repos are supported with a **per-repo token** entered
in the app. The token is stored locally only and is deliberately kept
out of the exportable configuration, so it never leaves the device in a
backup.

---

## 6. Trust levels

Every content source carries a trust level. It tells the learner how
much vetting the content has had -- nothing more. Trust is about
provenance and review, not about whether the lessons are "good".

| Level | Name | Meaning | How it is earned |
|-------|------|---------|------------------|
| **1** | Validated | Schema is correct and the quality minimums pass. The content itself was not reviewed individually. | Automatically, the moment the repo passes technical validation on sync. |
| **2** | Verified | Contributed by the community and reviewed by a maintainer for content correctness. | A maintainer reviews and vouches for the content. |
| **3** | Official | Curated and quality-assured by the project owner. | Listed and maintained by the project team in `recommended-repos.json`. |

The matching in-app strings (localized in all 9 languages) are:

- `content_repo.trust_validated` -- "Validated: Technically correct;
  content not individually reviewed."
- `content_repo.trust_verified` -- "Verified: Contributed by the
  community and reviewed by the team."
- `content_repo.trust_official` -- "Official: Curated and
  quality-assured by the project team."

> Implementation note: today the app assigns **Validated** automatically
> (a freshly added user repo starts Unverified and becomes Validated
> once it passes validation on sync), and the official repo declares
> **Official** via `recommended-repos.json`. The **Verified** middle
> tier is the documented path for community-contributed repos that a
> maintainer has reviewed; broader community verification (ratings, a
> central index, coach aggregation) is tracked as future work and needs
> a shared backend.

### Quality requirements for Trust 2+

To move beyond automatic Validation, content is expected to clear a
higher bar than the technical minimums:

- **Linguistic correctness**: accurate translations, correct articles
  and genders, complete accents/diacritics, correct conjugations.
- **Pedagogical soundness**: a sensible difficulty progression, theory
  before the exercises that test it, plausible-but-clearly-wrong
  distractors, cloze blanks with exactly one correct answer.
- **Cultural accuracy**: idiomatic, level-appropriate, non-misleading
  examples.
- **Completeness**: the declared `lesson_count` matches reality, every
  set has at least one theory step per lesson, assets resolve.

An optional in-app **AI content review** can help authors catch
translation, grammar, level, and cultural issues before they share
(see EXP-033 in the explorations, which extends per-lesson AI review to
a whole-set batch flow). AI review is advisory and never blocks sharing.

---

## 7. Reciprocity for courses and websites (EXP-029)

Adaptive Learner aims to be an ecosystem hub, not a passive ad board.
Lessons and domains can carry **companion media** -- YouTube videos,
podcasts, articles, books, and (commercial) courses or websites.

The curation filter for commercial media is **reciprocity, not price**:

- **Free media** (YouTube, podcasts, articles, books): always allowed.
- **Commercial media** (paid courses, websites): allowed only if the
  provider **reciprocates** -- proven by a backlink to Adaptive Learner,
  their own connected content repository, or a documented partnership.

In short: *reciprocity is the filter, not the price.* A teacher, a small
language school, or an author who links back to the app (or ships their
own content repo) earns the right to surface their commercial offering
in-app. The validator for companion media **fails closed**: a `course`
or `website` entry without proof of partnership is dropped. This keeps
the recommendation surface honest and turns content authors into
ecosystem partners rather than advertisers. See
`docs/explorations/EXP-029-media-reciprocity.md` for the full design.

---

## 8. Use the starter kit as a template

The fastest way to start is the ready-made starter repo:

**`astrapi69/adaptive-learner-content-test`**

It contains:

- `docs/GETTING-STARTED.md` and the full `docs/LESSON-FORMAT.md`.
- `templates/` -- per-domain skeletons (`language`, `programming`,
  `knowledge`) plus a `v1.4-preview/` multi-file layout preview.
- `examples/inception-effekt/` -- a complete worked lesson.
- `sets/de/inception-example/` -- the same lesson as a runnable set,
  registered in the root `manifest.yaml`.
- `books.yaml` -- book recommendations per domain.
- `scripts/validate_content.py` -- the local validator.

Workflow: fork it, replace the example lesson under
`sets/de/inception-example/lessons/` with your own (or add new sets
under `sets/{source}/{target-level}/`), register them in the root
`manifest.yaml`, run `python3 scripts/validate_content.py`, and connect
the repo in the app.

---

## See also

- Starter kit: <https://github.com/astrapi69/adaptive-learner-content-test>
- Official content: <https://github.com/astrapi69/adaptive-learner-content>
- Getting started (authoritative):
  <https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md>
- Lesson format (authoritative):
  <https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md>
- In-app help: *For content creators* in the documentation site.
