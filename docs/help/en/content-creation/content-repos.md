# Content repos — publishing your own repository

Adaptive Learner ships an official content library, but the content
system is open: you can run your **own content repository** on GitHub,
connect it in the app, and make it available to other learners. This
page is the overview; the full step-by-step instructions are in the
**[Content-Repo Guide](https://github.com/astrapi69/adaptive-learner/blob/main/docs/CONTENT-REPO-GUIDE.md)**.

---

## What is a content repo?

A content repo is a GitHub repository that holds **content sets** in the
Adaptive Learner format. A set is a collection of lessons for one
language pair and level (for example "Spanish A1 for German speakers")
or for one knowledge domain (for example "Python basics").

The official library and all user repos use the **same format** -- there
is no separate "official" schema. The moment your repo passes
validation, it is a first-class content source. You never need a server
of your own: a content repo is just files in a Git repository.

---

## Prerequisites

- A **GitHub repository** (public; private is possible too, via a
  per-repo token).
- A root **`manifest.yaml`** that lists your sets.
- Lessons in the **lesson format** (schema v1.3+; current is v1.4).
- Python 3 with PyYAML, to validate locally before you publish.

The authoritative format references live in the official content repo:

- [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

---

## Directory layout

A content repo follows a fixed tree. The source language (the language
the explanations are written in) is the top folder; the target language
and level form the next one:

```
my-content-repo/
  manifest.yaml                  # root manifest: lists every set
  sets/
    de/                          # source language (German speakers)
      es-a1/                     # target language + level (Spanish A1)
        manifest.yaml            # set manifest: lists the lessons
        lessons/
          01-greetings.json      # one JSON file per lesson (NN-slug.json)
        assets/                  # optional: images / audio
  scripts/validate_content.py    # the validator (from the starter kit)
```

---

## Validate locally

```bash
pip install pyyaml
python3 scripts/validate_content.py
```

Exit code 0 when every set passes, otherwise 1 with a per-file report.
It checks the schema, the directory structure, and the quality minimums
(at least 5 exercises, 2 exercise types, 1 theory step per lesson,
non-empty card fields, and so on).

---

## How is it listed in the app?

Once your repo validates, a learner connects it under
**Settings > Data > Content repositories**: paste the URL, the app
fetches the root manifest, validates technically, syncs and caches the
sets. They then appear in the **Content Browser** with a source badge.
Repos can also be shared via an `/add-repo` link plus a QR code.

A repo reaches the in-app **Recommended repositories** section only
through the project team's curated `recommended-repos.json` -- the
channel for official endorsement (Trust 3).

---

## Trust levels

The trust level tells the learner how much vetting the content has had.
It is about provenance and review, not a quality verdict.

| Level | Name | Meaning |
|-------|------|---------|
| **1** | Validated | Schema correct, quality minimums pass -- automatically on sync. Content not individually reviewed. |
| **2** | Verified | Contributed by the community and reviewed by a maintainer for content correctness. |
| **3** | Official | Curated and quality-assured by the project team. |

Trust 2+ expects more than the technical minimums: accurate
translations, correct articles/genders, complete accents, sensible
progression, plausible distractors, and cultural accuracy. An optional
in-app **AI review** helps authors catch such issues before sharing
(see EXP-033); it is advisory and never blocks sharing.

---

## Reciprocity for courses and websites (EXP-029)

Lessons and domains can carry **companion media** (videos, podcasts,
articles, books, courses, websites). The filter for commercial media is
**reciprocity, not price**: free media is always allowed; commercial
courses/websites only when the provider links back, runs their own
content repo, or has a documented partnership. This turns content
authors into ecosystem partners rather than advertisers. Details in
`docs/explorations/EXP-029-media-reciprocity.md`.

---

## Starter kit as a template

The fastest start is the ready-made starter repo
**[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test)**:
it contains `docs/`, per-domain templates, a complete example lesson
(the Inception effect), a runnable example set, `books.yaml`, and the
validator. Fork it, replace the example lesson with your own, register
it in the root `manifest.yaml`, validate, and connect the repo in the
app.

---

## See also

- **[Full Content-Repo Guide](https://github.com/astrapi69/adaptive-learner/blob/main/docs/CONTENT-REPO-GUIDE.md)**
- [Creating lessons — overview](overview.md)
- [Book recommendations](books.md)
