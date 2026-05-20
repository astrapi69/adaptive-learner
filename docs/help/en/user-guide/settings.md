# Settings

The Settings page is short on purpose. Five sections:

1. **Language** — UI language (DE / EN / ES / FR / EL / PT /
   TR / JA). Live-swaps every string the next render.
2. **AI provider** — which provider sees your messages
   (Anthropic / OpenAI / Gemini). Live-applied; the next
   message you send uses the new provider.
3. **Model overrides** — per-provider model picker. Empty =
   use the plugin's default. Datalist hints suggest the
   common options.
4. **API keys** — one per provider. Stored encrypted (Fernet)
   in Server mode; stored cleartext in IndexedDB in Local
   mode. The frontend only sees a `has_<provider>_key: bool`
   flag for each.
5. **Storage mode** *(v0.7.0+)* — Server vs Local.

## Language

The dropdown writes through `PATCH /api/settings/{user_id}` to
update both `User.language` and `UserSettings.language` in one
transaction. The i18n provider on the frontend also reloads
the strings, so the swap is instant. Persisted across reloads
via `localStorage`.

Five languages are first-class. PT / TR / JA ship as English
passthroughs with placeholder text — translations land when a
native speaker contributes them.

## AI provider

The dropdown writes `active_provider` to UserSettings. The
next message you send fires `ai_complete` against the new
provider's plugin (Server mode) or the new provider's HTTP
client (Local mode). The Active badge in the API-keys section
follows the dropdown.

## Model override

Each provider has a default model picked for the cheap-and-
fast tier (e.g. `claude-3-5-haiku-latest`, `gpt-4o-mini`,
`gemini-2.0-flash`). The override input lets you pick a
different model per provider — your `claude-sonnet-4` calls
will land if you set Anthropic's override.

Empty override = use the plugin's default. A datalist
attached to the input suggests the common options (e.g.
`claude-3-5-sonnet-latest`, `claude-haiku-4-5-20251001`).

## API keys

Each provider has its own row: a key-entry input, a
"Save key" button, a "Delete key" button. The active
provider's row carries an "Active" badge so you don't lose
track of which key the next session will use.

Keys never leave your device cleartext:

- **Server mode**: the backend encrypts with Fernet
  (`ADAPTIVE_LEARNER_SECRET_KEY`) before persisting. The
  decryption happens server-side only at the moment of an AI
  call.
- **Local mode**: the key sits in IndexedDB on your own
  device, no server roundtrip. Acceptable threat model
  because the data never leaves the browser; the AI provider
  IS the only network endpoint that sees the key.

## Storage mode {#storage-mode}

The v0.7.0 toggle between **Server** and **Local (Browser)**
storage:

- **Server** — every read and write hits the FastAPI backend.
  Requires a running backend. Best when you want to use the
  same data from multiple devices (sync is server-side).
- **Local (Browser)** — every read and write hits IndexedDB
  in this browser. AI calls fire direct to the provider. No
  backend required. Best when you want a private,
  device-local setup with zero infrastructure.

Switching modes saves your choice to `localStorage` and
toasts a "reload required" notice. Data is NOT synced between
modes — files in one are invisible to the other until a
future sync feature lands.

The Local-mode view shows per-table row counts so you can see
what's persisted (users, learningProjects, sessionMessages,
progressCommits, etc.).

## About

The last section of Settings shows the **About panel**: five
read-only blocks describing the running app.

- **Version**: app version (from the canonical
  `pyproject.toml`), short build hash (linked to the GitHub
  commit when available), and build date.
- **System**: storage mode (Server vs Local Browser), data
  directory, database path (Server mode only), Python version
  (Server mode only), platform, and the bundled backend
  dependency versions (FastAPI, SQLAlchemy, Pydantic,
  PluginForge).
- **Credits**: author, dependency acknowledgements, tagline.
- **Support development**: three donation channels — Liberapay
  (preferred), GitHub Sponsors, and Ko-fi. Each opens in a new
  tab.
- **License & resources**: MIT license link, repository link,
  documentation link, and the issue tracker.

In **Local (Browser)** storage mode the panel shows the same
shape but hides the rows that only make sense for a running
backend (Python version, FastAPI / SQLAlchemy / Pydantic /
PluginForge versions, database path). The storage label
switches from *Server (FastAPI + SQLite)* to *Local Browser
Storage (IndexedDB)* so it's always clear which side you're on.

## Backup

The **Backup section** sits right above About and lets you
snapshot or restore your entire account as a single JSON
file. The same file works in either storage mode: a backup
created in Server mode can be restored in Local mode and
vice versa.

### Create Backup

Click **Create Backup** to download a file named
`adaptive-learner-backup-YYYY-MM-DD-<short-id>.json`. It
contains every record the system has stored for your account
across 16 tables (users, projects, profiles, curricula,
topics, lessons, sessions, messages, ratings, notes, progress
commits, method switches, step evaluations, plus imported
conversations + messages).

The file is pretty-printed JSON so you can open it in a text
editor before trusting a restore.

**API keys are never included.** After a restore you have to
re-enter every provider key in the AI provider section.

### Restore from Backup

Click **Restore from Backup**, pick a `.json` file produced
by Create Backup. Adaptive Learner reads it locally and shows
a comparison table: per table, the current row count next to
the incoming row count. Click **Confirm restore** to apply
the merge, **Cancel** to abort.

Restore is a MERGE, not an overwrite:

- New records are inserted.
- Existing mutable records are updated only when the backup
  is newer (timestamp comparison).
- History rows (sessions, messages, ratings, progress
  commits, method switches, step evaluations) are immutable —
  duplicates are skipped.
- Nothing is ever deleted.

A summary card after the restore lists inserted / updated /
skipped counts plus any rows that could not be restored.

### Reminder

The section shows the timestamp of your last backup. After 7
days you get a subtle reminder to make a fresh one.

### Auto-backup (Local mode only)

In Local (Browser) storage mode the panel also shows an
**Auto-backup** block. The system keeps a rolling ring of 3
automatic snapshots in a separate IndexedDB database. A new
auto-backup runs:

- after every 10 completed sessions, OR
- after 7 days have passed since the last auto-backup,
- whichever fires first.

The toggle lets you turn auto-backup off. **Back up now**
forces an immediate snapshot regardless of the toggle. Each
snapshot in the list has its own **Restore** + **Delete**
buttons.

If browser storage usage gets close to the quota (above
90 %), a warning banner appears urging you to export a
manual backup to a file before the browser evicts the
IndexedDB store.
