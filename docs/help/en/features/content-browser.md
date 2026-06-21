# Content Browser

The **Content Browser** ("My content") is the **My content tab of
the Content hub** at `/content`. It shows only the lesson sets you
have already downloaded, built around the learning flow: search
first, then Continue Learning, then your local catalog. To find
and download *new* sets, use the **Discover** tab —
see [Discover content](discover.md).

<!-- TODO: Screenshot — Content Browser with search field, Continue Learning section and set tree -->

---

## Search

At the very top there is a **full-width search field**. It filters
instantly (debounced, against the locally cached catalog) across
set titles, descriptions, domain, lesson titles, card fronts and
backs, and tags. The search is **tolerant** of case and accents
and understands German digraphs (ae/oe/ue/ss). Matches replace the
catalog tree, with highlighting, a match count and an empty state.
`Cmd/Ctrl + K` jumps straight into the search field.

---

## Continue Learning

Right below the search, **Continue Learning** shows the most
recently touched lesson per set, each with exactly one action:
**resume** (in-progress/paused lesson, step n of total),
**next** lesson plus stars after a completion, or
**set complete**.

---

## Languages and Knowledge

The catalog splits into two trees:

- **Languages** — as a tree *source language → target language → level*,
  filtered to your app language (you can enable additional source
  languages in Settings → Learning).
- **Knowledge** — non-language domains (e.g. programming,
  psychology) with their own icons.

---

## Source badges and source filter

Every downloaded set carries a **source badge** that shows where
it came from:

- **Official** / **Bundled** — from the official catalog or
  built into the app.
- **Own repo** — from a repository you connected yourself.
- **Officially recommended** — from the curated recommendation
  list.

A **source filter** lets you show only sets from a specific source
when needed. More on this under
[Multiple content repositories](content-repos.md).

---

## Book recommendations

If the catalog maintains recommended books for a domain
(`books.yaml`), the Content Browser shows them as **further
reading** for that domain. This works in both storage modes and
needs no backend. Format and maintenance:
[Book recommendations](../content-creation/books.md).

---

## Subject filter

If you have assigned subjects to your learning projects, the
**Dashboard** shows a subject filter that lists **only your own**
subjects (hidden when there are none), sorted by **most-used**
first and grouped by category above five entries.

---

## My Lessons

Lessons you created or imported yourself appear in the
**My Lessons** section with actions to play, edit, delete, export
and share. How to build your own lessons is described under
[Creating lessons](../content-creation/overview.md).

---

## Related pages

- [Lessons and reviews](../user-guide/lessons.md) — the lesson flow
- [Multiple content repositories](content-repos.md) — connect and manage sources
- [My Lessons](../user-guide/my-lessons.md)
