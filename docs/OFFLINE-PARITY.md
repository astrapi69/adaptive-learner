# Offline parity & data portability

Adaptive Learner runs in two storage modes (see
[architecture.md](../.claude/rules/architecture.md) → *Dual storage*):

- **API mode** — FastAPI + SQLite (the desktop/server app).
- **Dexie mode** — IndexedDB in the browser (the GitHub Pages PWA).

Most persistent state lives in the DB tables (SQLite / IndexedDB) and is
already covered by the `.alb` backup. But a large class of **user
preferences and small user data lives in `localStorage`**, which the
backup historically did **not** cover. On a browser reset or a device
migration that data was lost. This document describes the mechanism that
closes that gap.

## localStorage snapshot in the backup (`.alb` / `.json`)

The backup payload (`BackupPayload`) carries an optional flat
`local_storage` block:

```jsonc
{
  "format": "adaptive-learner-backup",
  "version": "1.4.0",
  "data": { /* DB tables */ },
  "local_storage": {                       // NEW (>= 1.4.0)
    "adaptive-learner.theme": "ocean",
    "adaptive-learner.contributions": "[...]",
    "adaptive-learner.voice.tts_enabled": "true"
  },
  "stats": { /* ... */ }
}
```

- **Capture (export):** the full-backup export handlers
  (`BackupSection`, `DangerZoneSection`) wrap the payload with
  `withLocalStorageSnapshot(payload)` before it is written to the `.alb`.
  The frontend always has `localStorage`, so this works in **both**
  storage modes (in API mode the payload comes from the backend, the
  snapshot is added on the client).
- **Apply (import):** after `storage.backup.import(...)`, the restore
  handlers (`BackupSection`, onboarding first-run restore) call
  `applyLocalStorageSnapshot(payload.local_storage)`. The backend
  **ignores** the `local_storage` block entirely; localStorage is a
  browser concept and is restored client-side in both modes.
- **Backward compatible:** a pre-1.4.0 backup has no `local_storage`
  block, so import leaves `localStorage` untouched. A reader that doesn't
  know the field ignores it.

The single source of truth for the mechanism is
`frontend/src/lib/backup/localStorageSnapshot.ts`.

## What is and isn't snapshotted

**Included:** every `localStorage` key in the `adaptive-learner.`
namespace that is not excluded below — themes, voice/feedback/gamification
preferences, reminders, hints, review settings, the learning-direction
strategy, source languages, the Curriculum-Builder custom paths,
contributions + contributor name, and so on.

**Excluded** (`BACKUP_EXCLUDED_LOCALSTORAGE_PATTERNS`, case-insensitive
substring match — applied on **both** capture and apply):

| Pattern | Why excluded |
|---|---|
| `github_token` | Credential. Kept out of the exportable config (EXP-023). |
| `content_repo_token` | Per-repo credential (EXP-023). |
| `api_key` / `apikey` | Any provider key material. |
| `secret` / `password` | Any other secret. |
| `storage_mode` | Per-**device** boot setting, not user data — restoring it across devices/modes could force a mode the target can't serve (e.g. API mode onto a PWA-only install). |

Non-namespaced (third-party) keys are never captured.

> Secrets are excluded in **both** directions. The apply step re-runs the
> exclusion filter, so even a hand-edited backup that smuggled a secret
> into `local_storage` cannot inject it on import.

## For developers: classifying a new localStorage key

When you add a `localStorage` key, decide its class:

1. **User preference / user data** (theme, a toggle, a draft, a list the
   user built): use the `adaptive-learner.` prefix and it is snapshotted
   automatically. No action needed.
2. **Secret** (a token, a key, a password): use the `adaptive-learner.`
   prefix **and** make sure its name contains one of the excluded
   substrings above (or extend `BACKUP_EXCLUDED_LOCALSTORAGE_PATTERNS`).
   Add a test in `localStorageSnapshot.test.ts`.
3. **Device-local boot config** (which storage mode, dev-mode flag): if it
   must NOT travel with a backup, add it to the exclusion patterns with a
   comment, like `storage_mode`.

## Migrate true user-data to Dexie (Teil B) ✅

Teil A makes localStorage data **portable via backup**. Teil B promotes the
genuine *user data* keys to a **canonical Dexie store** so they live in the
durable IndexedDB store, not only in the fragile `localStorage`:

- `contributions` / `contributor-name` (contribution history) and
  `custom-paths` (Curriculum Builder) are mirrored into a Dexie key/value
  store `userData` (schema v29). The mechanism lives in
  `frontend/src/storage/dexie-user-data.ts`:
  - **write-through** (`mirrorUserData`) — every production write of a managed
    key is mirrored into Dexie (a Dexie failure never undoes the localStorage
    write that already succeeded);
  - **boot reconcile** (`syncUserDataAtBoot`) — at app start Dexie wins when it
    holds a value (covers a Dexie restore), otherwise an existing localStorage
    value seeds Dexie.
  - The synchronous localStorage API on `contribution-history.ts` /
    `custom-paths.ts` is kept as a **read cache**, so the React callers stay
    unchanged. All operations are **no-ops in API mode**.
- The `language` redundancy (it lived in both `localStorage` and the Dexie
  `user_settings.language` column) is resolved to a single source: Dexie
  `user_settings` is canonical, and `syncLanguageAtBoot` hydrates the
  localStorage cache from it at boot so the two never diverge.

Restore continues to flow through the Teil A localStorage snapshot: a restore
writes the keys into `localStorage`, and the next boot's reconcile seeds the
Dexie canonical store from them. The keys therefore stay in the localStorage
snapshot as well (belt-and-braces); they are deliberately **not** added to the
user-scoped Dexie record backup (they carry no `user_id`).
