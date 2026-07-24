# Sync architecture

Adaptive Learner is local-first: server mode (API) keeps the data
in the filesystem, browser-only mode (Dexie) in IndexedDB.
**Syncing** is meant to connect these devices over the local
network. The full reference is in
[`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md).

---

## Three device roles

The sync UI looks different depending on the device's role - and
is only shown where it is usable:

| Role | Storage mode | Sync UI |
|---|---|---|
| Desktop (server) | API | generate QR, status, "Sync now" |
| Mobile (client) | Dexie | scan QR / paste link, status after pairing |
| PWA-only | Dexie | none |

---

## SYNC-UI-GATE: only show what works

A function that is not available is **not offered** - no dead
buttons, no greyed-out placeholders. Currently (the LAN pairing
phase is not yet implemented) the sync section is therefore
visible **API-only**; without a working pairing flow the
mobile-client UI would run into nothing.

When LAN mode lands, the binary gate (API vs. Dexie) is rebuilt
into the three-way gate from the table above. The pairing UI is
**not** reactivated in Dexie mode beforehand, so that no dead
control appears on the PWA-only deployment.

---

## Related pages

- [Storage layer](../developer/storage-layer.md) - the dual storage abstraction
- [Backup and restore](../features/backup.md) - manual data transfer without sync
- [`docs/policies/SYNC-ARCHITECTURE.md`](https://github.com/astrapi69/adaptive-learner/blob/main/docs/policies/SYNC-ARCHITECTURE.md)
