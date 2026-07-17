# Creating lessons — overview

Adaptive Learner thrives on content. You can build your own
lessons — directly in the app or as a file in the content-repo
format — and share them with the community. This page gives the
overview; the detailed format specifics are in the linked sources.

---

## Two ways to create lessons

### 1. In the app: the Lesson Creator

The **Lesson Creator** at `/create-lesson` is a 4-step wizard
(Metadata → Card Editor → Exercise Generator → Save/Share) and
needs **no AI key**:

- Order cards via drag-and-drop or **import from CSV**.
- **Auto-generate** exercises from the cards (all five exercise
  types) or fine-tune them by hand.
- **Templates** (Blank / Vocabulary / Grammar / Conversation) and
  **draft auto-save**.
- **Preview** in the real lesson viewer before saving.
- **Save locally** or **share via pull request**.

Entry points exist in the Content Browser and on the Dashboard.

#### Knowledge lesson from text (book mode)

The fifth template card, **"Knowledge lesson from text"**, starts a
dedicated 3-step flow (Metadata → Book text → Review): paste one
section (e.g. a chapter) of your textbook — the AI rewrites it **in
its own words** as theory steps (never a copy) and generates
matching exercises that link back to their theory step. Optional
book metadata (title, author, URL, ISBN/ASIN) can be attached. Add
further sections by running the wizard again.

Unlike the card-based path, this mode requires a **configured AI
key**. Only paste text you have the rights to, or that is intended
for personal use.

### 2. As a file: the content-repo format

A lesson is a JSON file in a **content set**. Sets live in public
GitHub repos and follow a fixed directory tree
(`sets/{source-language}/{target-language-level}/`). The
authoritative guides live in the content repository:

- **Getting started:**
  [`docs/GETTING-STARTED.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/GETTING-STARTED.md)
- **Lesson format:**
  [`docs/LESSON-FORMAT.md`](https://github.com/astrapi69/adaptive-learner-content/blob/main/docs/LESSON-FORMAT.md)

A ready-made **starter kit** to study and copy is
[`astrapi69/adaptive-learner-content-test`](https://github.com/astrapi69/adaptive-learner-content-test).

---

## Sharing via pull request

Sharing a lesson creates a real **pull request** (fork → commit →
PR). The app automatically suggests the correct path and a
numbered file name and detects duplicates/variations. The content
repo's **validation pipeline** checks every submitted lesson on
each PR (schema, language pair, quality minimums), so only clean
content makes it into the catalog. Optionally there is an
AI-assisted content review; it never blocks sharing.

---

## Related pages

- [Authoring lesson content (developer)](../developer/authoring-content.md) — schema details, assets, code/formula cards
- [Book recommendations](books.md) — maintaining `books.yaml`
- [Multiple content repositories](../features/content-repos.md) — connect your own repo
