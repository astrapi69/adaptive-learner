# Backup and restore

Adaptive Learner can back up your entire learning state into a
single file and restore it on another device, in a fresh
installation, or after switching browsers. You find everything
under **Settings → Data**.

<!-- TODO: Screenshot - Settings → Data with the "Create backup" and "Restore" buttons -->

---

## What the backup contains

A backup is a **complete snapshot**: all data tables (learning
projects, sessions, lesson progress, element-level errors,
gamification with XP/streak/badges, missions, Anki cards, notes
and more), **your downloaded content sets**, and a **localStorage
snapshot** (your contributions, custom learning paths and local
preferences).

**Also included:** connected content repositories, redeemed invites
and whether the Learning Repository is switched on.
In browser mode the results of your AI content checks come along
too, so the "AI-checked" badge stays.

**Not included** are, for example:

- the access token of a private repository (enter it again after
  restoring);
- the Learning Repository folder, which belongs to the device;
- in server mode, lesson progress and voice recordings that were made
  offline and have not reached the server yet;
- cached search indexes and media lists, the auto-backup counter and the
  LAN-sync position.

The setting whether auto-backup is on, by contrast, is included. In
server mode the app keeps a record in this browser of what is created
offline: up to 50 changes to lesson progress and voice recordings; if
more pile up, the oldest are dropped. It transfers them on its own when
the connection comes back while the app is open, or at the next start
with a connection. Of what is created offline, only what has already
reached the server goes into the backup, so in server mode create a
backup only once the app has run with a connection again after
learning offline and has been able to transfer the changes.

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
notice** (toast) appears that does not disappear on its own - so
you never miss an error. In Developer Mode (Settings > Diagnostics & Support)
the message contains the technical details for a GitHub issue.

If the same lesson is on this device and in the backup, the two
are merged: a completed lesson stays completed, unless it was
restarted after that completion. Of two lessons in progress, the
one that got further is kept. The attempts, the best result and
the attempt history of both sides are kept.

---

## Cross-identity import

You do **not** have to be the same user on the same device.

- **On an empty device**, import the backup right at the start (see
  "Backup at first login"). The app then takes over the profile from the
  backup.
- **On a device where you already created a profile**, you can import the
  backup via Settings > Data. If it belongs to another profile, the
  confirmation dialog tells you so before the import. The progress from the
  backup is then assigned to your **active profile** and merged with yours:
  lesson progress, mistakes, runs, recordings, projects and history are
  added, and your own progress stays. XP, streak and settings are taken
  from the backup. Your active profile stays active; no second profile is
  created.

---

## Backup at first login

When you restart the app (or start it for the first time on a
device), Adaptive Learner actively offers to import an existing
backup instead of starting from an empty state. This way, after a
device or browser switch, you immediately get back into your
learning flow.

---

## Both storage modes

Backup and restore work in **both** storage modes - server (API)
and browser-only (Dexie/IndexedDB). The backup is an **`.alb`
file** - a ZIP archive that bundles the data tables, the
localStorage snapshot and the content sets. `.alb` files are
accepted at every backup-import surface (Settings → Data and the
Danger Zone). Older single-JSON backups still import cleanly.

A backup from a newer version of the app is restored with
everything this version knows, and a note afterwards names what it
skipped. A backup this version cannot read, because its format is
too new or its version cannot be read, is not imported, and a
message says why.

!!! note "Privacy"
    The backup stays entirely in your hands. It is only stored
    wherever you put it - nothing is sent to a server.

---

## Related pages

- [Settings](../user-guide/settings.md) - an overview of all data actions
- [Multiple content repositories](content-repos.md) - connected repos and redeemed invites travel with the backup
