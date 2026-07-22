# Manual Test Plan - Adaptive Learner v2.3.0+

Status: 2026-07-18 (Session 6, after the v2.3.0 release)
Testers: Aster + beta testers

This is the English counterpart of `testplan-adaptive-learner.md`. Keep the
two in sync when either changes.

Navigation note: the Content area is a tab hub at `/content`
(`?tab=discover` = Discover, `?tab=my` = My Content, `?tab=import` =
Import). The old routes `/discover` + `/import` redirect. **My Lessons**,
**Import a lesson**, **Edit**, **Save as file** and **Combine into a set**
all live under the **My Content** tab (`?tab=my`). Backup + the AI key vault
(KeyVault) are under **Settings → Data**; the provider overview under
**Settings → AI**; content repos under **Settings → Data**.

Structure:
- PART A: what YOU test manually (by priority)
- PART B: what is automated (reference, verifiable after the fact)

For each manual test case: OK / BUG (screenshot + browser + description)

---

# PART A: MANUAL TESTS (Aster)

Sorted by priority. Launch blockers first.

---

## PRIO 1: BACKUP ACCEPTANCE TEST (launch gate!)

**New test case under PRIO 1 backup acceptance test:**
- [ ] GitHub Pages: create backup
- [ ] Install locally (launcher)
- [ ] Import the `.alb` from GH Pages → everything carried over

This test has been defined as a launch gate since Session 2.
Never run yet. Do it NOW.

- [ ] Produce data: download at least 2 sets, start 3 lessons, switch theme
- [ ] Export: Settings → Data → Create backup → download the `.alb` file
- [ ] Check file size (should be >1MB when sets are loaded)
- [ ] Clear browser data COMPLETELY:
      DevTools → Application → Storage → "Clear site data"
      AND: delete the "adaptive-learner" IndexedDB
      AND: localStorage.clear()
