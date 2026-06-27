# Navigation

v1.91.0 restructured the app's navigation (EXP-037). The primary
navigation dropped from 12+ entries to a small set of **grouped
entries** (following the Nielsen-Norman "5-7 items" guidance) with
**no loss of function** — every page is still reachable, and old
links keep working through redirects.

<!-- TODO: Screenshot — the grouped primary navigation and the mobile bottom tab bar -->

---

## Desktop: grouped entries

The desktop navigation is organised into labelled groups via a
reusable `NavGroup` component:

- **Learn** — Dashboard and Learning Path.
- **Content** — the **Content hub** (`/content`), which holds your
  downloaded *My content*, the *Discover* catalog, and *Import* as
  tabs.
- **Progress** — the **ProgressHub** (`/progress`), with Overview,
  Statistics and My paths as tabs.
- **Settings** and **Help** round out the bar.

Pages that are no longer top-level entries (Anki, Session) are
still reachable: Anki via an action on *My content* (and its
`/anki` route), Session via its kept route.

### Vertical sidebar

On wide desktop screens the primary navigation is presented as a
**vertical left sidebar**. It uses the exact same grouped
`NavGroup` model as above — no extra entries, just a left-rail
layout that gives the grouped sections more room. The active item
carries `aria-current`, every target is at least 44px, and it
works across all themes. On narrow / mobile widths the sidebar
gives way to the bottom tab bar below. (This is the *primary*
navigation sidebar; the Settings page has its own separate sidebar
for its own tabs.)

---

## Mobile: bottom tab bar

On small screens a **bottom tab bar** gives five thumb-friendly
tabs — **Learn / Content / Discover / Progress / More** — with a
"More" bottom sheet for everything else. Targets are 44px, it
respects all themes, and it hides on the onboarding funnel and
during a lesson so nothing covers the content.

---

## Hubs and redirects

Two pages became **tabbed hubs**, mounting only the active tab:

- **ProgressHub** (`/progress`) embeds Progress + Learning
  Statistics + Curriculum.
- **Content hub** (`/content`) embeds My content + Discover +
  Import.

Old URLs are preserved by redirects, e.g. `/statistics` →
`/progress?tab=stats`, `/curriculum` → `/progress?tab=paths`,
`/discover` → `/content?tab=discover`, `/import` →
`/content?tab=import`.

---

## Related pages

- [Progress](progress.md) — the ProgressHub tabs
- [Content Browser](../features/content-browser.md) — My content
- [Discover content](../features/discover.md) — the catalog
