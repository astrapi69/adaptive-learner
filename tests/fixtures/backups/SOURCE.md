# Backup fixtures: one real export per released format (#3786)

Every file here was written by the export of the release it names. None of them was written by hand. A restore test reads each file in both storage modes and asserts that its rows arrive: `backend/tests/test_backup_fixtures.py` and `frontend/src/storage/backup/backup-fixtures.test.ts`. A file is never edited after it is checked in. A new format gets a new file from the release that ships it.

| File | Format | Written by | Commit |
|---|---|---|---|
| `api-1.2.0-v1.66.0.json` | 1.2.0 | backend export, v1.66.0 | `114cca060` |
| `api-1.3.0-v2.11.0.json` | 1.3.0 | backend export, v2.11.0 | `bfaa5c4a7` |
| `api-1.4.0-v2.15.0.json` | 1.4.0 | backend export, v2.15.0 | `921cc9a5a` |
| `dexie-1.5.0-v2.15.0.json` | 1.5.0 | browser export, v2.15.0 | `921cc9a5a` |
| `api-1.6.0-v2.16.0.json` | 1.6.0 | backend export, v2.16.0 | `a896887ea` |
| `api-1.9.0-v2.17.1.json` | 1.9.0 | backend export, v2.17.1 | `57998577d` |
| `dexie-1.9.0-v2.17.1.json` | 1.9.0 | browser export, v2.17.1 | `57998577d` |

Formats 1.7.0 and 1.8.0 never shipped in a release; v2.17.0 went out with 1.9.0. The browser exported 1.4.0 from v1.89.0 to v2.11.x and 1.5.0 from v2.12.0 to v2.15.x, the backend 1.3.0 until v2.11.x and 1.4.0 from v2.12.0 to v2.15.x.

## How they were made

**Backend files.** In a detached worktree at the tag, with that tag's own `poetry install --sync`, one pytest file was run and then thrown away. Under pytest, the conftest isolation applies. The file:

1. seeded the in-memory database with that tag's `_seed_all_tables` from `backend/tests/test_backup_service.py`, which writes one row in every table the tag knows;
2. called that tag's `create_backup(repo or db, user_id)`;
3. wrote the payload with the export route's own serialization, `json.dumps(payload, indent=2, ensure_ascii=False, default=str)`. That call is the same in every tag listed.

The seed's names and values are test data. The `api_key_backups` row carries the placeholder `gAAAAAB-ciphertext-blob`, never a key.

**Browser files.** In the same worktree, one vitest file:

1. restored the backend file of that tag through the tag's own `restoreDexieBackup`;
2. set three real preferences (`adaptive-learner.theme`, `.language`, `.gestures_enabled`);
3. exported the way the tag's Settings button does:
   - v2.15.0: `withLocalStorageSnapshot(await storage.backup.export(userId))`;
   - v2.17.1: `exportPortableBackup(userId)` with `VITE_STORAGE_MODE=dexie`.

A real download wraps the same payload as compact JSON in the `data.json` of an `.alb`; these files carry it with two-space indentation.

v2.15.0's `bun.lock` would not install frozen under Bun 1.4.2 ("overrides changed"). It was installed without `--frozen-lockfile`. That only aligned the lock's specifier lines with `package.json`. The resolved versions stayed the same: `dexie` 4.4.6, `vitest` 5.0.1, `happy-dom` 20.14.5 and `fake-indexeddb` 6.2.5, checked against the tag's lock.

The browser export of v2.17.1 carries no `api_key_backups` rows: browser-mode exports leave the key table out (#3367).
