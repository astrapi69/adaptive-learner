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

#### A3b. Returning-user entry never blanks (#2573)

Content-load resilience on iOS - the entry flow must never leave a blank
content area under an intact header/nav:

- [ ] As a RETURNING user (data present) open the app URL fresh (e.g. scan a
      shared QR code of the app URL). Expected: you land on the Dashboard -
      never a completely empty content area between the header and the bottom
      nav.
- [ ] While a view loads, a visible loading indicator shows (spinner +
      "Loading..."), never an empty box.
- [ ] Force the failure: put the device offline / throttle so a lazy view
      cannot load, then open a route. Expected: after a short wait a readable
      "taking longer than expected" (or "this view could not be loaded")
      message with a Reload button - not a silent blank screen.

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

#### A6c. Download order follows the manifest (#2367)

Downloaded sets (registry / source browser) show their lessons in the order
the set manifest declares (metadata.lessons), no longer alphabetically by
filename. The tricky case is mixed two- and three-digit prefixes:
alphabetically, 100- sorts between 10- and 11-. Applies at both seams: the
Dexie download (overlay seed like the import, #2173) and API mode (the
backend listing follows the manifest).

- [ ] Download a set with mixed prefixes (e.g. alc-psychology psych-intro,
      01- through 112-). "Manage lessons" shows the lessons in manifest
      order: 99- before 100-.
- [ ] Drives the LEARNING sequence: the set opens on the first lesson per the
      manifest and "next lesson" follows the manifest order - in both storage
      modes (API + Dexie).
- [ ] The user wins: move a lesson by hand, then re-download / update the
      set. The user's order is preserved.
