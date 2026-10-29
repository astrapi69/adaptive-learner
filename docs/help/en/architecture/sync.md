# Sync architecture

Adaptive Learner is local-first. In the Server storage mode (internally
API) the desktop app's backend stores the learning data; only a little
stays in the browser, for example some settings and, until they are
transferred, changes saved offline (see [Settings](../user-guide/settings.md)).
In the Local (Browser) storage mode, internally called Dexie, the
learning data is kept in the IndexedDB of the browser the app runs in.
**Syncing** is meant to connect devices over the local network in the
future; it is not usable yet (see the SYNC-UI-GATE section below).
The full reference is in
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Three device roles

The sync UI is planned differently depending on the device's role:

| Role | Storage mode | Sync UI |
|---|---|---|
| Desktop (server) | API | generate QR, status, "Sync now" |
| Mobile (client) | Dexie | scan QR / paste link, status after pairing |
| PWA-only | Dexie | none |

---

## SYNC-UI-GATE: principle and current state

The principle is: only show what works. LAN mode (phase 1) is only
partly implemented and not usable yet. Of the pairing views, so far
only the one that generates a pairing link is reachable, and that one
only in the desktop app's Server storage mode; the view that redeems
the link on another device (paste link, scan QR code) is deliberately
switched off. The gate follows the storage mode:

- In the **Server** storage mode (internally API), which exists only in
  the desktop app, the *Settings > Data > Sync* area offers only the
  generation of a pairing link: it shows input fields for host and port
  and the button "Generate pairing code"; after a click on it, a QR
  code, the pairing link and a copy button appear.
- In the **Local (Browser)** storage mode, internally called Dexie, the area
  stays visible, but shows no controls, instead the notice "Only
  available with the desktop app." The browser version always uses this
  storage mode, also as an installed web app (PWA); in the desktop app
  it can be chosen as well. Since #335/#336, functions that work only
  with the desktop app's backend are disabled with a notice instead of
  hidden; here, whether sync is disabled is decided by the storage
  mode, not by the kind of app.
- The redeem view would appear only in the Local (Browser) storage
  mode, where the area is disabled; it therefore never appears.

Because no device can be paired, the view for a paired device does not
appear either, and so neither does its "Sync Now" button; sync
exchanges no data.

Today the area departs from the principle in these ways, among others:

- Its description "Pair devices and keep data in step." promises
  pairing and keeping data in step, neither of which exists yet.
- In the Server storage mode the desktop app offers the generation of
  a pairing link that no device can redeem yet.
- The notice "Only available with the desktop app." points to the
  desktop app, which cannot be used for syncing yet either; in the
  desktop app itself it appears in the Local (Browser) storage mode.

Once LAN mode is implemented, the binary gate (API vs. Dexie) is to
become the three-way gate from the table above. The redeem view is to
be switched back on only with this gate. If it were switched on while
the binary gate still applies, it would appear on every device in the
Local (Browser) storage mode, because this gate does not distinguish
the roles "Mobile (client)" and "PWA-only". There it would be a dead
control: as long as LAN mode is not implemented, on every one of these
devices, and even after it is implemented, still on devices in the
"PWA-only" role, as long as the binary gate applies.

---

## Related pages

- [Storage layer](../developer/storage-layer.md) - the dual storage abstraction
- [Backup and restore](../features/backup.md) - manual data transfer without sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
