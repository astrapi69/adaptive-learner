# Multiple content repositories

Lessons come from **content repositories** — public GitHub repos
that bundle structured lesson sets. You are not limited to the
official catalog: Adaptive Learner can load multiple repositories
at once, connect your own, and recommend curated ones (EXP-023).

<!-- TODO: Screenshot — Settings → Data → Content repositories section with the official repo + one own repo -->

---

## The official repository

The official repo
[`astrapi69/adaptive-learner-content`](https://github.com/astrapi69/adaptive-learner-content)
is always loaded and cannot be removed. It provides the curated
default catalog (language courses, Python basics, psychology and
more). Every set from it carries the **Official** source badge in
the Content Browser.

In addition, a selection of lessons is **built into** the app
(Bundled), so the public GitHub Pages site shows content
immediately even without a network connection. If a set exists
both bundled and in the official repo, the higher version wins; on
a tie the GitHub variant is preferred.

---

## Connecting your own repository

Under **Settings → Data → Content repositories** you add a GitHub
repo URL. The app validates the repo automatically (see *Trust
levels* below), syncs the lesson catalog and stores it locally in
the same cache as official content (filesystem in server mode,
IndexedDB in browser-only mode).

- **Manual and automatic syncing.** You can press "Sync now" at
  any time; in addition, every repo updates automatically every
  24 hours.
- **Source badge.** Sets from your repo carry their own source
  badge in the Content Browser, so you can always see where a
  lesson came from.

---

## Managing multiple repositories

You can connect as many repos as you like. In the list under
**Settings → Data** you can:

- **Add** one via its repo URL,
- **Remove** one (the official repo stays protected),
- **Reorder** them — the order determines the **priority**.
  If two repos carry the same set, the one listed higher wins.

Older installations with only a single connected repo are
automatically migrated into the new list view.

---

## Sharing repositories

You can share a repo via a **deep link** and **QR code**. A link
of the form `/add-repo?...` opens the "Add repository" dialog
directly on the recipient's side with the URL pre-filled; the QR
code does the same on a smartphone. This lets you share a course
with your learning group without manual typing.

<!-- TODO: Screenshot — Share dialog with QR code -->

---

## Trust levels

Every connected repo goes through an **automatic technical
validation** that runs again on each sync. This yields a trust
level:

| Level | Meaning |
|---|---|
| **0** | Not yet validated or validation failed. |
| **1** | Technically valid: at least one lesson, no executable content. |
| **3** | **Officially recommended** — from the curated recommendation list. |

The validation is purely technical (structure + safety). A
content/community-based rating (Trust 2) needs a shared backend
service and is currently deferred.

---

## Recommended repositories

The official repo maintains a curated list
(`recommended-repos.json`). Under **Settings → Data** there is a
discovery section based on it, where you add recommended
repositories with **one click**. They appear with the
**Officially recommended** badge (Trust 3).

---

## Local ratings

You can give each repo local **stars**. This rating is entirely
private and stored only on your device — it helps you organize
your own sources. Community-wide ratings also need a shared
backend service and are deferred.

---

## Private and coach repositories

A repo can be private (for example from a teacher). For that you
store a **personal access token** per repo. The token is kept
locally (localStorage) and is deliberately **not** part of the
exportable configuration, so it is not accidentally included when
you share your settings.

---

## Related pages

- [Content Browser](content-browser.md) — find, filter, download sets
- [Creating lessons](../content-creation/overview.md) — contribute your own content
- [Backup and restore](backup.md) — connected repos are part of the snapshot
