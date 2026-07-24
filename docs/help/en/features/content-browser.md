# Content Browser

The **Content Browser** ("Meine Inhalte" / "My content") is the
**My content tab of the Content hub** at `/content`. It shows only
the lesson sets you have already downloaded, with the search field
on top and your local catalog below. To find and download *new*
sets, use the **Discover** tab - see
[Discover content](discover.md). Discover is the **default tab**, so
opening `/content` lands you on the catalog; switch to *My content*
once you have downloaded something.

The page header carries the title **Meine Inhalte** and a small
**info button** (the ⓘ icon). The intro text is no longer shown
permanently - click the info button to read what this tab is for
(your downloaded content, with its sources) without it taking up
space the rest of the time.

<!-- TODO: Screenshot - Content Browser with title, info button, view toggle and set tree -->

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

## List and grid view

A **view toggle** lets you switch how your downloaded sets are
shown:

- **List** - a compact, flat list that is fast to scroll,
  especially on mobile. This is the **default**.
- **Grid (tiles)** - the richer *source → target → level* tree
  view.

Your choice is a **global content-view preference**: it applies to
both the *My content* and *Discover* tabs and is remembered across
visits. You can also set it from **Settings → Learning**. (If you
had previously picked grid, that choice is kept; only new users
start on list.)

The downloaded sets are ordered by **download time** (most recently
downloaded first), not alphabetically, so what you just pulled in is
easy to find.

> **Continue Learning moved.** The "Weitermachen" (Continue
> Learning) panel is no longer on this tab - it lives on the
> **Dashboard**, which is the one place that owns it. See
> [Dashboard](../user-guide/dashboard.md).

---

## Select and manage downloaded sets

In *My content* you can **multi-select** downloaded sets and
**delete them in bulk** in one action. You can also **filter** the
list, including **by source**, to narrow it down to what you want.

---

## Languages and Knowledge

The catalog splits into two trees:

- **Languages** - as a tree *source language → target language → level*,
  filtered to your app language (you can enable additional source
  languages in Settings → Learning).
- **Knowledge** - non-language domains (e.g. programming,
  psychology) with their own icons.

---

## Direct link to a single set

Every set has its own **deep link** at `/content/set/:setId` that
opens that set directly, skipping the catalog tree. Open the link
and you land on the set - in both storage modes. This is what makes
**per-set sharing** possible: a set-level QR code or share link can
now point at a specific set, not just the app root.

If the link refers to a set that does not exist (or that you have
not downloaded yet), the page shows a friendly **not-found state**
with a way back to the catalog, rather than an error.

---

## Source badges and source filter

Every downloaded set carries a **source badge** that shows where
it came from:

- **Official** / **Bundled** - from the official catalog or
  built into the app.
- **Own repo** - from a repository you connected yourself.
- **Officially recommended** - from the curated recommendation
  list.

A **source filter** lets you show only sets from a specific source
when needed. More on this under
[Multiple content repositories](content-repos.md).

---

## Invitation-code sharing

If you own a **private content repository** and have set a per-repo
token for it, you can generate an **invitation code** (with a QR
code and link) that shares access to that repo. A learner **redeems
an invitation code** to add the repository to their own sources.
See [Multiple content repositories](content-repos.md).

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

## My Lessons (now on the Import tab)

Lessons you created or imported yourself - together with the
import/creation **action buttons** - moved to the **Import tab** of
the Content hub. There they sit next to chat import as one "bring
your own content" surface, with the same actions to play, edit,
delete, export and share. The *My content* tab keeps the
downloaded-set tree (with your user lessons folded into the matching
published node and a "(+N own)" count). How to build your own
lessons is described under
[Creating lessons](../content-creation/overview.md).

---

## Related pages

- [Lessons and reviews](../user-guide/lessons.md) - the lesson flow
- [Multiple content repositories](content-repos.md) - connect and manage sources
- [My Lessons](../user-guide/my-lessons.md)
