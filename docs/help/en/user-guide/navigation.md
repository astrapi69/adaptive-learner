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

- **Learn** - Dashboard, Learning Path and Session.
- **Content** - the **Content hub** (`/content`) with four tabs:
  *Discover* (the catalog), *My content* (what you downloaded),
  *Import* and *Create* (a new lesson of your own). The hub opens on
  the first tab of your order; by default that is Discover. You can
  change the order under *Settings > General > Appearance*.
- **Progress** - the **ProgressHub** (`/progress`), with Overview,
  Statistics and My paths as tabs.
- **Settings** and **Help** round out the bar.

Anki is not an entry of its own; it is an action on the Content
page, and its `/anki` route keeps working.

### One primary navigation per viewport

On desktop widths the horizontal top bar is the **only** primary
navigation - there is no hamburger button and no drawer. On narrow
/ mobile widths the same grouped entries move behind a **hamburger
drawer**. Both presentations render from one shared list of
destinations, so they always lead to the same pages. The active
item carries `aria-current`, every target is at least 44px, and it
works across all themes. (The Settings page has its own separate
section sidebar for its own tabs - that one is unrelated to the
primary navigation.)

---

## Mobile: bottom tab bar (optional)

On a phone the navigation sits at the top as a menu button by
default. Under *Settings > General > Interface*, **Menu position
(mobile)** switches it to **Bottom (tab bar)**: a bar with five
thumb-friendly tabs - **Learn / Content / Learning Path / Progress
/ More**. *More* opens a bottom sheet with Settings and Help. The
hamburger drawer stays available in both positions. Targets are
44px, the bar respects all themes, and it hides on the onboarding
funnel and during a lesson so nothing covers the content.

---

## Hubs and redirects

Two pages are **tabbed hubs**, mounting only the active tab:

- **ProgressHub** (`/progress`) embeds Progress + Learning
  Statistics + Curriculum.
- **Content hub** (`/content`) embeds Discover + My content +
  Import + Create.

Old URLs are preserved by redirects, e.g. `/statistics` →
`/progress?tab=stats`, `/curriculum` → `/progress?tab=paths`,
`/discover` → `/content?tab=discover`, `/import` →
`/content?tab=import`.

---

## Related pages

- [Progress](progress.md) - the ProgressHub tabs
- [Content Browser](../features/content-browser.md) - My content
- [Discover content](../features/discover.md) - the catalog
