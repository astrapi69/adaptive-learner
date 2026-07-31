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

## Manual device QA - consolidated checklist (as of 2026-07-25)

Everything here can ONLY be done manually. Two sessions: one iPhone, one
Ubuntu.

### Session A: iPhone (iOS PWA/standalone)

Prerequisite: #2050 merged, current `develop` deployed (or a preview build).

#### A1. BACKUP ACCEPTANCE TEST (launch gate, open since early sessions)

A real round-trip, not a simulation:

- [ ] App in standalone mode with real data: at least one imported set,
      learning progress in several lessons, one set set to "deferred", one
      set completed, an own exercise created.
- [ ] Export the backup (`.alb`), demonstrably save the file OUTSIDE the app
      (Files app / AirDrop).
- [ ] Hard wipe: delete the app data completely (remove Safari website data
      for the domain, reinstall/reopen the app - that is the real WKWebView
      eviction, NOT `localStorage.clear()`).
- [ ] Verify the fresh state: app empty.
- [ ] Import the backup.
- [ ] Check: learning progress present, the deferred marker present (the
      #2050 path!), completed set correct, own exercise present, settings
      plausible.
- [ ] Then continue one lesson normally - no follow-on error.

Document the result (partial failures individually too). On ANY deviation:
screenshot + which step, which becomes an issue with forensics.

#### A2. Mobile scroll-to-error (#2039, visual device check before merge)

- [ ] Provoke a validation error outside the viewport (long form, error at
      the top, submit from the bottom).
- [ ] Expected: automatic scroll to the first error field, error visible and
      focused.
- [ ] Once in portrait, once with the keyboard shown.

#### A3. iOS backlog issues

- [ ] Work through the open iOS verification points from the tracker in the
      same session (list from the respective issues, each result as an issue
      comment).

#### A4. Delete a lesson (#2064, merged) - overlaps with A1

Per the test plan this feature requires both storage modes plus a backup
round-trip including iOS standalone. In substance that is the same flow as
A1. Do both in one pass (see also the "Delete a single lesson (#2064)"
section further below):

- [ ] In "My Content" delete a lesson that has learning progress.
- [ ] Check the confirm dialog: does it name the learning progress (learned
      cards), not just the exercise count?
- [ ] After deletion: lesson gone, no orphaned review cards, favorite
      removed, numbering with a gap as decided.
- [ ] Import a backup from BEFORE the deletion: the lesson comes back (a
      backup is a point in time, as decided). That is expected behaviour, not
      a bug.
- [ ] Both storage modes.

#### A5. Wizard step reset (#2061, merged) - short, doable on desktop too

- [ ] Open a book set, "Edit lesson", navigate to step 2.
- [ ] Pick a different chapter in the dropdown: step 2 stays, the new
      lesson's exercises appear.
- [ ] Edge cases: switch to a lesson without exercises, switch backwards.

#### A6. Reorder lessons (#2172, merged)

Display order is its own field; moving a lesson changes the sort, never a
lesson's identity. iOS-standalone is the trickier case (reordering on a phone).

- [ ] In "My Content" expand a multi-lesson (book) set -> "Manage lessons".
- [ ] Each lesson shows Up/Down controls. On the first row "Up" is disabled,
      on the last row "Down" is disabled (no dead clicking).
- [ ] Keyboard only: Tab to the Up/Down control, trigger with Space/Enter.
      The screen reader announces an understandable label ("Move lesson X up")
      and, after the move, the new position ("X is now at position n of m").
- [ ] The order is saved IMMEDIATELY - there is no separate Save action.
      Reload the page (or collapse and re-expand the set): the changed order
      persists.
- [ ] Drives the LEARNING sequence (#2212), not just the list: after a move,
      opening the set starts on the new first lesson, and "next lesson"
      navigation follows the chosen order - in both storage modes.
- [ ] Existing sets: without an explicit move, the current order is shown
      unchanged (no silent resort).
- [ ] Identity untouched: after several moves of a lesson that has learning
      progress, the progress stays attached, no orphaned review cards, delete
      still hits the correct lesson.
- [ ] Backup round-trip: Export -> wipe storage -> Import brings the chosen
      order back.
- [ ] Both storage modes (API + Dexie).
- [ ] iOS standalone (PWA from the home screen): moving via touch and the
      position feedback work, and the order survives closing and reopening.

#### A6b. Import order follows the source (#2173, merged)

After a book/text import the lessons appear in source/chapter order, not
alphabetically by title (previously an "Epilogue" landed before chapter 1).
The order is written to the SAME overlay store the reorder feature (#2172)
uses; filenames/identities stay untouched. The tricky part is provenance: a
re-import must NOT overwrite an order the user set by hand.

- [ ] Import a book whose chapter titles do NOT sort alphabetically into
      chapter order (e.g. an "Epilogue" or "Appendix"). After the import,
      "Manage lessons" shows the chapters in book order, not alphabetically.
- [ ] Drives the LEARNING sequence, not just the list: the set opens on the
      first source lesson and "next lesson" follows the source order - in both
      storage modes (API + Dexie).
- [ ] Identity untouched: learning progress / review cards stay attached (no
      renumbering of filenames).
- [ ] The user wins: move a lesson by hand, then re-import the same book (or
      update content). The user's order is preserved, NOT silently reset.
- [ ] After a re-import following a manual move, NEW lessons land at the end
      (visible, not interspersed); REMOVED lessons disappear while the rest of
      the chosen order is preserved.
- [ ] Existing sets (imported before #2173) are not auto-resorted; the user
      straightens them via "Manage lessons" (#2172).
- [ ] Backup round-trip: Export -> wipe storage -> Import brings the order
      back.
- [ ] iOS standalone (PWA from the home screen): open a freshly imported book
      in the installed PWA - the chapters are in book order, and a manual move
      survives closing and reopening.

#### A7. Edit belongs to the lesson, not the set (#2210)

Edit belongs to the lesson, not the set. The set-level button used to guess
which lesson was meant and always opened the first. Three similar per-row
buttons (Play/Edit/Delete) need distinct, title-bearing labels. iOS standalone
is the trickier case (three plus Up/Down per row on a phone).

- [ ] In "My Content" expand a multi-lesson (book) set -> "Manage lessons".
      Each lesson now shows Play, Edit and Delete (in addition to Up/Down).
- [ ] A set with SEVERAL lessons no longer has a set-level Edit button (it
      would only guess).
- [ ] A set with ONE lesson keeps the set-level Edit button (unambiguous =
      that one lesson).
- [ ] Editing the SECOND or third lesson opens exactly THAT lesson in the
      editor (not the first). After a reorder, Edit still hits the correct
      lesson (identity, not position).
- [ ] Keyboard only: Tab to Play/Edit/Delete, trigger with Space/Enter. The
      screen reader announces a distinct label per button with the lesson
      title ("Edit lesson X"), not three identical-sounding buttons.
- [ ] Both storage modes (API + Dexie).
- [ ] iOS standalone (PWA from the home screen): every per-row button is
      reliably tappable without mis-taps; Edit opens the correct lesson.

### Session B: Ubuntu (launcher binary, after the launcher session)

Prerequisite: the v2.8.2 release binaries (the launcher runs in IMAGE mode
since v2.8.0, #2167; engine pin docker-app-launcher ^0.25.1). Use only these
binaries; all older ones are obsolete.

- [ ] Daemon running + a test user WITHOUT the docker group (qatest):
      permission message + pkexec-fix offer, NOT "Start Docker". [since the
      0.16.0 failure without real proof]
- [ ] Run the pkexec fix, real re-login: state switches to "Docker running".
- [ ] Console visible, detection lines streaming, text wrap correct, window
      resizable.
- [ ] Branding "Adaptive Learner", About: app 2.8.2 with a source label;
      note the launcher version shown (actual value from the v2.8.2 binary).
- [ ] Setup runs through to a reachable app frontend in the browser. Proof
      goal (image mode): an anonymous pull of
      ghcr.io/astrapi69/adaptive-learner:2.8.2 and a start - NO build, no
      buildx, no Compose; pull progress visible in the console.
- [ ] Second start while the launcher is running: focuses the existing window
      (#31).
- [ ] Stop, restart, uninstall: no errors, the console reports intelligibly.
- [ ] Port change: test via the three #2069 cases under "PRIO 2 -> Port
      change: data carry-over" (the earlier caveat has been delivered).

### Recommended order

Session A first and in one pass: A1 and A4 share the backup round-trip, A2
and A5 are short extra checks. That makes the oldest launch gate coincide
with two freshly merged features in one sitting. Session B only once the new
binaries are available.

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

### Port change: data portability (#2069)
- [ ] Server mode (default): populate data, change the port, reopen → sets + progress still there (backend data survives; auto-recovered on the Landing route via identity.yaml)
- [ ] Browser storage mode (Settings > Data > storage mode): populate data, change the port, reopen → empty app with the "Used Adaptive Learner before on a different port?" hint on the welcome screen (data NOT deleted, just tied to the old origin)
- [ ] The hint links to the "Changing the port" help page
- [ ] Recovery (browser mode): back to the old port → Settings > Data > Export backup (`.alb`) → new port → "Restore from backup" → sets, progress, exercises, settings all restored
- [ ] Canonical web version (astrapi69.github.io, browser mode, no explicit port): the hint does NOT appear

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
- [ ] Difficulty indicator (#1693): an exercise whose card(s) carry an
      authored `difficulty` (1-5) shows a small badge above the exercise
      with a tier word (Easy/Medium/Hard) + a 5-dot meter. Cards WITHOUT
      `difficulty` (the whole legacy corpus) show NO badge (exercise looks
      as before). Applies to every exercise type (Matching/Cloze/Free-Text/
      Word-Tiles/Picture-Choice/Multiple-Choice + ext types). Badge reads
      cleanly in all 6 themes (token-backed). Transparency only - it changes
      neither ordering nor scoring.

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
- [ ] ext:al-image-description (#2095): the image is shown, type a free-text
      description; correct / near-miss ("Almost!") / wrong shows the solution;
      a lesson with `requires_extensions: ["ext:al-image-description@1"]`
      loads (not refused by the guard). An embedded image renders WITHOUT a
      network connection (offline-first); a lesson whose image is a remote
      `http(s)://` URL is refused by the guard. Read-aloud: the prompt gets a
      speaker button (the instruction is spoken, never the answer). a11y note:
      this type is visually gated by design (the answer IS the image
      description) — a screen reader hears a neutral image label, not the
      solution.
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
- [ ] **[MOBILE] Title warning is scrolled into view (#2036):** iPhone /
      narrow viewport, step 1 WITHOUT a title, scroll down to the Next button
      (the title field is off-screen above) → press Next: the view scrolls to
      the title field, the field takes focus and is marked invalid (red
      border), and the "A title is required." message is in view (NO
      dead-end / no missing reaction). Applies to all three entries: Next
      (card path), the "Knowledge lesson from text" card (book) and the
      "Extensions" card (extension). Desktop regression: if the field is
      already visible there is no scroll jump
- [ ] **File upload in the book-text step (#1927):** "Load from file
      (EPUB, DOCX, TXT, MD)" button above the text field; pick an EPUB → a
      section list appears (checkboxes, title + character count);
      Markdown file → split at headings; TXT without headings → one
      section; broken / oversized file (> 20 MiB) → clear error
      message, no crash; the rights hint mentions uploading
- [ ] **DOCX upload (#1927, phase 2b):** a Word file with heading
      styles (including German Word, "Ueberschrift 1") → chapters are
      detected and offered as a list; a Word file WITHOUT heading
      styles (only bold-formatted "headings") → ONE whole-document
      section, the text still lands editable in the field; a broken
      .docx → clear error message, no crash
- [ ] **Multi-select + exclusion heuristic + batch (#1949):** upload a
      file with several sections INCLUDING a preface / glossary / table
      of contents → typical non-learning-content sections are UNCHECKED
      by default, yet still visible and manually checkable (a hint line
      explains it); EXACTLY ONE section selected → the "Insert into text
      field" button fills the text field (with existing text: a "Replace"
      confirmation dialog), preview shown, then the normal single
      generation (regression); MULTIPLE sections selected → the "Generate
      N lessons" button starts batch generation with a progress indicator
      ("Generating lesson 2 of 5 …") → one lesson per section, order =
      document order (not selection order); Review shows "N lesson(s)" +
      the title list; Save → one set with N lessons; if a single
      generation fails, the others continue and the summary reports "X of
      N" + the failed sections; with no AI key → key hint, no batch
- [ ] **Edit a lesson (#1740):** My Content → an OWN lesson's card →
      pencil/Edit → wizard opens pre-filled; Review shows "Save changes"
      (overwrites the same id, progress kept) + "Save as a copy";
      foreign-repo lessons show NO Edit; analysis lessons route to the
      import page. **#2201:** "Save as a copy" (and the import-collision
      "Import as copy") both show a note that a copy starts WITHOUT
      learning progress, while the original keeps its progress and
      review cards
- [ ] **Reopen a plain (no-extension) lesson stays saveable (#1919):**
      create a lesson via Auto-generate (only the six CORE types, no
      extension exercise), Save locally → reopen via Edit → step to Review:
      the "Valid lesson structure" check is GREEN and "Save changes" works
      (previously it failed with "ext_payload must be object" in API/server
      mode)
- [ ] **Edit a book-text lesson (#1967):** create a lesson via "Knowledge
      lesson from text" (the book-text path — theory + generated exercises,
      NO vocabulary cards), Save locally → reopen via "Edit lesson" → "Next"
      goes STRAIGHT to the exercise editor with the actually generated
      exercises (NOT the empty vocabulary-card editor, which previously
      blocked the Next button); the 3-step flow is Metadata → Exercises →
      Review; Review has NO "At least 4 cards" row and "Save changes" is
      enabled; after saving, theory + exercise steps are preserved.
      Regression: a normal card lesson (Vocabulary list) AND an extension
      lesson still open correctly for editing
- [ ] **Edit a small book-text lesson (< 5 exercises) (#1970):** a book-text
      lesson whose generator produced only a few exercises (e.g. 4, because
      word-tiles/picture-choice/multiple-choice were skipped for lack of
      example sentences/images), Save locally → reopen via "Edit lesson" →
      ALL saved exercises are shown; "Next" is NOT blocked by "5 exercises
      needed" and "Save changes" is enabled (the minimum count is a
      create-time requirement, never re-imposed when editing an already-valid
      lesson); the misleading "word-tiles/picture-choice/multiple-choice
      produced no exercises" hint + the generate config do NOT appear in edit
      (no cards to generate from). IMPORTANT: opening Edit does NOT change the
      stored file (no auto-save); no exercises are lost
- [ ] **Edit a multi-lesson set (lesson picker) (#1971):** a set that holds
      MORE THAN ONE lesson (e.g. a book-text upload with multi-section select →
      one lesson per section), reopen via "Edit lesson" → a **lesson picker**
      (dropdown of all lessons in the set) appears at the top; the first lesson
      is pre-selected with its exercises shown. Pick another lesson → its
      theory/exercises load (previously unreachable). With unsaved changes,
      switching prompts a confirm dialog ("Switch lesson?"). Edit one lesson +
      Save → only that lesson is replaced, the others survive, and the SET
      title/level/languages are NOT changed (not overwritten by the edited
      lesson's title). Regression: a set with a single lesson shows NO picker
- [ ] **Switching lesson keeps the step (#2061):** open a multi-lesson set via
      "Edit lesson", navigate to **step 2 (exercises)** (exercise list visible) →
      pick a DIFFERENT lesson in the "Lesson in this set" dropdown → the wizard
      STAYS on step 2, only the exercise list switches to the chosen lesson
      (previously: it fell back to step 1 and "Next" had to be pressed again).
      Same on step 3 (review): the step is preserved. Edge cases: switching to a
      lesson with NO exercises shows an empty list with no crash and no fall-back;
      with unsaved changes the "Switch lesson?" confirm dialog still appears
      first. Verify on Desktop + iOS standalone
- [ ] **Book reference survives editing (#1989):** create a lesson via the
      book-text wizard WITH the "book (optional)" fields filled in (title,
      author, URL, ISBN/ASIN) + Save → the lesson's "Vertiefe das Thema" section
      shows the book reference. Reopen via "Edit lesson", change something, Save
      → the book reference is STILL there (previously it vanished after the first
      edit). It survives across MULTIPLE edit cycles; "Save as a copy" also keeps
      the book reference. Regression: a lesson WITHOUT a book gets NO forced
      empty book object on edit
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
- [ ] **Combine lessons (#1741):** [E2E: `combine-lessons.spec.ts`] My Content → "Combine into a set"
      toggle → checkbox selection (own sets only) → "Combine" dialog:
      New set (title required) vs. add to an existing set; originals are
      kept; mixed languages/levels → non-blocking warning
- [ ] **Same-language hint (#1721/#1730):** source == target shows a
      neutral hint, does NOT block "Next"; Save enables once the checklist
      passes
- [ ] **Content-domain selector in Step 1 (#1716):** Step 1 shows a
      "Domain" field. Default "Language" → source/target languages + CEFR
      level are shown (as before). Choosing a knowledge domain (e.g.
      "Psychology", "Programming", "Knowledge") collapses the pair to a
      single "Content language" (source == target), the level gains a "No
      level" option, and a hint explains knowledge content. Changing the
      content language keeps source and target equal. Switching back to
      "Language" splits the pair again and restores the level to A1 (if it
      was "No level"). Save → the lesson carries the chosen domain
      (`domain: psychology` …); a language lesson carries NO `domain` field.
      Editing a saved knowledge lesson reopens with the right domain +
      content language
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
      Step 2: "Add extension exercise" offers six types — **categorization**,
      **error correction**, **reading comprehension**, **graded quiz**,
      **dictation**, **image description**. Each opens the inline editor with
      type-specific fields;
      Save is disabled until the shipped validator passes (categorization: ≥2
      named buckets with items; error correction: ≥2 words + a marked error + a
      correction; reading comprehension: a passage + ≥1 complete question;
      graded quiz: ≥1 question with positive points; dictation: a non-empty
      audio path + ≥1 accepted transcription; image description: a non-empty
      image + ≥1 accepted answer). Reading comprehension + graded
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
- [ ] **Image-description authoring (#2095):** In the extension wizard pick
      **image description**. The editor shows an **"Upload image"** button
      (labelled "Image to describe", NOT "(optional)"), a visible size-budget
      hint ("compressed and embedded, max ~150 KB / 512 px, remote links not
      allowed"), and an **"Accepted answers"** list. Upload a real JPG/PNG/WebP
      → inline preview + "Remove" appear; the image is compressed to a data URI
      (no assets folder needed). Save is disabled until there is an image AND
      ≥1 accepted answer. Save the lesson, play it: the **image is shown**, type
      a description, correct / near-miss / wrong shows the solution. **Offline:**
      turn off the network and reload — the embedded image STILL renders (it
      rides in the lesson JSON, not a remote URL). **Errors:** an image that
      cannot be shrunk under the budget shows a clear inline error, nothing is
      stored. **iOS standalone (MANDATORY):** on an installed iOS PWA, author an
      image-description lesson with an uploaded photo, Export the backup (`.alb`),
      reinstall/wipe, Import → open the lesson: the image + accepted answers are
      intact and the image displays with no network (proves the embedded image
      survives the iOS IndexedDB + backup round-trip, the known eviction-risk
      surface)
- [ ] **Multiple-choice single/multi mode control (#1888):** [E2E: `mc-single-multi-toggle.spec.ts`] In the MC inline
      editor (Step 3, `ExerciseEditor`) the mode control ("How many answers are
      correct?") is a segmented control **at the very top, before the first
      option row**. A new MC exercise (AI-generated OR manually added) defaults
      to **"Allow one answer"**, option markers are radios (exactly one
      correct). Switching to **"Allow multiple answers"** → markers become
      checkboxes, two correct are possible, and the saved exercise is
      **playable** with multi-select. Switching back to "Allow one answer" →
      pruned to exactly one correct. An existing MC exercise with a set
      `multiple` value opens **unchanged** in its original state.

### Card image upload (#1763 / #1764) [E2E: `card-image-upload.spec.ts`]

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
      [E2E: `lesson-summary-favorite.spec.ts`]
- [ ] Skip-to-content link visible when tabbing from the top (#1727, a11y)
- [ ] **[MOBILE/VoiceOver, non-blocking] Select fields are announced with a
      name (#2037):** turn on iOS VoiceOver, open `/create-lesson` step 1 and
      swipe across the select fields (domain, language(s), level): VoiceOver
      announces the VISIBLE label plus the chosen value for each (e.g.
      "Level, A1, combo box") - NOT just the value, and not an unnamed
      "button". Same in the Share wizard and the chat-import language
      pickers. Automated coverage via axe (`select-a11y.spec.ts`); this item
      is the real-screen-reader cross-check in the next iOS session

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

### Set status persists (active/deferred/completed, both modes)

Where: My Content (`/content?tab=my`) → the set actions menu (three dots)
of a downloaded set. Test in BOTH storage modes (Desktop/server = API
mode; GitHub-Pages PWA = Dexie mode), since the bug used to occur only in
API mode.

- [ ] Set a set to **Deferred** → switch to another view (e.g. Dashboard)
      → return to My Content → the status is STILL "Deferred" (not back to
      "Active")
- [ ] Check both return paths: once via the menu/navigation, once via the
      browser Back button
- [ ] Exercise every transition: active → deferred → completed → active
      again; each survives a view switch
- [ ] Second stage (real persistence proof): fully close and reopen the app
      → the deferred status is still there
- [ ] iPhone PWA: same flow (originally observed there)

### Continue-Learning suggestion: no completed/deferred sets without due reviews (#2123)

Where: Dashboard → Overview, the top "Continue Learning" / "Weitermachen"
block. Test in BOTH storage modes (API + Dexie); the logic is
mode-agnostic.

- [ ] Finish a set completely (all lessons) OR set it to "Completed" via the
      set actions menu, with NO cards due → the Continue-Learning block no
      longer proposes that set (it used to show up as "Set completed")
- [ ] No open set AND no due cards → an honest empty state ("Start your first
      lesson", link to My Content) instead of a filler set
- [ ] A completed set WITH due reviews → shown as a review row ("N elements
      due") that leads into the review session (`/review/{setId}`), not as
      "Set completed"
- [ ] A deferred set with no due cards → NOT proposed
- [ ] A started (active) set → still proposed to resume
- [ ] Order: due reviews first, then started sets (each most-recently-touched
      first)

### Update guard: no silent progress loss on a set update (#2128)

Where: My Content, an already-LEARNED set (progress + review cards present) that
has an update available. Test in BOTH storage modes. Background: an update that
changes exercise/card identities (e.g. an answer fix) would orphan review cards.
The guard hangs on a real old-vs-new identity diff, not a blanket switch-off.

- [ ] Prep: learn a set (at least one lesson, make a few mistakes -> review
      cards) for which a changed version with a CHANGED answer/card front exists.
- [ ] Trigger a manual update (the set's "Update" button): a confirmation appears
      with counts ("N review cards / N lessons would be reset"), NOT a silent
      overwrite.
- [ ] "Keep current version" -> nothing updates, progress stays, the set still
      shows "Update available" (visible + re-decidable).
- [ ] "Update anyway" -> the update applies.
- [ ] A harmless update (only a new lesson/exercise added, no existing identity
      changed) -> NO prompt, applies straight away.
- [ ] Auto-sync (only with a connected user repo, 24h): an identity-changing
      update is NOT silently applied in the background; the set stays on the
      current version and shows "Update available" (no background dialog, no
      data loss).
- [ ] iOS standalone (PWA): same manual flow, the confirmation appears.
- [ ] Language check (#2160): the confirmation text appears in the app language
      (not English), spot-checked across several languages (de/ja/ko/el/hi).

### Recovery: review progress after the ja/ko/zh correction (#2161)

Location: Dashboard (Overview). Background: the three A1 sets Japanese, Korean
and Chinese were re-published in July 2026 with a transliteration fix that
changed the answer text of 172 review items (66 ja / 58 ko / 48 zh). Review
cards are keyed by the answer text, so cards already created for the changed
items quietly fell out of scheduling. Check in BOTH storage modes. Only these
three sets are affected; all other sets are untouched.

- [ ] Setup: learn one of the sets (ja/ko/zh A1) in the OLD version and create a
      few review cards, then move it to the corrected version (or seed test data
      with the old answer keys).
- [ ] The notice appears on the Dashboard ONLY when affected cards are actually
      present in your own data. No notice when nothing is affected.
- [ ] The notice shows, per affected set, the number of affected cards and offers
      "Export backup" (recommended, not forced).
- [ ] "Export backup" -> produces the same .alb file as Settings → Data (toast
      with the filename).
- [ ] "Relink review cards" -> a numeric result ("N relinked, N already
      correct"). The notice then disappears for that set (no re-asking).
- [ ] Idempotency: triggering again (or reloading) changes nothing more; the
      notice does not come back for that set.
- [ ] Partial recovery: if a set changed again after the fix, unmappable cards
      are reported by count and left unchanged (not silently dropped).
- [ ] "Start set fresh" -> inline confirm; only after confirming are the set's
      progress + review cards removed; the notice is then gone for that set.
- [ ] No double-map / no orphaned rows: after relinking, no review lands on the
      wrong card and there are no duplicate cards.
- [ ] Backup behavior: import a backup taken BEFORE recovery -> the old
      (orphaned) keys are back, the notice reappears and can be applied again.
- [ ] iOS standalone (PWA): same flow, notice + both actions work.
- [ ] Language check: notice and result texts appear in the app language (not
      English), sampled across several languages (de/ja/ko/el/hi).

#### Producing the state (test precondition)

The notice shows only when affected review cards are present in your own data.
Producing that state needs access to the stored data (developer tools), and that
is NOT possible in iOS standalone mode: it requires the Safari Web Inspector on a
Mac, and the QA machine runs Ubuntu. Hence the platform rule:

- The produced state is created and tested on the DESKTOP (app in the browser,
  developer tools available).
- On the PHONE (iOS standalone) test ONLY if real affected data is present.

First check (two-stage):

- [ ] On the phone, open the Dashboard. If the notice shows by itself, real
      affected data is present -> test there. Then the product condition applies:
      run "Export backup" (the button in the notice) FIRST.
- [ ] If no notice shows on the phone, the check moves to the DESKTOP; produce
      the state there. An orphaned entry can no longer be created through normal
      use (the corrected version already emits the new key), so this step needs
      developer tools (marked as such):

- [ ] Take a backup (Settings -> Data -> Export backup) so the starting state is
      restorable.
- [ ] Learn Japanese A1, lesson "01-begruessungen", the matching exercise
      (ex-match-begruessung) once and answer "こんにちは" wrong on purpose -> a
      review card is created on the NEW key "こんにちは (konnichiwa)".
- [ ] [Developer tools] Reset that card's key to the old form "こんにちは"
      (makes it orphaned):
      - Server mode (SQLite at
        ~/.local/share/adaptive_learner/adaptive_learner.db), one row:
        `UPDATE element_errors SET element_key='こんにちは'
        WHERE set_id='ja-a1-from-de' AND lesson_id='01-begruessungen.json'
        AND exercise_id='ex-match-begruessung'
        AND element_key='こんにちは (konnichiwa)';`
      - Dexie mode (browser DevTools -> Application -> IndexedDB ->
        elementErrors): delete the new-key row and re-add it, replacing only the
        key segment "こんにちは (konnichiwa)" with "こんにちは" in both the
        `element_key` field and the `id` key (leave every other segment,
        including direction, unchanged).
- [ ] Reload the Dashboard -> the notice appears (1 affected card, Japanese A1).

Way back (repeatable, no traces):

- [ ] After the test, import the backup taken in step 1 (Settings -> Data ->
      Import) -> exact starting state, no traces.
- [ ] [Developer tools] Or reverse the UPDATE (server) / set the test row back to
      the new key (Dexie).

Not covered: if the state is produced and tested only on the desktop, the
notice's behaviour in iOS standalone mode remains UNPROVEN (it cannot be produced
there without a Mac Web Inspector). That is a valid result, but note it
explicitly as open - do not silently equate it with the desktop result.

### Download visibility (Dexie mode, #1709 / #1719 / #1731)
- [ ] Deleted set stays deleted: delete a set in My Content →
      Refresh → the set does NOT come back (#1719)
- [ ] A set from a no-longer-configured source stays visible in
      My Content (not silently hidden) (#1731/#1734)
- [ ] Book recommendations come from the federated registry, not the
      removed official `books.yaml` (#1717)

### Delete a single lesson (#2064)

Location: My Content (`/content?tab=my`) → My Lessons → a set with
SEVERAL lessons (e.g. after a book import) → "Manage lessons".

- [ ] Prep: import/generate a book (several lessons in one set) OR a
      multi-lesson own set; play 1-2 lessons (create progress + review
      cards)
- [ ] "Manage lessons" expands the per-lesson list; each lesson has Play
      + Delete
- [ ] Delete opens a confirm dialog that names the lesson and says it
      CANNOT be undone
- [ ] The "Also delete my learning progress" checkbox shows the REAL
      review-card count of the lesson (cannot be undone)
- [ ] Delete WITHOUT the checkbox: the lesson leaves the list,
      lesson_count drops, sibling lessons are untouched; the deleted
      lesson's progress is kept (orphaned, cleanable later)
- [ ] Delete WITH the checkbox: progress + review cards of ONLY this
      lesson are gone, sibling progress remains
- [ ] No renumbering: the surviving lessons keep their titles/order,
      deep links to them still work
- [ ] Deleting the last lesson of a set removes the WHOLE set from My
      Content
- [ ] Keyboard-operable dialog: the Delete button is focused,
      Escape/Cancel dismisses
- [ ] Check BOTH modes: desktop/server (API) AND GitHub Pages (Dexie)
- [ ] Backup time-point: make a backup (.alb) BEFORE deleting → delete
      the lesson → import the backup → the lesson is back (correct: a
      backup is a snapshot, NOT a bug)

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
- [ ] Tutor chat (assistant-ui, #1126): type → send (or Enter), the reply
      streams in; the 7-step cycle progress advances; read-aloud + dictation
      work; resuming a regular session shows the prior conversation
- [ ] Imported session opens with the AI asking the first question on its own
      (no user turn first), the chat starts clean
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

## Automated: Dexie-Smoke E2E (Playwright TS, 45 spec files)

Coverage:
- Full lesson playthrough (all exercise types)
- Content Hub tabs (Discover, My Content, Import)
- Dashboard tabs
- Navigation (desktop + mobile)
- Settings
- Backup round-trip (programmatic)
- All routes reachable (no 404)
- Card image upload: real file input + canvas encoding, preview, remove,
  unsupported-type error, asset-path toggle
  (`card-image-upload.spec.ts`, #1763/#1764)
- Multiple-choice single/multi mode toggle in the inline editor
  (radio<->checkbox, second correct option, collapse on switch-back)
  (`mc-single-multi-toggle.spec.ts`, #1888)
- Lesson summary renders exactly ONE favorite button
  (`lesson-summary-favorite.spec.ts`, #1649)
- Combine lessons: select -> dialog -> new set persisted, originals kept
  (`combine-lessons.spec.ts`, #1741)

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
