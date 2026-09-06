# Settings

The Settings page collects everything you can tweak without
touching code or YAML. It is organized as a **tabbed page**: pick a
tab and its panel opens, so you are not scrolling one long list top
to bottom. The tab groups are:

- **General**: profile (display name + avatar), UI language,
  appearance / theme, and interface
  options (gestures, tooltips, Developer Mode).
- **AI**: provider + model picker, per-provider API keys with
  source attribution, and the configured-providers overview.
- **Learning**: how lessons play (default mode, exam threshold,
  timed difficulty, hints, reminders, the Enter shortcut, exercise
  direction), the content view, and the Content-hub tab order.
- **Data**: storage mode, sync, backup (export / import / compare),
  and the encrypted key export.
- **Voice**: TTS / STT / pronunciation toggles.
- **Gamification**: XP / badge notifications, weekend mode, daily
  goal, and reset progress.
- **About**: version, system info, credits, donations, license.

## Profile

Under *General > Profile* you set your **display name** and style
your **avatar**:

- **Upload picture** opens the crop dialog; the result shows in the
  top-right of the navigation.
- **Or pick a figure**: eight preset figures as an alternative to
  your own photo - one click is enough. If an uploaded photo is
  active, a dialog asks before the figure replaces it; the photo is
  parked in a stash and can be brought back anytime via **Restore
  photo** (until a new photo is uploaded).
- **Avatar frames**: decorative rings around the avatar. Bronze,
  silver, and gold unlock with your level, the flame with the 3-day
  streak badge; star and accent are exchanged for XP (two-step
  confirmation, the cost is printed on the button). Locked frames
  show their condition.

Your choice and purchased frames persist and travel with your
[backup](backup.md).

## Language

Live-swaps every UI string on the next render via `PATCH
/api/settings/{user_id}`. All 11 languages are first-class -
DE / EL / EN / ES / FR / HI / ID / JA / KO / PT / TR - each
with a fully translated catalog. Persisted across reloads via
`localStorage`.

## AI provider + model picker

The provider dropdown writes `active_provider` to
UserSettings; the next AI call goes through the new
provider's plugin (Server mode) or the new provider's HTTP
client (Local mode).

The **Model picker** is a searchable
dropdown grouped Recommended / All, populated from each
provider's live `/v1/models` endpoint (1h cache). Each row
shows the human name + raw id + context-window badge. When
the discovered list is unavailable (no API key, no network),
the picker falls back to the static defaults and surfaces a
"using offline default" hint. The Session header reads
`<Provider>: <Model name>`; the full id + context window
sit in the tooltip.

## API keys

Each provider has its own row: a key-entry input, a Save
button, a Remove button, the active-provider badge, plus the
new **source attribution** badge:

- **Key from: Settings** - the key is stored Fernet-encrypted
  in the DB (Server mode) or cleartext in IndexedDB (Local
  mode). You can Save / Remove freely.
- **Key from: secrets.yaml** - the key is configured in
  `~/.config/adaptive-learner/secrets.yaml`. The Save button
  is disabled; edit the file directly to change it. An info
  banner under the row reminds you of the path.
- **Key from: environment** - the key is configured via the
  `ADAPTIVE_LEARNER_<PROVIDER>_API_KEY` environment variable.
  Save disabled; the env var is the source of truth.
- **No key configured** - nothing's set anywhere. Type and
  hit Save to start.

