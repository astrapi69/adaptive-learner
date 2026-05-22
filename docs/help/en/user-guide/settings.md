# Settings

The Settings page collects everything you can tweak without
touching code or YAML. Sections, top to bottom:

1. **Language** — UI language (DE / EN / ES / FR / EL / PT /
   TR / JA, all fully translated).
2. **AI provider + model picker** — which provider sees your
   messages, and which model to use.
3. **API keys** — per-provider keys with source attribution
   (env / `secrets.yaml` / Settings).
4. **Storage mode** — Server (FastAPI + SQLite) vs Local
   (browser IndexedDB).
5. **Sync** — pair this device with another over local
   network.
6. **Backup** — export / import / compare.
7. **Voice** — TTS + STT + pronunciation toggles.
8. **Interface** — gestures + theme + density.
9. **Gamification** — XP / badge notifications + weekend mode.
10. **About** — version, system info, credits, donations,
    license.

## Language

Live-swaps every UI string on the next render via `PATCH
/api/settings/{user_id}`. All 8 languages are first-class —
DE / EN / ES / FR / EL / PT / TR / JA — each with a fully
translated catalog. Persisted across reloads via
`localStorage`.

## AI provider + model picker

The provider dropdown writes `active_provider` to
UserSettings; the next AI call goes through the new
provider's plugin (Server mode) or the new provider's HTTP
client (Local mode).

The **Model picker** (since v1.11.0) is a searchable
dropdown grouped Recommended / All, populated from each
provider's live `/v1/models` endpoint (1h cache). Each row
shows the human name + raw id + context-window badge. When
the discovered list is unavailable (no API key, no network),
the picker falls back to the static defaults and surfaces a
"using offline default" hint. The Session header reads
`<Provider>: <Model name>`; the full id + context window
sit in the tooltip.

## API keys (Phase 34 / v1.20.0)

Each provider has its own row: a key-entry input, a Save
button, a Remove button, the active-provider badge, plus the
new **source attribution** badge:

- **Key from: Settings** — the key is stored Fernet-encrypted
  in the DB (Server mode) or cleartext in IndexedDB (Local
  mode). You can Save / Remove freely.
- **Key from: secrets.yaml** — the key is configured in
  `~/.config/adaptive-learner/secrets.yaml`. The Save button
  is disabled; edit the file directly to change it. An info
  banner under the row reminds you of the path.
- **Key from: environment** — the key is configured via the
  `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` environment variable.
  Save disabled; the env var is the source of truth.
- **No key configured** — nothing's set anywhere. Type and
  hit Save to start.

Resolution chain (highest priority wins): env > secrets.yaml
> DB. See [the Configuration doc](../../configuration.md) for
the full breakdown.

## Storage mode

The toggle between **Server** and **Local (Browser)** storage:

- **Server** — every read and write hits the FastAPI backend.
  Requires a running backend. Best for multi-device usage
  with backend-side sync.
- **Local (Browser)** — every read and write hits IndexedDB
  in this browser. AI calls fire direct to the provider. No
  backend required. Best for a private, device-local setup.

Switching modes saves to `localStorage` and toasts a
"reload required" notice. Data is NOT synced between modes.

## Sync

Pair this device with another over your local network using
the QR-code scanner (rear camera) or paste the pairing URL.
Once paired, push + pull buttons exchange data
bidirectionally. Conflicts go through an AI-merge resolver
on the backend.

Restricted-browser fallback: upload a screenshot of the QR
code from your other device (`Html5Qrcode.scanFile`).

## Backup

Three things in one section: **Export** (download a
timestamped JSON), **Import** (restore from file), and
**Compare** (side-by-side diff against current state).
API keys are stripped from every export.

Restore is a MERGE, not an overwrite: new rows insert,
mutable rows update on newer `updated_at`, history rows
(sessions / commits / ratings) dedupe on UUID. The compare
preview shows per-table added / removed / changed before you
click Restore; the Restore button label reads "Restore
(N added, M updated)" once the diff settles.

In Local mode the section also shows the **Auto-backup**
block: rolling ring of 3 snapshots in a separate IndexedDB
DB, runs every 10 sessions OR every 7 days (whichever
fires first). Each snapshot has its own Restore + Delete +
Compare-as-A/B buttons.

## Voice

Three toggles (since v1.18.0):

- **TTS enabled** — adds a ▶ button next to AI replies +
  Assessment results that reads them aloud. Picks the
  language-matched voice when available; rate + pitch
  clamped to [0.5, 2.0].
- **Auto-play AI** — speaks every AI reply automatically
  (default OFF — surprise audio is rarely what you want).
- **STT enabled** — adds a 🎤 button to the Session input
  that captures speech and populates the textarea with
  interim transcripts before send.
- **Pronunciation Practice enabled** — surfaces the
  `/pronunciation` page from the Dashboard quick-start for
  Languages-tagged projects.

The Voice section hides itself when neither Web Speech API
side (synth nor recognition) is supported by the browser.

## Interface

Theme picker (5 palettes × light/dark = 10 variants),
density, and the **Gestures toggle** (since v1.10.0,
default ON for touch-capable devices). Gestures cover
Assessment swipe navigation, Curriculum topic
swipe-to-reveal, and Session cycle peek.

## Gamification

Toggles for XP / badge / level-up notifications (off
silences toasts but the system still records state),
**weekend mode** (skip Sat/Sun gaps in the streak heatmap),
daily session goal (1..10), and **Reset progress** (double-
confirm; wipes `user_xp` + `user_badges` + `user_streaks`
rows).

## About

Five read-only blocks: **Version** (canonical version from
`pyproject.toml`, build hash, build date), **System**
(storage mode, data dir, DB path in Server mode, Python +
platform info), **Credits** (author, dependency
acknowledgements), **Support development** (Liberapay /
GitHub Sponsors / Ko-fi links), **License & resources** (MIT
link, repository, docs, issue tracker).

In Local mode the panel hides the rows that only make sense
for a running backend (Python version, FastAPI /
SQLAlchemy / Pydantic / PluginForge versions, DB path).
