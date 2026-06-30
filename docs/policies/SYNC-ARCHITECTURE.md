# Sync architecture and the Sync-UI gate

How the local-network sync feature is exposed in the UI, why the Sync
section is currently API-mode-only, and what has to change when Phase 1
LAN Mode lands. This document is the reference for the `SYNC-UI-GATE`
rule in [`.claude/rules/architecture.md`](../../.claude/rules/architecture.md).

## Three roles in the sync system

Sync is not a single feature with one UI. It is one feature seen from
three different device roles. Each role can use a *different slice* of
the sync surface — or none of it.

| Role | Storage mode | Sync UI it needs | Example |
|------|--------------|------------------|---------|
| **Desktop (server)** | API (a local backend is running) | Generate pairing QR code, sync status, "Sync Now" — the device is the sync authority | `localhost:18001` |
| **Mobile (client)** | Dexie (no backend of its own) | Scan QR / paste pairing link, then sync status after pairing — the device is a client of a desktop server | Phone on the same LAN |
| **PWA-only** | Dexie (no backend reachable, no pairing target) | Nothing. No sync UI at all. | `astrapi69.github.io` |

The distinction that matters: **Dexie mode is not one thing.** A phone
that pairs to a desktop backend (Mobile client) and a GitHub-Pages
visitor with nothing to pair to (PWA-only) both run `resolveStorageMode()
=== "dexie"`, but they need opposite UIs — pairing controls vs. nothing.
The current code cannot yet tell them apart (see below).

## How the storage mode is resolved

`resolveStorageMode()` in
[`frontend/src/storage/index.ts`](../../frontend/src/storage/index.ts)
returns `"api"` or `"dexie"`, picked from, in order:

1. `localStorage["adaptive-learner.storage_mode"]` — the user's explicit
   choice in Settings.
2. Build-time `VITE_STORAGE_MODE` — the GitHub Pages build sets this to
   `dexie`.
3. Auto-pick — defaults to `api`.

It is a **binary** signal. It does not distinguish "Mobile client paired
to a desktop" from "PWA-only with no backend in reach".

## Current state (v1.61.0+)

- **Phase 1 LAN Mode is not implemented yet.** There is no
  production-ready pairing/coupling flow.
- Therefore the entire Sync section is behind a single API gate in
  [`frontend/src/pages/Settings.tsx`](../../frontend/src/pages/Settings.tsx):

  ```tsx
  {resolveStorageMode() === "api" && <SyncSection />}
  ```

- This is **correct for now**: without a working LAN Mode, the
  Mobile-client pairing UI (`PhoneUnpairedView` in
  [`SyncSection.tsx`](../../frontend/src/components/SyncSection.tsx)) would
  run into nothing — a QR scanner that can never reach a live desktop,
  a pairing field that can never complete. A control that cannot
  function must not be shown (see the rule below).
- Tracking issue: [#51](https://github.com/astrapi69/adaptive-learner/issues/51).

The gate mirrors the sibling `IdentitySection` gate in the same Data
tab, which is also API-only for the same reason (it needs a backend).

## When Phase 1 LAN Mode is implemented

The binary gate (API vs. Dexie) must be rebuilt into the **three-way**
distinction:

- **Desktop (server)** → render the server side: generate QR, show the
  device as the sync authority, "Sync Now".
- **Mobile (client)** → render the client side: scan QR / paste pairing
  link, then sync status once paired.
- **PWA-only** → render nothing.

### Open architecture decision

Telling **Mobile client** apart from **PWA-only** — both are
`dexie` — is not yet decided. Two candidate approaches:

1. **Device detection** — infer "this is a phone on a LAN that could
   pair" from the environment.
2. **Explicit "I am a mobile client" flow** — the user opts into the
   client role, which unlocks the pairing UI.

Pick one when Phase 1 LAN Mode is scoped. Until then, do **not**
reintroduce the pairing UI in Dexie mode — it would be a dead control
on the PWA-only deployment, which is exactly what issue #51 removed.

See the Phase 1 proposal in
[`docs/explorations/ROADMAP-PHASE-1-VORSCHLAG.md`](../explorations/ROADMAP-PHASE-1-VORSCHLAG.md).

## The governing rule

**A function that is not available is not offered.** No dead buttons,
no greyed-out placeholders, no "not available" hints. If the function
does not work for this role, the UI for it does not exist.

This is the same rule as "Dexie-mode is part of the contract" in
[`.claude/rules/lessons-learned.md`](../../.claude/rules/lessons-learned.md),
applied at the UI-surface level: the correct way to "support" a feature
that a role cannot use is to not render it, not to render it broken.
