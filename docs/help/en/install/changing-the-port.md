# Changing the port (and keeping your data)

The desktop launcher lets you change the port Adaptive Learner runs on
(it defaults to **8501**). This is handy when another app already uses
that port - but there is one consequence worth knowing before you do it.

## Why the port matters for your data

A web app's storage is tied to its exact web address, including the
port. `http://localhost:8501` and `http://localhost:8502` are two
**different** addresses as far as your browser is concerned, and each
gets its own separate storage.

What this means in practice depends on how you run Adaptive Learner:

- **Server mode** (the default for the desktop launcher). Your sets,
  lessons, and progress live in the app's own backend, not in the
  browser. They are **not** affected by a port change - the app finds
  them again automatically on the new address.
- **Browser storage mode** (the option you can turn on in
  *Settings > Data*, and the mode the public web version uses). Your
  sets, progress, and self-authored exercises live **in the browser**,
  tied to the current address. After a port change the app opens on the
  new address with empty browser storage, so it looks like a fresh
  start. **Your data is not deleted** - it is still stored under the
  previous port, just not visible on the new one.

## Move your data to the new port

If you use browser storage mode and you have already changed the port,
your data is waiting under the old address. Bring it across with a
backup:

1. Go **back to the previous port** (for example
   `http://localhost:8501`). Your data appears again.
2. Open **Settings > Data > Export backup** and save the `.alb` file.
3. Switch to the **new port**.
4. On the welcome screen choose **Restore from backup** and pick the
   `.alb` file. Everything - sets, progress, exercises, and your
   settings - is restored.

See [Backup and restore](../features/backup.md) for more on backups.

## Avoid the surprise: back up first

The safest habit is to **export a backup before you change the port**,
so you can restore it on the new address if anything is missing. A
regular backup is good insurance in general - it also lets you move your
learning between devices.
