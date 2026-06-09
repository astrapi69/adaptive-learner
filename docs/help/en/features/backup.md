# Backup and restore

Adaptive Learner can back up your entire learning state into a
single file and restore it on another device, in a fresh
installation, or after switching browsers. You find everything
under **Settings → Data**.

<!-- TODO: Screenshot — Settings → Data with the "Create backup" and "Restore" buttons -->

---

## What the backup contains

A backup is a **complete snapshot**: all 30 data tables (learning
projects, sessions, lesson progress, element-level errors,
gamification with XP/streak/badges, missions, Anki cards, notes
and more) **plus your downloaded content sets**. Nothing important
is left behind.

Before the export, the app shows a **"Your backup contains …"**
preview with record counts per area, so you can see what will be
backed up before saving.

---

## Creating a backup

1. Open **Settings → Data**.
2. Press **Create backup**.
3. In browser-only mode you can choose a save location directly
   via the File System Access API ("Save to disk"); if the browser
   does not support it, the app downloads the file instead.

**Auto-backup:** Optionally, the app keeps a rolling ring of the
most recent snapshots, so you are never left without a backup.

---

## Restoring

1. **Settings → Data → Restore**.
2. Choose the backup file.
3. The app imports each table and scrolls to the top to a
   **per-table summary** (added / updated / skipped), so you can
   see exactly what was imported.

If something goes wrong during the import, a **persistent error
notice** (toast) appears that does not disappear on its own — so
you never miss an error. In Developer Mode (Settings → Interface)
the message contains the technical details for a GitHub issue.

---

## Cross-identity import

You do **not** have to be the same user on the same device. A
backup can be imported into a **fresh installation** or under a
**different user profile**. The restore assigns the data to the
active profile and cleanly re-resolves internal references
(foreign keys) in the process, so your progress stays coherent —
including lesson step progress, streak and badges.

---

## Backup at first login

When you restart the app (or start it for the first time on a
device), Adaptive Learner actively offers to import an existing
backup instead of starting from an empty state. This way, after a
device or browser switch, you immediately get back into your
learning flow.

---

## Both storage modes

Backup and restore work in **both** storage modes — server (API)
and browser-only (Dexie/IndexedDB). The format is a single JSON
file; there is no proprietary archive format.

!!! note "Privacy"
    The backup stays entirely in your hands. It is only stored
    wherever you put it — nothing is sent to a server.

---

## Related pages

- [Settings](../user-guide/settings.md) — an overview of all data actions
- [Multiple content repositories](content-repos.md) — connected repos are part of the snapshot