- [ ] Open app → onboarding → "Restore from backup"
- [ ] Pick the `.alb` file → import starts
- [ ] NO HTTP 413 error (nginx 50MB limit fixed)
- [ ] Sets present (My Content → all previously loaded sets)
- [ ] Progress preserved (started lessons, scores)
- [ ] Settings correct (theme, language, voice settings)
- [ ] Learning-mode settings preserved
- [ ] XP + level correct
- [ ] Legacy `.json` import: old backup format → works
- [ ] API keys NOT in the backup (security check)
- [ ] After restore: the provider overview (Settings → AI) shows the
      restored settings WITHOUT a reload (settings-refresh-bus, #1769)

---

## PRIO 2: LAUNCHER (desktop)

### Basic function (Ubuntu)
- [ ] `python3 -m adaptive_learner_launcher --debug` → ONE window opens
- [ ] Window NEVER disappears on its own
- [ ] Docker check as the first step (hint when Docker isn't running)
- [ ] Live progress during install in the log area (line by line)
- [ ] "Building image..." visible (not a silent background step)
- [ ] At the end: "App is ready." in green

### Port
- [ ] Port field visible (default 8501)
- [ ] Port editable when stopped/not installed
- [ ] Port read-only when running
- [ ] CHANGE the port: 8501 → 9000 → app reachable on 9000
- [ ] Port indicator: green when running (not red)

### States
- [ ] Not installed: [Install] visible
- [ ] Running: [Open in browser] [Stop] [Uninstall]
- [ ] Stopped: [Start] [Uninstall]
- [ ] All buttons fully visible (620px wide, no clipping)

### Uninstall
- [ ] Verbose output: each container/image individually with ✓/✗
- [ ] Image sizes shown
- [ ] Summary: "X artifacts removed, Y MB freed"
- [ ] State switches to "Not installed"

### Cleanup on start
- [ ] Finds orphaned artifacts (if any)
- [ ] User can choose (learning data OFF by default)
- [ ] Verbose progress

### Windows
- [ ] `.exe` starts (from the GitHub Release)
- [ ] Persistent window (NO dialog chain!)
- [ ] All functions as on Linux

---

## PRIO 3: CONTENT QUALITY (native-speaker spot check)

Requires domain knowledge. Not automatable.

- [ ] German-English A1/B1: translations correct?
- [ ] AI for beginners (DE): technical terms correct? explanations clear?
- [ ] Ansible QE: commands correct? syntax right?
- [ ] Japanese A1: hiragana/katakana correct? romanization right?
- [ ] Korean A1: hangul correct? romanization right?
- [ ] Chinese A1: pinyin correct? characters right?
- [ ] Italian A1: spot check grammar/vocabulary
- [ ] Portuguese-BR A1: spot check

---

## PRIO 4: LEARNING - MANUAL UX CHECK

### Exercise types (check visually)
- [ ] Matching: pairs SAME height (no visual offset)
- [ ] Matching: "Resolve" animation looks good (test all 4 effects)
- [ ] Word Tiles: correction READABLE (spaces, not "TheBrainforgets...")
- [ ] Free Text: correction READABLE (token diff understandable)
- [ ] Picture Choice: tiles SAME height

### Learning modes (play each once)
- [ ] Mode toggle reachable in the collapsible options panel (since #1628
      it lives behind the panel, no longer directly visible)
- [ ] "Options" button sits in the SAME ROW as the progress indicator
      ("Step n of m"), not below it (desktop: bar on the left, button
      beside it on the right; mobile: tightly packed or a clean wrap,
      no overlap) (#1942)
- [ ] Exam mode: no hints, result at the end, 1.5x XP
- [ ] Timed mode: countdown bar visible, color transition
- [ ] Error mode: only error cards (after at least 1 error)
- [ ] Reverse: matching columns swapped
- [ ] Shuffle: cards mixed from different lessons
- [ ] Endless: no session end, statistics keep running
- [ ] Endless completion ("Practice session complete!"): Enter (without a
      click) triggers "Back to Dashboard" (#1864, button auto-focused)
- [ ] Error-replay completion ("All errors corrected!"): Enter (without a
      click) triggers "Back to lesson" (#1864); clicking the button still
      works
- [ ] Lesson summary ("You finished: ..."): with a next lesson available,
      Enter (without a click) triggers the PRIMARY card "Next Lesson ->
      Start" - not a secondary card (e.g. "Review"); clicking the buttons
      still works (#1943)
- [ ] Last lesson of a set (no "Next Lesson"): on the summary, Enter does
      nothing wrong - no error, no navigation to a non-existent lesson
      (#1943)
- [ ] Retry errors for matching (#1874): play a matching exercise with a
      mix of correct/wrong pairs, open "Retry errors" -> only the wrong
      pairs appear (not all). With a single wrong pair, correct pairs are
      added as distractors (min. 2 pairs so there is something to match)
- [ ] "Retry errors" setting (Settings -> Learning): switch to "Replay the
      whole set" -> the next "Retry errors" shows ALL pairs; switch back to
      "Only show errors" (default) -> only the wrong ones again
- [ ] Regression, other types: free-text/cloze in "Retry errors" still show
      only the wrong elements

### New exercise types (since v2.2.0, visual + functional)
- [ ] multiple_choice: selection, feedback, SRS attempt
- [ ] ext:al-categorization: assign categories, readable resolution
- [ ] ext:al-error-correction: find + correct errors
- [ ] ext:al-reading-comprehension: text + questions
- [ ] ext:al-graded-quiz: grading + result display
- [ ] ext:al-dictation (#1881): "Listen first" plays the clip, type the
      transcription; correct / near-miss ("Almost!") / wrong shows the
      solution; a lesson with `requires_extensions: ["ext:al-dictation@1"]`
      loads (not refused by the guard)
- [ ] Listen-first audio (#1687): audio button on free_text +
      matching plays, grading unaffected

### Lesson/set file import-export (#1672 / #1681 / #1685 hardening)

Location: My Content (`/content?tab=my`) → "Import a lesson" modal +
per-card "Export" / "Export as set"; accepts `.json` (a single lesson)
+ `.zip` (a whole set = `manifest.yaml` + `lessons/`).

- [ ] Import a `.json` lesson: preview shows title · language · N
      lessons · M exercises BEFORE confirming
- [ ] Import a `.zip` set: preview + correct lesson count
- [ ] Name collision: three-way dialog appears (Overwrite /
      Import as copy / Cancel), NO silent overwrite;
      "Import as copy" creates a fresh id + "(copy)" title
- [ ] Partial import (ZIP with broken lessons): valid ones import,
      warning "N lesson(s) skipped" is shown
- [ ] Set with ONLY broken lessons: clean error, no crash
- [ ] Size guard: a file > 5 MiB is refused BEFORE parsing with a
      friendly message; malformed JSON/ZIP names the reason, no crash
- [ ] Round-trip: export a lesson → re-import → identical in
      My Content
- [ ] Create-Lesson "Save as file": the save step offers a file
      download of the just-created lesson (canonical JSON)

### Create-Lesson wizard (`/create-lesson`, v2.3.0)

- [ ] **Book-text path (#1745):** Step 1 → the "Knowledge lesson from
      text" card (below the template grid) starts a 3-step flow
      (Metadata → Book text → Review); paste text + Generate → the AI
      rephrases theory in its own words + generates exercises; WITHOUT
      an AI key: friendly notice, no crash; "Next" only after a
      successful generation
- [ ] **Title required in the book-text path (#1946):** Step 1 WITHOUT
      a title → click the "Knowledge lesson from text" card → stays on
      step 1 with the friendly "A title is required." message (NOT the
      book-text step, NOT the raw schema error on save); with a title →
      the book-text step opens normally and saving succeeds
- [ ] **File upload in the book-text step (#1927):** "Load from file
      (EPUB, TXT, MD)" button above the text field; pick an EPUB → a
      chapter list appears (titles from the table of contents) with a
      preview + character count; "Insert into text field" fills the
      field (with existing text: a "Replace" confirmation dialog);
      Markdown file → split at headings; TXT without headings → one
      section; broken / oversized file (> 20 MiB) → clear error
      message, no crash; the rights hint mentions uploading
- [ ] **Edit a lesson (#1740):** My Content → an OWN lesson's card →
      pencil/Edit → wizard opens pre-filled; Review shows "Save changes"
      (overwrites the same id, progress kept) + "Save as a copy";
      foreign-repo lessons show NO Edit; analysis lessons route to the
      import page
- [ ] **Reopen a plain (no-extension) lesson stays saveable (#1919):**
      create a lesson via Auto-generate (only the six CORE types, no
      extension exercise), Save locally → reopen via Edit → step to Review:
      the "Valid lesson structure" check is GREEN and "Save changes" works
      (previously it failed with "ext_payload must be object" in API/server
      mode)
- [ ] **Migrate legacy English prompts on edit (#1860):** open a
      pre-#1855 legacy lesson (exercise instructions hardcoded in English,
      e.g. "Match each word with its translation.") via "Edit a lesson" →
      the affected instructions appear in the UI language automatically +
      a subtle, dismissible notice at the top ("... automatically
      translated to your language"). ONLY for the EXACT old default: a
      prompt the user deliberately set differently (even if coincidentally
      English) stays unchanged. Leave the editor WITHOUT saving → the
      original in Dexie is unchanged (no silent write); only saving
      (overwrite / save-as-copy) persists the migrated version
- [ ] **Combine lessons (#1741):** My Content → "Combine into a set"
      toggle → checkbox selection (own sets only) → "Combine" dialog:
      New set (title required) vs. add to an existing set; originals are
      kept; mixed languages/levels → non-blocking warning
- [ ] **Same-language hint (#1721/#1730):** source == target shows a
      neutral hint, does NOT block "Next"; Save enables once the checklist
      passes
- [ ] **Language-pair check row (#1929):** Review shows SIX checklist rows
      (title, "Language pair is valid", ≥4 cards, ≥5 exercises, ≥2 types,
      valid structure). "Language pair is valid" is green once BOTH source
      and target are supported codes — a same-language pair (de → de) is
      VALID (no "source != target" gate)
- [ ] **Structure-check reason (#1724):** a failing "Valid lesson
      structure" check names a concrete reason, not just a ✗
- [ ] **Template titles (#1674/#1756):** template cards show readable
      titles (even offline) + a pressed/selected state
- [ ] **Advanced exercise types / extension wizard (#1852, #1887):** Step 1 →
      the "Advanced exercise types" card starts a dedicated 3-step flow (author
      → review → save) with a non-blocking notice that these types are advanced.
      Step 2: "Add extension exercise" offers five types — **categorization**,
      **error correction**, **reading comprehension**, **graded quiz**,
      **dictation**. Each opens the inline editor with type-specific fields;
      Save is disabled until the shipped validator passes (categorization: ≥2
      named buckets with items; error correction: ≥2 words + a marked error + a
      correction; reading comprehension: a passage + ≥1 complete question;
      graded quiz: ≥1 question with positive points; dictation: a non-empty
      audio path + ≥1 accepted transcription). Reading comprehension + graded
      quiz: per question toggle multiple-choice ⇄ free-text, MC options with a
      correct checkbox, graded quiz additionally points + partial credit + a
      pass threshold. Dictation (#1887): a typed `assets/audio/...` path (no
      upload in v1) + the accepted-transcriptions list. Review shows the count;
      "Save locally" → the saved lesson is **playable** (each type renders + is
      answerable); the set JSON carries `requires_extensions: ["ext:al-...@1"]`
- [ ] **Dictation in the core type picker (#1895):** Main wizard (card-based),
      Step 3 "Generate exercises" → "Add exercise" opens the "Choose an exercise
      type" picker. Beside the six core types (Matching, Free text, Cloze, Word
      tiles, Picture choice, Multiple choice) a **seventh option "Dictation"**
      appears. Click → a dictation exercise is appended and opens straight in the
      **same** editor as the extension wizard (audio path + accepted
      transcriptions), gated by the **same** validator (empty audio path / no
      transcription → Save disabled; an incomplete dictation also blocks "Next"
      to Step 4). After saving: the stored lesson **carries
      `requires_extensions: ["ext:al-dictation@1"]`** (whether added via the core
      picker OR the extension wizard) and is playable. **Regression:** the
      existing extension-wizard path for dictation still works unchanged
- [ ] **Dictation audio upload (#1911, Slice 3):** In the dictation editor
      (core picker OR extension wizard) the audio field shows an **"Upload
      audio"** button above a **"…assets/audio/clip.mp3"** path input. Click
      Upload → a file picker offers MP3/OGG/WAV. Pick a real clip → an inline
      **audio player + "Remove"** appear (the path box stays blank; the base64
      blob is not shown), and the accept-transcriptions list still works. Save
      the lesson, play it: **"Listen first" plays the uploaded clip** in the
      lesson (both storage modes, no assets folder needed — the clip rides in
      the lesson JSON as a data URI, surviving export/import). **Remove** clears
      it. **Regression:** typing an `assets/audio/…` path still works as the
      alternative (no upload). **Errors:** a too-large file (> 2 MB) OR a wrong
      format (e.g. `.mp4`) shows a clear inline error and does not crash;
      nothing is stored
- [ ] **Multiple-choice single/multi mode control (#1888):** In the MC inline
      editor (Step 3, `ExerciseEditor`) the mode control ("How many answers are
      correct?") is a segmented control **at the very top, before the first
      option row**. A new MC exercise (AI-generated OR manually added) defaults
      to **"Allow one answer"**, option markers are radios (exactly one
      correct). Switching to **"Allow multiple answers"** → markers become
      checkboxes, two correct are possible, and the saved exercise is
      **playable** with multi-select. Switching back to "Allow one answer" →
      pruned to exactly one correct. An existing MC exercise with a set
      `multiple` value opens **unchanged** in its original state.

### Card image upload (#1763 / #1764)

Location: Create-Lesson Step 2 (card editor), in the add-card form +
each card row (`CardImageField`).

- [ ] "Image (optional)" field with an "Upload image" button; after
      upload a 64x64 preview + "Remove"
- [ ] Only JPEG / PNG / WebP accepted; other type → inline error
      (role=alert), no crash
- [ ] Large file is downscaled (≤512px edge, ~150 KiB cap);
      undecodable file → error instead of crash
- [ ] "Advanced: use an asset path" keeps the manual `img/…png` field
      (for repo-published sets)
- [ ] Round-trip: a card with an uploaded image → export →
      re-import → image preserved
- [ ] Known limitation: uploaded data-URI images are NOT yet rendered
      in a played picture_choice exercise (engine `src` cap)

### Lesson player UX (v2.3.0)
- [ ] Pause button now lives in the sticky footer (#1644), pausing
      works from there
- [ ] Auto-advance + "Back" (#1921): with "Advance automatically"
      (Settings -> Learning) ON, answer an exercise correctly so the app
      jumps to the next step by itself -> then click "Back": the previous
      (already-solved) exercise STAYS and does NOT jump forward again;
      the "Continue" button is still clickable
- [ ] Lesson summary shows only ONE favorite button (#1649)
- [ ] Skip-to-content link visible when tabbing from the top (#1727, a11y)

### Invalid lesson: friendly error message (#1808 / #1824)
- [ ] German umlaut cards (`währung`, `präsenz`) load correctly
      (the app accepts unicode-lowercase card ids/tags, #1808)
- [ ] An actually broken lesson shows OUTSIDE Developer Mode a friendly
      message ("… invalid or corrupted data … contact the author"),
      NOT the raw error dump (#1824)
- [ ] With Developer Mode ON (Settings): the technical detail text is
      appended again

### Discover + Registry (since v2.2.0)
- [ ] Source-language filter as a visible chip on first view
      (no longer hidden behind "Filter"), "All languages" persists
      across reload (#1699/#1701)
- [ ] Reference/demo sets (graded-quiz-demo) do NOT appear in
      Discover/My Content (#1702/#1706)
- [ ] Per-set share link opens the set detail page directly (#1572)
- [ ] Add a registered content repo (register-a-repo #1511)

### Download visibility (Dexie mode, #1709 / #1719 / #1731)
- [ ] Deleted set stays deleted: delete a set in My Content →
      Refresh → the set does NOT come back (#1719)
- [ ] A set from a no-longer-configured source stays visible in
      My Content (not silently hidden) (#1731/#1734)
- [ ] Book recommendations come from the federated registry, not the
      removed official `books.yaml` (#1717)

### Disconnect content repo vs. delete progress (#1651 / #1652)

Location: Settings → Data → content-repo list → "Remove".

- [ ] Default (checkbox NOT set): a reassuring note that learning
      progress is KEPT and comes back on reconnect
- [ ] "Delete progress" checkbox set: a warning with REAL counts
      (N lessons + M review cards, cannot be undone)
- [ ] Disconnect only → reconnect the same repo → progress back
- [ ] Disconnect + delete → reconnect → progress empty
- [ ] The checkbox only appears when there IS progress to delete
      (Dexie mode)

### Social sharing (visual + native)
- [ ] Share button visible after a lesson
- [ ] Mobile: native share sheet (WhatsApp/Telegram)
- [ ] Desktop: copies to clipboard + toast
- [ ] PNG share card: looks good (1200x630, theme tokens)

---

## PRIO 5: AI FEATURES (needs a real API key)

- [ ] Provider table: enter key → "Test" → "Connection ok"
- [ ] "Generate exercises" on theory-only: AI returns a result
- [ ] Quality of the generated exercises: sensible? type variety?
- [ ] "Continue session" after chat import: AI knows the context
- [ ] AI content validation: report sensible? provider+model shown?
- [ ] No button without a key leads to an error toast (disabled + tooltip)

### Batch "Generate for all lessons" (#1896)
- [ ] My Content → My Lessons, a set where ALL lessons already have
      exercises: the "Generate for all lessons" button is disabled RIGHT
      AWAY with the tooltip "All lessons already have exercises."
      (no click needed, no info toast)
- [ ] A set with at least ONE lesson without exercises: button active,
      cost confirm → progress → result toast as before
- [ ] After a successful full run: the button turns disabled without a
      reload

### AI key vault import (#1765 / #1769)
- [ ] Settings → AI → "Configured providers" → "Import" jumps to
      Settings → Data and scrolls the KeyVault import block into view (#1765)
- [ ] Import via "Choose file" OR paste the raw envelope JSON into the
      textarea; passphrase always required
- [ ] Malformed/incomplete JSON → inline error (aria-live), Import
      stays disabled
- [ ] After a successful import (file OR paste): switching to
      Settings → AI shows the key IMMEDIATELY, without a reload (#1769)
- [ ] Passphrase masked with a reveal toggle; key/passphrase never logged

---

## PRIO 6: THEMES (subjective aesthetics)

Click through once for EACH theme:
- [ ] Light: readable, contrasts
- [ ] Dark: readable, app icon light variant
- [ ] Ocean, Forest, Sepia, High-Contrast
- [ ] Catppuccin Mocha, Soft Pop, Amethyst Haze
- [ ] Buttons high-contrast on ALL themes?
- [ ] Dropdowns: opaque background (not transparent)?
- [ ] Share card: theme tokens correct?

---

## PRIO 7: DEVICE-SPECIFIC (not scriptable)

### iPhone Safari
- [ ] "Add to Home Screen" → app icon correct
- [ ] PWA starts in Dexie mode
- [ ] Safe-area insets respected
- [ ] Mobile nav = hamburger drawer (the bottom tab bar was removed in
      #1512); drawer links 44px, closes after navigation
- [ ] Known open issue #1569 (caret/touch offset by 1-2 lines in the
      lesson flow): reproduce + add notes to the issue

#### Theory read-aloud on iOS: long text (#1928) - MANDATORY

iOS Safari silently stops an unchunked utterance after ~15 seconds. Since
#1928 a theory block is split into chunks and spoken as a queue. Measured:
617 of 621 theory runs exceed the chunk budget; a median run is 1551
characters.

- [ ] On the iPhone, open a lesson with a long theory text and start
      read-aloud
- [ ] The text is read **completely** and does not break off after ~15
      seconds
- [ ] On a multi-step theory block the lesson auto-advances to the next
      step while reading (chunking must not distort the position in the
      text)
- [ ] No audible stutter between chunks
- [ ] Known platform limit, NOT a bug: pause/resume has no effect on iOS
      Safari (it stops and restarts there)

#### App update as an installed iOS PWA (#1357 / #1873) - MANDATORY

The one path no automated test covers: on iOS/WKWebView a new service
worker often does NOT activate through skipWaiting + reload, only after
the app is fully closed and reopened.

- [ ] Install the PWA on the home screen, note the build hash under
      Settings > About
- [ ] Deploy a newer build, bring the app back from the background
      (do not relaunch it): the update banner appears
- [ ] The banner ALSO shows the hint "close the app and reopen it" -
      this hint must never be missing on iOS standalone
- [ ] Tap "Update": the banner disappears and does NOT come back after
      a reload (accept suppression)
- [ ] Fully close and reopen the app: the build hash under About is
      the new one
- [ ] On a NON-iOS device (Android/desktop) run the same flow: the
      restart hint must NOT appear there

### Android Chrome
- [ ] "Install app" → maskable icon not clipped
- [ ] PWA works, Dexie mode

### Desktop PWA
- [ ] Install prompt → app starts standalone
- [ ] Dexie mode (NOT API mode, no 404)

---

## PRIO 8: SERVER MODE (via launcher)

- [ ] Download a set → visible in "My Content" (no cache problem)
- [ ] Backup import: no HTTP 413
- [ ] Play a lesson: no workbox errors in the console
- [ ] Change the port → app reachable on the new port

---

# PART B: AUTOMATED TESTS (reference)

These tests run in CI or via `make test`.
Documented here only to show what is covered.

---

## Automated: Unit + Component Tests (Vitest, 7200+;
## current number see docs/audits/current-coverage.md)

Coverage:
- All exercise types (Matching, Cloze, Free Text, Word Tiles, Picture Choice)
- Answer Toggle (My answer / Solution) for all types
- Learning-mode configs (MODE_CONFIGS correctness)
- SRS algorithm
- Backup export/import serialization
- Content loader (download, parse, cache)
- GitHub repo export (manifest.yaml, search-index.json round-trip)
- Share-text builder + share-card generator
- Feature strategy (useFeatureAvailable hook)
- i18n parity (all 11 languages, no missing key)
- No-hardcoded-colors guard
- Complexity gate
- File-size / dir-size gates
- Docs-discipline gate

Run: `make test` or `cd frontend && npm test`

---

## Automated: Backend + Plugin Tests (pytest, 2400+;
## current number see docs/audits/current-coverage.md)

Coverage:
- FastAPI endpoints (all CRUD operations)
- Content-loader plugin (download, cache, list_sets)
- Gamification plugin (XP, level, badges)
- AI plugins (Anthropic, OpenAI, Gemini) with mocks
- Assessment plugin (profile, progress)
- Session plugin
- Tracking plugin
- Backup export/import API
- Alembic migrations (schema consistency)
- Plugin-lock parity

Run: `make test` (backend part)

---

## Automated: Dexie-Smoke E2E (Playwright TS, 31 spec files)

Coverage:
- Full lesson playthrough (all exercise types)
- Content Hub tabs (Discover, My Content, Import)
- Dashboard tabs
- Navigation (desktop + mobile)
- Settings
- Backup round-trip (programmatic)
- All routes reachable (no 404)

Run: `make test-dexie-smoke`

---

## Automated: Manual-Automation E2E (Playwright TS, 18)

Coverage:
- Matching resolution flow
- Content Hub navigation
- Keyboard shortcuts
- Session flows (mobile + desktop)
- Critical surfaces

Run: `make test-manual-automation`

---

## Automated: Launcher Tests (pytest, 430+)

Coverage:
- actions.py: Docker check, status, install, start, stop, uninstall
- Port validation, free-port finder
- Config load/save round-trip
- Install-manifest CRUD
- Cleanup (find_stale, cleanup_stale)
- Health-check logic
- CLI-GUI parity
- i18n key parity (DE/EN)
- Frozen-binary detection
- Cross-platform port check (Windows SO_EXCLUSIVEADDRUSE)

Run: `cd launcher && poetry run pytest` or `make launcher-test`

---

## Automated: Accessibility (axe-core, in Dexie-Smoke)

Coverage:
- Dashboard: no critical violations
- Settings: no critical violations
- Content: no critical violations

Planned extension: all 15 sections

---

## Automated: Visual Regression (feature screenshots)

Coverage:
- Dashboard tabs (desktop + mobile)
- Content Hub tabs
- Matching animation
- Lesson modes
- Answer Toggle
- GitHub export dialog

Run: `make capture-screenshots` / `make verify-screenshots`

---

## Automated: CI Gates (on every PR)

- tsc --noEmit (TypeScript compiler)
- eslint --max-warnings 0
- ruff check + ruff format (backend)
- mypy --strict (backend)
- i18n parity
- No-hardcoded-colors
- Complexity gate (.complexity-baseline)
- File-size gate (.filesize-baseline)
- Dir-size gate (.dirsize-baseline)
- Docs-discipline
- Version lockstep (19 files)
- Plugin-lock parity

---

# RESULT

```
Date:
Tester:
Device + browser:
Version:

MANUAL TESTS:
  Tested:   ___ / ___
  OK:       ___
  BUG:      ___
  SKIP:     ___

  Critical bugs (launch blockers):
  1.

  Medium bugs:
  1.

  Cosmetic bugs:
  1.

AUTOMATED TESTS (target numbers: docs/audits/current-coverage.md):
  Vitest:       ___ green
  Backend:      ___ green
  Dexie-Smoke:  ___ green
  Launcher:     ___ green
  CI Gates:     all green? [ ]

Verdict: LAUNCH-READY / NOT LAUNCH-READY
```