- [ ] Sets without metadata.lessons in the manifest behave unchanged
      (alphabetical order, no silent resorting).

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
- [ ] AI-generated error correction (#2355/#2364): for a generated
      `ext:al-error-correction` exercise, check that the marked token is really
      the wrong one and the accepted correction actually fixes it.
      Schema-conformant is not the same as meaningful: an already-correct marked
      token is valid but not a real exercise, and no automation can detect it
      (this spot check only). The same idea applies to the graded quiz and
      reading comprehension - solvable, unambiguous, grading as expected

---

## PRIO 4: LEARNING - MANUAL UX CHECK

### Exercise types (check visually)
- [ ] Matching: pairs SAME height (no visual offset)
- [ ] Matching: "Resolve" animation looks good (test all 4 effects)
- [ ] Word Tiles: correction READABLE (spaces, not "TheBrainforgets...")
- [ ] Word Tiles: on a CORRECT answer the built sentence stays visible (#2494):
      assemble a sentence correctly and check it. The composed sentence remains
      shown (all green) afterwards and does NOT disappear; the success message
      ("Correct!") and the Continue button appear below it. iOS PWA/Standalone:
      run the same check on the web app icon added to the home screen.
- [ ] Free Text: correction READABLE (token diff understandable)
- [ ] Picture Choice: tiles SAME height
- [ ] Answer order shuffled (#2317): open a picture_choice exercise across
      several lessons - the correct tile is NOT always in the same slot
      (previously always first). Within ONE session the order stays stable (no
      jump when re-viewing the same exercise). A correct tap still scores
      correct, a wrong one wrong (grading + review progress are content-based,
      not position-based). Same for the options in ext:al-graded-quiz and
      ext:al-reading-comprehension. iOS PWA/Standalone: repeat the check on the
      web-app icon added to the Home Screen.
- [ ] Matching + word tiles shuffled (#2371, #2372): open a matching exercise
      several times (different exercises/visits) - the first left entry does
      NOT consistently pair with the last right one (previously a near-constant
      reversed order); both columns are shuffled independently. In word tiles
      the first solution word is NOT consistently at the end of the tile bar.
      Within ONE exercise view the order stays stable. Correct pairs/sentences
      still score correct (grading is content-based, not position-based).
      iOS PWA/Standalone: repeat the check on the web-app icon added to the
      Home Screen.
- [ ] Matching: NO hint button (#2443, replaces #2390): open a matching
      exercise. There is NO "Show a hint" button above the columns, and no XP is
      deducted for one. Reason: in a matching exercise every word of both columns
      is already fully on screen, so a first-letter hint reveals nothing. For
      free-text/cloze/word-tiles the hint button stays as before. iOS
      PWA/Standalone: repeat the check on the web-app icon added to the Home
      Screen.
- [ ] Matching: no wrong subtitle/column labels on knowledge sets (#2392): open
      a matching exercise from a KNOWLEDGE set (non-language domain, or source ==
      target, e.g. senses to organs). NO subtitle "Match each term with its
      definition" appears; the columns carry NO "Term"/"Definition" label, only
      the "A"/"B" badges and their content. A real LANGUAGE exercise is unchanged
      (language names or Term/Translation + the direction hint stay visible). iOS
      PWA/Standalone: repeat the check on the web-app icon added to the Home
      Screen.
- [ ] Matching: the preamble no longer eats the screen (#2391/#2444/#2453): open a
      matching exercise on a SMALL device (iPhone). The "How it works" button
      sits at the TOP in the button row under the title, right next to "Re-read
      theory" (#2453) — when a theory chapter precedes this step. Without a
      preceding theory "Re-read theory" is absent and "How it works" sits alone
      in the same row (consistent position). It is NO LONGER on the instruction
      row ("Connect the pairs …", #2453 corrects #2444). At 375px it fits without
      an ugly wrap. The operating manual ("Select an item on the left …") and the "A → B"
      hint live BEHIND that button (collapsed on open; tap to expand/collapse);
      on expand the content wraps cleanly onto the next line at full width. The
      progress counter ("2 / 5 paired") is at the TOP by the prompt (no longer at
      the bottom next to "Check answers"), so it stays visible while pairing;
      after checking it disappears and the score shows in the footer (#2445). The
      second column is reachable without long scrolling. A11y: the button is keyboard-operable and
      the content stays reachable for screen readers even when collapsed (native
      <details>). iOS PWA/Standalone: repeat the check on the web-app icon added
      to the Home Screen.
- [ ] Difficulty indicator (#1693): an exercise whose card(s) carry an
      authored `difficulty` (1-5) shows a small badge above the exercise
      with a tier word (Easy/Medium/Hard) + a 5-dot meter. Cards WITHOUT
      `difficulty` (the whole legacy corpus) show NO badge (exercise looks
      as before). Applies to every exercise type (Matching/Cloze/Free-Text/
      Word-Tiles/Picture-Choice/Multiple-Choice + ext types). Badge reads
      cleanly in all 6 themes (token-backed). Transparency only - it changes
      neither ordering nor scoring.

### Test mode (preview build, #2319)

Only relevant when the build was produced with `VITE_TEST_MODE=true` (the
preview delivery). In the regular build the mode does not exist.

- [ ] Activate via the hidden gesture: six quick taps on the progress bar at
      the top of a running lesson. The test-mode banner then appears ("Answers
      are not graded and no progress is saved").
- [ ] Not accidentally triggerable: single or slow taps on the progress bar do
      NOT activate the mode.
- [ ] Every answer counts as correct: a deliberately WRONG choice/input (choice,
      free text, matching) is shown as correct; the lesson can be clicked all
      the way through without knowing the content.
- [ ] No progress: after clicking through in test mode the lesson shows NO
      progress, and no review cards or error counters were created (check the
      dashboard / review).
- [ ] Exit: "Exit test mode" in the banner switches it off; leaving the lesson
      resets the mode (re-entering starts without test mode).
- [ ] iOS PWA/Standalone: repeat the check on the web-app icon added to the Home
      Screen (gesture by tap, banner visible, click-through works).

### Learning modes (play each once)
- [ ] Mode toggle reachable in the collapsible options panel (since #1628
      it lives behind the panel, no longer directly visible)
- [ ] Options panel of an OWN lesson (created, imported, or an
      "Edit as a copy" fork): entry "Edit this lesson in the editor"
      visible; clicking lands in the editor with exactly this set and
      lesson preloaded (#2766)
- [ ] Options panel of a DOWNLOADED lesson and of an analysis lesson:
      NO editor entry (#2766)
- [ ] Mentor note (own lesson): below every step the "Mentor note"
      button; save category + text, reopening shows the note prefilled,
      removing deletes it (#2768)
- [ ] Mentor notes survive a reload and re-entering the lesson
      (localStorage store, identical in both storage modes) (#2768)
- [ ] Summary of an own lesson with notes: "Mentor notes (n)" block with
      category, text, per-row removal, and the editor link; without
      notes and on non-own lessons the block does not appear (#2768)
- [ ] Downloaded/analysis lesson: no mentor-note UI anywhere (#2768)
- [ ] Editor of an own lesson with mentor notes: panel
      "Mentor notes for this lesson (n)" above the wizard; removing a
      note updates the panel, the runner and the summary (#2769)
- [ ] "AI suggestion" per note: with a configured key a short text
      proposal appears; without a key the BYOK hint; an empty reply
      shows the "nothing usable" message (#2769)
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

### Game mode (#2844)
- [ ] Settings -> Learning: "Game Mode" section with the "Playful
      lessons" switch, default off
- [ ] Lesson start (first step, game mode off, hint never dismissed):
      "Try game mode" banner with "Turn on" and a close control
- [ ] "Turn on" in the banner: success toast, banner disappears, the
      Settings switch is on afterwards
- [ ] Closing the banner ("Don't show again"): banner disappears and does
      not come back on the next lesson; game mode stays off
- [ ] Game mode on: praise phrase on EVERY correct answer (not just
      periodically), confetti/milestone overlays allowed, regardless of
      the configured feedback intensity
- [ ] Game mode on + reduced motion in the system: feedback stays subtle
      (reduced motion wins)
- [ ] Game mode off: behaviour unchanged (feedback intensity applies as
      before)
- [ ] Toggling takes effect without a reload (change event) and behaves
      identically in both storage modes (localStorage)

#### Lernfunke mascot (#2849, only while game mode is on)

- [ ] Game mode on, open a lesson: small flame figure next to the
      progress bar (tooltip/screen reader: "Your learning companion");
      game mode off: no figure, row unchanged
- [ ] Correct answer: the figure cheers briefly (hop, happy eyes) and
      returns to its resting pose
- [ ] Wrong answer: the figure encourages (wiggle, surprised look), no
      praise text at the figure (the praise line under the exercise
      stays as before)
- [ ] Milestone during the lesson (level-up, streak, badge): the figure
      celebrates (star eyes + sparkles); the milestone overlay still
      appears undisturbed at the top center
- [ ] Lesson completion: the figure grows, celebrates, and shows ONE
      localized praise phrase as a speech bubble; the bubble dismisses
      itself
- [ ] Reduced motion in the system: poses still change (expression),
      but without hop/wiggle animation
- [ ] Exam mode + game mode: no per-answer reactions (no immediate
      feedback); the figure stays resting until completion
- [ ] Narrow viewport (mobile): the figure does not crowd out the
      progress bar; the row wraps cleanly

#### Mascot variants (#2861, Lernfunke color schemes)

- [ ] Settings -> Learning -> Game mode: below the switch, the "Mascot
      variant" row with five mini figures (Spark, Ocean, Forest, Ghost,
      Gold) plus a hint text
- [ ] Fresh account (level 1, no badges, 0 XP): only Spark selectable;
      Ocean "From level 3", Forest "From level 7", Ghost "Needs the
      badge: First session", Gold with a "250 XP" button (disabled
      while XP is insufficient)
- [ ] At level 3+: Ocean clickable; the choice survives a reload
      (highlight ring on the selected variant)
- [ ] With a lesson open (game mode on), switch the variant: the flame
      figure next to the progress bar recolors immediately, no reload
- [ ] Gold purchase with enough XP: first click shows "Confirm", the
      second deducts 250 XP (the header XP badge updates), the variant
      is selected and permanently unlocked
- [ ] Backup round-trip: export -> wipe -> import restores selected and
      purchased variants (both storage modes)

#### Game mode sounds (#2875)

- [ ] Settings -> Learning -> Game mode: below the mode switch, the
      "Game mode sounds" switch (default off) with a hint text
- [ ] Turn game mode on without ever answering the sound question: the
      "Play with sound?" offer with "Yes, sounds on" / "Later"; "Yes"
      enables the sounds, "Later" does not - both make the offer
      disappear permanently
- [ ] Lesson-start banner (game mode off, never dismissed): next to
      "Turn on", the "Turn on with sound" button - enables mode AND
      sounds in one click
- [ ] Sounds on, global sounds OFF: a correct answer plays a tone
      (audibly rising with the streak), a wrong answer a low thud, a
      checkpoint jingle on crossing, a fanfare on lesson completion;
      volume follows the existing slider
- [ ] Game mode sounds OFF and global sounds OFF: everything silent;
      global sounds ON behave as before (no game-mode fanfare, no
      streak rise outside game mode)
- [ ] Exam mode + game mode + sounds: no per-answer tone (no immediate
      feedback); the completion fanfare stays allowed

#### Tension systems: hearts + countdown ring (#2878, opt-in, default off)

- [ ] Settings > Learning > Game Mode: the "Hearts (lives)" and
      "Countdown ring" switches are OFF by default; the number inputs
      (hearts per lesson, seconds per exercise) only become editable
      after enabling their switch and clamp to 1-5 / 5-120
- [ ] Hearts on + game mode on: the hearts row appears next to the
      streak chip (filled); every wrong answer empties one heart with
      a short shake
- [ ] At 0 hearts: a friendly "Out of hearts!" dialog offers "Try
      again" (restarts the lesson, hearts refilled) and "Leave lesson"
      (back to the overview); nothing solved is lost
- [ ] Correction round on the summary: fixing mistakes costs NO
      hearts (the row is hidden there)
- [ ] Countdown ring on: a small ring runs per exercise (green >
      yellow > red, pulse in the last 5 seconds); expiry breaks the
      streak, costs a heart (if on) and plays the wrong tone - but
      the exercise stays open and normally solvable, nothing is
      auto-submitted; the ring pauses after checking
- [ ] Exam mode and timed mode: neither hearts nor ring appear (the
      timed mode keeps its own time bar)
- [ ] Grading unchanged: score, stars and progress are identical with
      and without the tension systems

#### Streak bonus XP (#2893, default on, game mode only)

- [ ] Settings > Learning > Game Mode: the "Streak bonus XP" switch is
      ON by default; the "Bonus XP cap per lesson" number input is
      editable, clamps to 5-20 (default 10) and is disabled while the
      switch is off
- [ ] Game mode on, play a lesson with a streak of at least 3 correct
      answers in a row: the summary shows a green "+N XP" next to
      "Best streak: N"; the displayed lesson XP include the bonus, and
      "Mark as complete" credits exactly the same value (dashboard XP
      rise by the displayed sum)
- [ ] The bonus counts from the THIRD streak answer (+1 per further
      correct answer in a row); a wrong answer stops the growth, a new
      streak from 3 keeps counting
- [ ] Cap: with the cap at 5 and a long streak, the summary shows at
      most "+5 XP"
- [ ] Switch off OR game mode off: no "+N XP" on the summary, XP are
      identical to normal mode
- [ ] Exam mode: no streak bonus (the exam multiplier is unchanged)

#### Arcade mini-games (#2887, default on, game mode only)

- [ ] Settings > Learning > Game Mode: the "Arcade" switch is ON by
      default; the "Snake round length" (30-120, default 60) and
      "Memory pairs" (4-12, default 8) number inputs clamp and are
      disabled while the switch is off
- [ ] Game mode on: the arcade card appears on the dashboard; "To the
      arcade" opens the game list. Arcade switch off OR game mode off:
      the card disappears entirely; visiting /arcade directly shows a
      friendly notice with a link to the settings
- [ ] Learn Memory (free): the set picker lists downloaded sets only
      and is preselected with the most recently learned set (#2899),
      not the first in the list; without any progress the first set
      stays preselected;
      the board has two cards per pair (term and translation from real
      lesson cards); a matched pair stays open, a mismatch counts a
      try and folds away on the next reveal; finding every pair shows
      the win message with the try count
- [ ] Snake (locked): the game card offers "Unlock for 200 XP"; with
      too little XP the button is disabled (tooltip); the purchase
      takes TWO clicks (confirm text), deducts 200 XP (header XP
      drops) and Snake stays playable permanently (survives a reload
      and rides the backup)
- [ ] Playing Snake: arrow keys/WASD AND swipe gestures steer; pause
      halts clock and snake; food grows the snake (+1 point); wall or
      own body ends the round; the round clock running out shows the
      result (won from 5 points); the local best score is display-only
- [ ] Games award NO XP (header XP unchanged after a won round)
- [ ] Reduced motion in the system: no flip/flash effects in either
      game

#### Flash rounds (#2888, default on, game mode only)

- [ ] Settings > Learning > Game Mode: the "Special rounds" switch is
      ON by default; the "Flash-round cards" number input clamps to
      5-20 (default 10) and is disabled while the switch is off
- [ ] Set overview (/content/set/...) with game mode on: the
      flash-round card appears; while not every lesson of the set is
      completed with at least one star, the start button is disabled
      with the unlock-condition tooltip
- [ ] Set finished (every lesson with at least one star) and error
      cards present: starting opens the flash round - title
      "Flash round: {set}", the countdown ring runs per exercise
      (expiry breaks the streak, nothing is auto-submitted), the
      exercises come from the set's most error-prone cards
- [ ] The flash round's back button returns to the set overview (not
      to a lesson)
- [ ] Perfect set (no error cards): the start button stays disabled
      with the perfect tooltip
- [ ] Special-rounds switch off OR game mode off: the flash-round card
      disappears entirely
- [ ] A plain "Retry errors" from a lesson summary: unchanged, NO
      countdown ring
- [ ] Scoring/SRS: the flash round writes no lesson progress;
      corrected error cards only advance the SRS state, as in retry
      errors

#### Game tickets (#2889, default on, game mode only)

- [ ] Settings > Learning > Game Mode: the "Game tickets" switch is ON
      by default; the "Maximum tickets" number input clamps to 1-10
      (default 5) and is disabled while the switch is off
- [ ] Finishing a lesson with a perfect score: the summary shows the
      ticket banner ("Reward unlocked ...") with a "Play now" button
      leading to the arcade
- [ ] Hearts active (#2878) and a run finished without losing one:
      one more ticket (perfect score + all hearts = 2 tickets)
- [ ] Streak milestones (3/7/14/30 days): reaching one grants a bonus
      ticket, each milestone only once
- [ ] Cap: no more tickets than the maximum can be saved up; a
      milestone blocked by the cap is granted later once a slot is
      free
- [ ] Revisiting the summary of an already-completed lesson: NO new
      ticket (no farming); "Practice again" with a fresh perfect run
      earns normally
- [ ] The correction round and retry-errors award no tickets; a run
      corrected after the fact never counts as a perfect score
- [ ] Exam mode: a perfect score earns the ticket by the same rule
- [ ] The arcade page and the dashboard arcade card show the balance
      ("Tickets: N"); the line disappears while the ticket switch is
      off
- [ ] A locked game (snake without the XP purchase) with a balance:
      the "Play one round with a ticket" button starts one round and
      deducts exactly one ticket; without a balance the button is
      absent
- [ ] Ticket switch off: the arcade offers only the XP purchase /
      existing unlocks
- [ ] Backup export > wipe > import: the ticket balance survives the
      round-trip (localStorage snapshot)

#### Playful exercise renderers (#2876, only while game mode is on)

- [ ] Multiple-choice exercise: the answers render as large tiles
      (two columns from tablet width); the chosen tile pops briefly
      and gets an accent border; after checking, the correctly chosen
      tile hops and a wrongly chosen one shakes
- [ ] Cloze with word choices: the tapped word "jumps" into the blank
      in the sentence with a small hop; changing the pick replays the
      hop with the new word
- [ ] Matching exercise: a freshly formed pair "snaps" together with a
      pop on both tiles; after checking, correct pairs hop briefly;
      tapping a pair still undoes it
- [ ] Behaviour unchanged: selection, checking, score and resolution
      are identical to normal mode in all three exercise types
- [ ] Game mode off: classic lists/chips/tiles without the game look;
      reduced motion in the system: the shapes stay, all hop/pop
      animations are suppressed

#### Juice package (#2874, only while game mode is on)

- [ ] Play a lesson, two correct answers in a row: the streak chip
      (flame + "x2") appears next to the progress bar and hops on every
      further correct answer ("x3", "x4", ...)
- [ ] Wrong answer: the chip disappears (streak broken); the next two
      correct answers rebuild it
- [ ] Correct answer: a "+1" floats off the check mark and fades; the
      check hops briefly; on a wrong answer the X shakes
- [ ] Lesson with at least 3 steps: two checkpoint dots at 1/3 and 2/3
      on the progress bar; crossing one lights it up in the accent
      color (small pop)
- [ ] Summary: instead of the live chip, "Best streak: N" is shown
      (from streak 2; no chip without a real streak)
- [ ] Exam mode + game mode: no chip, no "+1", no per-answer checkpoint
      celebration (no immediate feedback)
- [ ] Game mode off: none of this appears; reduced motion in the
      system: chip/dots render without animation, the "+1" stays
      invisible (pure motion decoration)

### Summary counts corrections (#2479)
- [ ] Play a lesson with several wrong answers, then fix them in the
      end-of-lesson correction round. The score bar shows two segments: what
      was right on the first try (solid fill) and what was fixed after
      correcting (hatched), with a legend "N on the first try" / "N after
      correcting".
- [ ] Stars, message and the "+N XP" follow the final state: fixing every
      mistake earns full stars and "Perfect score!", not "1 of 3 stars" /
      "Good start". The credited XP matches the number shown.
- [ ] Without a correction round the bar stays a single solid segment (no empty
      second segment, no legend); stars + message unchanged.
- [ ] Exam mode: the result does NOT follow the correction - an exam result is
      the first pass (single-segment bar, stars + XP unchanged).
- [ ] Accessibility: the two bar segments are distinguishable without colour
      (hatch + legend) - check in BOTH light and dark themes.
- [ ] iOS PWA/Standalone: same check on the icon added to the home screen
      (the report came from there). Bar, stars, message and XP show the final
      state after correction.

### "Why you missed these" shows the question (#2757)
- [ ] Play a lesson with at least one wrongly answered element (explanations
      enabled in Settings > Learning). In the "Why you missed these" section,
      each answer comparison carries a "Question:" line above it showing what
      was asked (the exercise prompt, the sentence with "___" for cloze, the
      asked term for matching) - not just "Your answer" / "Correct".
- [ ] Matching exercise with one wrong pair: the question shown is the asked
      term (the pair's left side), never an internal ID.
- [ ] When the question cannot be resolved (e.g. the content was updated in
      the meantime), the entry renders as before without a question line -
      no error, no empty line.

### One collapsed mistakes section (#2496)
- [ ] Play a lesson with at least one mistake. On the summary the
      "Fix your mistakes (N)" section appears COLLAPSED: NO text field has
      focus, NO keyboard pops up (check on a phone - that was the report).
      The score stays visible.
- [ ] Tap "Fix now" -> the section expands, the first correction drill
      (cloze) appears and NOW takes focus (the keyboard may open here - it is
      the user's deliberate action).
- [ ] Inside the expanded section there is a secondary "Redo all exercises (N)"
      action -> goes to the error-replay page with the real failed exercises.
- [ ] The "What's next?" cards no longer contain a separate "Retry errors"
      card (folded into the one section). Enter still activates the primary
      forward card (Next lesson / Adaptive / Review), never the collapsed
      mistakes section.
- [ ] When every mistake is already corrected, the section shows a short
      success note ("All errors corrected!") instead of a drill.
- [ ] #2570: only non-cloze-able mistakes (no cloze can be generated) - the
      section shows "Repeat your mistakes" DIRECTLY, with "These can't be
      practiced as a quick drill - redo the exercises instead." + the "Redo
      all exercises (N)" button. NO "Fix now" intermediate step that would
      only expand into nothing.
- [ ] #2570 placement: the mistakes section sits BEFORE the "What's next?"
      cards (Next lesson / Adaptive / ...) in the default order, not after -
      fix your own mistakes first, then decide where to go next. Still freely
      reorderable via Settings.

### New exercise types (since v2.2.0, visual + functional)
- [ ] multiple_choice: selection, feedback, SRS attempt
- [ ] ext:al-categorization: assign categories, readable resolution; after
      "Check answer" the verdict chips including the red correction category
      stay INSIDE their column (no bleeding into the neighbor column, #2771) -
      the correction sits on its own line under the item
- [ ] ext:al-categorization solve toggle (#2772): after a not-fully-correct
      check, the "My answers" / "Solve" toggle appears next to the result
      line (like the pairs exercise). "Solve" shows every category with its
      correct items; items you had placed correctly yourself are tinted green
      with a check mark. "My answers" returns to the graded view, "Try again"
      resets to the interactive view. On a fully-correct answer NO toggle
      appears (only "Continue")
- [ ] ext:al-error-correction: find + correct errors
- [ ] ext:al-error-correction solve view (#2803): after a wrong check,
      the "My answer" / "Solution" toggle appears next to the result
      line (like pairs/categories). "Solution" renders the sentence as
      word tiles: the wrong word struck through in red with an X, the
      canonical correction right beside it in green with a check mark -
      you see WHERE in the sentence the error sat. "My answer" returns
      to the graded view (incl. the solution line); "Try again" resets
      to the interactive view. On a correct answer NO toggle appears
- [ ] ext:al-reading-comprehension: text + questions
- [ ] ext:al-reading-comprehension resolution (#2633): after "Check answers"
      the correct multiple-choice option is highlighted GREEN — with a check
      icon and a text badge, never by color alone. If you picked it yourself it
      reads "Correct"; if you picked wrong, the right option reads "Correct
      answer" (green, dashed border) and your own pick reads "Wrong" (red).
      For free-text questions the solution line renders in the green tint with
      a check instead of as grey body text. Same color language as the pairs
      (matching). Check across all 12 themes: the text stays readable on the
      tint.
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
- [ ] ext:al-speak-and-record (engine#68 idea 3): the sentence is read aloud
      via TTS (falls back to speech synthesis when no authored `audio` is
      present; with `audio` the authored clip plays instead); "Show text"
      reveals the sentence only after clicking; "Record" requests the
      microphone - test a REAL recording on a device with a microphone, the
      automated suite can only mock MediaRecorder. After recording: a
      playback player appears, "Done" becomes clickable. Re-recording
      overwrites the previous clip (no history). Revisiting the step
      replays the last saved clip automatically; a lesson with
      `requires_extensions: ["ext:al-speak-and-record@1"]` loads (not
      refused by the guard). Deliberately UNGRADED: no correct/incorrect
      state, no SRS row after completion (unlike every other exercise
      type). Microphone access denied yields a friendly error, no crash. No
      microphone present disables/hides the record button accordingly, no
      crash.
- [ ] **Storage cap + eviction (#2841):** recordings are auto-evicted
      oldest-first once total storage crosses a cap - practically
      unreachable in normal use (~170 max-length recordings needed), so
      only the regression check applies here: the normal record flow
      (record -> playback -> re-record) keeps working unchanged. The
      eviction logic itself is covered by automated tests
      (`speech-recordings-dexie.test.ts`), not manually verified. If the
      "Your previous recording was removed…" message ever appears: no
      crash, "Record again" works normally and the message clears
      afterwards.
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
- [ ] **#2592 Overwrite carries the learning progress across:** create a set
      with your own lesson, answer one exercise wrongly (so an error/review
      row exists), export the set, correct ONE answer text in the exported
      file (e.g. a typo in `free_text.accept[0]`), re-import → collision
      dialog → "Overwrite". Expected: a toast "Carried over N review
      card(s)", and the error history still shows the row (with its old error
      count) under the NEW answer text — not as a fresh row and not gone.
      Before this fix the row was orphaned silently.
- [ ] **#2592 an unresolvable case is reported, not silent:** same setup, but
      DELETE an exercise in the file (so positions shift) → "Overwrite".
      Expected: an info toast "… could not be confidently matched", no silent
      loss
- [ ] **#2592 "Import as copy" is untouched:** same flow but choose "Import
      as copy" → the original keeps its progress AND review cards, the copy
      starts without either
- [ ] Partial import (ZIP with broken lessons): valid ones import,
      warning "N lesson(s) skipped" is shown
- [ ] Set with ONLY broken lessons: clean error, no crash
- [ ] Size guard: a file > 5 MiB is refused BEFORE parsing with a
      friendly message; malformed JSON/ZIP names the reason, no crash
- [ ] Round-trip: export a lesson → re-import → identical in
      My Content
- [ ] Create-Lesson "Save as file": the save step offers a file
      download of the just-created lesson (canonical JSON)

### Work through a set again - second run (#2125, EXP-051)

Location: My Content (`/content?tab=my`), the three-dot menu of a set with
status **Completed**. A new run keeps the first one for later analysis
instead of overwriting or resetting it.

- [ ] Mark a set **Completed** -> the three-dot menu shows **"Work through
      again"** (NOT present for active/deferred sets)
- [ ] Click it -> a **simple** confirmation ("a new run starts from
      scratch, the previous one is kept"), with NO counted deletion figures
- [ ] Confirm -> toast "A new run has started …", the set flips back to
      **Active**, no error, no data loss
- [ ] Cancel -> nothing happens, the status stays Completed
- [ ] After restarting, answer a previously-learned exercise wrong -> the
      review queue fills **fresh** (cold scheduling; the first run's cards
      do NOT appear as overdue)
- [ ] Delete the set (with "delete progress") -> ALL of the set's runs are
      gone, no orphan rows
- [ ] Check BOTH: desktop/server (API mode) AND iOS PWA / GitHub Pages
      (Dexie mode) - the flow must work in BOTH modes
- [ ] Backup round-trip: Export -> wipe -> Import; the runs (incl. the
      completed first one) survive the import. An older backup with no run
      data imports as the implicit run 1 (no crash)

### Edit as a copy - forking a downloaded set (#2654, EXP-046)

Location: My Content (`/content`), the three-dot menu of a DOWNLOADED
(foreign) set - not shown on your own "My Lessons" sets, which already
have a direct "Edit".

- [ ] Open a downloaded set -> the three-dot menu shows **"Edit as a
      copy"** as the FIRST entry
- [ ] Click it -> a confirmation dialog: notes that the original stays
      unchanged and remains downloadable, PLUS the progress note ("A copy
      starts without learning progress …")
- [ ] Cancel in the dialog -> nothing happens, no new set is created
- [ ] Confirm -> toast "Saved as your own copy", the app switches
      automatically into the lesson editor, PRE-FILLED with the
      original's content
- [ ] The new copy then shows up under "My Lessons"; the original stays
      unchanged among the downloaded sets with its status unchanged and
      remains downloadable
- [ ] Edit the same source as a copy a second time -> the second copy
      gets its OWN, collision-free id (e.g. `...-copy-2`), never
      overwriting the first copy
- [ ] Check BOTH: desktop/server (API mode) AND iOS PWA / GitHub Pages
      (Dexie mode) - the fork must work in BOTH modes

### Derivation on fork - "Your edit" badge + "based on" credit (#2655, EXP-046)

Location: Import tab (`/content?tab=import`), "My Lessons" section - every
forked copy (whether created via "Edit as a copy", "Import a lesson", or
"Save as a copy" in the lesson editor).

- [ ] Fork a downloaded set that has a visible author credit on one of its
      lessons (e.g. "Contributed by …") via "Edit as a copy" -> the new
      copy shows up under "My Lessons" WITH the **"Your edit"** badge next
      to its title
- [ ] Below it, a compact **"Based on {author}"** line appears - hovering
      the line shows a tooltip stating that credits are self-declared and
      not verified (NO checkmark, NO "verified" badge)
- [ ] Fork a set with NO author credit at all -> the "Your edit" badge
      still appears, but NO "Based on" line (nothing to credit)
- [ ] A SELF-authored lesson under "My Lessons" that was never forked
      (no prior import/copy step) shows NEITHER the badge NOR a credit
      line
- [ ] Same flow via "Import a lesson" (import a shared `.json` carrying an
      author credit) -> the same two indicators appear
- [ ] Same flow via "Save as a copy" in the lesson editor (save an
      already-forked own lesson as a copy again) -> the new copy still
      carries the same "based on" credit (the chain does not grow
      unbounded)
- [ ] Check BOTH: desktop/server (API mode) AND iOS PWA / GitHub Pages
      (Dexie mode) - the badge + credit line must appear in BOTH modes

### Share Wizard - hint + removal for carried-over foreign credits (#2656, EXP-046)

Location: `ShareWizard` step 1, directly below the existing "Your name
(optional)" block. Precondition for a visible foreign credit: a forked
lesson carrying a "based on" credit (#2655) or an imported lesson whose
`contributed_by` is already set before the wizard opens.

- [ ] Share a self-authored, never-forked lesson -> NO foreign-credit
      hint appears (nothing to disclose)
- [ ] Share a forked lesson with set-level attribution (#2655) -> the
      hint "This content credits {author}. Their name travels when you
      share, you can remove it." appears, WITH the name from the
      attribution
- [ ] Share an imported lesson with `contributed_by` set but no set-level
      attribution -> the same hint, with the name from `contributed_by`
- [ ] Share WITHOUT clicking "Remove credits" -> the foreign credit
      travels with the shared content (default behavior, now visible
      instead of silent)
- [ ] Click "Remove credits" -> the button disappears, a "Credits
      removed." confirmation appears; sharing afterwards -> the name no
      longer appears in the shared content (the structural
      `variation_of` link stays untouched)
- [ ] Enter your own name AND enable "Show name", WITHOUT removing the
      foreign credit -> YOUR OWN name wins in the shared content, the
      foreign-credit hint stays visible but gets overwritten on share (no
      double credit)
- [ ] Check BOTH: desktop/server (API mode) AND iOS PWA / GitHub Pages
      (Dexie mode) - the hint + removal button must work in BOTH modes

### Create-Lesson wizard (`/create-lesson`, v2.3.0)

- [ ] **Step-1 order + template disclosure (#2755):** In step 1 the
      required **Title field comes first** (right under the heading,
      focused). The template picker behind it is a disclosure
      "Start from a template", **collapsed by default**; the collapsed
      row shows the current pick ("· Blank Lesson" is preselected).
      Opening it shows the four template cards plus "Knowledge lesson
      from text" and "Advanced exercise types"; picking a card marks it
      pressed and the collapsed row then shows the new pick.
- [ ] **Book-text path (#1745):** Step 1 → open the template disclosure
      → the "Knowledge lesson from
      text" card (below the template grid) starts a 3-step flow
      (Metadata → Book text → Review); paste text + Generate → the AI
      rephrases theory in its own words + generates exercises; WITHOUT
      an AI key: friendly notice, no crash; "Next" only after a
      successful generation
- [ ] **Exercise-type selection in the assistant (#2510):** In the book-text
      step, **above the textbook textarea** (between the file/sections area and
      the textarea, #2522) there is an "Exercise types"
      selector with three groups: **Standard types** (Matching, Free text,
      Cloze, Word tiles, Multiple choice) are pre-selected; **Extension types**
      (Categorization, Error correction, Reading comprehension, Graded quiz) are
      opt-in; **"Not generatable from text"** (Picture choice, Image description,
      Dictation) are greyed out/disabled with a one-line reason ("Images and
      audio cannot be generated from text … add later in the editor"). Doing
      nothing yields today's behaviour. Deselect all but one → the last one stays
      selected and the "At least one exercise type must stay selected." hint
      appears (not silent). An opted-in type is still selected on the next run
      (remembered). Generate → only the selected types come out; a selected type
      the text did not yield is listed by name under "These selected types did
      not come out of the text:" (not silently fewer). **iOS standalone (PWA,
      Dexie mode):** the selector costs little height (three compact, wrapping
      groups), is tappable, and the remembered selection survives a reload.
      **Accessible:** the greyed fields carry a label + `aria-describedby` to the
      reason.
- [ ] **Order of the type selection (#2522):** The selector sits **above** the
      textbook textarea, not below it (see what was detected, choose the types,
      then paste). **iOS standalone (PWA, small device):** on opening the
      book-text step the textarea is reachable **without scrolling** - the
      selector does not push it below the fold; after pasting a chapter the user
      need not scroll back up to find the types. DOM order matches the visible
      order (no axe regression).
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
- [ ] **AI exercise generation produces multiple_choice (#2353):** generate a
      knowledge lesson from text/book text (with an AI key) whose theory has
      clear factual questions with several answer options (e.g. "Which of these
      modules belong to X?") → the "Generated exercises" preview shows, at least
      occasionally, a **"Multiple choice"** chip alongside
      matching/cloze/free-text/word-tiles; the saved lesson plays the MC
      exercise (single-choice radios, or "select all that apply" checkboxes),
      feedback + SRS work like the other types. Regression: the other five types
      still get generated
- [ ] **AI exercise generation produces text extensions (#2355):** generate a
      book-text lesson (with an AI key) from non-fiction whose theory suits
      extensions structurally (a longer passage with several follow-up
      questions, terms that group into categories, a statement with one wrong
      word) → the "Generated exercises" preview shows, occasionally, chips for
      **"Reading comprehension" / "Categorization" / "Error correction" /
      "Graded quiz"**; after saving, the lesson LOADS with no "unsupported
      extension" error (it declares `requires_extensions`) and the extension
      exercises play correctly in the lesson runner (passage + sub-questions,
      bucket sort, token fix, scored quiz with a pass threshold). IMPORTANT: at
      most ONE reading-comprehension and ONE graded quiz per lesson; the core
      types still dominate. Regression: a core-only lesson declares NO
      requires_extensions
- [ ] **Book path no longer offers picture-choice + set type variety (#2356):**
      generate a multi-section book upload (several lessons) → NONE of the
      generated lessons contains a **picture-choice** exercise (the book path
      has no images, so the type is not offered at all instead of being
      dropped later); ACROSS the lessons of the set, more than four distinct
      exercise types appear (not just cloze/matching/free-text/word-tiles).
      Regression: the single book path and the set exercise-generation still
      produce valid lessons
- [ ] **Edit a lesson (#1740):** My Content → an OWN lesson's card →
      pencil/Edit → wizard opens pre-filled; Review shows "Save changes"
      (overwrites the same id, progress kept) + "Save as a copy";
      foreign-repo lessons show NO Edit; analysis lessons route to the
      import page. **#2201:** "Save as a copy" (and the import-collision
      "Import as copy") both show a note that a copy starts WITHOUT
      learning progress, while the original keeps its progress and
      review cards
- [ ] **A review card survives an answer-text correction (#2519):**
      create/save an own lesson with a free_text exercise → practice it
      until a review card exists for that exercise (the review queue shows
      it) → edit the lesson, fix a typo in the accepted answer (e.g.
      "Merci" → "Merci !"), save. Expected: a toast "Carried over {N}
      review card(s) for the changed answer." appears, the review card
      survives (no silent loss of the error/SRS history). Applies to BOTH
      storage modes (API + Dexie)
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
- [ ] **Internal structure error (#2384):** when the "Valid lesson
      structure" check fails with an INTERNAL error (e.g.
      `(0 , T.default) is not a function`), the message explains it is a
      problem in the app, NOT the lesson, gives a reload/retry path and a
      "Report this problem" link — instead of framing the technical string
      as invalid user content
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
- [ ] **Extension types in the core picker (#2508):** Main wizard (card-based),
      Step 3 "Generate exercises" → "Add exercise" opens the "Choose an exercise
      type" picker. Below the standard types (six core types + Dictation) a
      second, labelled group **"Extension types"** now appears with
      Categorization, Error correction, Reading comprehension, Graded quiz and
      Image description (Dictation is **not** shown twice). Click one of these →
      an extension exercise is appended and opens straight in the extension
      editor. Image description is **selectable** here (the image is added in the
      editor). "Save locally" → the stored lesson carries
      `requires_extensions: ["ext:al-...@1"]` and is playable. **iOS standalone
      (PWA added to the home screen, Dexie mode):** the picker opens, both groups
      are visible and tappable, the chosen extension exercise is saved and
      renders after a reload. **Regression:** the separate extension wizard still
      works unchanged
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
- [ ] **Convert exercise type -> free text (EXP-050 Stage 1, #2511):** In the
      inline editor (Step 3, `ExerciseEditor`) of a **Word tiles** or
      **Multiple choice** exercise, a **"Exercise type"** select at the top
      lists the current type plus **"Free text"**. Switching to "Free text":
      the fields change to the free-text editor with the **accepted answer
      pre-filled** (word tiles: the joined tile sentence; MC: the correct
      option, wrong options move into the distractors). Save and play it as a
      free-text exercise. For other exercise types (free text, matching, cloze,
      picture choice) **no** select appears. Expectation: the converted
      exercise keeps the learner's progress (same answer key), and Cancel
      discards the conversion.
- [ ] **Convert an extension exercise -> free text (EXP-050 Stage 1, #2511):**
      **Edit an existing lesson that contains a Dictation or Image-description
      exercise** (not the "add extension exercises" flow). In that row's inline
      editor the same **"Exercise type"** select offers **"Free text"**.
      Switching to "Free text": the editor **swaps to the free-text editor**
      with the accepted transcriptions/answers **pre-filled** as accepted
      answers (the audio/image is dropped). Save -> the lesson now holds a
      free-text exercise. **Cancel** after switching **restores the original
      dictation / image-description exercise**. Note: the "add extension
      exercises" flow (`ExtensionSteps`) does **not** show the select (a core
      type is not valid there).
- [ ] **Convert error-correction + cloze -> free text (EXP-050 Stage 2, #2511):**
      While editing an existing lesson:
      - An **error-correction** exercise (`ext:al-error-correction`) shows the
        same "Exercise type" select; choosing "Free text" pre-fills the accepted
        correction, **no prompt** (key-preserving).
      - A **cloze** (select/type mode) with **exactly one blank**: choosing
        "Free text" pre-fills, **no prompt**.
      - A **cloze with several blanks**: choosing "Free text" pops a
        **confirmation dialog** ("Convert exercise type?", danger style) because
        only the first answer is kept and the review history for the others is
        not carried over. **Confirm** converts (first blank as the free-text
        answer); **Cancel** leaves the cloze unchanged.
      - A **multiselect cloze** shows **no** select (not offered).
- [ ] **Convert free text -> multiple choice / cloze (EXP-050 Stage 3, #2511):**
      While editing an existing lesson, open a **free-text** exercise. The
      "Exercise type" select now offers **"Multiple choice"** and **"Cloze"**.
      - **-> Multiple choice:** the accepted answer becomes the **correct
        option**; if the free-text exercise has distractors they fill the wrong
        options (valid right away). Without distractors, **one empty option**
        remains and **Save is blocked** until a second, distinct option is added
        (the validator hint shows). No prompt (key-preserving).
      - **-> Cloze:** produces a one-blank cloze (`___`) with the answer in the
        blank, valid immediately; expand the sentence around the blank and save.
      - Expectation: `id`/`stable_id` unchanged, progress preserved (same answer
        key).
- [ ] **Convert graded quiz <-> reading comprehension (EXP-050 Stage 3b, #2511):**
      While editing an existing lesson (a row in the `ExerciseGenerator`, not
      the "add extension exercises" flow):
      - **Graded quiz -> Reading comprehension:** pick "Reading comprehension"
        in the "Exercise type" select -> the editor **stays the extension
        editor**, the questions carry over, but the **passage is empty** and
        **Save is blocked** until you type one. (Per-question points are dropped.)
      - **Reading comprehension -> Graded quiz:** pick "Graded quiz" -> the
        passage is dropped, each question gets **1 point** (valid at once),
        pass threshold 60%.
      - Edge: if a multiple-choice question has **several correct** options, the
        danger confirmation dialog appears (key moves); otherwise no prompt.
- [ ] **Suggest empty fields after a conversion with AI (EXP-050 Stage 4, #2511):**
      After a conversion (Stage 3), fill the now-empty target field via AI. The
      button appears **only while the field is empty** (for multiple choice: while
      fewer than three wrong options exist).
      - **Multiple choice -> "Suggest wrong answers with AI":** the correct answer
        is left untouched; the AI fills the missing wrong options. Options already
        typed and the correct answer are **never overwritten**. Suggestions equal
        to the answer, too short, or duplicates are dropped ("rather one fewer");
        if nothing survives, a hint to add a wrong answer by hand appears.
      - **Cloze -> "Suggest a sentence with AI":** only while the sentence is
        still the bare `___` placeholder -> the AI returns an example sentence with
        the answer shown as `___`. The button then disappears.
      - **Reading comprehension -> "Suggest a passage with AI":** only with an
        empty passage and at least one question -> the AI writes a passage for the
        questions.
      - **Without your own AI key (BYOK):** the button is greyed but tappable;
        tap/focus shows a hint linking to **AI settings** and fires **no** AI
        request.
      - Each button carries a note that these are AI drafts to review and edit
        before saving. (Visual check: desktop + mobile.)

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

### Diagnostics probe: Settings toggle + protocol (#2782)
- [ ] Settings > Diagnostics & Support: enable the "Tap & viewport
      probe" toggle - the measurement bar appears IMMEDIATELY at the
      top (no reload); disabling removes it immediately
- [ ] With the probe on: tap anywhere, then "Copy protocol" in
      Settings - the clipboard holds the entry (a line with `tap` and
      `deltaY=`); the counter next to it shows > 0 recorded events
- [ ] Reload the page: the counter is preserved (the protocol survives
      reloads); "Clear protocol" resets it to 0
- [ ] Appending `?vvdiag=1` to the URL enables the same probe; the
      Settings toggle then shows ON (one shared flag)
- [ ] "Show measurement bar" OFF: the bar disappears immediately and
      the header/menu are reachable again - but new taps still raise
      the protocol counter (recording continues invisibly, #2785)

### Sticky button for the measurement bar (#2799)
- [ ] Settings > Diagnostics & Support: enable "Sticky button for the
      measurement bar" (the probe must be ON) - a round floating
      button appears IMMEDIATELY at the bottom left
- [ ] Tap the button: the measurement bar disappears (exactly like
      "Show measurement bar" OFF); tap again: it reappears - the
      Settings "Show measurement bar" toggle mirrors every tap (one
      shared flag)
- [ ] The position choice (4 corners) appears under the toggle: pick
      "Top right" - the button jumps to that corner immediately;
      default is "Bottom left"
- [ ] Taps ON the button do NOT enter the diagnostics protocol (the
      counter in Settings stays put while toggling)
- [ ] With the bottom tab bar active (#2786): the button in a bottom
      corner floats ABOVE the tab bar, covering no tabs
- [ ] Probe OFF: the button disappears with it (without the probe
      there is no bar to toggle)

### Mobile menu position: bottom tab bar as an option (#2786)
- [ ] Settings > General > Interface: "Menu position (mobile)" is
      "Top (menu button)" (default) - NO bottom bar
- [ ] Pick "Bottom (tab bar)": the bar appears IMMEDIATELY at the
      bottom (Learn/Content/Learning Path/Progress/More); content is
      not hidden behind it (bottom scroll reserve)
- [ ] With the bottom bar: the top hamburger menu still works
- [ ] During an active lesson and on Landing/Onboarding/Assessment the
      bar stays hidden (the lesson footer keeps the bottom edge)
- [ ] Back to "Top": the bar disappears immediately; the choice
      survives a reload

### In-set position + navigation (#2793)
- [ ] Inside a lesson from a set, the header shows "Lesson N of M"
      with the correct number
- [ ] The left arrow opens the PREVIOUS lesson of the set; the right
      arrow the next one
- [ ] On the first lesson the left arrow is absent (no dead button),
      the readout stays; on the last one the right arrow is absent
- [ ] After jumping, the readout shows the new position
- [ ] For a standalone lesson without a set (e.g. an own lesson) the
      position row is absent entirely

### First paint: no language mix (#2796)
- [ ] Reload the app with a German UI (clear the cache): landing page,
      navigation, install hint, update banner and offline notice are
      German immediately - no English text, no raw key like
      `landing.intro`
- [ ] Same in airplane mode / offline: the strings stay German (the
      first paint needs no network)
- [ ] Update banner: "Was ist neu?", "Release-Seite", "Später" carry
      readable labels (not empty, sufficient contrast)

### Set-completion review (#2792)
- [ ] Finish the last lesson of a set: the completion card offers
      "View review" as the first action, "View Set" beside it
- [ ] The review shows four headline figures (total mistakes,
      mastered percentage, still open, time spent) and below them
      mistakes per lesson, per exercise type, and the biggest weak
      spots with your own wrong answer next to the correct one
- [ ] "Practise mistakes" leads into the set's review session,
      "Back to the set" to the set page
- [ ] A set with no recorded mistakes shows the friendly message
      instead of empty sections
- [ ] Check both in browser mode (no server) - the figures come from
      the local database there

### Set page: lesson list + progress (#2793 stages 2-3)
- [ ] Open a set page (/content/set/<id> or via a shared link): below
      the set details, ALL lessons are listed with their number
- [ ] The list header shows "{x} of {y} lessons completed"
- [ ] Completed lessons show their score; the first unfinished one
      carries the "Continue here" marker
- [ ] Clicking any row opens exactly that lesson - including one far
      back in the set
- [ ] Inside a running lesson the set name in the header is clickable
      and leads to that same list
- [ ] With no recorded progress the list still appears, just without
      markers
### Summary: all answers with their question (#2807)
- [ ] Finish a lesson, open "View all answers": every row with something
      to show is expandable (title + score stay visible)
- [ ] Expanded, the QUESTION sits above the answers - including on a
      partially correct row like "2 / 3", which previously showed nothing
- [ ] Choice/matching exercises (no text answer) show question and
      correct answer
- [ ] Text answers keep the coloured token diff, plus your own answer
      spelled out
- [ ] A fully correct row shows its question but no mistake diff

### Leaving a lesson returns to its set (#2811)
- [ ] Pause and leave a set lesson: the app lands on the SET page with
      the lesson list, not on "My content"
- [ ] "Exit" after the summary: the set page too - the lesson just
      finished is marked completed there
- [ ] A lesson without a set (own lesson, standalone import) still
      lands on "My content"

### Share the result as an image (#2813)
- [ ] After a lesson press "Share image only" next to "Share": the share
      sheet opens WITH the result card and WITHOUT text or link
- [ ] Pick Facebook: a photo post with the card appears (not the generic
      app image)
- [ ] WhatsApp still works through the normal "Share" button (card plus
      text)
- [ ] On desktop (no share sheet): the image downloads, toast "Image
      saved"
- [ ] Dismiss the share sheet: no file lands silently in the downloads

### New "Diagnostics & Support" tab unites error report + probe (#2789)
- [ ] Settings > Info: between "Help" and "About" there is now
      "Diagnostics & Support"
- [ ] It shows the Support section first ("Create error report",
      formerly under "About"), then the Diagnostics section with
      Developer Mode (formerly under "General > Interface") and the
      tap/viewport probe (formerly under "General > Diagnostics")
- [ ] "About" still shows version, strand and links, but no Support
      button anymore
- [ ] "General" still shows the menu position, but no Developer Mode
      toggle and no Diagnostics section anymore
- [ ] The direct link `?tab=diagnostics` opens the tab immediately

### Discover + Registry (since v2.2.0)
- [ ] Source-language filter as a visible chip on first view
      (no longer hidden behind "Filter"), "All languages" persists
      across reload (#1699/#1701)
- [ ] Reference/demo sets (graded-quiz-demo) do NOT appear in
      Discover/My Content (#1702/#1706)
- [ ] Per-set share link opens the set detail page directly (#1572)
- [ ] Add a registered content repo (register-a-repo #1511)
- [ ] Manifest fallback for own repos without a search-index.json (#2562):
      connect your own repo via Settings → Data → "Add a repository" that
      was NEVER built with the engine generator (no search-index.json at
      its root) - its sets still appear in Discover; once more than one
      source contributes, the "Source" filter appears (previously missing
      when only one source contributed)
- [ ] "Share as repository" (#2376): a set with quality issues (e.g. a
      matching exercise with a duplicate left value) is NOT pushed on the
      first click - the issue list appears and the button flips to
      "Export anyway"; only the second click exports
- [ ] "Share as repository" (#2376): when lesson filenames do not sort
      into the source order (kapitel-1..kapitel-10), the success screen
      reports the NN-prefix renaming; the exported repo lists the
      lessons in source order

### Discover Stage 1: facets, marks, empty state (EXP-048, #2320-#2324)

Where: Discover (`/content?tab=discover`). Test in BOTH storage modes
(API + Dexie); the facets read the search index and are mode-independent.

- [ ] Target-language facet visible next to the source language; marks carry
      their set count, only targets present for the active source language,
      sorted by count; selecting one filters the list (#2322)
- [ ] Review standing: machine-generated sets (e.g. ja-a1-from-de,
      ko-a1-from-de, zh-a1-from-de) carry a neutral badge ("Machine-made"),
      hand-written sets carry NO badge; the "Review" facet appears only when
      such sets are in the catalogue (#2321)
- [ ] The "AI-checked" facet is gone; the AI badge on the entry stays (#2321)
- [ ] Active restrictions (level, domain, trust, review, search) appear as
      removable marks above the list; clicking a mark's X clears exactly that
      restriction (#2323)
- [ ] Domain names are translated (Dog training, Technology, Software,
      Philosophy, Traffic knowledge instead of raw identifiers) (#2320)
- [ ] Empty state: at zero results, computed exits appear ("Without <facet>:
      N sets") plus "Reset all filters"; a click restores results; the source
      language stays (#2324)
- [ ] Empty library (no set): a pointer to "Add your own source" (/add-repo)
      or "create a lesson" (/create-lesson) (#2324)
- [ ] Phone (narrow width): the marks row stays ONE horizontally-scrollable
      line, never wraps, and does not eat half the height
- [ ] **iOS standalone (added to home screen, Dexie mode):** same flow on the
      iPhone PWA - the facet menus open above the list (portal/fixed, #1349),
      the marks row scrolls horizontally, and the empty-state exits are
      tappable (>=44px touch target)

### Discover Stage 2: entry points, source facet, language-name search (EXP-048, #2329-#2331)

Where: Discover (`/content?tab=discover`). Test in BOTH storage modes
(API + Dexie); the facets read the search index and are mode-independent.

- [ ] Entry control ("I want to") as the first permanently-visible mark; three
      presets with counts: Learn a language / A subject / Everything (#2331)
- [ ] "Learn a language" preset (the default on first visit): language sets
      only; target-language + level facets visible, domain facet hidden (#2331)
- [ ] Switching to "A subject": knowledge sets only; domain facet visible,
      level + target facets hidden; the choice persists across a reload (#2331)
- [ ] "Everything" shows both populations; switching entries clears the
      restrictions the new entry hides, so the list never silently drops to
      zero (#2331)
- [ ] Source facet: appears once more than one source is present; selecting one
      restricts to that source, with a per-source count (#2330)
- [ ] Language-name search: switch the UI to English and type "Spanish" - the
      German-authored Spanish sets are found (the pair's UI-language names are
      searchable) (#2329)
- [ ] Phone (narrow width): the entry mark joins the ONE horizontally-
      scrollable marks row and does not wrap
- [ ] **iOS standalone (added to home screen, Dexie mode):** same flow on the
      iPhone PWA - the entry menu opens above the list (portal/fixed, #1349),
      the preset stays remembered after quitting the PWA, and the
      language-name search works

### Discover Stage 3: batched rendering (EXP-048, #2333)

Where: Discover (`/content?tab=discover`). To get past 24 results, set the
entry to "Everything" and the source language to "All languages". Testable in
BOTH storage modes; the logic is mode-independent.

- [ ] With more than 24 results, only 24 render first; "Show more" loads the
      next batch; the count above the list stays the full number (#2333)
- [ ] No infinite scroll; the button disappears after the last batch
- [ ] A filter, search or sort change starts over from the first batch
- [ ] Applies to both the card grid and the list view
- [ ] **iOS standalone (added to home screen, Dexie mode):** "Show more" is
      tappable (>=44px), and the back-path (gesture / navigation) survives the
      extra batch

### Discover Stage 3: typo tolerance + ranking in search (EXP-048, #2336)

Where: Discover (`/content?tab=discover`), search box. Threshold deliberately
overridden: the exploration scheduled this only from ~200 sets (currently ~46);
it is built now on an explicit user decision. Testable in BOTH storage modes;
the logic is mode-independent.

- [ ] A search word with ONE typo (e.g. "spanissch" for "Spanisch") finds the
      same sets as the correct spelling
- [ ] Two or more typos in the same word do NOT find the set (tolerance stays
      tight)
- [ ] Very short search words (under 4 characters) stay exact; a 3-character
      typo finds nothing wrong
- [ ] A multi-word search still requires EVERY word to match; an unrelated
      second word excludes the set
- [ ] Exact matches rank above typo-only matches when sorting by "Relevance"
- [ ] **iOS standalone (added to home screen, Dexie mode):** typo search works
      offline exactly as in server mode

### Discover Stage 3: language-pair selection (alternative entry, collapsible) (EXP-048, #2337, #2359)

Where: Discover (`/content?tab=discover`), the "Language pairs" area above the
result list. Threshold deliberately overridden: the exploration scheduled this
only from ~30 populated pairs (currently 14); built now on an explicit user
decision. Shown in the "Learn a language" and "Everything" entries once more
than one pair is populated. Testable in BOTH storage modes; the logic is
mode-independent.

- [ ] Above the list sits ONE collapsible button, collapsed by default; with no
      selection it reads "Choose a language pair (N)" with the pair count (#2359)
- [ ] Expanding (click/tap the button) shows the populated pairs grouped by
      SOURCE language (one heading per source, its targets with counts below,
      most-populated first); tapping again collapses it (#2359)
- [ ] Tapping a target presets BOTH the source and target language at once and
      switches to the "Learn a language" entry; the list then shows only that
      pair's sets (#2337)
- [ ] After the choice the collapsed button summarizes it, e.g.
      "German → Spanish"; the chosen target is highlighted (marked active) when
      expanded (#2359)
- [ ] A pair in a DIFFERENT instruction language (e.g. the "English" group,
      "Spanish" target) jumps there too; the source language stays freely
      changeable afterwards (#2337)
- [ ] The pair selection is not shown in the "Subject" entry (#2337)
- [ ] Flag icons: each language name is prefixed with a flag emoji - in the
      pair selection's group headings and target buttons AND in the
      source/target language menus; the language name stays next to it, so on
      platforms without flag emoji (e.g. Windows) the name is still readable
      (#2359). Note: a language is not a country; the mapping is a deliberate
      convention (English -> UK, Portuguese -> Portugal)
- [ ] Keyboard: the button is reachable via Tab and toggles open/closed with
      Enter/Space; when expanded, the target buttons are reachable via Tab (#2359)
- [ ] Phone (narrow width): collapsed the selection costs ONE line; expanded the
      content stays scrollable and does not eat half the screen height (#2359)
- [ ] **iOS standalone (added to home screen, Dexie mode):** the disclosure
      button and the target buttons are tappable (>=44px), toggling works, and
      the selection acts offline exactly as in server mode (#2359)

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
- [ ] Carry-over proposal (#2308): the confirmation dialog additionally shows an
      "old -> new" list of the review items that could be carried over, plus a
      "Carry over what still matches" checkbox (on by default, BECAUSE the pairs
      are visible right above it).
- [ ] Confirm with the box ticked: after the update, error counts, streak and
      mastery sit on the CORRECTED answer (the review does not restart from
      zero). The toast names the count.
- [ ] UNTICK the box and confirm: the update runs and NOTHING is carried over
      (pre-#2308 behaviour). The checkbox is the decision, not decoration.
- [ ] Cases that cannot be assigned: if an exercise had its ORDER changed or an
      element inserted/removed, the dialog names those separately ("N cannot be
      assigned with confidence and will be reset"). Verify NOTHING was carried
      over for them - a wrong assignment is worse than a loss because it is
      invisible.
- [ ] AUTH-05: the exercise's OWN id changed (not just the answer text) - e.g.
      an exercise without a `stable_id` gets renamed (slug change) on update.
      The count in the "Carry over what still matches" checkbox includes this
      case (a combined number from the exercise and element level); the
      readable preview list still shows only answer-text pairs, never raw
      exercise slugs. After confirming with the box checked: the review card
      survives under the NEW exercise id, no restart from zero.
- [ ] Auto-sync (24h, connected user repo): NEITHER updates NOR carries anything
      over. The mapping may only come into being in the manual dialog.
- [ ] Confirm twice in a row (trigger the update again): no double carry-over, no
      error (idempotent).
- [ ] Backup beforehand: the backup hint is an offer, not a requirement - the
      update can be confirmed without one.
- [ ] iOS standalone (PWA): dialog including the pair list and the checkbox is
      fully readable and operable (the list does not overflow the dialog, the
      checkbox is tappable); carry-over works the same in Dexie mode.
- [ ] First minting (engine#91, element level): a set whose pairs/blanks/options
      get a stable_id for the first time, content otherwise unchanged or
      corrected in the same update. The transition is treated as a normal,
      safely assignable correction, not reported as "cannot be assigned".
      Progress survives when carry-over is confirmed.

### Retirement: archived progress on retired_ids (#2188)

Location: Content page, a set with learner progress whose update declares
`retired_ids` in the set manifest (the author deliberately retired
exercises). Check in BOTH storage modes. Background: a declared retirement is
not an accident - the related progress is ARCHIVED (not deleted, not
orphaned), leaves review scheduling and due counts, and the learner is told
once, with the count.

- [ ] Apply an update of a set with declared retirements (manually or via
      sync): ONE notice toast appears with the count ("N exercises were
      retired by the author; the related progress is archived.").
- [ ] Retirement-only update (no other identity changes): NO warning dialog
      (#2128) - a declared retirement is not breaking; the update applies,
      only the notice toast appears.
- [ ] After the update: the retired elements no longer appear in the review
      queue and no longer count into the "N due" number.
- [ ] Trigger the update again: no second toast, no double archival
      (idempotent; the count would be 0, so no notice).
- [ ] Language check: the notice appears in the app language (spot-check
      de/ja/ko).

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

### Delete several lessons at once (#2065)

Location: My Content (`/content?tab=my`) → My Lessons → a set with
SEVERAL lessons → "Manage lessons".

- [ ] Prep: a multi-lesson own set (e.g. a book import); play 2-3 lessons
      to create progress + review cards
- [ ] "Select lessons" turns on a selection MODE: a checkbox appears on
      each row and the per-row actions (move, play, edit, delete) are
      hidden while it is active
- [ ] "Select all" checks every lesson; clicking again clears them;
      "N selected" counts correctly
- [ ] "Delete N" is disabled while nothing is selected
- [ ] Delete opens ONE confirm dialog that names the COUNT and says it
      CANNOT be undone; the dialog visibly RECOMMENDS a backup first
      (without forcing it)
- [ ] The "Also delete my learning progress" checkbox shows the
      AGGREGATED REAL review-card count across the selected lessons
- [ ] Delete WITHOUT the checkbox: exactly the selected lessons disappear
      in ONE step, lesson_count drops accordingly, NON-selected sibling
      lessons are untouched
- [ ] Order: the remaining lessons keep their order (no renumbering),
      deep links to them still work
- [ ] Delete WITH the checkbox: progress + review cards of ONLY the
      selected lessons are gone, sibling progress remains
- [ ] Select and delete ALL lessons: the dialog says BEFOREHAND that the
      WHOLE set will be deleted; afterwards the set is gone from My Content
- [ ] Keyboard-operable dialog: the Delete button is focused,
      Escape/Cancel dismisses; the checkboxes carry an aria-label
- [ ] Check BOTH modes: desktop/server (API) AND GitHub Pages (Dexie)
- [ ] Backup time-point: make a backup (.alb) BEFORE deleting → delete
      several lessons → import the backup → the lessons are back (correct:
      a backup is a snapshot, NOT a bug)
- [ ] iOS standalone (PWA added to the Home Screen, Dexie mode): the
      selection mode, the checkboxes and the confirm dialog are usable by
      touch; the action bar wraps cleanly on a narrow screen (no overflow)

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

### Recommended repositories: per-row buttons (#2558)

Location: Settings → Data → Recommended repositories.

- [ ] Multiple recommendations visible → click "Add repository" on ONE →
      ONLY that button disables, the others stay clickable
- [ ] While adding, a progress indicator (label + bar once the sync
      phase reports numbers) appears right at the clicked row, not
      globally
- [ ] Click a second recommendation while the first is still loading →
      both run through independently, no error
- [ ] After completion: the row disappears from "Recommended" (now
      under "Your content repositories"), the other rows' button state
      is unaffected

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

### "Ask AI" button in lessons (#2693)
- [ ] Shown by default: the "Ask AI" button appears under every theory
      block and exercise, even without an AI key (then greyed-out with a
      BYOK hint popover instead of being hidden)
- [ ] Settings → Learning → Interaction → turn off "Show 'Ask AI'
      button": the button disappears in the running lesson (theory and
      exercises), no reload needed
- [ ] Turn the toggle back on: the button reappears immediately
- [ ] The toggle state survives a reload (localStorage)

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

### Cross-app vault import (Topos → Adaptive Learner) (#2512)
- [ ] An .alk file exported from Topos (format "topos-ai-keys") imports
      without a "foreign file" rejection; the FILE's passphrase is asked
- [ ] The Topos key stored under "google" lands on the "Gemini" provider
      after the import (Settings → AI shows it there)
- [ ] Wrong passphrase → warning, no key is written
- [ ] AL export unchanged: an exported file still carries the format
      "adaptive-learner-keys"

### Perplexity provider (OpenAI-compatible, server mode only) (#2512)
- [ ] Settings → AI: "Perplexity" appears in the provider selection
      (after Gemini)
- [ ] Server mode (make dev): store a pplx- key, the model picker shows
      the static sonar list (sonar, sonar-pro, sonar-reasoning)
- [ ] Server mode: a session message with Perplexity active returns a
      response (model sonar-pro as the default)
- [ ] Browser mode (Dexie/PWA): Perplexity is visible but marked
      "desktop only" (no dead menu item, no CORS error)

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

#### Read-aloud keeps playing when the screen auto-locks (#2666) - MANDATORY

The screen wake lock keeps the display awake while read-aloud is playing so
the device's inactivity timer doesn't interrupt speech synthesis (iOS
Safari and mobile Chrome browsers stop `speechSynthesis` the moment the
screen auto-locks).

- [ ] On the iPhone (Safari), open a lesson, start read-aloud, and do NOT
      touch the device
- [ ] Wait past the device's normal auto-lock timeout (leave the phone
      alone): the screen stays on for as long as read-aloud is playing
- [ ] Read-aloud plays uninterrupted through to the end of the text
- [ ] After "Stop" or the end of read-aloud, the screen is again allowed to
      auto-lock normally (the wake lock is released)
- [ ] Repeat the same flow on an Android device (Chrome)
- [ ] Known platform limit, NOT a bug: manually pressing the lock/power
      button still turns the screen off immediately and stops playback -
      no web API can prevent that

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

#### "What's new" release-notes modal stays closable (#2266)

The desktop/API-mode update banner's "What's new" modal
(`DesktopUpdateHost`) must never trap the user, however tall the release
and installation notes are. Viewport height is most critical on a short
window, so verify the iOS-standalone / phone-portrait shape explicitly.

- [ ] In API/desktop mode with an update available, open the banner's
      "What's new?" - the modal appears with a title, a scrollable body,
      and an always-visible X in the header
- [ ] Long release notes: the body scrolls; the header X and the footer
      "Close" button stay reachable (the notes never push the actions off
      screen)
- [ ] Close it four ways, each works: the header X, the footer "Close"
      button, the Escape key, and a click on the backdrop outside the card
- [ ] A click INSIDE the card does NOT close it
- [ ] Short viewport / iOS-standalone: shrink the window to a
      phone-portrait height (or an installed iOS standalone window) - the X
      stays fixed in the header while the notes scroll; the modal is still
      closable with the X, Escape, and a backdrop tap. Repeat with the
      on-screen keyboard raised
- [ ] Keyboard/SR: focus moves into the modal on open, Tab stays inside
      it, and focus returns to the "What's new?" button on close (no axe
      regression)

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

## PRIO 9: LANDING PAGE (static, #2409)

The landing page at `/start/` (DE) and `/start/en/` (EN) is real static
HTML in the Pages artifact - no React, no client-side loading. It carries
no numbers that could go stale, on purpose.

- [ ] `astrapi69.github.io/adaptive-learner/start/en/` loads; the core
      sentence "An app that adapts to you, not the other way around."
      is visible as the heading.
- [ ] "Open the app in your browser" leads into the app; "Download the
      launcher" leads to the release page.
- [ ] Language switch: "Deutsch" (top right on the EN page) leads to
      `/start/`, and "English" there leads back.
- [ ] The bottom links (Documentation, Repository, Learning content) work.
- [ ] Dark system theme: the page follows (prefers-color-scheme), text
      stays readable.
- [ ] Mobile (narrow window): single column, no horizontal scrolling.
- [ ] Share preview (e.g. in a messenger): title, description and image
      appear (the landing page's Open Graph data, not the app's).

---

## PRIO 10: Selective data export - speech recordings category (#2840)

Location: Settings > Data > "Export selected data".

- [ ] The "Media" group with the "Speech recordings" category is visible,
      NOT checked by default (unlike Learning projects/Curricula/
      Progress/Subjects, which are pre-selected)
- [ ] Without checking it: the exported file contains NO
      `speech_recordings` rows, even when some exist
- [ ] Checking it + export: the file contains the user's
      `speech_recordings` rows

## PRIO 11: Preset avatar gallery (#2848)

Location: Settings > General > Profile, below the photo upload.

- [ ] "Or pick a figure" row with 8 figures visible (Spark, Robot,
      Star, Cat, Owl, Ghost, Lightning, Heart), each with a speaking
      tooltip/screen-reader name
- [ ] Tapping a figure: success toast, the preview above and the header
      avatar show the figure immediately (no reload)
- [ ] The chosen figure is marked (ring); picking another moves the mark
- [ ] Uploading a photo replaces the figure; afterwards NO figure is
      marked; picking a figure over a photo asks first (see the photo
      stash below)
- [ ] "Remove" clears the avatar; the header falls back to the initials
- [ ] Backup round-trip: pick a figure, export (`.alb`), wipe data,
      import - the figure is set again
- [ ] Both storage modes (server + browser) behave identically

#### Photo stash on figure switch (#2862)

- [ ] Upload and crop a photo, then tap a figure: a confirmation dialog
      appears ("Replace your photo?"); cancel leaves photo and selection
      unchanged
- [ ] Confirm ("Use figure"): the figure is active and a "Restore photo"
      button appears below the gallery
- [ ] "Restore photo": the photo is back (preview + header), the button
      disappears
- [ ] Figure-to-figure switch: NO dialog (only a real photo is guarded)
- [ ] Upload a NEW photo after picking a figure: the old stash is
      cleared (no restore button with a stale photo)
- [ ] Backup round-trip: with a filled stash export -> wipe -> import;
      "Restore photo" still works (both storage modes)

#### Avatar frames (#2850)

Location: Settings > General > Profile, below the figure gallery.

- [ ] "Avatar frame" row with 7 options (None, Bronze, Silver, Gold,
      Flame, Star, Accent); locked ones show a lock and the condition
      ("From level 5", "Needs the 3-day streak badge")
- [ ] Level unlock: with a sufficient level the frame is selectable;
      selecting puts the ring around the preview AND the header avatar
      immediately (no reload)
- [ ] XP purchase (Star 150 / Accent 300): the buy button shows the
      price, first click "Confirm", second click deducts the XP (header
      XP updates live); the frame is permanently unlocked and selected
- [ ] Insufficient XP: the buy button is disabled, no deduction possible
- [ ] Badge frame (Flame): selectable only after earning the 3-day
      streak badge
- [ ] The frame applies to photo avatars AND preset figures alike;
      "None" removes the ring
- [ ] Backup round-trip: pick a frame + buy one, export (`.alb`), wipe
      data, import - selection and purchase are back
- [ ] Both storage modes behave identically (XP deduction included)

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
