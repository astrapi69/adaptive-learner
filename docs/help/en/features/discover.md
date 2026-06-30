# Discover content

**Discover** is where you find new lesson sets across the whole
library and download them. It lives as the **Discover tab inside
the Content hub** (`/content`); the older `/discover` link still
works and redirects there.

The split is deliberate: **My content** shows only what you have
already downloaded, while **Discover** is the catalog you browse
and pull from. That keeps your day-to-day learning surface free of
sets you have not chosen yet. **Discover is the default tab** of the
Content hub, so a first-time visitor is guided to find content
instead of an empty "My content" page.

<!-- TODO: Screenshot — the Discover tab with the search/filter bar, view toggle and per-set download buttons -->

---

## Search and filters

Discover is backed by a **search index** over the catalog. A
**compact Search/Filter toggle bar** sits at the top: tap **Search**
to type a query, or **Filter** to narrow the catalog with
**combinable filters** — **language**, **level**, **domain**,
**trust** level, and **AI-checked**. Search and filters work
together, and the bar stays compact (it expands only the part you
are using) so it does not crowd the results on small screens.

Typing filters instantly across set titles, descriptions, domains,
lesson titles, card fronts and backs, and tags. The search is
tolerant of case and accents and understands German digraphs
(ae/oe/ue/ss). The index is built lazily on first interaction — no
backend call, it works in both storage modes.

---

## List and grid view

Discover honours the same **global content-view preference** as
*My content*: a **view toggle** switches the catalog between a
compact **list** (the default) and a richer **grid** of cards.
Changing it here also changes it on *My content*, and the choice is
remembered. You can also set it from **Settings → Learning**.

---

## Downloading a set

Each result carries a **Download** action. Downloading copies the
set into your local cache (IndexedDB in browser-only mode, the
filesystem cache in server mode), after which it appears under
**My content** and can be played offline.

Every set shows a **source badge** — Official / Bundled, your own
connected repo, or Officially recommended. The **trust** filter (see
above) narrows the catalog to a single source or trust level. See
[Multiple content repositories](content-repos.md) for connecting
and managing your own sources.

---

## Import tab

The Content hub also exposes an **Import** tab for bringing in a
chat export or a single lesson file. The import/creation **action
buttons** and your **My Lessons** (lessons you created or imported)
now live here too. Old `/import` links redirect into it.

---

## Related pages

- [Content Browser](content-browser.md) — your downloaded "My content"
- [Multiple content repositories](content-repos.md) — sources and trust levels
- [Lessons and reviews](../user-guide/lessons.md) — the lesson flow
