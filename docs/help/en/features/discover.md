# Discover content

**Discover** is where you find new lesson sets across the whole
library and download them. It lives as the **Discover tab inside
the Content hub** (`/content`); the older `/discover` link still
works and redirects there.

The split is deliberate: **My content** shows only what you have
already downloaded, while **Discover** is the catalog you browse
and pull from. That keeps your day-to-day learning surface free of
sets you have not chosen yet.

<!-- TODO: Screenshot — the Discover tab with the search index and per-set download buttons -->

---

## Search index

Discover is backed by a **search index** over the catalog. Typing
filters instantly across set titles, descriptions, domains, lesson
titles, card fronts and backs, and tags. The search is tolerant of
case and accents and understands German digraphs (ae/oe/ue/ss).
The index is built lazily on first interaction — no backend call,
it works in both storage modes.

---

## Downloading a set

Each result carries a **Download** action. Downloading copies the
set into your local cache (IndexedDB in browser-only mode, the
filesystem cache in server mode), after which it appears under
**My content** and **Continue Learning** and can be played offline.

Every set shows a **source badge** — Official / Bundled, your own
connected repo, or Officially recommended. A source filter narrows
the catalog to a single source. See
[Multiple content repositories](content-repos.md) for connecting
and managing your own sources.

---

## Import tab

The Content hub also exposes an **Import** tab for bringing in a
chat export or a single lesson file. Old `/import` links redirect
into it.

---

## Related pages

- [Content Browser](content-browser.md) — your downloaded "My content"
- [Multiple content repositories](content-repos.md) — sources and trust levels
- [Lessons and reviews](../user-guide/lessons.md) — the lesson flow
