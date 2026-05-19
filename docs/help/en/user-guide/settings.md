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
