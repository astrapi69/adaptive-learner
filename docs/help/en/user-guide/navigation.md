# Navigation

The app's primary navigation is a small set of **grouped
entries** (EXP-037, following the Nielsen-Norman "5-7 items"
guidance) with **no loss of function** - every page is reachable,
and old links keep working through redirects.

<!-- TODO: Screenshot - the grouped primary navigation and the mobile bottom tab bar -->

---

## Desktop: grouped entries

The desktop navigation is organised into labelled groups via a
reusable `NavGroup` component:

- **Learn** - Dashboard and Learning Path.
- **Content** - the **Content hub** (`/content`), which holds your
  *Discover* catalog, your downloaded *My content*, and *Import* as
  tabs (in that order). **Discover is the default tab**, so opening
  the hub lands on the catalog.
- **Progress** - the **ProgressHub** (`/progress`), with Overview,
  Statistics and My paths as tabs.
- **Settings** and **Help** round out the bar.

Pages that are no longer top-level entries (Anki, Session) are
still reachable: Anki via its `/anki` route, Session via its kept
route.

### One primary navigation per viewport

On desktop widths the horizontal top bar is the **only** primary
navigation - there is no hamburger button and no drawer. On narrow
/ mobile widths the top-bar links move behind a **hamburger
drawer** (same grouped entries), and the bottom tab bar below
provides the primary tabs. Both presentations render from one
shared list of destinations, so they always lead to the same
pages. The active item carries `aria-current`, every target is at
least 44px, and it works across all themes. (The Settings page has
its own separate section sidebar for its own tabs - that one is
unrelated to the primary navigation.)

---

## Mobile: bottom tab bar

On small screens a **bottom tab bar** gives five thumb-friendly
tabs - **Learn / Content / Discover / Progress / More** - with a
"More" bottom sheet for everything else. Targets are 44px, it
respects all themes, and it hides on the onboarding funnel and
during a lesson so nothing covers the content.

---

## Hubs and redirects

Two pages became **tabbed hubs**, mounting only the active tab:

- **ProgressHub** (`/progress`) embeds Progress + Learning
  Statistics + Curriculum.
- **Content hub** (`/content`) embeds Discover + My content +
  Import (Discover is the default tab).

Old URLs are preserved by redirects, e.g. `/statistics` →
`/progress?tab=stats`, `/curriculum` → `/progress?tab=paths`,
`/discover` → `/content?tab=discover`, `/import` →
`/content?tab=import`.

---

## Related pages

- [Progress](progress.md) - the ProgressHub tabs
- [Content Browser](../features/content-browser.md) - My content
- [Discover content](../features/discover.md) - the catalog