Resolution chain (highest priority wins): env > secrets.yaml
> DB. See [the Configuration doc](https://github.com/astrapi69/adaptive-learner/blob/main/docs/configuration.md) for
the full breakdown.

Key inputs use a masked **secret input** (with a show/hide
toggle) and do not trigger the browser's password manager.

API keys are deliberately **excluded** from the normal backup
(`.alb`). To carry your keys to another device or browser, use the
dedicated **encrypted key export (`.alk`)** - there is a
**reference button** here in the AI tab that jumps straight to it
on the **Data tab** (see *Encrypted key export* under
[Backup](#backup)).

## Configured providers

A **configured-providers overview** lists the AI providers you
have set up, each with a **masked key preview** so you can see at
a glance which providers are ready. Every row has a **Test button**
that calls the provider's models-list endpoint and reports back
ok / invalid key / rate-limited / network error - a safe check
that does not spend generation tokens.

## Storage mode

The toggle between **Server** and **Local (Browser)** storage:

- **Server** - every read and write hits the FastAPI backend.
  Requires a running backend. Best for multi-device usage
  with backend-side sync.
- **Local (Browser)** - every read and write hits IndexedDB
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

### Encrypted key export (.alk)

The normal backup strips your API keys, which is safe but means a
device or browser switch otherwise forces you to re-enter every
key by hand. The **encrypted key export** closes that gap with a
separate, passphrase-protected file:

- It carries **only** the sensitive credentials - your **API keys**
  plus the provider settings (active provider, model overrides). It
  does NOT contain the rest of your app data (that stays in the
  `.alb` backup).
- **Export** asks for a passphrase (plus confirmation) and
  downloads a dedicated **`.alk`** file. The keys inside are
  encrypted with **AES-GCM-256**, with the key derived from your
  passphrase via **PBKDF2** - the file never contains a key in
  plaintext.
- **Import** reads an `.alk`, asks for the passphrase, decrypts and
  writes the keys + provider settings back into the same secure
  storage manual entry uses (present providers are overwritten,
  absent ones left alone).
- A **wrong passphrase or a tampered file** is rejected cleanly
  with a single message and **no partial import** - nothing is
  half-written.
- The passphrase fields validate **inline** as you type - a
  too-short passphrase or a mismatched confirmation is shown right at
  the field (and the submit button stays disabled) instead of firing
  an error toast after you click. Like the API-key inputs, these
  passphrase fields do **not** trigger the browser's password
  manager.

This export lives on the **Data tab**, next to the normal backup;
the **AI tab** only carries a reference button that brings you
here. In **Local (browser) mode** the keys live in IndexedDB, so
the export is fully available (and is the main use case). In
**Server mode** the keys are held server-side and the client never
sees the plaintext, so the entry is **disabled with a hint**. The
export is also disabled when no exportable key is configured yet.

### Housekeeping

Two data-lifecycle settings sit on the Data tab right next to the
storage they govern:

- **Maximum lesson size** (directly below *Offline cache*): when a long
  chat analysis is saved as an offline lesson, lessons with more than
  this many steps are split into several parts. *Steps per part* takes
  5 to 20; the default is 10.
- **Paused lesson retention** (directly above the *Disconnected content*
  cleanup, which only appears when there is something to clean up):
  paused lessons older than this are abandoned automatically on the
  next Dashboard load. Choose 7, 14, 30 or 60 days, or *Never*; the
  default is 30 days. Up to 10 paused lessons are kept regardless of
  age.

Both values are stored in this browser and apply in Server and Local
mode alike.

## Voice

Three toggles:

- **TTS enabled** - adds a ▶ button next to AI replies +
  Assessment results that reads them aloud. Picks the
  language-matched voice when available; rate + pitch
  clamped to [0.5, 2.0].
- **Auto-play AI** - speaks every AI reply automatically
  (default OFF - surprise audio is rarely what you want).
- **STT enabled** - adds a 🎤 button to the Session input
  that captures speech and populates the textarea with
  interim transcripts before send.
- **Pronunciation Practice enabled** - surfaces the
  `/pronunciation` page from the Dashboard quick-start for
  Languages-tagged projects.

The **Voice** card sits on the **Learning** tab in its *Reading aloud
and dictation* area. When the browser supports neither Web Speech API
side (synthesis nor recognition), the whole area is absent, heading
included.

## Appearance

The **Theme** picker under *General > Appearance* offers six
themes plus an automatic mode:

- **Light** - the default, bright and high-contrast.
- **Dark** - dimmed surfaces for low-light use.
- **Ocean** - deep blue tones, calm and easy on the eyes at night.
- **Forest** - warm green and amber earthy tones.
- **High Contrast** - accessibility-first: black, white, and bold
  signal colors, with crisp card edges. Use this if you need maximum
  readability.
- **Sepia** - warm paper tones, comfortable for long reading.
- **Auto (System)** - follows your operating system's light/dark
  setting and switches automatically when the system does.

Pick a theme from its preview card; the change applies instantly with
no reload, and your choice is remembered across visits. Every theme is
designed to meet WCAG 2.1 AA contrast, so text, charts, badges, and
exercise feedback stay readable in all of them.

Also in this card: the **content view** - the global *list / grid*
preference for the Content hub (default **list**). It is the same
preference as the in-tab view toggle on *My content* / *Discover*, so
changing it in either place keeps both in sync. Directly below the card
you set the **order of the Content-hub tabs** (Discover / My content /
Import), so the hub opens on the tab you use most.

## Interface

Two controls: **Show button tooltips** (a hover tooltip on icon
buttons; screen-reader labels stay on regardless) and the **menu
position** on the phone (top as a menu button, the default, or bottom as
a thumb-reach tab bar). Swipe gestures are a lesson setting and live
under *Learning > In the lesson > Interaction*.

**Developer Mode** (on the **Diagnostics & Support** tab): its default
depends on the build strand: it is **ON by
default on the Latest (preview) strand** and **OFF on Main**, so
preview testers see full technical error detail while production users
get friendly messages. You can flip it either way.

## Learning

The **Learning** tab groups its cards into five labelled areas, in the
order a lesson unfolds. Each area has a small heading and a one-line
description; the cards inside keep their own titles.

A **section bar** above the areas lists them as chips: click one to jump
to that area. On a desktop the bar stays visible below the app header
while you scroll; on a phone it scrolls with the page and the row can be
swiped sideways. The bar mirrors the address: `/settings?tab=learning&section=review`
opens the tab scrolled to *After the lesson* (ids: `basics`, `lessons`,
`voice`, `review`, `motivation`), and a chip click updates the address
without adding a history entry. Switching to another tab drops the
section again. An area that is not rendered (the voice area in a browser
without Web Speech) has no chip, and an unknown section is ignored.
While you scroll, the highlighted chip follows the area on screen.

### Basics

Who is learning, and in which languages.

- **Learning profile** - create, continue or retake the learning
  profile behind the six-method weights.
- **Additional source languages** - which source languages the content
  tree shows besides your app language.

### In the lesson

How exercises behave while you answer.

- **Lesson mode** - the **default mode** (Practice / Exam / Timed), the
  **exam pass threshold** and the **timed mode difficulty** (Fast,
  Normal, Relaxed); see [Lessons and reviews](lessons.md).
- **Hints** - whether a staged hint button appears on each exercise,
  and the **XP cost per hint** (0 for free hints).
- **Interaction** - **swipe gestures** (swipe to navigate in
  Assessment, Session and Curriculum; default ON on touch-capable
  devices), **lesson keyboard shortcuts** (Enter checks the answer,
  Enter again moves on), **auto-advance on a correct answer**, and
  whether the **Ask AI** button is shown.
- **Preferred exercise direction** - which direction directional
  exercises open with.
- **Solve animation** - the effect a solved matching exercise plays.

### Reading aloud and dictation

Voices, speed, microphone and pronunciation practice.

- **Voice** - the toggles described under *Voice* above: text-to-speech,
  auto-play, speech-to-text and pronunciation practice.

This area appears only when the browser supports at least one side of
the Web Speech API (synthesis or recognition). Otherwise it is absent,
heading included, and *After the lesson* follows *In the lesson*
directly.

### After the lesson

Review sessions, the lesson summary and retrying mistakes.

- **Review** - the auto-generated error explanations and the number of
  questions per review session. The card ends with the read-only
  **Spaced repetition** block: the interval schedule (correct answers
  in a row against the days until the next review), when an item
  counts as mastered, and a link to the learning method.
- **Lesson summary** - which sections the end-of-lesson summary shows,
  and in which order.
- **Retry errors** - which mistakes the retry round picks up.

### Motivation and routine

Game mode, feedback, daily missions and reminders.

- **Game Mode** - playful lessons, including the **mascot variant**,
  color schemes for Lernfunke that unlock with levels and badges or in
  exchange for XP (locked variants show their condition, purchases ask
  for a two-step confirmation). What game mode changes in detail is
  covered in [Praise and rewards](celebrations.md).
- **Feedback** - feedback intensity and sounds (volume, test button).
- **Daily Missions** - whether missions run, how many per day, the
  difficulty mix, and a reshuffle of today's missions.
- **Reminders** - the reminder time and the days it applies to.
- **Gamification** - XP / badge toasts, weekend mode, the daily session
  goal and *Reset progress*; the last card, see below.

The game mode card shows the master switch, the game mode sounds and a
status line counting how many of the extras are on. **Game mode details**
(hearts, countdown, arcade, special rounds, tickets, bonus lessons, streak
XP and mascot) is collapsed and remembers your choice; while **Playful
lessons** is off, the options inside are greyed out.

The tab ends with **Gamification** (below a separator, because that card
holds *Reset progress*). The two housekeeping settings -
*Paused lesson retention* and *Maximum lesson size* - are data-lifecycle
settings and live on the **Data** tab (see *Housekeeping* under Backup).

The **content view** (list / grid) and the **order of the Content-hub
tabs** are on the **General** tab under *Appearance*.

### Gamification

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

### Build strand: Main vs Latest

Adaptive Learner runs on two deployment strands, and the About tab
now tells you which one you are on:

- **Main** - the stable production site
  (`https://astrapi69.github.io/adaptive-learner/`). Shown as a
  discreet badge, no warning styling.
- **Latest** - the preview/staging site built from `develop`
  (`https://astrapi69.github.io/adaptive-learner-content-test/`).
  Shown as a clear **test-version** badge so you know it may
  contain bugs.

The badge shows the strand together with the branch and the short
commit hash. It is driven by the build info baked in at build time;
a URL heuristic is only a clearly-marked fallback, and missing
info reads as "unknown" rather than guessing.

### Share the app

The About tab has a **Share the app** entry that shows a scannable
**QR code** of the public app URL, with copy / download-PNG /
native-share actions - handy for getting the app onto a phone.

When you are on the **Latest** strand, sharing offers the preview
URL as a **link only - no QR code** - together with an
instability warning, so a scanned code can never silently send
someone to the unstable test version. On **Main**, sharing works
as before with the QR code for the production URL.

### Check for updates

A **Check for updates** button compares your version against the
latest GitHub release. The desktop build additionally runs an
**auto-update checker** via the GitHub Releases API and tells you
when a newer version is available. After a PWA update, the
"new version available" banner stays dismissed once you accept it
(it no longer reappears on every reload).
