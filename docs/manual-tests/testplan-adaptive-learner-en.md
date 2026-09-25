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

#### TS-0001 A1. BACKUP ACCEPTANCE TEST (launch gate, open since early sessions)

A real round-trip, not a simulation:

- [ ] TC-0001 App in standalone mode with real data: at least one imported set,
      learning progress in several lessons, one set set to "deferred", one
      set completed, an own exercise created.
- [ ] TC-0002 Export the backup (`.alb`), demonstrably save the file OUTSIDE the app
      (Files app / AirDrop).
- [ ] TC-0003 Hard wipe: delete the app data completely (remove Safari website data
      for the domain, reinstall/reopen the app - that is the real WKWebView
      eviction, NOT `localStorage.clear()`).
- [ ] TC-0004 Verify the fresh state: app empty.
- [ ] TC-0005 Import the backup.
- [ ] TC-0006 Check: learning progress present, the deferred marker present (the
      #2050 path!), completed set correct, own exercise present, settings
      plausible.
- [ ] TC-0007 Then continue one lesson normally - no follow-on error.

Document the result (partial failures individually too). On ANY deviation:
screenshot + which step, which becomes an issue with forensics.

#### TS-0127 A1b. Recovery round-trip (#2171, an owed precondition, to be caught up)

This item was stated as a precondition for merging #2171 and was skipped. It
is caught up here, not dropped.

- [ ] TC-0899 Check whether the recovery notice appears on its own. If it does, real
      affected data is present: check it here and **back up first**.
- [ ] TC-0900 If it does not appear, the check moves to the desktop, where the state
      can be produced with developer tools (guide: "Recovery: review progress
      after the ja/ko/zh correction"). In iOS standalone mode this is not
      possible, because it would need a Mac.
- [ ] TC-0901 Choose recover, then check: progress assigned, no orphaned rows, the
      numbers in the feedback plausible.
- [ ] TC-0902 Then import the backup made before the recovery: the old state comes
      back and the notice appears again. That is expected behaviour.

**Consequence of a finding:** a patch in a follow-up release, no rollback. The
notice is state-driven and reaches nobody who is not affected. Do not
improvise, report the finding.

#### TS-0002 A2. Mobile scroll-to-error (#2039, visual device check before merge)

- [ ] TC-0008 Provoke a validation error outside the viewport (long form, error at
      the top, submit from the bottom).
- [ ] TC-0009 Expected: automatic scroll to the first error field, error visible and
      focused.
- [ ] TC-0010 Once in portrait, once with the keyboard shown.

#### TS-0003 A3. iOS backlog issues

- [ ] TC-0011 Work through the open iOS verification points from the tracker in the
      same session (list from the respective issues, each result as an issue
      comment).

#### TS-0004 A3b. Returning-user entry never blanks (#2573)

Content-load resilience on iOS - the entry flow must never leave a blank
content area under an intact header/nav:

- [ ] TC-0012 As a RETURNING user (data present) open the app URL fresh (e.g. scan a
      shared QR code of the app URL). Expected: you land on the Dashboard -
      never a completely empty content area between the header and the bottom
      nav.
- [ ] TC-0013 While a view loads, a visible loading indicator shows (spinner +
      "Loading..."), never an empty box.
- [ ] TC-0014 Force the failure: put the device offline / throttle so a lazy view
      cannot load, then open a route. Expected: after a short wait a readable
      "taking longer than expected" (or "this view could not be loaded")
      message with a Reload button - not a silent blank screen.

#### TS-0005 A4. Delete a lesson (#2064, merged) - overlaps with A1

Per the test plan this feature requires both storage modes plus a backup
round-trip including iOS standalone. In substance that is the same flow as
A1. Do both in one pass (see also the "Delete a single lesson (#2064)"
section further below):

- [ ] TC-0015 In "My Content" delete a lesson that has learning progress.
- [ ] TC-0016 Check the confirm dialog: does it name the learning progress (learned
      cards), not just the exercise count?
- [ ] TC-0017 After deletion: lesson gone, no orphaned review cards, favorite
      removed, numbering with a gap as decided.
- [ ] TC-0018 Import a backup from BEFORE the deletion: the lesson comes back (a
      backup is a point in time, as decided). That is expected behaviour, not
      a bug.
- [ ] TC-0019 Both storage modes.

#### TS-0006 A5. Wizard step reset (#2061, merged) - short, doable on desktop too

- [ ] TC-0020 Open a book set, "Edit lesson", navigate to step 2.
- [ ] TC-0021 Pick a different chapter in the dropdown: step 2 stays, the new
      lesson's exercises appear.
- [ ] TC-0022 Edge cases: switch to a lesson without exercises, switch backwards.

#### TS-0007 A6. Reorder lessons (#2172, merged)

Display order is its own field; moving a lesson changes the sort, never a
lesson's identity. iOS-standalone is the trickier case (reordering on a phone).

- [ ] TC-0023 In "My Content" expand a multi-lesson (book) set -> "Manage lessons".
- [ ] TC-0024 Each lesson shows Up/Down controls. On the first row "Up" is disabled,
      on the last row "Down" is disabled (no dead clicking).
- [ ] TC-0025 Keyboard only: Tab to the Up/Down control, trigger with Space/Enter.
      The screen reader announces an understandable label ("Move lesson X up")
      and, after the move, the new position ("X is now at position n of m").
- [ ] TC-0026 The order is saved IMMEDIATELY - there is no separate Save action.
      Reload the page (or collapse and re-expand the set): the changed order
      persists.
- [ ] TC-0027 Drives the LEARNING sequence (#2212), not just the list: after a move,
      opening the set starts on the new first lesson, and "next lesson"
      navigation follows the chosen order - in both storage modes.
- [ ] TC-0028 Existing sets: without an explicit move, the current order is shown
      unchanged (no silent resort).
- [ ] TC-0029 Identity untouched: after several moves of a lesson that has learning
      progress, the progress stays attached, no orphaned review cards, delete
      still hits the correct lesson.
- [ ] TC-0030 Backup round-trip: Export -> wipe storage -> Import brings the chosen
      order back.
- [ ] TC-0031 Both storage modes (API + Dexie).
- [ ] TC-0032 iOS standalone (PWA from the home screen): moving via touch and the
      position feedback work, and the order survives closing and reopening.

#### TS-0008 A6b. Import order follows the source (#2173, merged)

After a book/text import the lessons appear in source/chapter order, not
alphabetically by title (previously an "Epilogue" landed before chapter 1).
The order is written to the SAME overlay store the reorder feature (#2172)
uses; filenames/identities stay untouched. The tricky part is provenance: a
re-import must NOT overwrite an order the user set by hand.

- [ ] TC-0033 Import a book whose chapter titles do NOT sort alphabetically into
      chapter order (e.g. an "Epilogue" or "Appendix"). After the import,
      "Manage lessons" shows the chapters in book order, not alphabetically.
- [ ] TC-0034 Drives the LEARNING sequence, not just the list: the set opens on the
      first source lesson and "next lesson" follows the source order - in both
      storage modes (API + Dexie).
- [ ] TC-0035 Identity untouched: learning progress / review cards stay attached (no
      renumbering of filenames).
- [ ] TC-0036 The user wins: move a lesson by hand, then re-import the same book (or
      update content). The user's order is preserved, NOT silently reset.
- [ ] TC-0037 After a re-import following a manual move, NEW lessons land at the end
      (visible, not interspersed); REMOVED lessons disappear while the rest of
      the chosen order is preserved.
- [ ] TC-0038 Existing sets (imported before #2173) are not auto-resorted; the user
      straightens them via "Manage lessons" (#2172).
- [ ] TC-0039 Backup round-trip: Export -> wipe storage -> Import brings the order
      back.
- [ ] TC-0040 iOS standalone (PWA from the home screen): open a freshly imported book
      in the installed PWA - the chapters are in book order, and a manual move
      survives closing and reopening.

#### TS-0009 A6c. Download order follows the manifest (#2367)

Downloaded sets (registry / source browser) show their lessons in the order
the set manifest declares (metadata.lessons), no longer alphabetically by
filename. The tricky case is mixed two- and three-digit prefixes:
alphabetically, 100- sorts between 10- and 11-. Applies at both seams: the
Dexie download (overlay seed like the import, #2173) and API mode (the
backend listing follows the manifest).

- [ ] TC-0041 Download a set with mixed prefixes (e.g. alc-psychology psych-intro,
      01- through 112-). "Manage lessons" shows the lessons in manifest
      order: 99- before 100-.
- [ ] TC-0042 Drives the LEARNING sequence: the set opens on the first lesson per the
      manifest and "next lesson" follows the manifest order - in both storage
      modes (API + Dexie).
- [ ] TC-0043 The user wins: move a lesson by hand, then re-download / update the
      set. The user's order is preserved.
- [ ] TC-0044 Sets without metadata.lessons in the manifest behave unchanged
      (alphabetical order, no silent resorting).

#### TS-0126 A6d. ZIP import keeps the language pair (#3244)

A set ZIP whose manifest carries `target_language`/`source_language` used to
arrive as en->en; an export followed by a re-import reset the source language
to en.

- [ ] TC-0896 In "My Content" export a set whose source language is German (e.g.
      fr-a1 from the German tree) as a ZIP ("Save as file") and import it again
      under "Import". The imported set shows French as the target and German
      as the source language, and the card speech output speaks French.
- [ ] TC-0897 An older set ZIP whose manifest carries only `language` still imports
      with that target language and English as the source.
- [ ] TC-0898 Both storage modes (API + Dexie).

#### TS-0010 A7. Edit belongs to the lesson, not the set (#2210)

Edit belongs to the lesson, not the set. The set-level button used to guess
which lesson was meant and always opened the first. Three similar per-row
buttons (Play/Edit/Delete) need distinct, title-bearing labels. iOS standalone
is the trickier case (three plus Up/Down per row on a phone).

- [ ] TC-0045 In "My Content" expand a multi-lesson (book) set -> "Manage lessons".
      Each lesson now shows Play, Edit and Delete (in addition to Up/Down).
- [ ] TC-0046 A set with SEVERAL lessons no longer has a set-level Edit button (it
      would only guess).
- [ ] TC-0047 A set with ONE lesson keeps the set-level Edit button (unambiguous =
      that one lesson).
- [ ] TC-0048 Editing the SECOND or third lesson opens exactly THAT lesson in the
      editor (not the first). After a reorder, Edit still hits the correct
      lesson (identity, not position).
- [ ] TC-0049 Keyboard only: Tab to Play/Edit/Delete, trigger with Space/Enter. The
      screen reader announces a distinct label per button with the lesson
      title ("Edit lesson X"), not three identical-sounding buttons.
- [ ] TC-0050 Both storage modes (API + Dexie).
- [ ] TC-0051 iOS standalone (PWA from the home screen): every per-row button is
      reliably tappable without mis-taps; Edit opens the correct lesson.

### TS-0011 Session B: Ubuntu (launcher binary, after the launcher session)

Prerequisite: the v2.8.2 release binaries (the launcher runs in IMAGE mode
since v2.8.0, #2167; engine pin docker-app-launcher ^0.25.1). Use only these
binaries; all older ones are obsolete.

**Back up first.** The launcher mounts the prefixed volume with the real
database, so the run works on real data: a backup export from the app, plus a
copy of the volume, and only then start. Read the backup back once, do not
only check that the file exists.

- [ ] TC-0052 Daemon running + a test user WITHOUT the docker group (qatest):
      permission message + pkexec-fix offer, NOT "Start Docker". [since the
      0.16.0 failure without real proof]
- [ ] TC-0053 Run the pkexec fix, real re-login: state switches to "Docker running".
- [ ] TC-0054 Console visible, detection lines streaming, text wrap correct, window
      resizable.
- [ ] TC-0055 Branding "Adaptive Learner", About: app 2.8.2 with a source label;
      note the launcher version shown (actual value from the v2.8.2 binary).
- [ ] TC-0056 Setup runs through to a reachable app frontend in the browser. Proof
      goal (image mode): an anonymous pull of
      ghcr.io/astrapi69/adaptive-learner:2.8.2 and a start - NO build, no
      buildx, no Compose; pull progress visible in the console.
- [ ] TC-0057 Second start while the launcher is running: focuses the existing window
      (#31).
- [ ] TC-0058 Stop, restart, uninstall: no errors, the console reports intelligibly.
- [ ] TC-0059 Port change: test via the three #2069 cases under "PRIO 2 -> Port
      change: data carry-over" (the earlier caveat has been delivered).
- [ ] TC-0903 Before the first click, run `--doctor`: one pass reports configuration,
      daemon, tools, readiness blockers, port and state. Note the result.
- [ ] TC-0904 A `~/.docker/config.json` with a broken credential helper stays
      **unchanged** after the start and the install; the log carries no
      credential line.
- [ ] TC-0905 Progress bar: disappears after success AND after failure. A bar that
      stays is a finding.
- [ ] TC-0906 Cancel a pull: the bar is gone, the message names the kept layers, the
      install can start again at once, the second attempt is noticeably faster.
- [ ] TC-0907 Cancel an update early: the message says the app is stopped and that
      Start brings back the previous version. Press Start and check that it
      comes back.
- [ ] TC-0908 Stopping and uninstalling show **no** cancel control.
- [ ] TC-0909 Concurrency guard: the note that it cannot work does **not** appear on
      the first start. If it does, the configuration points at an unwritable
      directory, and that is a finding.
- [ ] TC-0910 After a cancel, run `--doctor` again: the line for the last operation
      shows the cancel.
- [ ] TC-0911 Uninstall: container and volume gone, no leftovers under `~/.config` and
      `~/.local/share`.

### Recommended order

Session A first and in one pass: A1, A1b and A4 share the backup round-trip, A2
and A5 are short extra checks. That makes the oldest launch gate coincide
with two freshly merged features in one sitting. Session B only once the new
binaries are available.

---

## TS-0012 PRIO 1: BACKUP ACCEPTANCE TEST (launch gate!)

**New test case under PRIO 1 backup acceptance test:**
- [ ] TC-0060 GitHub Pages: create backup
- [ ] TC-0061 Install locally (launcher)
- [ ] TC-0062 Import the `.alb` from GH Pages → everything carried over

This test has been defined as a launch gate since Session 2.
Never run yet. Do it NOW.

- [ ] TC-0063 Produce data: download at least 2 sets, start 3 lessons, switch theme
- [ ] TC-0064 Export: Settings → Data → Create backup → download the `.alb` file
- [ ] TC-0065 Check file size (should be >1MB when sets are loaded)
- [ ] TC-0066 Clear browser data COMPLETELY:
      DevTools → Application → Storage → "Clear site data"
      AND: delete the "adaptive-learner" IndexedDB
      AND: localStorage.clear()
- [ ] TC-0067 Open app → onboarding → "Restore from backup"
- [ ] TC-0068 Pick the `.alb` file → import starts
- [ ] TC-0069 NO HTTP 413 error (nginx 50MB limit fixed)
- [ ] TC-0070 Sets present (My Content → all previously loaded sets)
- [ ] TC-0071 Progress preserved (started lessons, scores)
- [ ] TC-0072 Settings correct (theme, language, voice settings)
- [ ] TC-0073 Learning-mode settings preserved
- [ ] TC-0074 XP + level correct
- [ ] TC-0075 Legacy `.json` import: old backup format → works
- [ ] TC-0076 API keys NOT in the backup (security check)
- [ ] TC-0077 After restore: the provider overview (Settings → AI) shows the
      restored settings WITHOUT a reload (settings-refresh-bus, #1769)

---

## PRIO 2: LAUNCHER (desktop)

### TS-0013 Basic function (Ubuntu)
- [ ] TC-0078 `python3 -m adaptive_learner_launcher --debug` → ONE window opens
- [ ] TC-0079 Window NEVER disappears on its own
- [ ] TC-0080 Docker check as the first step (hint when Docker isn't running)
- [ ] TC-0081 Live progress during install in the log area (line by line)
- [ ] TC-0082 "Building image..." visible (not a silent background step)
- [ ] TC-0083 At the end: "App is ready." in green

### TS-0014 Port
- [ ] TC-0084 Port field visible (default 8501)
- [ ] TC-0085 Port editable when stopped/not installed
- [ ] TC-0086 Port read-only when running
- [ ] TC-0087 CHANGE the port: 8501 → 9000 → app reachable on 9000
- [ ] TC-0088 Port indicator: green when running (not red)

### TS-0015 Port change: data portability (#2069)
- [ ] TC-0089 Server mode (default): populate data, change the port, reopen → sets + progress still there (backend data survives; auto-recovered on the Landing route via identity.yaml)
- [ ] TC-0090 Browser storage mode (Settings > Data > storage mode): populate data, change the port, reopen → empty app with the "Used Adaptive Learner before on a different port?" hint on the welcome screen (data NOT deleted, just tied to the old origin)
- [ ] TC-0091 The hint links to the "Changing the port" help page
- [ ] TC-0092 Recovery (browser mode): back to the old port → Settings > Data > Export backup (`.alb`) → new port → "Restore from backup" → sets, progress, exercises, settings all restored
- [ ] TC-0093 Canonical web version (astrapi69.github.io, browser mode, no explicit port): the hint does NOT appear

### TS-0016 States
- [ ] TC-0094 Not installed: [Install] visible
- [ ] TC-0095 Running: [Open in browser] [Stop] [Uninstall]
- [ ] TC-0096 Stopped: [Start] [Uninstall]
- [ ] TC-0097 All buttons fully visible (620px wide, no clipping)

### TS-0017 Uninstall
- [ ] TC-0098 Verbose output: each container/image individually with ✓/✗
- [ ] TC-0099 Image sizes shown
- [ ] TC-0100 Summary: "X artifacts removed, Y MB freed"
- [ ] TC-0101 State switches to "Not installed"

### TS-0018 Cleanup on start
- [ ] TC-0102 Finds orphaned artifacts (if any)
- [ ] TC-0103 User can choose (learning data OFF by default)
- [ ] TC-0104 Verbose progress

### TS-0019 Windows
- [ ] TC-0105 `.exe` starts (from the GitHub Release)
- [ ] TC-0106 Persistent window (NO dialog chain!)
- [ ] TC-0107 All functions as on Linux

---

## TS-0020 PRIO 3: CONTENT QUALITY (native-speaker spot check)

Requires domain knowledge. Not automatable.

- [ ] TC-0108 German-English A1/B1: translations correct?
- [ ] TC-0109 AI for beginners (DE): technical terms correct? explanations clear?
- [ ] TC-0110 Ansible QE: commands correct? syntax right?
- [ ] TC-0111 Japanese A1: hiragana/katakana correct? romanization right?
- [ ] TC-0112 Korean A1: hangul correct? romanization right?
- [ ] TC-0113 Chinese A1: pinyin correct? characters right?
- [ ] TC-0114 Italian A1: spot check grammar/vocabulary
- [ ] TC-0115 Portuguese-BR A1: spot check
- [ ] TC-0116 AI-generated error correction (#2355/#2364): for a generated
      `ext:al-error-correction` exercise, check that the marked token is really
      the wrong one and the accepted correction actually fixes it.
      Schema-conformant is not the same as meaningful: an already-correct marked
      token is valid but not a real exercise, and no automation can detect it
      (this spot check only). The same idea applies to the graded quiz and
      reading comprehension - solvable, unambiguous, grading as expected

---

## PRIO 4: LEARNING - MANUAL UX CHECK

### TS-0021 Exercise types (check visually)
- [ ] TC-0117 Matching: pairs SAME height (no visual offset)
- [ ] TC-0118 Matching: "Resolve" animation looks good (test all 4 effects)
- [ ] TC-0119 Matching: left column ALWAYS in lesson order (#2882), only the right
      column is shuffled; on "Resolve" the left column keeps its order (no
      jumping, #2872), each row shows the correct partner on the right,
      number badges run 1..n
- [ ] TC-0120 Word Tiles: correction READABLE (spaces, not "TheBrainforgets...")
- [ ] TC-0121 Word Tiles: on a CORRECT answer the built sentence stays visible (#2494):
      assemble a sentence correctly and check it. The composed sentence remains
      shown (all green) afterwards and does NOT disappear; the success message
      ("Correct!") and the Continue button appear below it. iOS PWA/Standalone:
      run the same check on the web app icon added to the home screen.
- [ ] TC-0122 Free Text: correction READABLE (token diff understandable)
- [ ] TC-0123 Cloze, select mode (#3167): pick a distractor -> graded wrong. Open a
      cloze exercise with word choices whose distractors are very close to
      the answer (e.g. alc-programming, react-grundlagen, lesson 02 "JSX",
      question "Wie bettet man in JSX den Wert einer Variablen name in den
      Text ein?"). Pick the wrong option `<p>Hallo $name</p>` and check:
      result "0 of 1 correct", the picked option red, the correct option
      `<p>Hallo {name}</p>` green. Then pick the correct option: "All
      correct!". Cross-check, type mode: in a typed cloze ONE typo is still
      graded correct (the tolerance applies to typed answers only). Review:
      the same exercise in a review session, pick the wrong option -> wrong;
      the exercise is NOT marked mastered afterwards.
- [ ] TC-0124 Picture Choice: tiles SAME height
- [ ] TC-0125 Answer order shuffled (#2317): open a picture_choice exercise across
      several lessons - the correct tile is NOT always in the same slot
      (previously always first). Within ONE session the order stays stable (no
      jump when re-viewing the same exercise). A correct tap still scores
      correct, a wrong one wrong (grading + review progress are content-based,
      not position-based). Same for the options in ext:al-graded-quiz and
      ext:al-reading-comprehension. iOS PWA/Standalone: repeat the check on the
      web-app icon added to the Home Screen.
- [ ] TC-0126 Matching + word tiles shuffled (#2371, #2372): open a matching exercise
      several times (different exercises/visits) - the first left entry does
      NOT consistently pair with the last right one (previously a near-constant
      reversed order); both columns are shuffled independently. In word tiles
      the first solution word is NOT consistently at the end of the tile bar.
      Within ONE exercise view the order stays stable. Correct pairs/sentences
      still score correct (grading is content-based, not position-based).
      iOS PWA/Standalone: repeat the check on the web-app icon added to the
      Home Screen.
- [ ] TC-0127 Matching: NO hint button (#2443, replaces #2390): open a matching
      exercise. There is NO "Show a hint" button above the columns, and no XP is
      deducted for one. Reason: in a matching exercise every word of both columns
      is already fully on screen, so a first-letter hint reveals nothing. For
      free-text/cloze/word-tiles the hint button stays as before. iOS
      PWA/Standalone: repeat the check on the web-app icon added to the Home
      Screen.
- [ ] TC-0128 One hint affordance per exercise (#3168): open a cloze, a free-text and a
      word-tiles exercise whose content carries an authored hint (field `hint`,
      e.g. French A1 lesson 1: free-text "It starts with M.", word-tiles
      "Literally 'until the re-seeing' ...", cloze "Daytime greeting, starts
      with B."). Before checking there is EXACTLY ONE hint surface: the "Show a
      hint −5 XP" button above the input. Below the options or the input there
      is NO "Need a hint?" link any more. The first hint click shows the
      authored hint verbatim and deducts XP (the header badge flashes red);
      further clicks show the generated stages (length, first letter or first
      tile), each again for XP. Without an authored hint the button keeps the
      generated stages as before. After "Check" no hint surface is visible. In
      exam mode the authored hint does not appear either (no hints in exam
      mode). Repeat in the review session and in the audio-tiles exercise
      (extension type). iOS PWA/Standalone: repeat the check on the web-app
      icon added to the Home Screen.
- [ ] TC-0129 Explanation after the answer (#2991): open an exercise whose content
      carries an explanation (the `explanation` field, e.g. the fixture
      `e2e/fixtures/explanation-post-answer.lesson.json` through a connected
      test repository). Before checking, NO explanation is visible. Answer
      wrong and check: the "Explanation" box appears below the exercise,
      EXPANDED, with rendered Markdown (bold "Rule", the word-by-word list, the
      examples). Answer the next exercise correctly: the box appears COLLAPSED
      with a "Why?" button; a click opens it, "Hide explanation" closes it
      again. An exercise WITHOUT an explanation shows no box. Settings >
      Learning > Review > "Show explanations" off: the box disappears at once,
      also inside the running lesson; on brings it back. In exam mode it never
      appears. No XP is deducted. iOS PWA/Standalone: repeat the check on the
      web-app icon added to the Home Screen.
- [ ] TC-0130 Matching: no wrong subtitle/column labels on knowledge sets (#2392): open
      a matching exercise from a KNOWLEDGE set (non-language domain, or source ==
      target, e.g. senses to organs). NO subtitle "Match each term with its
      definition" appears; the columns carry NO "Term"/"Definition" label, only
      the "A"/"B" badges and their content. A real LANGUAGE exercise is unchanged
      (language names or Term/Translation + the direction hint stay visible). iOS
      PWA/Standalone: repeat the check on the web-app icon added to the Home
      Screen.
- [ ] TC-0131 Matching: the preamble no longer eats the screen (#2391/#2444/#2453): open a
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
- [ ] TC-0132 Matching: long words wrap inside the tile (#3174): open a matching
      exercise whose word is wider than the tile on a NARROW device (iPhone,
      375px), e.g. alc-psychology "Sprachebenen zuordnen" with "kleinste
      bedeutungsunterscheidende Lauteinheit". The long word is hyphenated or,
      failing that, wrapped without a hyphen and stays ENTIRELY inside the tile
      border; no text runs past the right edge and the page does not scroll
      horizontally. After checking, the same holds for the "Your answer" /
      "Correct answer" lines and for the Solve view. Hyphenation follows the
      language of the CONTENT (set language), not the UI language: the tile
      columns carry a `lang` attribute with the target or source language
      (switching the UI language does not move the break points). The same
      applies to multiple-choice options, word tiles and picture-choice
      captions. iOS PWA/Standalone: repeat the check on the web-app icon added
      to the Home Screen.
- [ ] TC-0133 Difficulty indicator (#1693): an exercise whose card(s) carry an
      authored `difficulty` (1-5) shows a small badge above the exercise
      with a tier word (Easy/Medium/Hard) + a 5-dot meter. Cards WITHOUT
      `difficulty` (the whole legacy corpus) show NO badge (exercise looks
      as before). Applies to every exercise type (Matching/Cloze/Free-Text/
      Word-Tiles/Picture-Choice/Multiple-Choice + ext types). Badge reads
      cleanly in all 6 themes (token-backed). Transparency only - it changes
      neither ordering nor scoring.

### TS-0022 Test mode (preview build, #2319)

Only relevant when the build was produced with `VITE_TEST_MODE=true` (the
preview delivery). In the regular build the mode does not exist.

- [ ] TC-0134 Activate via the hidden gesture: six quick taps on the progress bar at
      the top of a running lesson. The test-mode banner then appears ("Answers
      are not graded and no progress is saved").
- [ ] TC-0135 Not accidentally triggerable: single or slow taps on the progress bar do
      NOT activate the mode.
- [ ] TC-0136 Every answer counts as correct: a deliberately WRONG choice/input (choice,
      free text, matching) is shown as correct; the lesson can be clicked all
      the way through without knowing the content.
- [ ] TC-0137 No progress: after clicking through in test mode the lesson shows NO
      progress, and no review cards or error counters were created (check the
      dashboard / review).
- [ ] TC-0138 Exit: "Exit test mode" in the banner switches it off; leaving the lesson
      resets the mode (re-entering starts without test mode).
- [ ] TC-0139 iOS PWA/Standalone: repeat the check on the web-app icon added to the Home
      Screen (gesture by tap, banner visible, click-through works).

### TS-0023 Learning modes (play each once)
- [ ] TC-0140 Mode toggle reachable in the collapsible options panel (since #1628
      it lives behind the panel, no longer directly visible)
- [ ] TC-0141 Options panel of an OWN lesson (created, imported, or an
      "Edit as a copy" fork): entry "Edit this lesson in the editor"
      visible; clicking lands in the editor with exactly this set and
      lesson preloaded (#2766)
- [ ] TC-0142 Options panel of a DOWNLOADED lesson and of an analysis lesson:
      NO editor entry (#2766)
- [ ] TC-0143 Mentor note (own lesson): below every step the "Mentor note"
      button; save category + text, reopening shows the note prefilled,
      removing deletes it (#2768)
- [ ] TC-0144 Mentor notes survive a reload and re-entering the lesson
      (localStorage store, identical in both storage modes) (#2768)
- [ ] TC-0145 Summary of an own lesson with notes: "Mentor notes (n)" block with
      category, text, per-row removal, and the editor link; without
      notes and on non-own lessons the block does not appear (#2768)
- [ ] TC-0146 Downloaded/analysis lesson: no mentor-note UI anywhere (#2768)
- [ ] TC-0147 Editor of an own lesson with mentor notes: panel
      "Mentor notes for this lesson (n)" above the wizard; removing a
      note updates the panel, the runner and the summary (#2769)
- [ ] TC-0148 "AI suggestion" per note: with a configured key a short text
      proposal appears; without a key the BYOK hint; an empty reply
      shows the "nothing usable" message (#2769)
- [ ] TC-0149 "Options" button sits in the SAME ROW as the progress indicator
      ("Step n of m"), not below it (desktop: bar on the left, button
      beside it on the right; mobile: tightly packed or a clean wrap,
      no overlap) (#1942)
- [ ] TC-0150 Exam mode: no hints, result at the end, 1.5x XP
- [ ] TC-0151 Timed mode: countdown bar visible, color transition
- [ ] TC-0152 Error mode: only error cards (after at least 1 error)
- [ ] TC-0153 Reverse: matching columns swapped
- [ ] TC-0154 Shuffle: cards mixed from different lessons
- [ ] TC-0155 Endless: no session end, statistics keep running
- [ ] TC-0156 Endless completion ("Practice session complete!"): Enter (without a
      click) triggers "Back to Dashboard" (#1864, button auto-focused)
- [ ] TC-0157 Error-replay completion ("All errors corrected!"): Enter (without a
      click) triggers "Back to lesson" (#1864); clicking the button still
      works
- [ ] TC-0158 Lesson summary ("You finished: ..."): with a next lesson available,
      Enter (without a click) triggers the PRIMARY card "Next Lesson ->
      Start" - not a secondary card (e.g. "Review"); clicking the buttons
      still works (#1943)
- [ ] TC-0159 Last lesson of a set (no "Next Lesson"): on the summary, Enter does
      nothing wrong - no error, no navigation to a non-existent lesson
      (#1943)
- [ ] TC-0160 Retry errors for matching (#1874): play a matching exercise with a
      mix of correct/wrong pairs, open "Retry errors" -> only the wrong
      pairs appear (not all). With a single wrong pair, correct pairs are
      added as distractors (min. 2 pairs so there is something to match)
- [ ] TC-0161 "Retry errors" setting (Settings -> Learning): switch to "Replay the
      whole set" -> the next "Retry errors" shows ALL pairs; switch back to
      "Only show errors" (default) -> only the wrong ones again
- [ ] TC-0162 Regression, other types: free-text/cloze in "Retry errors" still show
      only the wrong elements

### TS-0024 Game mode (#2844)
- [ ] TC-0163 Settings -> Learning: "Game Mode" section with the "Playful
      lessons" switch, default off
- [ ] TC-0164 Preparation for every detail step in this section (#2959):
      Settings > Learning > Game Mode > unfold "Game mode details"
      (collapsed by default); the detail switches are only usable while
      game mode is on, so switch "Playful lessons" on first
- [ ] TC-0165 Lesson start (first step, game mode off, hint never dismissed):
      "Try game mode" banner with "Turn on" and a close control
- [ ] TC-0166 "Turn on" in the banner: success toast, banner disappears, the
      Settings switch is on afterwards
- [ ] TC-0167 Closing the banner ("Don't show again"): banner disappears and does
      not come back on the next lesson; game mode stays off
- [ ] TC-0168 Game mode on: praise phrase on EVERY correct answer (not just
      periodically), confetti/milestone overlays allowed, regardless of
      the configured feedback intensity
- [ ] TC-0169 Game mode on + reduced motion in the system: feedback stays subtle
      (reduced motion wins)
- [ ] TC-0170 Game mode off: behaviour unchanged (feedback intensity applies as
      before)
- [ ] TC-0171 Toggling takes effect without a reload (change event) and behaves
      identically in both storage modes (localStorage)

#### TS-0025 Lernfunke mascot (#2849, only while game mode is on)

- [ ] TC-0172 Game mode on, open a lesson: small flame figure next to the
      progress bar (tooltip/screen reader: "Your learning companion");
      game mode off: no figure, row unchanged
- [ ] TC-0173 Correct answer: the figure cheers briefly (hop, happy eyes) and
      returns to its resting pose
- [ ] TC-0174 Wrong answer: the figure encourages (wiggle, surprised look), no
      praise text at the figure (the praise line under the exercise
      stays as before)
- [ ] TC-0175 Milestone during the lesson (level-up, streak, badge): the figure
      celebrates (star eyes + sparkles); the milestone overlay still
      appears undisturbed at the top center
- [ ] TC-0176 Lesson completion: the figure grows, celebrates, and shows ONE
      localized praise phrase as a speech bubble; the bubble dismisses
      itself
- [ ] TC-0177 Reduced motion in the system: poses still change (expression),
      but without hop/wiggle animation
- [ ] TC-0178 Exam mode + game mode: no per-answer reactions (no immediate
      feedback); the figure stays resting until completion
- [ ] TC-0179 Narrow viewport (mobile): the figure does not crowd out the
      progress bar; the row wraps cleanly

#### TS-0026 Mascot variants (#2861, Lernfunke color schemes)

- [ ] TC-0180 Settings -> Learning -> Game mode -> details (unfolded, see the
      preparation step #2959), "XP and mascot" block: the "Mascot
      variant" row with five mini figures (Spark, Ocean, Forest, Ghost,
      Gold) plus a hint text
- [ ] TC-0181 Fresh account (level 1, no badges, 0 XP): only Spark selectable;
      Ocean "From level 3", Forest "From level 7", Ghost "Needs the
      badge: First session", Gold with a "250 XP" button (disabled
      while XP is insufficient)
- [ ] TC-0182 At level 3+: Ocean clickable; the choice survives a reload
      (highlight ring on the selected variant)
- [ ] TC-0183 With a lesson open (game mode on), switch the variant: the flame
      figure next to the progress bar recolors immediately, no reload
- [ ] TC-0184 Gold purchase with enough XP: first click shows "Confirm", the
      second deducts 250 XP (the header XP badge updates), the variant
      is selected and permanently unlocked
- [ ] TC-0185 Backup round-trip: export -> wipe -> import restores selected and
      purchased variants (both storage modes)

#### TS-0027 Game mode sounds (#2875)

- [ ] TC-0186 Settings -> Learning -> Game mode: below the mode switch, the
      "Game mode sounds" switch (default off) with a hint text
- [ ] TC-0187 Turn game mode on without ever answering the sound question: the
      "Play with sound?" offer with "Yes, sounds on" / "Later"; "Yes"
      enables the sounds, "Later" does not - both make the offer
      disappear permanently
- [ ] TC-0188 Lesson-start banner (game mode off, never dismissed): next to
      "Turn on", the "Turn on with sound" button - enables mode AND
      sounds in one click
- [ ] TC-0189 Sounds on, global sounds OFF: a correct answer plays a tone
      (audibly rising with the streak), a wrong answer a low thud, a
      checkpoint jingle on crossing, a fanfare on lesson completion;
      volume follows the existing slider
- [ ] TC-0190 Game mode sounds OFF and global sounds OFF: everything silent;
      global sounds ON behave as before (no game-mode fanfare, no
      streak rise outside game mode)
- [ ] TC-0191 Exam mode + game mode + sounds: no per-answer tone (no immediate
      feedback); the completion fanfare stays allowed

#### TS-0028 Feedback card: volume always visible + game-mode hint (#2957)

- [ ] TC-0192 Settings -> Learning -> Feedback: the "Sounds" switch is OFF, yet
      the volume slider, the percentage readout and the "Test" button
      are visible; below the slider the hint "Also applies to the
      game-mode sounds."
- [ ] TC-0193 Sounds OFF, game-mode sounds ON: move the slider, play a lesson in
      game mode - the game-mode tones follow the new volume; sounds OFF
      + game-mode sounds OFF: "Test" stays silent
- [ ] TC-0194 Turn game mode on (Settings -> Learning -> Game mode): below the
      three intensity options the hint "Game mode is on, so feedback is
      always enthusiastic regardless of this setting." appears
      IMMEDIATELY, no reload
- [ ] TC-0195 Turn game mode off again: the hint disappears immediately; the
      selected intensity stays marked unchanged
- [ ] TC-0196 Game mode on + reduced motion in the system: both hints (reduced
      motion + game mode) are visible; feedback stays subtle (reduced
      motion wins)

#### TS-0029 Tension systems: hearts + countdown ring (#2878, opt-in, default off)

- [ ] TC-0197 Settings > Learning > Game Mode > details ("Tension" block,
      preparation step #2959): the "Hearts (lives)" and
      "Countdown ring" switches are OFF by default; the number inputs
      (hearts per lesson, seconds per exercise) only become editable
      after enabling their switch and clamp to 1-5 / 5-120
- [ ] TC-0198 Hearts on + game mode on: the hearts row appears next to the
      streak chip (filled); every wrong answer empties one heart with
      a short shake
- [ ] TC-0199 At 0 hearts: a friendly "Out of hearts!" dialog offers "Try
      again" (restarts the lesson, hearts refilled) and "Leave lesson"
      (back to the overview); nothing solved is lost
- [ ] TC-0200 Correction round on the summary: fixing mistakes costs NO
      hearts (the row is hidden there)
- [ ] TC-0201 Countdown ring on: a small ring runs per exercise (green >
      yellow > red, pulse in the last 5 seconds); expiry breaks the
      streak, costs a heart (if on) and plays the wrong tone - but
      the exercise stays open and normally solvable, nothing is
      auto-submitted; the ring pauses after checking
- [ ] TC-0202 Exam mode and timed mode: neither hearts nor ring appear (the
      timed mode keeps its own time bar)
- [ ] TC-0203 Grading unchanged: score, stars and progress are identical with
      and without the tension systems

#### TS-0030 Streak bonus XP (#2893, default on, game mode only)

- [ ] TC-0204 Settings > Learning > Game Mode > details ("XP and mascot" block,
      preparation step #2959): the "Streak bonus XP" switch is
      ON by default; the "Bonus XP cap per lesson" number input is
      editable, clamps to 5-20 (default 10) and is disabled while the
      switch is off
- [ ] TC-0205 Game mode on, play a lesson with a streak of at least 3 correct
      answers in a row: the summary shows a green "+N XP" next to
      "Best streak: N"; the displayed lesson XP include the bonus, and
      "Mark as complete" credits exactly the same value (dashboard XP
      rise by the displayed sum)
- [ ] TC-0206 The bonus counts from the THIRD streak answer (+1 per further
      correct answer in a row); a wrong answer stops the growth, a new
      streak from 3 keeps counting
- [ ] TC-0207 Cap: with the cap at 5 and a long streak, the summary shows at
      most "+5 XP"
- [ ] TC-0208 Switch off OR game mode off: no "+N XP" on the summary, XP are
      identical to normal mode
- [ ] TC-0209 Exam mode: no streak bonus (the exam multiplier is unchanged)

#### TS-0031 Arcade mini-games (#2887, default on, game mode only)

- [ ] TC-0210 Settings > Learning > Game Mode > details ("Arcade and rewards"
      block, preparation step #2959): the "Arcade" switch is ON by
      default; the "Snake round length" (30-120, default 60) and
      "Memory pairs" (4-12, default 8) number inputs clamp and are
      disabled while the switch is off
- [ ] TC-0211 Game mode on: the arcade card appears on the dashboard; "To the
      arcade" opens the game list. Arcade switch off OR game mode off:
      the card disappears entirely; visiting /arcade directly shows a
      friendly notice with a link to the settings
- [ ] TC-0212 Learn Memory (free): the set picker lists downloaded sets only
      and is preselected with the most recently learned set (#2899),
      not the first in the list; without any progress the first set
      stays preselected;
      the board has two cards per pair (term and translation from real
      lesson cards); a matched pair stays open, a mismatch counts a
      try and folds away on the next reveal; finding every pair shows
      the win message with the try count
- [ ] TC-0213 Snake (locked): the game card offers "Unlock for 200 XP"; with
      too little XP the button is disabled (tooltip); the purchase
      takes TWO clicks (confirm text), deducts 200 XP (header XP
      drops) and Snake stays playable permanently (survives a reload
      and rides the backup)
- [ ] TC-0214 Playing Snake: arrow keys/WASD AND swipe gestures steer; pause
      halts clock and snake; food grows the snake (+1 point); wall or
      own body ends the round; the round clock running out shows the
      result (won from 5 points); the local best score is display-only
- [ ] TC-0215 Games award NO XP (header XP unchanged after a won round)
- [ ] TC-0216 Reduced motion in the system: no flip/flash effects in either
      game

#### TS-0032 Arcade: Tic-Tac-Toe (#2906, 100-XP unlock)

- [ ] TC-0217 Arcade game list: Tic-Tac-Toe appears between Learn Memory and
      Snake, locked behind "Unlock for 100 XP" (two-step confirm as
      with Snake); a ticket plays one round without the purchase
- [ ] TC-0218 A round: clicking places X, a short "the app is thinking"
      beat, then the app places O; occupied cells and the thinking
      beat are disabled
- [ ] TC-0219 The AI is beatable: it does not block every winning chance -
      over a few rounds you can win (three in a row highlighted,
      friendly win message)
- [ ] TC-0220 Losing and a draw end friendly with "Restart"; the game awards
      no XP

#### TS-0033 Arcade: Simon (#2907, 300-XP unlock)

- [ ] TC-0221 Arcade game list: Simon appears after Snake, locked behind
      "Unlock for 300 XP" (two-step confirm); a ticket plays one
      round without the purchase
- [ ] TC-0222 A round: the app shows the color sequence field by field
      (status "Watch the sequence"), then the four fields become
      active ("Your turn"); during playback they are disabled
- [ ] TC-0223 A correct input extends the sequence by one field and replays
      it; the round label counts "Sequence {n} of {m}" up
- [ ] TC-0224 A wrong input ends friendly with the reached length and
      "Restart"; reaching the target length wins the round; the game
      awards no XP
- [ ] TC-0225 Sounds: with the sounds or game-mode-sounds switch on, each
      field plays its own tone (playback and input); without the
      opt-in the game stays silent and fully playable
- [ ] TC-0226 Settings > Learning > Game Mode > details ("Arcade and rewards"
      block, preparation step #2959): the "Simon target length"
      number input clamps to 5-15 (default 8) and is disabled while
      the arcade is off
- [ ] TC-0227 Reduced motion in the system: fields only change state
      (ring/brightness), no flash/scale effect

#### TS-0034 Flash rounds (#2888, default on, game mode only)

- [ ] TC-0228 Settings > Learning > Game Mode > details ("Arcade and rewards"
      block, preparation step #2959): the "Special rounds" switch is
      ON by default; the "Flash-round cards" number input clamps to
      5-20 (default 10) and is disabled while the switch is off
- [ ] TC-0229 Set overview (/content/set/...) with game mode on: the
      flash-round card appears; while not every lesson of the set is
      completed with at least one star, the start button is disabled
      with the unlock-condition tooltip
- [ ] TC-0230 Set finished (every lesson with at least one star) and error
      cards present: starting opens the flash round - title
      "Flash round: {set}", the countdown ring runs per exercise
      (expiry breaks the streak, nothing is auto-submitted), the
      exercises come from the set's most error-prone cards
- [ ] TC-0231 The flash round's back button returns to the set overview (not
      to a lesson)
- [ ] TC-0232 Perfect set (no error cards): the start button stays disabled
      with the perfect tooltip
- [ ] TC-0233 Special-rounds switch off OR game mode off: the flash-round card
      disappears entirely
- [ ] TC-0234 A plain "Retry errors" from a lesson summary: unchanged, NO
      countdown ring
- [ ] TC-0235 Scoring/SRS: the flash round writes no lesson progress;
      corrected error cards only advance the SRS state, as in retry
      errors

#### TS-0035 Game tickets (#2889, default on, game mode only)

- [ ] TC-0236 Settings > Learning > Game Mode > details ("Arcade and rewards"
      block, preparation step #2959): the "Game tickets" switch is ON
      by default; the "Maximum tickets" number input clamps to 1-10
      (default 5) and is disabled while the switch is off
- [ ] TC-0237 Finishing a lesson with a perfect score: the summary shows the
      ticket banner ("Reward unlocked ...") with a "Play now" button
      leading to the arcade
- [ ] TC-0238 Arcade switch off (#3029): the same lesson finished with a perfect
      score shows NEITHER the banner nor "Play now" in the summary, and
      no ticket is banked; arcade switch back on and another new lesson
      finished perfectly: banner and button are back
- [ ] TC-0239 Hearts active (#2878) and a run finished without losing one:
      one more ticket (perfect score + all hearts = 2 tickets)
- [ ] TC-0240 Streak milestones (3/7/14/30 days): reaching one grants a bonus
      ticket, each milestone only once
- [ ] TC-0241 Cap: no more tickets than the maximum can be saved up; a
      milestone blocked by the cap is granted later once a slot is
      free
- [ ] TC-0242 Revisiting the summary of an already-completed lesson: NO new
      ticket (no farming); "Practice again" with a fresh perfect run
      earns normally
- [ ] TC-0243 The correction round and retry-errors award no tickets; a run
      corrected after the fact never counts as a perfect score
- [ ] TC-0244 Exam mode: a perfect score earns the ticket by the same rule
- [ ] TC-0245 The arcade page and the dashboard arcade card show the balance
      ("Tickets: N"); the line disappears while the ticket switch is
      off
- [ ] TC-0246 A locked game (snake without the XP purchase) with a balance:
      the "Play one round with a ticket" button starts one round and
      deducts exactly one ticket; without a balance the button is
      absent
- [ ] TC-0247 Ticket switch off: the arcade offers only the XP purchase /
      existing unlocks
- [ ] TC-0248 Backup export > wipe > import: the ticket balance survives the
      round-trip (localStorage snapshot)

#### TS-0036 Bonus lessons (#2890, default on, game mode only)

- [ ] TC-0249 Settings > Learning > Game Mode > details ("Arcade and rewards"
      block, preparation step #2959): the "Bonus lessons" switch is
      ON by default
- [ ] TC-0250 A set with a bonus- lesson file (filename starts with
      "bonus-"): the set page shows the bonus lesson at the END of
      the list with a "Bonus" badge, even when the file would sort
      first alphabetically
- [ ] TC-0251 Game mode on, set unfinished: the bonus row is locked (lock
      icon, no link); the tooltip names the condition (every regular
      lesson with at least one star)
- [ ] TC-0252 Every regular lesson completed with at least one star: the
      bonus row becomes a normal link and opens the lesson
- [ ] TC-0253 Bonus switch off OR game mode off: the bonus lesson is a normal
      link (only the badge stays) - no content is withheld
- [ ] TC-0254 "Start learning" on the set page opens the first REGULAR
      lesson, never the bonus file
- [ ] TC-0255 Flash round (#2888): a still-locked bonus lesson does NOT block
      the flash-round unlock (only regular lessons count)

#### TS-0037 Playful exercise renderers (#2876, only while game mode is on)

- [ ] TC-0256 Multiple-choice exercise: the answers render as large tiles
      (two columns from tablet width); the chosen tile pops briefly
      and gets an accent border; after checking, the correctly chosen
      tile hops and a wrongly chosen one shakes
- [ ] TC-0257 Cloze with word choices: the tapped word "jumps" into the blank
      in the sentence with a small hop; changing the pick replays the
      hop with the new word
- [ ] TC-0258 Matching exercise: a freshly formed pair "snaps" together with a
      pop on both tiles; after checking, correct pairs hop briefly;
      tapping a pair still undoes it
- [ ] TC-0259 Behaviour unchanged: selection, checking, score and resolution
      are identical to normal mode in all three exercise types
- [ ] TC-0260 Game mode off: classic lists/chips/tiles without the game look;
      reduced motion in the system: the shapes stay, all hop/pop
      animations are suppressed

#### TS-0038 Juice package (#2874, only while game mode is on)

- [ ] TC-0261 Play a lesson, two correct answers in a row: the streak chip
      (flame + "x2") appears next to the progress bar and hops on every
      further correct answer ("x3", "x4", ...)
- [ ] TC-0262 Wrong answer: the chip disappears (streak broken); the next two
      correct answers rebuild it
- [ ] TC-0263 Correct answer: a "+1" floats off the check mark and fades; the
      check hops briefly; on a wrong answer the X shakes
- [ ] TC-0264 Lesson with at least 3 steps: two checkpoint dots at 1/3 and 2/3
      on the progress bar; crossing one lights it up in the accent
      color (small pop)
- [ ] TC-0265 Summary: instead of the live chip, "Best streak: N" is shown
      (from streak 2; no chip without a real streak)
- [ ] TC-0266 Exam mode + game mode: no chip, no "+1", no per-answer checkpoint
      celebration (no immediate feedback)
- [ ] TC-0267 Game mode off: none of this appears; reduced motion in the
      system: chip/dots render without animation, the "+1" stays
      invisible (pure motion decoration)

### TS-0039 Learning tab: five clusters (#2956)

- [ ] TC-0268 Settings > Learning: the cards sit in five labelled areas, each
      with a small uppercase heading and a description line underneath,
      in this order: "Basics" (Who is learning, and in which languages.),
      "In the lesson" (How exercises behave while you answer.), "Reading
      aloud and dictation" (Voices, speed, microphone and pronunciation
      practice.), "After the lesson" (Review sessions, the lesson summary
      and retrying mistakes.), "Motivation and routine" (Game mode,
      feedback, daily missions and reminders.)
- [ ] TC-0269 Basics: Learning profile, then Additional source languages
- [ ] TC-0270 In the lesson: Lesson mode, Hints, Interaction, then Preferred
      exercise direction and Matching exercise (Hints and Interaction come
      BEFORE direction and solve)
- [ ] TC-0271 Reading aloud and dictation: only the "Voice" card; in a browser
      without Web Speech support (neither synthesis nor recognition) the
      whole area is absent, heading included, and "After the lesson"
      follows "In the lesson" directly
- [ ] TC-0272 After the lesson: Review, Lesson summary, Retry errors. "Spaced
      repetition" is no longer a card of its own but the last block
      inside the "Review" card (under a divider, smaller heading): the
      interval schedule (correct answers in a row against days until the
      next review), the note on when an item counts as mastered, and the
      link to the learning method
- [ ] TC-0273 Motivation and routine: Game Mode, Feedback, Daily Missions,
      Reminders (last card of the tab)
- [ ] TC-0274 Phone (375 px wide): area headings and descriptions wrap, nothing
      scrolls horizontally; switching tabs and the ?tab=learning deep
      link work as before

### TS-0040 Game mode: summary card + details (#2959)

- [ ] TC-0275 Settings > Learning > Game Mode: the card shows the "Playful
      lessons" switch, the game mode sounds and, below them, the status
      line "N of 7 extras on" (fresh state: "5 of 7")
- [ ] TC-0276 "Game mode details" is collapsed by default (button with a
      chevron, the hint "Hearts, countdown, arcade, special rounds,
      tickets, bonus lessons, streak XP and mascot." underneath);
      unfolding shows the three blocks "Tension", "Arcade and rewards"
      and "XP and mascot"
- [ ] TC-0277 Leave it unfolded and reload the page: the fold stays open; leave
      it collapsed and reload: it stays collapsed (both storage modes,
      localStorage)
- [ ] TC-0278 Game mode OFF, details unfolded: every switch, every number input
      and the mascot buttons are greyed out; the notice "Turn on "Playful
      lessons" to change these options." sits at the top of the fold
- [ ] TC-0279 Switch "Playful lessons" on: the notice disappears and the detail
      switches become usable without a reload; number inputs still follow
      their own switch (e.g. "Hearts per lesson" stays locked while
      "Hearts (lives)" is off); switching off again locks everything
      without a reload
- [ ] TC-0280 Flip one detail switch (e.g. hearts on): the status line counts
      along immediately ("6 of 7 extras on")
- [ ] TC-0281 Arcade notice page (/arcade with the arcade or game mode off): the
      link into the settings lands on the Learning tab's "Motivation and
      routine" area (chip active, area on screen, see #2961)

### TS-0041 Gamification inside "Motivation and routine" (#2962)

- [ ] TC-0282 Settings > Learning > "Motivation and routine": the "Gamification"
      card (XP notifications, badge notifications, "View all badges",
      weekend mode, daily session goal, "Reset progress") is the LAST
      card of the tab, right behind "Reminders", set apart by a thicker
      divider with extra space above it
- [ ] TC-0283 Settings > Plugins: the "Installed plugins" card (#3055) and, below
      it, the "Learning Repository" card; no Gamification card any more
- [ ] TC-0284 Section bar, chip "Motivation and routine": the jump lands on the
      area heading, and the Gamification card belongs to the area (under
      the same heading)
- [ ] TC-0285 "View all badges" still opens the badge gallery; "Reset progress"
      still asks twice; weekend mode persists (reload) - in both storage
      modes
- [ ] TC-0286 Phone (375 px): the card and the divider wrap cleanly, nothing
      scrolls horizontally

### TS-0042 Data tab: section bar + deep link (#3122)

The same mechanics as on the Learning tab (#2961, #2966), over the six
areas of the Data tab in the fixed #1451 order.

- [ ] TC-0287 Settings > Data: above the first area sits a row of chips "Sources",
      "Sync", "Offline content", "Backup and export", "Housekeeping",
      "Danger zone" (in this order, `settings-subnav-sources` …
      `settings-subnav-danger`). With no selection no chip is highlighted;
      every area carries a heading and a description, the cards below are
      unchanged (content repos and registry under Sources; cache and lesson
      size under Offline content; backup, identity, key vault, export under
      Backup; retention and orphaned data under Housekeeping; Delete
      everything as the last card, set apart)
- [ ] TC-0288 Click the "Backup and export" chip: the page scrolls to the area, the
      heading sits clear of the header (desktop: clear of header AND bar),
      the chip is highlighted, the address ends in
      `?tab=data&section=backup`, the back button does NOT return to the
      previous chip
- [ ] TC-0289 Phone (375 px): the chip row can be swiped sideways, no horizontal
      page scroll; the backup is one tap away instead of several screen
      heights of scrolling
- [ ] TC-0290 Open the deep link `/settings?tab=data&section=danger` in a new tab:
      the Data tab is open, the danger zone on screen, its chip highlighted
- [ ] TC-0291 Open `/settings?tab=data&section=review` (a Learning area): the Data
      tab opens at the top, no Data chip highlighted, no error
- [ ] TC-0292 Jump from the AI tab "Export keys" / "Import keys" (#1183, #1765):
      still lands on the key vault inside "Backup and export"; the bar does
      not disturb the jump
- [ ] TC-0293 With no selection scroll slowly: the highlighted chip follows the
      area whose heading is at the top of the screen; the address does NOT
      change
- [ ] TC-0294 Both storage modes (API + Dexie): bar and deep link behave the same;
      in Dexie mode the "Sync" area shows the desktop-only notice

### TS-0043 Learning tab: section bar + deep link (#2961)

- [ ] TC-0295 Settings > Learning: above the first area sits a row of chips
      "Basics", "In the lesson", "Reading aloud and dictation", "After the
      lesson", "Motivation and routine" (in this order; without Web Speech
      support the "Reading aloud and dictation" chip is absent). With no
      selection no chip is highlighted
- [ ] TC-0296 Click the "After the lesson" chip: the page scrolls to the "After
      the lesson" area, the area heading sits clear of the header (desktop:
      clear of header AND bar), the chip is highlighted, the address ends
      in `?tab=learning&section=review`, and the browser back button does
      NOT return to the previous chip (no new history entry)
- [ ] TC-0297 Desktop (>= 768 px): keep scrolling down - the bar stays visible
      right below the app header and covers no text. Phone (375 px): the
      bar scrolls away with the page, the chip row can be swiped sideways,
      nothing scrolls horizontally at page level
- [ ] TC-0298 Open the deep link `/settings?tab=learning&section=motivation` in a
      new tab: the Learning tab is open, the "Motivation and routine" area
      on screen, its chip highlighted; on the phone the active chip is
      visible in the row (the row was scrolled to it)
- [ ] TC-0299 Open `/settings?tab=learning&section=nonsense`: the tab opens at the
      top, no chip highlighted, no error
- [ ] TC-0300 With an active area switch to another tab (e.g. Data): the address
      carries only `?tab=data`; back on Learning: no chip highlighted, no
      scroll movement
- [ ] TC-0301 System setting "reduce motion" on: the jump happens without
      animation (instant), otherwise smoothly
- [ ] TC-0302 With no selection scroll slowly through the tab (#2966): the
      highlighted chip follows the area whose heading is at the top of
      the screen (Basics -> In the lesson -> ... -> Motivation and
      routine); after a chip click the clicked chip stays highlighted
      until its area is on screen, then follows the scrolling again. The
      address does NOT change while scrolling
- [ ] TC-0303 Heading hierarchy (#2966, screen reader / browser outline): on the
      Learning tab the area headings are h2 and the card titles inside
      are h3; on the other tabs the card titles stay h2
- [ ] TC-0304 Both storage modes (API + Dexie): bar and deep link behave the same

### TS-0044 Summary counts corrections (#2479)
- [ ] TC-0305 Play a lesson with several wrong answers, then fix them in the
      end-of-lesson correction round. The score bar shows two segments: what
      was right on the first try (solid fill) and what was fixed after
      correcting (hatched), with a legend "N on the first try" / "N after
      correcting".
- [ ] TC-0306 Stars, message and the "+N XP" follow the final state: fixing every
      mistake earns full stars and "Perfect score!", not "1 of 3 stars" /
      "Good start". The credited XP matches the number shown.
- [ ] TC-0307 Without a correction round the bar stays a single solid segment (no empty
      second segment, no legend); stars + message unchanged.
- [ ] TC-0308 Exam mode: the result does NOT follow the correction - an exam result is
      the first pass (single-segment bar, stars + XP unchanged).
- [ ] TC-0309 Accessibility: the two bar segments are distinguishable without colour
      (hatch + legend) - check in BOTH light and dark themes.
- [ ] TC-0310 iOS PWA/Standalone: same check on the icon added to the home screen
      (the report came from there). Bar, stars, message and XP show the final
      state after correction.

### TS-0045 "Why you missed these" shows the question (#2757)
- [ ] TC-0311 Play a lesson with at least one wrongly answered element (explanations
      enabled in Settings > Learning). In the "Why you missed these" section,
      each answer comparison carries a "Question:" line above it showing what
      was asked (the exercise prompt, the sentence with "___" for cloze, the
      asked term for matching) - not just "Your answer" / "Correct".
- [ ] TC-0312 Matching exercise with one wrong pair: the question shown is the asked
      term (the pair's left side), never an internal ID.
- [ ] TC-0313 When the question cannot be resolved (e.g. the content was updated in
      the meantime), the entry renders as before without a question line -
      no error, no empty line.

### TS-0046 One collapsed mistakes section (#2496)
- [ ] TC-0314 Play a lesson with at least one mistake. On the summary the
      "Fix your mistakes (N)" section appears COLLAPSED: NO text field has
      focus, NO keyboard pops up (check on a phone - that was the report).
      The score stays visible.
- [ ] TC-0315 Tap "Fix now" -> the section expands, the first correction drill
      (cloze) appears and NOW takes focus (the keyboard may open here - it is
      the user's deliberate action).
- [ ] TC-0316 Inside the expanded section there is a secondary "Redo all exercises (N)"
      action -> goes to the error-replay page with the real failed exercises.
- [ ] TC-0317 The "What's next?" cards no longer contain a separate "Retry errors"
      card (folded into the one section). Enter still activates the primary
      forward card (Next lesson / Adaptive / Review), never the collapsed
      mistakes section.
- [ ] TC-0318 When every mistake is already corrected, the section shows a short
      success note ("All errors corrected!") instead of a drill.
- [ ] TC-0319 #2570: only non-cloze-able mistakes (no cloze can be generated) - the
      section shows "Repeat your mistakes" DIRECTLY, with "These can't be
      practiced as a quick drill - redo the exercises instead." + the "Redo
      all exercises (N)" button. NO "Fix now" intermediate step that would
      only expand into nothing.
- [ ] TC-0320 #2570 placement: the mistakes section sits BEFORE the "What's next?"
      cards (Next lesson / Adaptive / ...) in the default order, not after -
      fix your own mistakes first, then decide where to go next. Still freely
      reorderable via Settings.

### TS-0047 Correction round: the result stays, then Continue (#3125)
- [ ] TC-0321 Finish a lesson with at least two mistakes, press "Fix now", fill
      the first blank CORRECTLY and check: the blank turns green, "All
      correct!" appears, below it the green success bar with "Continue".
      The round does NOT move on by itself (auto-advance in Settings >
      Learning off)
- [ ] TC-0322 Press "Continue" (or Enter): now the next drill appears (counter
      "2 / N")
- [ ] TC-0323 Fill a blank WRONGLY and check: the blank turns red, "0 of 1
      correct", My answer / Solution stay visible, below them a plain
      "Continue" button; no auto-advance, not even with auto-advance on
- [ ] TC-0324 Settings > Learning > auto-advance on, round again: after a CORRECT
      answer the success bar stays briefly (as in the lesson) and the
      round moves on by itself
- [ ] TC-0325 After the last drill "Continue" leads to the completion note
      ("Correction round complete", N elements improved); the number
      matches the correct answers
- [ ] TC-0326 Skipping stays possible at any time; the comparison with the
      previous run (#983) is unchanged

### TS-0048 New exercise types (since v2.2.0, visual + functional)
- [ ] TC-0327 multiple_choice: selection, feedback, SRS attempt
- [ ] TC-0328 matching solve toggle (#3140): after a not-fully-correct check the
      "My answers" / "Solve" toggle is there; on a fully-correct answer NO
      toggle appears - in the lesson only "Continue", in the review
      session and the endless, shuffle, adaptive and error-replay lessons
      only the graded columns
- [ ] TC-0329 matching corrections view (#3186): after a not-fully-correct check
      there are three buttons "My answers" / "Corrections" / "Solve".
      "My answers" is active and shows your pairs exactly as you formed
      them (numbered, colour-coded pair badges), with NO grading: no
      green/red, no green pair colour either (#3261), no "Your answer" or
      "Correct answer" row (#3233).
      "Corrections" shows the graded grid (green/red, "Your answer") plus
      the correct answer under each mistake, "Solve" shows the solution.
      "Try again" and a new check start in "My answers" again
- [ ] TC-0330 matching corrections setting (#3186): Settings > Learning > card
      "Matching exercise" > "Corrections as a separate view" is on by
      default. Off: only two buttons "My answers" / "Solve", the correct
      answer sits directly under each mistake. Toggling applies at once to
      an open exercise. In exam mode (no toggle) the correct answer always
      sits directly under the mistake
- [ ] TC-0331 ext:al-categorization: assign categories, readable resolution; after
      "Check answer" the verdict chips including the red correction category
      stay INSIDE their column (no bleeding into the neighbor column, #2771) -
      the correction sits on its own line under the item
- [ ] TC-0332 ext:al-categorization solve toggle (#2772): after a not-fully-correct
      check, the "My answers" / "Solve" toggle appears next to the result
      line (like the pairs exercise). "Solve" shows every category with its
      correct items; items you had placed correctly yourself are tinted green
      with a check mark. "My answers" returns to the graded view, "Try again"
      resets to the interactive view. On a fully-correct answer NO toggle
      appears (only "Continue")
- [ ] TC-0333 ext:al-error-correction: find + correct errors
- [ ] TC-0334 ext:al-error-correction solve view (#2803): after a wrong check,
      the "My answer" / "Solution" toggle appears next to the result
      line (like pairs/categories). "Solution" renders the sentence as
      word tiles: the wrong word struck through in red with an X, the
      canonical correction right beside it in green with a check mark -
      you see WHERE in the sentence the error sat. "My answer" returns
      to the graded view (incl. the solution line); "Try again" resets
      to the interactive view. On a correct answer NO toggle appears
- [ ] TC-0335 ext:al-reading-comprehension: text + questions
- [ ] TC-0336 ext:al-reading-comprehension resolution (#2633): after "Check answers"
      the correct multiple-choice option is highlighted GREEN — with a check
      icon and a text badge, never by color alone. If you picked it yourself it
      reads "Correct"; if you picked wrong, the right option reads "Correct
      answer" (green, dashed border) and your own pick reads "Wrong" (red).
      For free-text questions the solution line renders in the green tint with
      a check instead of as grey body text. Same color language as the pairs
      (matching). Check across all 12 themes: the text stays readable on the
      tint.
- [ ] TC-0337 ext:al-graded-quiz: grading + result display
- [ ] TC-0338 ext:al-dictation (#1881): "Listen first" plays the clip, type the
      transcription; correct / near-miss ("Almost!") / wrong shows the
      solution; a lesson with `requires_extensions: ["ext:al-dictation@1"]`
      loads (not refused by the guard)
- [ ] TC-0339 ext:al-image-description (#2095): the image is shown, type a free-text
      description; correct / near-miss ("Almost!") / wrong shows the solution;
      a lesson with `requires_extensions: ["ext:al-image-description@1"]`
      loads (not refused by the guard). An embedded image renders WITHOUT a
      network connection (offline-first); a lesson whose image is a remote
      `http(s)://` URL is refused by the guard. Read-aloud: the prompt gets a
      speaker button (the instruction is spoken, never the answer). a11y note:
      this type is visually gated by design (the answer IS the image
      description) — a screen reader hears a neutral image label, not the
      solution.
- [ ] TC-0340 ext:al-speak-and-record (engine#68 idea 3): the sentence is read aloud
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
- [ ] TC-0341 **Storage cap + eviction (#2841):** recordings are auto-evicted
      oldest-first once total storage crosses a cap - practically
      unreachable in normal use (~170 max-length recordings needed), so
      only the regression check applies here: the normal record flow
      (record -> playback -> re-record) keeps working unchanged. The
      eviction logic itself is covered by automated tests
      (`speech-recordings-dexie.test.ts`), not manually verified. If the
      "Your previous recording was removed…" message ever appears: no
      crash, "Record again" works normally and the message clears
      afterwards.
- [ ] TC-0342 Listen-first audio (#1687): audio button on free_text +
      matching plays, grading unaffected
- [ ] TC-0343 Parametric exercises (#3109, schema v1.14): a free_text exercise
      declaring `variables` shows CONCRETE numbers in its prompt (no
      `{{name}}` braces visible anywhere), a different draw on each fresh
      attempt of the same lesson; typing the exact computed answer is
      accepted, and a numeric answer close to it (within the authored
      tolerance) is ALSO accepted even when the text differs (e.g. "10.3"
      accepted for a computed "10" with tolerance 0.5) - a clearly wrong
      number is rejected. Revisiting an already-completed step shows the
      SAME numbers the learner originally saw, not a fresh draw. A lesson
      with NO `variables` (e.g. content teaching Jinja2 templating) keeps
      any literal `{{ ... }}` in its text untouched.
- [ ] TC-0344 ext:al-ordering (#3110): steps shown as shuffled draggable tiles; tap
      a scrambled tile to place it, tap a placed tile to return it, drag
      (or the ◀ ▶ arrows / arrow keys) to reorder. Check accepts ONLY the
      exact authored order — one swap is wrong. Try again resets the
      placement; a lesson with `requires_extensions: ["ext:al-ordering@1"]`
      loads (not refused by the guard).
- [ ] TC-0345 ext:al-ordering review (#3260): after Check, "Your answer" shows the
      submitted order, numbered, each step with a green check or a red X. A
      wrong answer adds the "Solution" below with the right order; a correct
      answer shows no solution. The wrong-answer line reads "Not quite - the
      order is not right yet." (no prompt to retry). Exam mode shows no
      breakdown. On a phone (narrow width) long steps stay readable and wrap.
- [ ] TC-0346 ext:al-parsons (#3110): code lines shown as shuffled draggable tiles
      (monospace), same tap/drag reorder as ordering, PLUS a per-tile
      indent stepper (- / depth / +). Check requires BOTH the right
      sequence AND the right indent per line — a right sequence at the
      wrong depth is wrong. The indent stays with a tile when it is
      dragged elsewhere. Try again resets placement AND every indent back
      to 0; a lesson with `requires_extensions: ["ext:al-parsons@1"]` loads
      (not refused by the guard).
- [ ] TC-0347 ext:al-parsons review (#3218): after Check, "Your answer" shows the
      submitted code at the chosen indent, each line with a green check or
      a red X; wrong lines name the reason ("Wrong position" or "Indent 0,
      expected 2"). A wrong answer adds the "Solution" below with the right
      order and indent; a correct answer shows no solution. Exam mode shows
      no breakdown.
- [ ] TC-0348 ext:al-reading-comprehension passage (#3217): a passage with a fenced
      code block (```) shows the code on multiple lines, indented, in
      monospace and horizontally scrollable for long lines; paragraphs and
      single line breaks in the passage are kept.
- [ ] TC-0349 ext:al-hotspot (#3110): an image with invisible clickable zones —
      click the right spot. Before Check, no zone outline or fill is
      visible (the answer is never revealed early). Check highlights the
      correct zone green; a wrong pick highlights red. Rect and circle
      zones both hit-test correctly, including a click right on a zone's
      edge. Try again clears the selection; a lesson with
      `requires_extensions: ["ext:al-hotspot@1"]` loads (not refused by
      the guard).
- [ ] TC-0350 Extension-wizard authoring (#3110): in the Lesson Creator's
      extension-exercise editor, author one exercise of each new type —
      ordering (add/remove steps), parsons (type/paste code in the
      textarea; the line list preview reflects the derived indent), and
      hotspot (pick/upload an image, add a zone, set its shape + 0-100
      coordinates, mark exactly one zone correct). Save is disabled with
      an inline hint until the payload is valid (e.g. fewer than 2 items,
      or zero/more-than-one correct hotspot zone).
- [ ] TC-0351 Hotspot drag-to-draw zone canvas (#3110): once an image is picked,
      a "Draw a zone on the image" canvas appears above the numeric zone
      list. Choose Rectangle or Circle, then drag on the image — a dashed
      preview follows the drag and, on release, a new zone is added with
      the drawn position/size (visible immediately in the numeric fields
      below for fine-tuning). Dragging off the image and releasing there
      cancels the draw (no zone added). The existing zones render on the
      canvas too (the correct one visually distinct), so the whole layout
      is visible while drawing more.

### TS-0053 Lesson/set file import-export (#1672 / #1681 / #1685 hardening)

Location: My Content (`/content?tab=my`) → "Import a lesson" modal +
per-card "Export" / "Export as set"; accepts `.json` (a single lesson)
+ `.zip` (a whole set = `manifest.yaml` + `lessons/`).

- [ ] TC-0381 Import a `.json` lesson: preview shows title · language · N
      lessons · M exercises BEFORE confirming
- [ ] TC-0382 Import a `.zip` set: preview + correct lesson count
- [ ] TC-0383 Name collision: three-way dialog appears (Overwrite /
      Import as copy / Cancel), NO silent overwrite;
      "Import as copy" creates a fresh id + "(copy)" title
- [ ] TC-0384 **#2592 Overwrite carries the learning progress across:** create a set
      with your own lesson, answer one exercise wrongly (so an error/review
      row exists), export the set, correct ONE answer text in the exported
      file (e.g. a typo in `free_text.accept[0]`), re-import → collision
      dialog → "Overwrite". Expected: a toast "Carried over N review
      card(s)", and the error history still shows the row (with its old error
      count) under the NEW answer text — not as a fresh row and not gone.
      Before this fix the row was orphaned silently.
- [ ] TC-0385 **#2592 an unresolvable case is reported, not silent:** same setup, but
      DELETE an exercise in the file (so positions shift) → "Overwrite".
      Expected: an info toast "… could not be confidently matched", no silent
      loss
- [ ] TC-0386 **#2592 "Import as copy" is untouched:** same flow but choose "Import
      as copy" → the original keeps its progress AND review cards, the copy
      starts without either
- [ ] TC-0387 Partial import (ZIP with broken lessons): valid ones import,
      warning "N lesson(s) skipped" is shown
- [ ] TC-0388 Set with ONLY broken lessons: clean error, no crash
- [ ] TC-0389 Size guard: a file > 5 MiB is refused BEFORE parsing with a
      friendly message; malformed JSON/ZIP names the reason, no crash
- [ ] TC-0390 Round-trip: export a lesson → re-import → identical in
      My Content
- [ ] TC-0391 Create-Lesson "Save as file": the save step offers a file
      download of the just-created lesson (canonical JSON)

### TS-0049 Work through a set again - second run (#2125, EXP-051)

Location: My Content (`/content?tab=my`), the three-dot menu of a set with
status **Completed**. A new run keeps the first one for later analysis
instead of overwriting or resetting it.

- [ ] TC-0352 Mark a set **Completed** -> the three-dot menu shows **"Work through
      again"** (NOT present for active/deferred sets)
- [ ] TC-0353 Click it -> a **simple** confirmation ("a new run starts from
      scratch, the previous one is kept"), with NO counted deletion figures
- [ ] TC-0354 Confirm -> toast "A new run has started …", the set flips back to
      **Active**, no error, no data loss
- [ ] TC-0355 Cancel -> nothing happens, the status stays Completed
- [ ] TC-0356 After restarting, answer a previously-learned exercise wrong -> the
      review queue fills **fresh** (cold scheduling; the first run's cards
      do NOT appear as overdue)
- [ ] TC-0357 Delete the set (with "delete progress") -> ALL of the set's runs are
      gone, no orphan rows
- [ ] TC-0358 Check BOTH: desktop/server (API mode) AND iOS PWA / GitHub Pages
      (Dexie mode) - the flow must work in BOTH modes
- [ ] TC-0359 Backup round-trip: Export -> wipe -> Import; the runs (incl. the
      completed first one) survive the import. An older backup with no run
      data imports as the implicit run 1 (no crash)

### TS-0050 Edit as a copy - forking a downloaded set (#2654, EXP-046)

Location: My Content (`/content`), the three-dot menu of a DOWNLOADED
(foreign) set - not shown on your own "My Lessons" sets, which already
have a direct "Edit".

- [ ] TC-0360 Open a downloaded set -> the three-dot menu shows **"Edit as a
      copy"** as the FIRST entry
- [ ] TC-0361 Click it -> a confirmation dialog: notes that the original stays
      unchanged and remains downloadable, PLUS the progress note ("A copy
      starts without learning progress …")
- [ ] TC-0362 Cancel in the dialog -> nothing happens, no new set is created
- [ ] TC-0363 Confirm -> toast "Saved as your own copy", the app switches
      automatically into the lesson editor, PRE-FILLED with the
      original's content
- [ ] TC-0364 The new copy then shows up under "My Lessons"; the original stays
      unchanged among the downloaded sets with its status unchanged and
      remains downloadable
- [ ] TC-0365 Edit the same source as a copy a second time -> the second copy
      gets its OWN, collision-free id (e.g. `...-copy-2`), never
      overwriting the first copy
- [ ] TC-0366 Check BOTH: desktop/server (API mode) AND iOS PWA / GitHub Pages
      (Dexie mode) - the fork must work in BOTH modes

### TS-0051 Derivation on fork - "Your edit" badge + "based on" credit (#2655, EXP-046)

Location: Import tab (`/content?tab=import`), "My Lessons" section - every
forked copy (whether created via "Edit as a copy", "Import a lesson", or
"Save as a copy" in the lesson editor).

- [ ] TC-0367 Fork a downloaded set that has a visible author credit on one of its
      lessons (e.g. "Contributed by …") via "Edit as a copy" -> the new
      copy shows up under "My Lessons" WITH the **"Your edit"** badge next
      to its title
- [ ] TC-0368 Below it, a compact **"Based on {author}"** line appears - hovering
      the line shows a tooltip stating that credits are self-declared and
      not verified (NO checkmark, NO "verified" badge)
- [ ] TC-0369 Fork a set with NO author credit at all -> the "Your edit" badge
      still appears, but NO "Based on" line (nothing to credit)
- [ ] TC-0370 A SELF-authored lesson under "My Lessons" that was never forked
      (no prior import/copy step) shows NEITHER the badge NOR a credit
      line
- [ ] TC-0371 Same flow via "Import a lesson" (import a shared `.json` carrying an
      author credit) -> the same two indicators appear
- [ ] TC-0372 Same flow via "Save as a copy" in the lesson editor (save an
      already-forked own lesson as a copy again) -> the new copy still
      carries the same "based on" credit (the chain does not grow
      unbounded)
- [ ] TC-0373 Check BOTH: desktop/server (API mode) AND iOS PWA / GitHub Pages
      (Dexie mode) - the badge + credit line must appear in BOTH modes

### TS-0052 Share Wizard - hint + removal for carried-over foreign credits (#2656, EXP-046)

Location: `ShareWizard` step 1, directly below the existing "Your name
(optional)" block. Precondition for a visible foreign credit: a forked
lesson carrying a "based on" credit (#2655) or an imported lesson whose
`contributed_by` is already set before the wizard opens.

- [ ] TC-0374 Share a self-authored, never-forked lesson -> NO foreign-credit
      hint appears (nothing to disclose)
- [ ] TC-0375 Share a forked lesson with set-level attribution (#2655) -> the
      hint "This content credits {author}. Their name travels when you
      share, you can remove it." appears, WITH the name from the
      attribution
- [ ] TC-0376 Share an imported lesson with `contributed_by` set but no set-level
      attribution -> the same hint, with the name from `contributed_by`
- [ ] TC-0377 Share WITHOUT clicking "Remove credits" -> the foreign credit
      travels with the shared content (default behavior, now visible
      instead of silent)
- [ ] TC-0378 Click "Remove credits" -> the button disappears, a "Credits
      removed." confirmation appears; sharing afterwards -> the name no
      longer appears in the shared content (the structural
      `variation_of` link stays untouched)
- [ ] TC-0379 Enter your own name AND enable "Show name", WITHOUT removing the
      foreign credit -> YOUR OWN name wins in the shared content, the
      foreign-credit hint stays visible but gets overwritten on share (no
      double credit)
- [ ] TC-0380 Check BOTH: desktop/server (API mode) AND iOS PWA / GitHub Pages
      (Dexie mode) - the hint + removal button must work in BOTH modes

### TS-0054 Create-Lesson wizard (`/create-lesson`, v2.3.0)

- [ ] TC-0392 **Step-1 order + template disclosure (#2755):** In step 1 the
      required **Title field comes first** (right under the heading,
      focused). The template picker behind it is a disclosure
      "Start from a template", **collapsed by default**; the collapsed
      row shows the current pick ("· Blank Lesson" is preselected).
      Opening it shows the four template cards plus "Knowledge lesson
      from text" and "Advanced exercise types"; picking a card marks it
      pressed and the collapsed row then shows the new pick.
- [ ] TC-0393 **Book-text path (#1745):** Step 1 → open the template disclosure
      → the "Knowledge lesson from
      text" card (below the template grid) starts a 3-step flow
      (Metadata → Book text → Review); paste text + Generate → the AI
      rephrases theory in its own words + generates exercises; WITHOUT
      an AI key: friendly notice, no crash; "Next" only after a
      successful generation
- [ ] TC-0394 **Exercise-type selection in the assistant (#2510):** In the book-text
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
- [ ] TC-0395 **Order of the type selection (#2522):** The selector sits **above** the
      textbook textarea, not below it (see what was detected, choose the types,
      then paste). **iOS standalone (PWA, small device):** on opening the
      book-text step the textarea is reachable **without scrolling** - the
      selector does not push it below the fold; after pasting a chapter the user
      need not scroll back up to find the types. DOM order matches the visible
      order (no axe regression).
- [ ] TC-0396 **Generate explanations in the assistant (#2992):** In the book-text
      step, right below the exercise-type selector, there is the checkbox
      "Generate explanations (shown after the answer)" with the cost hint. It
      is **unchecked** EVERY time the step opens (deliberately not remembered,
      it costs AI output). Generate unchecked → the produced exercises carry NO
      `explanation` field (the explanation field in the inline editor is
      empty). Generate checked → cloze, word-tiles, free-text, multiple-choice
      and error-correction exercises carry a Markdown explanation (rule, word
      for word, further examples; in the text's language), matching carries
      none; play the lesson and see the "Explanation" panel after an answer
      (#2991). Check both paths: a single pasted text AND a file upload with
      several sections (batch).
- [ ] TC-0397 **Title required in the book-text path (#1946):** Step 1 WITHOUT
      a title → click the "Knowledge lesson from text" card → stays on
      step 1 with the friendly "A title is required." message (NOT the
      book-text step, NOT the raw schema error on save); with a title →
      the book-text step opens normally and saving succeeds
- [ ] TC-0398 **[MOBILE] Title warning is scrolled into view (#2036):** iPhone /
      narrow viewport, step 1 WITHOUT a title, scroll down to the Next button
      (the title field is off-screen above) → press Next: the view scrolls to
      the title field, the field takes focus and is marked invalid (red
      border), and the "A title is required." message is in view (NO
      dead-end / no missing reaction). Applies to all three entries: Next
      (card path), the "Knowledge lesson from text" card (book) and the
      "Extensions" card (extension). Desktop regression: if the field is
      already visible there is no scroll jump
- [ ] TC-0399 **File upload in the book-text step (#1927):** "Load from file
      (EPUB, DOCX, TXT, MD)" button above the text field; pick an EPUB → a
      section list appears (checkboxes, title + character count);
      Markdown file → split at headings; TXT without headings → one
      section; broken / oversized file (> 20 MiB) → clear error
      message, no crash; the rights hint mentions uploading
- [ ] TC-0400 **DOCX upload (#1927, phase 2b):** a Word file with heading
      styles (including German Word, "Ueberschrift 1") → chapters are
      detected and offered as a list; a Word file WITHOUT heading
      styles (only bold-formatted "headings") → ONE whole-document
      section, the text still lands editable in the field; a broken
      .docx → clear error message, no crash
- [ ] TC-0401 **Multi-select + exclusion heuristic + batch (#1949):** upload a
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
- [ ] TC-0402 **AI exercise generation produces multiple_choice (#2353):** generate a
      knowledge lesson from text/book text (with an AI key) whose theory has
      clear factual questions with several answer options (e.g. "Which of these
      modules belong to X?") → the "Generated exercises" preview shows, at least
      occasionally, a **"Multiple choice"** chip alongside
      matching/cloze/free-text/word-tiles; the saved lesson plays the MC
      exercise (single-choice radios, or "select all that apply" checkboxes),
      feedback + SRS work like the other types. Regression: the other five types
      still get generated
- [ ] TC-0403 **AI exercise generation produces text extensions (#2355):** generate a
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
- [ ] TC-0404 **Book path no longer offers picture-choice + set type variety (#2356):**
      generate a multi-section book upload (several lessons) → NONE of the
      generated lessons contains a **picture-choice** exercise (the book path
      has no images, so the type is not offered at all instead of being
      dropped later); ACROSS the lessons of the set, more than four distinct
      exercise types appear (not just cloze/matching/free-text/word-tiles).
      Regression: the single book path and the set exercise-generation still
      produce valid lessons
- [ ] TC-0405 **Edit a lesson (#1740):** My Content → an OWN lesson's card →
      pencil/Edit → wizard opens pre-filled; Review shows "Save changes"
      (overwrites the same id, progress kept) + "Save as a copy";
      foreign-repo lessons show NO Edit; analysis lessons route to the
      import page. **#2201:** "Save as a copy" (and the import-collision
      "Import as copy") both show a note that a copy starts WITHOUT
      learning progress, while the original keeps its progress and
      review cards
- [ ] TC-0406 **A review card survives an answer-text correction (#2519):**
      create/save an own lesson with a free_text exercise → practice it
      until a review card exists for that exercise (the review queue shows
      it) → edit the lesson, fix a typo in the accepted answer (e.g.
      "Merci" → "Merci !"), save. Expected: a toast "Carried over {N}
      review card(s) for the changed answer." appears, the review card
      survives (no silent loss of the error/SRS history). Applies to BOTH
      storage modes (API + Dexie)
- [ ] TC-0407 **Reopen a plain (no-extension) lesson stays saveable (#1919):**
      create a lesson via Auto-generate (only the six CORE types, no
      extension exercise), Save locally → reopen via Edit → step to Review:
      the "Valid lesson structure" check is GREEN and "Save changes" works
      (previously it failed with "ext_payload must be object" in API/server
      mode)
- [ ] TC-0408 **Edit a book-text lesson (#1967):** create a lesson via "Knowledge
      lesson from text" (the book-text path — theory + generated exercises,
      NO vocabulary cards), Save locally → reopen via "Edit lesson" → "Next"
      goes STRAIGHT to the exercise editor with the actually generated
      exercises (NOT the empty vocabulary-card editor, which previously
      blocked the Next button); the 3-step flow is Metadata → Exercises →
      Review; Review has NO "At least 4 cards" row and "Save changes" is
      enabled; after saving, theory + exercise steps are preserved.
      Regression: a normal card lesson (Vocabulary list) AND an extension
      lesson still open correctly for editing
- [ ] TC-0409 **Edit a small book-text lesson (< 5 exercises) (#1970):** a book-text
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
- [ ] TC-0410 **Edit a multi-lesson set (lesson picker) (#1971):** a set that holds
      MORE THAN ONE lesson (e.g. a book-text upload with multi-section select →
      one lesson per section), reopen via "Edit lesson" → a **lesson picker**
      (dropdown of all lessons in the set) appears at the top; the first lesson
      is pre-selected with its exercises shown. Pick another lesson → its
      theory/exercises load (previously unreachable). With unsaved changes,
      switching prompts a confirm dialog ("Switch lesson?"). Edit one lesson +
      Save → only that lesson is replaced, the others survive, and the SET
      title/level/languages are NOT changed (not overwritten by the edited
      lesson's title). Regression: a set with a single lesson shows NO picker
- [ ] TC-0411 **Switching lesson keeps the step (#2061):** open a multi-lesson set via
      "Edit lesson", navigate to **step 2 (exercises)** (exercise list visible) →
      pick a DIFFERENT lesson in the "Lesson in this set" dropdown → the wizard
      STAYS on step 2, only the exercise list switches to the chosen lesson
      (previously: it fell back to step 1 and "Next" had to be pressed again).
      Same on step 3 (review): the step is preserved. Edge cases: switching to a
      lesson with NO exercises shows an empty list with no crash and no fall-back;
      with unsaved changes the "Switch lesson?" confirm dialog still appears
      first. Verify on Desktop + iOS standalone
- [ ] TC-0412 **Book reference survives editing (#1989):** create a lesson via the
      book-text wizard WITH the "book (optional)" fields filled in (title,
      author, URL, ISBN/ASIN) + Save → the lesson's "Vertiefe das Thema" section
      shows the book reference. Reopen via "Edit lesson", change something, Save
      → the book reference is STILL there (previously it vanished after the first
      edit). It survives across MULTIPLE edit cycles; "Save as a copy" also keeps
      the book reference. Regression: a lesson WITHOUT a book gets NO forced
      empty book object on edit
- [ ] TC-0413 **Migrate legacy English prompts on edit (#1860):** open a
      pre-#1855 legacy lesson (exercise instructions hardcoded in English,
      e.g. "Match each word with its translation.") via "Edit a lesson" →
      the affected instructions appear in the UI language automatically +
      a subtle, dismissible notice at the top ("... automatically
      translated to your language"). ONLY for the EXACT old default: a
      prompt the user deliberately set differently (even if coincidentally
      English) stays unchanged. Leave the editor WITHOUT saving → the
      original in Dexie is unchanged (no silent write); only saving
      (overwrite / save-as-copy) persists the migrated version
- [ ] TC-0414 **Combine lessons (#1741):** [E2E: `combine-lessons.spec.ts`] My Content → "Combine into a set"
      toggle → checkbox selection (own sets only) → "Combine" dialog:
      New set (title required) vs. add to an existing set; originals are
      kept; mixed languages/levels → non-blocking warning
- [ ] TC-0415 **Same-language hint (#1721/#1730):** source == target shows a
      neutral hint, does NOT block "Next"; Save enables once the checklist
      passes
- [ ] TC-0416 **Content-domain selector in Step 1 (#1716):** Step 1 shows a
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
- [ ] TC-0417 **Language-pair check row (#1929):** Review shows SIX checklist rows
      (title, "Language pair is valid", ≥4 cards, ≥5 exercises, ≥2 types,
      valid structure). "Language pair is valid" is green once BOTH source
      and target are supported codes — a same-language pair (de → de) is
      VALID (no "source != target" gate)
- [ ] TC-0418 **Structure-check reason (#1724):** a failing "Valid lesson
      structure" check names a concrete reason, not just a ✗
- [ ] TC-0419 **Internal structure error (#2384):** when the "Valid lesson
      structure" check fails with an INTERNAL error (e.g.
      `(0 , T.default) is not a function`), the message explains it is a
      problem in the app, NOT the lesson, gives a reload/retry path and a
      "Report this problem" link — instead of framing the technical string
      as invalid user content
- [ ] TC-0420 **Template titles (#1674/#1756):** template cards show readable
      titles (even offline) + a pressed/selected state
- [ ] TC-0421 **Advanced exercise types / extension wizard (#1852, #1887, #2817):** Step 1 →
      the "Advanced exercise types" card starts a dedicated 3-step flow (author
      → review → save) with a non-blocking notice that these types are advanced.
      Step 2: "Add extension exercise" offers seven types — **categorization**,
      **error correction**, **reading comprehension**, **graded quiz**,
      **dictation**, **image description**, **speak & record**. Each opens the inline editor with
      type-specific fields;
      Save is disabled until the shipped validator passes (categorization: ≥2
      named buckets with items; error correction: ≥2 words + a marked error + a
      correction; reading comprehension: a passage + ≥1 complete question;
      graded quiz: ≥1 question with positive points; dictation: a non-empty
      audio path + ≥1 accepted transcription; image description: a non-empty
      image + ≥1 accepted answer; speak & record: a non-empty sentence, the
      audio reference is optional — ungraded, no "convert to free text" path).
      Reading comprehension + graded
      quiz: per question toggle multiple-choice ⇄ free-text, MC options with a
      correct checkbox, graded quiz additionally points + partial credit + a
      pass threshold. Dictation (#1887): a typed `assets/audio/...` path (no
      upload in v1) + the accepted-transcriptions list. Review shows the count;
      "Save locally" → the saved lesson is **playable** (each type renders + is
      answerable); the set JSON carries `requires_extensions: ["ext:al-...@1"]`
- [ ] TC-0422 **Dictation in the core type picker (#1895):** Main wizard (card-based),
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
- [ ] TC-0423 **Extension types in the core picker (#2508):** Main wizard (card-based),
      Step 3 "Generate exercises" → "Add exercise" opens the "Choose an exercise
      type" picker. Below the standard types (six core types + Dictation) a
      second, labelled group **"Extension types"** now appears with
      Categorization, Error correction, Reading comprehension, Graded quiz,
      Image description and **Speak & record** (#2817; Dictation is **not**
      shown twice). Click one of these →
      an extension exercise is appended and opens straight in the extension
      editor. Image description is **selectable** here (the image is added in the
      editor). "Save locally" → the stored lesson carries
      `requires_extensions: ["ext:al-...@1"]` and is playable. **iOS standalone
      (PWA added to the home screen, Dexie mode):** the picker opens, both groups
      are visible and tappable, the chosen extension exercise is saved and
      renders after a reload. **Regression:** the separate extension wizard still
      works unchanged
- [ ] TC-0424 **Dictation audio upload (#1911, Slice 3):** In the dictation editor
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
- [ ] TC-0425 **Image-description authoring (#2095):** In the extension wizard pick
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
- [ ] TC-0426 **Speak & record authoring (#2817):** In the extension wizard (Step 1 →
      "Advanced exercise types") OR the core picker (Step 3, second group
      "Extension types") pick **"Speak & record"**. The editor shows a text
      field **"Sentence to speak"** and, below it, the (reused) audio field
      from the dictation editor ("Upload audio" + a typed path, both
      optional). Save is disabled while the sentence is empty; saving **with
      no audio at all is allowed** (the exercise is deliberately ungraded —
      no "convert"/type-conversion control appears, unlike dictation/image
      description). Save the lesson, open it in the viewer: the lesson loads
      **without `E-EXT-UNSUPPORTED`**, the renderer appears (a speaker button
      reads the sentence aloud, "Show text" reveals it, a record control lets
      the learner record themselves). With an uploaded reference clip: the
      player plays that clip instead of on-device TTS. The saved lesson
      carries `requires_extensions: ["ext:al-speak-and-record@1"]`.
      **Regression:** dictation + image description still work unchanged,
      including their "→ free text" conversion control (only speak & record
      omits it, by design)
- [ ] TC-0427 **Keyboard pre-reveal (#3002, touch devices only):** in a lesson, tap
      a free-text or cloze field sitting in the LOWER half of the screen.
      On focus the page IMMEDIATELY scrolls the field into the upper third
      (the app's own scroll, no whole-layout jump), the keyboard opens
      below it, the field stays visible. Then: tap other elements while
      the field keeps focus - taps land on the visible target (no 1-2 line
      offset, the #1569 core). A field already sitting HIGH is NOT moved
      on focus; checkboxes/radios/dropdowns trigger no scroll. Desktop
      (mouse): no scroll on focus
- [ ] TC-0428 **Tab bars stay on one line on phones (#3012):** on a real phone in
      portrait, open **Content**, **Progress** and **Dashboard** in turn. Each
      tab bar sits on **one** line, no label is clipped or squeezed, every tab
      is at least 44px tall to tap. Before this, the Content bar wrapped onto
      two lines on narrow phones (375px and below) unnoticed.
      **Tablet/desktop comparison:** there the tabs are set larger and padded
      wider than on the phone; the switch is at 640px window width (shrink the
      desktop window and watch it flip). **Selection and keyboard:** exactly
      one tab is marked active, Tab reaches every tab, Enter switches it, the
      address carries the tab (`?tab=`). **iOS standalone:** launched from the
      home screen the same holds; after rotating to landscape and back the bar
      stays on one line and does not jump.
- [ ] TC-0429 **Create button in "My Lessons" (#3007):** Precondition: at least one
      own lesson exists (otherwise the section is not shown at all). Open
      Content → Import → in the **My Lessons** section head, next to "Combine
      into a set", there is a **"Create New Lesson"** button. Click → the
      lesson wizard opens. The button stays visible while the combine
      multi-select mode is active. On a phone: both head buttons are at least
      44px tall and wrap cleanly, the heading stays readable.
      **iOS standalone:** launched from the home screen the button behaves the
      same, the wizard opens in the same view without browser chrome.
- [ ] TC-0430 **"Create" tab in the content hub (#3006):** open `/content` → the tab
      bar shows **four** tabs: Discover, My content, Import, **Create**.
      Click Create → the lesson wizard appears in the tab, the address reads
      `/content?tab=create`. **Old address:** open `/create-lesson` directly →
      it redirects to `/content?tab=create` and the wizard is there (no 404,
      no duplicated page). **The edit deep link stays standalone:** choose
      "Edit" on one of your own lessons → `/create-lesson/edit/...` opens the
      pre-filled wizard as its own page, NOT inside the tab. **Other entry
      points:** the "Create new lesson" button on the Dashboard and the link
      in Discover still reach the wizard. **In the Import tab** the "Create
      new lesson" button is gone (the tab replaces it); the four remaining
      actions (Import lesson, Import chat, Anki export, Learning path) are
      unchanged. **Order:** Settings → General → content tab order lists
      Create as well and can move it; the new order applies without a reload.
      Anyone who had set a custom order before this version finds Create at
      the end of the list, the other three unchanged.
      **Phone (#3006 on the bar from #3012):** on a real phone in portrait,
      check whether the four tabs fit on ONE line. Measured in the container
      (Chromium, German labels) they need 337.1px with the compact bar and fit
      from 375px device width up; without it they needed 451.7px and fitted on
      no phone at all. On a very narrow device (320px, first-generation iPhone
      SE) the bar still wraps onto two lines - that is the defined fallback,
      not a defect. If it wraps on a device at 375px or wider, REPORT it: the
      measurement then does not hold, and the remedy is a separate decision.
      **iOS standalone:** launch the app from the home screen (no browser
      chrome), open `/content` → the same tab bar, clicking Create switches
      the tab without a page change, and the back gesture does not leave the
      app. Then remove the app from the app switcher and relaunch → the last
      selected tab is not "frozen"; `/content` starts on the first configured
      tab again.
- [ ] TC-0431 **Header updates badge (#2904):** an installed content set has a newer
      version (e.g. tap "Update available" on a set in the content browser
      OR bump the set's manifest version in the test repo). Reload/reopen
      the app: **without** visiting `/content`, a header badge ("N updates")
      appears next to the reviews badge, linking to `/content?tab=my`.
      Click → lands on the **My content** tab (#2998: regardless of the tab
      order configured under Settings → General, even when Import or
      Discover comes first), the affected set shows **"Update available"**
      in its row (matches the badge's count). **Apply all (#3001):** press
      the header button **"Refresh"** (`content-refresh`) → the list is
      reloaded AND every set showing "Update available" is updated one
      after the other; the button stays disabled until the run is over,
      then ONE summary toast "N sets updated." (no per-set toast). With
      nothing pending: toast "All sets are up to date.", no download. A
      breaking update (#2128, progress affected) is NOT applied by the
      bulk run: info toast "Held back because your progress would be
      affected: <set title>. Confirm each update with the set's Update
      button." (#3081: names EVERY held set by title, several separated by
      commas, and stays until dismissed via its X), the set keeps
      "Update available" and is confirmed individually via its row
      button. **List view (#3081):** in the list view (toggle at the top
      right of the list) the set's row shows the "Update available" marker
      and a download-icon button (`content-list-set-<id>-update-button`,
      tooltip "Update"); on a phone (below 640 px) marker and button drop as
      one group to their own line under the title (right-aligned, #3092), the
      title keeps the width it has without an update; a click
      opens the same #2128 guard dialog as the card button for a breaking
      update, otherwise the update is applied directly; up-to-date sets show
      neither marker nor button. **After applying (#2985):** apply
      the update(s) on `/content` (header button, row button, or sync the
      repo source) → the badge's
      count drops **immediately, without a reload**; once every update is
      applied the badge disappears (held breaking updates keep counting
      until decided manually - that is correct). **No update available:** the
      badge does **not** appear (no empty pill in the header). **Error
      tolerance:** turn off the network at app launch → no crash, no error
      toast, the header renders normally (the badge simply stays hidden —
      it is supplementary chrome, never a blocking load state)
- [ ] TC-0432 **Multiple-choice single/multi mode control (#1888):** [E2E: `mc-single-multi-toggle.spec.ts`] In the MC inline
      editor (Step 3, `ExerciseEditor`) the mode control ("How many answers are
      correct?") is a segmented control **at the very top, before the first
      option row**. A new MC exercise (AI-generated OR manually added) defaults
      to **"Allow one answer"**, option markers are radios (exactly one
      correct). Switching to **"Allow multiple answers"** → markers become
      checkboxes, two correct are possible, and the saved exercise is
      **playable** with multi-select. Switching back to "Allow one answer" →
      pruned to exactly one correct. An existing MC exercise with a set
      `multiple` value opens **unchanged** in its original state.
- [ ] TC-0433 **Explanation in the inline editor (#2992):** In the inline editor of
      every exercise (Step 3, `ExerciseEditor` AND `ExtensionExerciseEditor`),
      below the type-specific fields, there is the Markdown textarea
      **"Explanation after the answer (optional, Markdown)"** with a hint line
      and the counter "n / 2000 characters". While the field is empty an
      **"Insert template"** button is offered: one click fills in the skeleton
      (**Rule**, **Word for word**, **Further examples**, **Typical mistake**)
      and the button disappears. Type a text, save, reopen the row → the text
      is there (trimmed); save the lesson and play it → after the answer the
      "Explanation" panel shows the rendered Markdown (#2991). Clear the field
      completely and save → the saved exercise carries NO `explanation` field
      (no empty string in the JSON). More than 2000 characters cannot be typed
      (maxlength); a loaded exercise with a longer explanation shows "The
      explanation is too long …" and Save stays disabled until it is shortened.
- [ ] TC-0434 **Convert exercise type -> free text (EXP-050 Stage 1, #2511):** In the
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
- [ ] TC-0435 **Convert an extension exercise -> free text (EXP-050 Stage 1, #2511):**
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
- [ ] TC-0436 **Convert error-correction + cloze -> free text (EXP-050 Stage 2, #2511):**
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
- [ ] TC-0437 **Convert free text -> multiple choice / cloze (EXP-050 Stage 3, #2511):**
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
- [ ] TC-0438 **Convert graded quiz <-> reading comprehension (EXP-050 Stage 3b, #2511):**
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
- [ ] TC-0439 **Suggest empty fields after a conversion with AI (EXP-050 Stage 4, #2511):**
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
- [ ] TC-0440 **Annotate token roles (#3072):** In step 2 add a card (front
      "der Hund in dem Garten", back "the dog in the garden"), then open
      "Edit" on its row. Below the image field sits "Token roles
      (optional)". Check in order: (a) type a word that does NOT appear
      in the front exactly like that (e.g. "Katze") -> "Add role" stays
      disabled and the message below says the word does not appear.
      Same for the wrong casing ("der" when the front starts with
      "Der"). (b) Type the word exactly as it appears, pick a role in
      the select, "Add role" -> the row appears with word and role name.
      (c) Add the same word again -> the message says it is already
      annotated. (d) The select offers EXACTLY seven roles (article,
      noun, verb, adjective, preposition, gender marker, tense marker)
      and no free-text field. (e) Save, reopen the card for editing ->
      the annotations are still there. (f) Phone width (below 769 px,
      #3087): the add-row stacks (word field full width, select full
      width, "Add role" below), nothing overflows the card; from tablet
      width up it stays one line and the word field fills the remaining
      space.
- [ ] TC-0441 **Suggest roles (#3072):** In the same row click "Suggest roles".
      On a German front carrying articles and prepositions the list
      fills ("der Hund in dem Garten" gives der = article, in =
      preposition, dem = article). Nouns and verbs are NOT suggested,
      which is deliberate. On a front without such words (e.g. "Hund
      läuft") the hint appears saying no word was recognised and the
      list stays empty. Below the list the note says suggestions are
      guesses and every row wants checking.

### TS-0055 Card image upload (#1763 / #1764) [E2E: `card-image-upload.spec.ts`]

Location: Create-Lesson Step 2 (card editor), in the add-card form +
each card row (`CardImageField`).

- [ ] TC-0442 "Image (optional)" field with an "Upload image" button; after
      upload a 64x64 preview + "Remove"
- [ ] TC-0443 Only JPEG / PNG / WebP accepted; other type → inline error
      (role=alert), no crash
- [ ] TC-0444 Large file is downscaled (≤512px edge, ~150 KiB cap);
      undecodable file → error instead of crash
- [ ] TC-0445 "Advanced: use an asset path" keeps the manual `img/…png` field
      (for repo-published sets)
- [ ] TC-0446 Round-trip: a card with an uploaded image → export →
      re-import → image preserved
- [ ] TC-0447 Known limitation: uploaded data-URI images are NOT yet rendered
      in a played picture_choice exercise (engine `src` cap)

### TS-0056 Lesson player UX (v2.3.0)
- [ ] TC-0448 Pause button now lives in the sticky footer (#1644), pausing
      works from there
- [ ] TC-0449 Position before the first exercise (#3075): open a lesson, page
      through two theory steps only, answer NO exercise, reload the page ->
      the resume dialog appears and "Continue" lands on the step that was
      open (before: restart at step 1 without a dialog)
- [ ] TC-0450 Pause button before the first exercise (#3075): as above, then press
      the pause button in the footer -> the Continue/Pause/Abandon dialog
      appears (before: left the lesson silently); "Pause" -> the lesson is
      listed on the dashboard under "Paused lessons"
- [ ] TC-0451 Leaving through the app navigation (#3075): answer one exercise, then
      move two theory steps further, then leave through the menu
      (hamburger -> "Settings"), the logo or the browser's back button ->
      the lesson is listed under "Paused lessons"; "Resume" there opens the
      resume dialog and lands on the theory step you were on (not on the
      exercise before it); on the phone the same through the menu drawer
      [E2E: `lesson-pause-position.spec.ts`]
- [ ] TC-0452 Auto-advance + "Back" (#1921): with "Advance automatically"
      (Settings -> Learning) ON, answer an exercise correctly so the app
      jumps to the next step by itself -> then click "Back": the previous
      (already-solved) exercise STAYS and does NOT jump forward again;
      the "Continue" button is still clickable
- [ ] TC-0453 Title area slimmed down, no more in-lesson description (#1635)
- [ ] TC-0454 Lesson summary shows only ONE favorite button (#1649)
      [E2E: `lesson-summary-favorite.spec.ts`]
- [ ] TC-0455 Skip-to-content link visible when tabbing from the top (#1727, a11y)
- [ ] TC-0456 **[MOBILE/VoiceOver, non-blocking] Select fields are announced with a
      name (#2037):** turn on iOS VoiceOver, open `/create-lesson` step 1 and
      swipe across the select fields (domain, language(s), level): VoiceOver
      announces the VISIBLE label plus the chosen value for each (e.g.
      "Level, A1, combo box") - NOT just the value, and not an unnamed
      "button". Same in the Share wizard and the chat-import language
      pickers. Automated coverage via axe (`select-a11y.spec.ts`); this item
      is the real-screen-reader cross-check in the next iOS session

### TS-0057 Invalid lesson: friendly error message (#1808 / #1824)
- [ ] TC-0457 German umlaut cards (`währung`, `präsenz`) load correctly
      (the app accepts unicode-lowercase card ids/tags, #1808)
- [ ] TC-0458 An actually broken lesson shows OUTSIDE Developer Mode a friendly
      message ("… invalid or corrupted data … contact the author"),
      NOT the raw error dump (#1824)
- [ ] TC-0459 With Developer Mode ON (Settings): the technical detail text is
      appended again

### TS-0058 Diagnostics probe: Settings toggle + protocol (#2782)
- [ ] TC-0460 Settings > Diagnostics & Support: enable the "Tap & viewport
      probe" toggle - the measurement bar appears IMMEDIATELY at the
      top (no reload); disabling removes it immediately
- [ ] TC-0461 With the probe on: tap anywhere, then "Copy protocol" in
      Settings - the clipboard holds the entry (a line with `tap` and
      `deltaY=`); the counter next to it shows > 0 recorded events
- [ ] TC-0462 Reload the page: the counter is preserved (the protocol survives
      reloads); "Clear protocol" resets it to 0
- [ ] TC-0463 Appending `?vvdiag=1` to the URL enables the same probe; the
      Settings toggle then shows ON (one shared flag)
- [ ] TC-0464 "Show measurement bar" OFF: the bar disappears immediately and
      the header/menu are reachable again - but new taps still raise
      the protocol counter (recording continues invisibly, #2785)

### TS-0059 AI check: apply suggestions (AIV-07, #3060)
- [ ] TC-0465 Browser mode with a configured AI key, an own lesson (Content > My
      content) with a deliberate mistake on a card (e.g. "casa" instead
      of "la casa"); run "Check with AI": the report lists the card and
      the footer carries the "Apply suggestions" button
- [ ] TC-0466 "Apply suggestions": a table with lesson, card, field, "Current"
      and "Suggestion", every row ticked; below it the number of
      findings without an applicable value (if any); the confirm button
      counts "N fields in M cards"
- [ ] TC-0467 Untick one row, confirm: only the ticked fields change (open the
      lesson or check in the editor), the set's title, languages, level
      and description stay; toast "N fields applied"; the lesson's
      progress is kept
- [ ] TC-0468 In the result, "Undo the last apply": the fields carry the old
      value again, toast "Apply undone."; the undo button disappears
- [ ] TC-0469 Close the dialog and open "Check with AI" again: no cached report
      any more, the cost estimate shows (the report was dropped after the
      apply)
- [ ] TC-0470 Downloaded set (not your own): "Apply suggestions" is disabled with
      the tooltip "Only for your own lessons."

### TS-0060 Settings > Plugins: installed plugins (#3055)
- [ ] TC-0471 Desktop app (API mode), Settings > Plugins: at the top the
      "Installed plugins" card with one row per loaded plugin, sorted by
      name: name, version, source ("Package") and the activation time
      formatted in the app language; below it the unchanged "Learning
      Repository" card
- [ ] TC-0472 Right after opening, "Reading plugins…" shows briefly, then the
      list; with the backend running there is no error and no toast
- [ ] TC-0473 Stop the backend, reload the tab: the card shows the line "Could
      not read the plugin status: …" and a toast carries the same
      message; the "Learning Repository" card stays visible
- [ ] TC-0474 Browser mode (GitHub Pages / Dexie): the card stays visible with
      the notice "Only available with the desktop app."; DevTools >
      Network shows no request to /api/plugins/health

### TS-0061 Diagnostics probe: mis-tap mark + actions (#3043)
- [ ] TC-0475 Probe ON, measurement bar visible: next to "Werte kopieren" and
      "Details" the bar shows the button "Daneben!"
- [ ] TC-0476 Tap anywhere, then tap "Daneben!", then "Details": the report has
      a section `actions (newest first)` with a `mark` line whose
      `target=` names the element just tapped; the tap counter ("N
      Tipps") did NOT increase because of the button
- [ ] TC-0477 On a lesson page tap an answer tile: the `actions` section gains a
      `click` line with `target=`, `downTarget=` and `mismatch=0`;
      tapping a text field additionally adds a `focus` line with
      `top=`/`bottom=`/`vis=`
- [ ] TC-0478 The bar's last tap line additionally carries `hit=`, `above1=`,
      `above2=`, `pageY=`, `screenY=`, `hdrTop=`, `ftrBot=`, `room=`
      and `focusTop=`/`focusBot=`/`focusVis=`; "Copy protocol" in
      Settings yields the same fields plus the `click`/`focus`/`mark`
      entries

### TS-0062 Sticky button for the measurement bar (#2799)
- [ ] TC-0479 Settings > Diagnostics & Support: enable "Sticky button for the
      measurement bar" (the probe must be ON) - a round floating
      button appears IMMEDIATELY at the bottom left
- [ ] TC-0480 Tap the button: the measurement bar disappears (exactly like
      "Show measurement bar" OFF); tap again: it reappears - the
      Settings "Show measurement bar" toggle mirrors every tap (one
      shared flag)
- [ ] TC-0481 The position choice (4 corners) appears under the toggle: pick
      "Top right" - the button jumps to that corner immediately;
      default is "Bottom left"
- [ ] TC-0482 Taps ON the button do NOT enter the diagnostics protocol (the
      counter in Settings stays put while toggling)
- [ ] TC-0483 With the bottom tab bar active (#2786): the button in a bottom
      corner floats ABOVE the tab bar, covering no tabs
- [ ] TC-0484 Probe OFF: the button disappears with it (without the probe
      there is no bar to toggle)

### TS-0063 Mobile menu position: bottom tab bar as an option (#2786)
- [ ] TC-0485 Settings > General > Interface: "Menu position (mobile)" is
      "Top (menu button)" (default) - NO bottom bar
- [ ] TC-0486 Pick "Bottom (tab bar)": the bar appears IMMEDIATELY at the
      bottom (Learn/Content/Learning Path/Progress/More); content is
      not hidden behind it (bottom scroll reserve)
- [ ] TC-0487 With the bottom bar: the top hamburger menu still works
- [ ] TC-0488 During an active lesson and on Landing/Onboarding/Assessment the
      bar stays hidden (the lesson footer keeps the bottom edge)
- [ ] TC-0489 Back to "Top": the bar disappears immediately; the choice
      survives a reload

### TS-0064 Phone header: menu button and logo survive many badges (#3123)
- [ ] TC-0490 Phone (375 and 430 px wide, e.g. iPhone 14 Pro Max) with due
      reviews, one available set update and XP: open the Dashboard. The
      menu button top left keeps its full width (no thin sliver) and the
      logo next to it is visible
- [ ] TC-0491 On the phone the badges show only the number next to the icon
      ("718" instead of "718 due", "1" instead of "1 updates"); the
      tooltip and the screen-reader name still carry the full text
- [ ] TC-0492 When the badges no longer fit beside the menu button and the logo
      they wrap right-aligned onto a second line; nothing is cut off and
      the page does not scroll sideways
- [ ] TC-0493 Tablet and desktop: the header stays a single line with the full
      badge text

### TS-0065 Step change on a phone: anchor at the top, footer at the bottom (#3126)
- [ ] TC-0494 iPhone (Safari or PWA): open a lesson with a long theory step,
      scroll to the very bottom, then "Next" onto a short step (e.g. a
      matching exercise)
- [ ] TC-0495 Without swiping: the step starts at the top (progress bar and task
      visible), the footer with Back/Pause/Check sits at the bottom edge,
      no empty (black) lower half
- [ ] TC-0496 The same from a short onto a long step: the anchor is at the top,
      the content scrolls normally
- [ ] TC-0497 With "Reduce motion" in the system: the jump happens without
      animation, same result
- [ ] TC-0498 Rotate the device during a step (#1422): the step is still
      re-anchored

### TS-0066 Settings > Data: housekeeping cards (#2955)
- [ ] TC-0499 Settings > Data: the "Maximum lesson size" card sits directly
      below "Offline cache"; the "Paused lesson retention" card sits
      directly above "Disconnected content" (with no disconnected
      content, directly above the danger zone)
- [ ] TC-0500 Settings > Learning ends with "Reminders"; neither card is there
      any more
- [ ] TC-0501 Set "Steps per part" to 15, reload the page: the value stays 15;
      set "Keep paused lessons for" to "60 days", reload: the choice
      stays "60 days"
- [ ] TC-0502 Repeat both in browser mode (Settings > Data > storage mode): same
      behaviour

### TS-0067 In-set position + navigation (#2793)
- [ ] TC-0503 Inside a lesson from a set, the header shows "Lesson N of M"
      with the correct number
- [ ] TC-0504 The left arrow opens the PREVIOUS lesson of the set; the right
      arrow the next one
- [ ] TC-0505 On the first lesson the left arrow is absent (no dead button),
      the readout stays; on the last one the right arrow is absent
- [ ] TC-0506 After jumping, the readout shows the new position
- [ ] TC-0507 For a standalone lesson without a set (e.g. an own lesson) the
      position row is absent entirely

### TS-0068 First paint: no language mix (#2796)
- [ ] TC-0508 Reload the app with a German UI (clear the cache): landing page,
      navigation, install hint, update banner and offline notice are
      German immediately - no English text, no raw key like
      `landing.intro`
- [ ] TC-0509 Same in airplane mode / offline: the strings stay German (the
      first paint needs no network)
- [ ] TC-0510 Update banner: "Was ist neu?", "Release-Seite", "Später" carry
      readable labels (not empty, sufficient contrast)

### TS-0069 Set-completion review (#2792)
- [ ] TC-0511 Finish the last lesson of a set: the completion card offers
      "View review" as the first action, "View Set" beside it
- [ ] TC-0512 The review shows four headline figures (total mistakes,
      mastered percentage, still open, time spent) and below them
      mistakes per lesson, per exercise type, and the biggest weak
      spots with your own wrong answer next to the correct one
- [ ] TC-0513 The two middle figures follow the mistakes, not the review flag
      (#3166): "Still open" counts the elements with at least one mistake
      that the review has not marked mastered yet; "Mastered" is the share
      of all played elements that were never wrong or have cleared their
      mistake since. A set with 12 played elements, 3 of them wrong once:
      "3 Total mistakes", "75% Mastered", "3 Still open" - not "0%" and
      "12"
- [ ] TC-0514 "Practise mistakes" leads into the set's review session,
      "Back to the set" to the set page
- [ ] TC-0515 A set with no recorded mistakes shows the friendly message
      instead of empty sections
- [ ] TC-0516 Check both in browser mode (no server) - the figures come from
      the local database there

### TS-0070 Learning-path set: "Repeat everything" resets the results (#3171)
- [ ] TC-0517 Open the learning path and expand a set with results: the action bar
      shows "Repeat everything" (`set-reset-results-<id>`) next to "Train
      errors"; a never-started set does not show the button
- [ ] TC-0518 Press it: the confirmation "Reset all results?" names the set title,
      the number of lessons with results, that score, stars and study time
      are reset, that the previous run's mistakes stay as history and that
      XP and badges are unchanged; below it "Average so far: N%" (for a
      set without a scored lesson "No average yet.")
- [ ] TC-0519 "Cancel" (also Escape): nothing changes, the set's stars and progress
      are as before
- [ ] TC-0520 "Reset and start over": success toast, lesson 1 of the set opens;
      back on the learning path the set shows no stars and no progress,
      "Train errors" is gone (new run, as with "Work through again")
- [ ] TC-0521 A set marked "Completed" or "Deferred" in My Content is listed under
      "Active" again after the reset (status filter in My Content); the
      dashboard's "Continue Learning" shows it as a started set again, not
      as done
- [ ] TC-0522 Dashboard: XP and badges are unchanged after the reset
- [ ] TC-0523 Check both: desktop app (API mode) and browser mode without a server
      (Dexie) - the reset writes to both stores

### TS-0071 Set page: lesson list + progress (#2793 stages 2-3)
- [ ] TC-0524 Open a set page (/content/set/<id> or via a shared link): below
      the set details, ALL lessons are listed with their number
- [ ] TC-0525 The list header shows "{x} of {y} lessons completed"
- [ ] TC-0526 Completed lessons show a green checkmark plus their score; the
      first unfinished one carries the "Continue here" marker (#2935)
- [ ] TC-0527 Clicking any row opens exactly that lesson - including one far
      back in the set
- [ ] TC-0528 Inside a running lesson the set name in the header is clickable
      and leads to that same list
- [ ] TC-0529 With no recorded progress the list still appears, just without
      markers
- [ ] TC-0530 Finish a couple of lessons in a set, leave, reopen the set page,
      press "Start learning": it opens the first UNFINISHED lesson, not
      lesson 1 again (#2935)
- [ ] TC-0531 Finish every lesson of a set, then press "Start learning" again:
      it opens lesson 1 (nothing left to resume)
### TS-0072 Summary: all answers with their question (#2807)
- [ ] TC-0532 Finish a lesson, open "View all answers" (the "Answers overview"
      section switched on in Settings, or "Detailed evaluation" pressed,
      #3124): every row with something to show is expandable (title +
      score stay visible)
- [ ] TC-0533 Expanded, the QUESTION sits above the answers - including on a
      partially correct row like "2 / 3", which previously showed nothing
- [ ] TC-0534 Choice/matching exercises (no text answer) show question and
      correct answer
- [ ] TC-0535 Text answers keep the coloured token diff, plus your own answer
      spelled out
- [ ] TC-0536 A fully correct row shows its question but no mistake diff

### TS-0073 Summary: the detailed evaluation on one button (#3031)
- [ ] TC-0537 Finish a lesson: the "Detailed evaluation" button sits directly
      under the heading
- [ ] TC-0538 Switch an enabled section off in Settings > Learning > "Lesson
      summary" (e.g. "XP reward"), then finish a lesson: the section is
      missing - after pressing "Detailed evaluation" it is there
- [ ] TC-0539 In the detailed view "View all answers" is already expanded
- [ ] TC-0540 "Why you missed these" appears even with its own toggle off, and
      shows more than five mistakes when the run had more
- [ ] TC-0541 Press again ("Compact evaluation"): everything is back as before,
      the switched-off section is gone again
- [ ] TC-0542 Back in Settings: the switched-off sections are still switched
      off - the button stores nothing
- [ ] TC-0543 The correction round stays collapsed in the detailed view too (no
      keyboard pops up on the phone)
- [ ] TC-0544 Toggling keeps the button in place, the page does not jump

### TS-0074 Summary: the detailed evaluation like the set end (#3124)
- [ ] TC-0545 Finish a lesson with at least two mistakes, press "Detailed
      evaluation": directly under the button reads "Review: <lesson
      title>" with "Every mistake in this lesson at a glance"
- [ ] TC-0546 Below it four key figures (Total mistakes, Mastered, Still open,
      Time spent), "Mistakes per exercise type" and "Biggest weak spots"
      with the own wrong answer struck through next to the correct one;
      "Mistakes per lesson" is NOT there (it is a single lesson)
- [ ] TC-0547 First run of a lesson, e.g. 12 elements, 9 right, 3 wrong: "3 Total
      mistakes", "75% Mastered", "3 Still open" - the same 75% as the run's
      score (#3166). "Mastered" counts the elements that were never wrong or
      whose mistake the review has cleared since, "Still open" those with a
      mistake and no mastery; not "0%" and "12" for 3 mistakes
- [ ] TC-0548 The numbers match the set review (Content > set > "Open review")
      for the same lesson
- [ ] TC-0549 "Practise mistakes" opens the set's review session
- [ ] TC-0550 With no mistakes in the run: "No mistakes recorded - excellent!"
      instead of the figures
- [ ] TC-0551 "Compact evaluation": the review disappears again; the #3031 items
      (sections, answers, explanations) still hold
- [ ] TC-0552 The button's tooltip names key figures, exercise types and weak spots

### TS-0075 Summary: the compact default, one screen (#3124)
- [ ] TC-0553 Fresh install (or Settings > Learning > "Lesson summary" with only
      "Result and statistics" and "XP reward" ticked): finish a lesson -
      the summary shows stars, score, time, "+N XP" and directly below
      "Mark as complete", "Next lesson", "Practice again" and "Back"; no
      favorites hint, no sharing, no answers overview, no export, no "Why
      you missed these", no correction round, no next-step cards
- [ ] TC-0554 On a phone (portrait): everything down to the continue buttons is
      visible without scrolling
- [ ] TC-0555 "Detailed evaluation": the set-style review and every switched-off
      section appear (favorite, share, all answers expanded, export, "Why
      you missed these", fix mistakes, next steps); "Compact evaluation"
      takes them away again
- [ ] TC-0556 Settings > Learning > "Lesson summary": nine rows, "Why you missed
      these" sits directly above the correction-round row; only Result and
      XP are ticked; tick a row (e.g. Next-step suggestions), finish a
      lesson: the section is part of the compact view for good
- [ ] TC-0557 An existing choice stays: whoever configured the sections before
      this state sees their selection unchanged; "Why you missed these" is
      ticked there and sits directly above the correction round
- [ ] TC-0558 "Why you missed these" ticked but "Explanations after the answer"
      (Review) off: the block is missing from the compact view and only
      appears in the detailed evaluation

Note for every step of this plan that uses export, share, favorite, all
answers, "Why you missed these", fix mistakes or the next-step cards:
switch the section on in Settings first or press "Detailed evaluation"
(#3124).

### TS-0076 Leaving a lesson returns to its set (#2811)
- [ ] TC-0559 Pause and leave a set lesson: the app lands on the SET page with
      the lesson list, not on "My content"
- [ ] TC-0560 "Exit" after the summary: the set page too - the lesson just
      finished is marked completed there
- [ ] TC-0561 A lesson without a set (own lesson, standalone import) still
      lands on "My content"

### TS-0077 Share the result as an image (#2813)
- [ ] TC-0562 After a lesson press "Share image only" next to "Share": the share
      sheet opens WITH the result card and WITHOUT text or link
- [ ] TC-0563 Pick Facebook: a photo post with the card appears (not the generic
      app image)
- [ ] TC-0564 WhatsApp still works through the normal "Share" button (card plus
      text)
- [ ] TC-0565 On desktop (no share sheet): the image downloads, toast "Image
      saved"
- [ ] TC-0566 Dismiss the share sheet: no file lands silently in the downloads

### TS-0078 New "Diagnostics & Support" tab unites error report + probe (#2789)
- [ ] TC-0567 Settings > Info: between "Help" and "About" there is now
      "Diagnostics & Support"
- [ ] TC-0568 It shows the Support section first ("Create error report",
      formerly under "About"), then the Diagnostics section with
      Developer Mode (formerly under "General > Interface") and the
      tap/viewport probe (formerly under "General > Diagnostics")
- [ ] TC-0569 "About" still shows version, strand and links, but no Support
      button anymore
- [ ] TC-0570 "General" still shows the menu position, but no Developer Mode
      toggle and no Diagnostics section anymore
- [ ] TC-0571 The direct link `?tab=diagnostics` opens the tab immediately

### TS-0079 Discover + Registry (since v2.2.0)
- [ ] TC-0572 Source-language filter as a visible chip on first view
      (no longer hidden behind "Filter"), "All languages" persists
      across reload (#1699/#1701)
- [ ] TC-0573 Reference/demo sets (graded-quiz-demo) do NOT appear in
      Discover/My Content (#1702/#1706)
- [ ] TC-0574 Per-set share link opens the set detail page directly (#1572)
- [ ] TC-0575 Add a registered content repo (register-a-repo #1511)
- [ ] TC-0576 Manifest fallback for own repos without a search-index.json (#2562):
      connect your own repo via Settings → Data → "Add a repository" that
      was NEVER built with the engine generator (no search-index.json at
      its root) - its sets still appear in Discover; once more than one
      source contributes, the "Source" filter appears (previously missing
      when only one source contributed)
- [ ] TC-0577 "Share as repository" (#2376): a set with quality issues (e.g. a
      matching exercise with a duplicate left value) is NOT pushed on the
      first click - the issue list appears and the button flips to
      "Export anyway"; only the second click exports
- [ ] TC-0578 "Share as repository" (#2376): when lesson filenames do not sort
      into the source order (kapitel-1..kapitel-10), the success screen
      reports the NN-prefix renaming; the exported repo lists the
      lessons in source order

### TS-0080 Discover Stage 1: facets, marks, empty state (EXP-048, #2320-#2324)

Where: Discover (`/content?tab=discover`). Test in BOTH storage modes
(API + Dexie); the facets read the search index and are mode-independent.

- [ ] TC-0579 Target-language facet visible next to the source language; marks carry
      their set count, only targets present for the active source language,
      sorted by count; selecting one filters the list (#2322)
- [ ] TC-0580 Review standing: machine-generated sets (e.g. ja-a1-from-de,
      ko-a1-from-de, zh-a1-from-de) carry a neutral badge ("Machine-made"),
      hand-written sets carry NO badge; the "Review" facet appears only when
      such sets are in the catalogue (#2321)
- [ ] TC-0581 The "AI-checked" facet is gone; the AI badge on the entry stays (#2321)
- [ ] TC-0582 Active restrictions (level, domain, trust, review, search) appear as
      removable marks above the list; clicking a mark's X clears exactly that
      restriction (#2323)
- [ ] TC-0583 Domain names are translated (Dog training, Technology, Software,
      Philosophy, Traffic knowledge instead of raw identifiers) (#2320)
- [ ] TC-0584 Empty state: at zero results, computed exits appear ("Without <facet>:
      N sets") plus "Reset all filters"; a click restores results; the source
      language stays (#2324)
- [ ] TC-0585 Empty library (no set): a pointer to "Add your own source" (/add-repo)
      or "create a lesson" (/create-lesson) (#2324)
- [ ] TC-0586 Phone (narrow width): the marks row stays ONE horizontally-scrollable
      line, never wraps, and does not eat half the height
- [ ] TC-0587 **iOS standalone (added to home screen, Dexie mode):** same flow on the
      iPhone PWA - the facet menus open above the list (portal/fixed, #1349),
      the marks row scrolls horizontally, and the empty-state exits are
      tappable (>=44px touch target)

### TS-0081 Discover Stage 2: entry points, source facet, language-name search (EXP-048, #2329-#2331)

Where: Discover (`/content?tab=discover`). Test in BOTH storage modes
(API + Dexie); the facets read the search index and are mode-independent.

- [ ] TC-0588 Entry control ("I want to") as the first permanently-visible mark; three
      presets with counts: Learn a language / A subject / Everything (#2331)
- [ ] TC-0589 "Learn a language" preset (the default on first visit): language sets
      only; target-language + level facets visible, domain facet hidden (#2331)
- [ ] TC-0590 Switching to "A subject": knowledge sets only; domain facet visible,
      level + target facets hidden; the choice persists across a reload (#2331)
- [ ] TC-0591 "Everything" shows both populations; switching entries clears the
      restrictions the new entry hides, so the list never silently drops to
      zero (#2331)
- [ ] TC-0592 Source facet: appears once more than one source is present; selecting one
      restricts to that source, with a per-source count (#2330)
- [ ] TC-0593 Language-name search: switch the UI to English and type "Spanish" - the
      German-authored Spanish sets are found (the pair's UI-language names are
      searchable) (#2329)
- [ ] TC-0594 Phone (narrow width): the entry mark joins the ONE horizontally-
      scrollable marks row and does not wrap
- [ ] TC-0595 **iOS standalone (added to home screen, Dexie mode):** same flow on the
      iPhone PWA - the entry menu opens above the list (portal/fixed, #1349),
      the preset stays remembered after quitting the PWA, and the
      language-name search works

### TS-0082 Discover Stage 3: batched rendering (EXP-048, #2333)

Where: Discover (`/content?tab=discover`). To get past 24 results, set the
entry to "Everything" and the source language to "All languages". Testable in
BOTH storage modes; the logic is mode-independent.

- [ ] TC-0596 With more than 24 results, only 24 render first; "Show more" loads the
      next batch; the count above the list stays the full number (#2333)
- [ ] TC-0597 No infinite scroll; the button disappears after the last batch
- [ ] TC-0598 A filter, search or sort change starts over from the first batch
- [ ] TC-0599 Applies to both the card grid and the list view
- [ ] TC-0600 **iOS standalone (added to home screen, Dexie mode):** "Show more" is
      tappable (>=44px), and the back-path (gesture / navigation) survives the
      extra batch

### TS-0083 Discover Stage 3: typo tolerance + ranking in search (EXP-048, #2336)

Where: Discover (`/content?tab=discover`), search box. Threshold deliberately
overridden: the exploration scheduled this only from ~200 sets (currently ~46);
it is built now on an explicit user decision. Testable in BOTH storage modes;
the logic is mode-independent.

- [ ] TC-0601 A search word with ONE typo (e.g. "spanissch" for "Spanisch") finds the
      same sets as the correct spelling
- [ ] TC-0602 Two or more typos in the same word do NOT find the set (tolerance stays
      tight)
- [ ] TC-0603 Very short search words (under 4 characters) stay exact; a 3-character
      typo finds nothing wrong
- [ ] TC-0604 A multi-word search still requires EVERY word to match; an unrelated
      second word excludes the set
- [ ] TC-0605 Exact matches rank above typo-only matches when sorting by "Relevance"
- [ ] TC-0606 **iOS standalone (added to home screen, Dexie mode):** typo search works
      offline exactly as in server mode

### TS-0084 Discover Stage 3: language-pair selection (alternative entry, collapsible) (EXP-048, #2337, #2359)

Where: Discover (`/content?tab=discover`), the "Language pairs" area above the
result list. Threshold deliberately overridden: the exploration scheduled this
only from ~30 populated pairs (currently 14); built now on an explicit user
decision. Shown in the "Learn a language" and "Everything" entries once more
than one pair is populated. Testable in BOTH storage modes; the logic is
mode-independent.

- [ ] TC-0607 Above the list sits ONE collapsible button, collapsed by default; with no
      selection it reads "Choose a language pair (N)" with the pair count (#2359)
- [ ] TC-0608 Expanding (click/tap the button) shows the populated pairs grouped by
      SOURCE language (one heading per source, its targets with counts below,
      most-populated first); tapping again collapses it (#2359)
- [ ] TC-0609 Tapping a target presets BOTH the source and target language at once and
      switches to the "Learn a language" entry; the list then shows only that
      pair's sets (#2337)
- [ ] TC-0610 After the choice the collapsed button summarizes it, e.g.
      "German → Spanish"; the chosen target is highlighted (marked active) when
      expanded (#2359)
- [ ] TC-0611 A pair in a DIFFERENT instruction language (e.g. the "English" group,
      "Spanish" target) jumps there too; the source language stays freely
      changeable afterwards (#2337)
- [ ] TC-0612 The pair selection is not shown in the "Subject" entry (#2337)
- [ ] TC-0613 Flag icons: each language name is prefixed with a flag emoji - in the
      pair selection's group headings and target buttons AND in the
      source/target language menus; the language name stays next to it, so on
      platforms without flag emoji (e.g. Windows) the name is still readable
      (#2359). Note: a language is not a country; the mapping is a deliberate
      convention (English -> UK, Portuguese -> Portugal)
- [ ] TC-0614 Keyboard: the button is reachable via Tab and toggles open/closed with
      Enter/Space; when expanded, the target buttons are reachable via Tab (#2359)
- [ ] TC-0615 Phone (narrow width): collapsed the selection costs ONE line; expanded the
      content stays scrollable and does not eat half the screen height (#2359)
- [ ] TC-0616 **iOS standalone (added to home screen, Dexie mode):** the disclosure
      button and the target buttons are tappable (>=44px), toggling works, and
      the selection acts offline exactly as in server mode (#2359)

### TS-0085 Set status persists (active/deferred/completed, both modes)

Where: My Content (`/content?tab=my`) → the set actions menu (three dots)
of a downloaded set. Test in BOTH storage modes (Desktop/server = API
mode; GitHub-Pages PWA = Dexie mode), since the bug used to occur only in
API mode.

- [ ] TC-0617 Set a set to **Deferred** → switch to another view (e.g. Dashboard)
      → return to My Content → the status is STILL "Deferred" (not back to
      "Active")
- [ ] TC-0618 Check both return paths: once via the menu/navigation, once via the
      browser Back button
- [ ] TC-0619 Exercise every transition: active → deferred → completed → active
      again; each survives a view switch
- [ ] TC-0620 Second stage (real persistence proof): fully close and reopen the app
      → the deferred status is still there
- [ ] TC-0621 iPhone PWA: same flow (originally observed there)

### TS-0086 Continue-Learning suggestion: ranking and a visible set completion (#2123, #3020)

Where: Dashboard → Overview, the top "Continue Learning" / "Weitermachen"
block. Test in BOTH storage modes (API + Dexie); the logic is
mode-agnostic.

- [ ] TC-0622 Finish a set completely (all lessons) OR set it to "Completed" via the
      set actions menu, with NO cards due → the row carries a visible
      "Set completed" tag (check icon, the last lesson's stars) and does NOT
      silently disappear
- [ ] TC-0623 Click the completed row → returns to the set's most recently worked
      lesson (looking things up again stays possible)
- [ ] TC-0624 A started set present as well → the started set is on TOP, the completed
      one below it; a finish is never the top proposal
- [ ] TC-0625 Several completed sets → at most ONE is shown with the tag (the most
      recently finished); the block never becomes a completion archive
- [ ] TC-0626 Neither an open nor a completed set and no due cards → an honest empty
      state ("Start your first lesson", link to My Content) instead of a
      filler set
- [ ] TC-0627 A completed set WITH due reviews → shown as a review row ("N elements
      due") that leads into the review session (`/review/{setId}`), not as a
      completion tag
- [ ] TC-0628 A deferred set with no due cards → NOT shown (deliberately set aside, so
      there is no finish to report)
- [ ] TC-0629 A started (active) set → still proposed to resume
- [ ] TC-0630 Order: due reviews first, then started sets, the completed set last
      (within each tier most-recently-touched first)

### TS-0087 Continue Learning: every row removable with an X (#3023)

Where: Dashboard → Overview, the "Continue Learning" block. Test in BOTH
storage modes (API + Dexie); the store is mode-agnostic (localStorage plus
the Dexie userData mirror).

- [ ] TC-0631 Every row carries an X on the right - whatever its mode: resume, next
      lesson, due review, completed set
- [ ] TC-0632 Click the X: the row disappears at once and a short message says it
      comes back as soon as you keep learning
- [ ] TC-0633 Reload: the row stays away (the decision is persisted)
- [ ] TC-0634 Nothing was deleted: the set is still in My Content, the lesson's
      progress is intact, the review cards are unchanged (check the count on
      the review card)
- [ ] TC-0635 Self-healing: open and work on the hidden lesson again → the row
      reappears on the dashboard
- [ ] TC-0636 Dismiss every row → honest empty state ("Start your first lesson"), not
      an empty block without explanation
- [ ] TC-0637 Backup round-trip: Export → wipe → Import → the dismissed rows are still
      dismissed (the state rides in the .alb)
- [ ] TC-0638 Phone: the X is tappable without mis-hits and does NOT trigger the row
      link (44 px target)

### TS-0088 Continue Learning: the step counter names the resume point (#3076)

Where: Dashboard → Overview, "Continue Learning" block, "Resume" row. Before,
"Step 1/8" counted graded exercises while the resume landed on a different
step.

- [ ] TC-0639 Open a lesson with eight steps, answer the first exercise, then move
      two theory steps further (step 4), leave through the menu
- [ ] TC-0640 Dashboard: the row reads "Resume · Step 4/8" (not "1/8")
- [ ] TC-0641 Click "Resume" → resume dialog → "Continue" lands on exactly the step
      the row names
- [ ] TC-0642 Play to the summary without "Mark complete", leave through the logo →
      the row reads "Step 8/8", never "9/8"

### TS-0089 Update guard: no silent progress loss on a set update (#2128)

Where: My Content, an already-LEARNED set (progress + review cards present) that
has an update available. Test in BOTH storage modes. Background: an update that
changes exercise/card identities (e.g. an answer fix) would orphan review cards.
The guard hangs on a real old-vs-new identity diff, not a blanket switch-off.

- [ ] TC-0643 Prep: learn a set (at least one lesson, make a few mistakes -> review
      cards) for which a changed version with a CHANGED answer/card front exists.
- [ ] TC-0644 Trigger a manual update (the set's "Update" button): a confirmation appears
      with counts ("N review cards / N lessons would be reset"), NOT a silent
      overwrite.
- [ ] TC-0645 "Keep current version" -> nothing updates, progress stays, the set still
      shows "Update available" (visible + re-decidable).
- [ ] TC-0646 "Update anyway" -> the update applies.
- [ ] TC-0647 A harmless update (only a new lesson/exercise added, no existing identity
      changed) -> NO prompt, applies straight away.
- [ ] TC-0648 Auto-sync (only with a connected user repo, 24h): an identity-changing
      update is NOT silently applied in the background; the set stays on the
      current version and shows "Update available" (no background dialog, no
      data loss).
- [ ] TC-0649 iOS standalone (PWA): same manual flow, the confirmation appears.
- [ ] TC-0659 Language check (#2160): the confirmation text appears in the app language
      (not English), spot-checked across several languages (de/ja/ko/el/hi).
- [ ] TC-0650 Carry-over proposal (#2308): the confirmation dialog additionally shows an
      "old -> new" list of the review items that could be carried over, plus a
      "Carry over what still matches" checkbox (on by default, BECAUSE the pairs
      are visible right above it).
- [ ] TC-0651 Confirm with the box ticked: after the update, error counts, streak and
      mastery sit on the CORRECTED answer (the review does not restart from
      zero). The toast names the count.
- [ ] TC-0652 UNTICK the box and confirm: the update runs and NOTHING is carried over
      (pre-#2308 behaviour). The checkbox is the decision, not decoration.
- [ ] TC-0653 Cases that cannot be assigned: if an exercise had its ORDER changed or an
      element inserted/removed, the dialog names those separately ("N cannot be
      assigned with confidence and will be reset"). Verify NOTHING was carried
      over for them - a wrong assignment is worse than a loss because it is
      invisible.
- [ ] TC-0654 AUTH-05: the exercise's OWN id changed (not just the answer text) - e.g.
      an exercise without a `stable_id` gets renamed (slug change) on update.
      The count in the "Carry over what still matches" checkbox includes this
      case (a combined number from the exercise and element level); the
      readable preview list still shows only answer-text pairs, never raw
      exercise slugs. After confirming with the box checked: the review card
      survives under the NEW exercise id, no restart from zero.
- [ ] TC-0655 Auto-sync (24h, connected user repo): NEITHER updates NOR carries anything
      over. The mapping may only come into being in the manual dialog.
- [ ] TC-0656 Confirm twice in a row (trigger the update again): no double carry-over, no
      error (idempotent).
- [ ] TC-0657 Backup beforehand: the backup hint is an offer, not a requirement - the
      update can be confirmed without one.
- [ ] TC-0658 iOS standalone (PWA): dialog including the pair list and the checkbox is
      fully readable and operable (the list does not overflow the dialog, the
      checkbox is tappable); carry-over works the same in Dexie mode.
- [ ] TC-0660 First minting (engine#91, element level): a set whose pairs/blanks/options
      get a stable_id for the first time, content otherwise unchanged or
      corrected in the same update. The transition is treated as a normal,
      safely assignable correction, not reported as "cannot be assigned".
      Progress survives when carry-over is confirmed.

### TS-0090 Retirement: archived progress on retired_ids (#2188)

Location: Content page, a set with learner progress whose update declares
`retired_ids` in the set manifest (the author deliberately retired
exercises). Check in BOTH storage modes. Background: a declared retirement is
not an accident - the related progress is ARCHIVED (not deleted, not
orphaned), leaves review scheduling and due counts, and the learner is told
once, with the count.

- [ ] TC-0661 Apply an update of a set with declared retirements (manually or via
      sync): ONE notice toast appears with the count ("N exercises were
      retired by the author; the related progress is archived.").
- [ ] TC-0662 Retirement-only update (no other identity changes): NO warning dialog
      (#2128) - a declared retirement is not breaking; the update applies,
      only the notice toast appears.
- [ ] TC-0663 After the update: the retired elements no longer appear in the review
      queue and no longer count into the "N due" number.
- [ ] TC-0664 Trigger the update again: no second toast, no double archival
      (idempotent; the count would be 0, so no notice).
- [ ] TC-0665 Language check: the notice appears in the app language (spot-check
      de/ja/ko).

### TS-0091 Recovery: review progress after the ja/ko/zh correction (#2161)

Location: Dashboard (Overview). Background: the three A1 sets Japanese, Korean
and Chinese were re-published in July 2026 with a transliteration fix that
changed the answer text of 172 review items (66 ja / 58 ko / 48 zh). Review
cards are keyed by the answer text, so cards already created for the changed
items quietly fell out of scheduling. Check in BOTH storage modes. Only these
three sets are affected; all other sets are untouched.

- [ ] TC-0666 Setup: learn one of the sets (ja/ko/zh A1) in the OLD version and create a
      few review cards, then move it to the corrected version (or seed test data
      with the old answer keys).
- [ ] TC-0667 The notice appears on the Dashboard ONLY when affected cards are actually
      present in your own data. No notice when nothing is affected.
- [ ] TC-0668 The notice shows, per affected set, the number of affected cards and offers
      "Export backup" (recommended, not forced).
- [ ] TC-0669 "Export backup" -> produces the same .alb file as Settings → Data (toast
      with the filename).
- [ ] TC-0670 "Relink review cards" -> a numeric result ("N relinked, N already
      correct"). The notice then disappears for that set (no re-asking).
- [ ] TC-0671 Idempotency: triggering again (or reloading) changes nothing more; the
      notice does not come back for that set.
- [ ] TC-0672 Partial recovery: if a set changed again after the fix, unmappable cards
      are reported by count and left unchanged (not silently dropped).
- [ ] TC-0673 "Start set fresh" -> inline confirm; only after confirming are the set's
      progress + review cards removed; the notice is then gone for that set.
- [ ] TC-0674 No double-map / no orphaned rows: after relinking, no review lands on the
      wrong card and there are no duplicate cards.
- [ ] TC-0675 Backup behavior: import a backup taken BEFORE recovery -> the old
      (orphaned) keys are back, the notice reappears and can be applied again.
- [ ] TC-0676 iOS standalone (PWA): same flow, notice + both actions work.
- [ ] TC-0677 Language check: notice and result texts appear in the app language (not
      English), sampled across several languages (de/ja/ko/el/hi).

#### TS-0092 Producing the state (test precondition)

The notice shows only when affected review cards are present in your own data.
Producing that state needs access to the stored data (developer tools), and that
is NOT possible in iOS standalone mode: it requires the Safari Web Inspector on a
Mac, and the QA machine runs Ubuntu. Hence the platform rule:

- The produced state is created and tested on the DESKTOP (app in the browser,
  developer tools available).
- On the PHONE (iOS standalone) test ONLY if real affected data is present.

First check (two-stage):

- [ ] TC-0678 On the phone, open the Dashboard. If the notice shows by itself, real
      affected data is present -> test there. Then the product condition applies:
      run "Export backup" (the button in the notice) FIRST.
- [ ] TC-0679 If no notice shows on the phone, the check moves to the DESKTOP; produce
      the state there. An orphaned entry can no longer be created through normal
      use (the corrected version already emits the new key), so this step needs
      developer tools (marked as such):

- [ ] TC-0680 Take a backup (Settings -> Data -> Export backup) so the starting state is
      restorable.
- [ ] TC-0681 Learn Japanese A1, lesson "01-begruessungen", the matching exercise
      (ex-match-begruessung) once and answer "こんにちは" wrong on purpose -> a
      review card is created on the NEW key "こんにちは (konnichiwa)".
- [ ] TC-0682 [Developer tools] Reset that card's key to the old form "こんにちは"
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
- [ ] TC-0683 Reload the Dashboard -> the notice appears (1 affected card, Japanese A1).

Way back (repeatable, no traces):

- [ ] TC-0684 After the test, import the backup taken in step 1 (Settings -> Data ->
      Import) -> exact starting state, no traces.
- [ ] TC-0685 [Developer tools] Or reverse the UPDATE (server) / set the test row back to
      the new key (Dexie).

Not covered: if the state is produced and tested only on the desktop, the
notice's behaviour in iOS standalone mode remains UNPROVEN (it cannot be produced
there without a Mac Web Inspector). That is a valid result, but note it
explicitly as open - do not silently equate it with the desktop result.

### TS-0093 Download visibility (Dexie mode, #1709 / #1719 / #1731)
- [ ] TC-0686 Deleted set stays deleted: delete a set in My Content →
      Refresh → the set does NOT come back (#1719)
- [ ] TC-0687 A set from a no-longer-configured source stays visible in
      My Content (not silently hidden) (#1731/#1734)
- [ ] TC-0688 Book recommendations come from the federated registry, not the
      removed official `books.yaml` (#1717)

### TS-0094 Delete a single lesson (#2064)

Location: My Content (`/content?tab=my`) → My Lessons → a set with
SEVERAL lessons (e.g. after a book import) → "Manage lessons".

- [ ] TC-0689 Prep: import/generate a book (several lessons in one set) OR a
      multi-lesson own set; play 1-2 lessons (create progress + review
      cards)
- [ ] TC-0690 "Manage lessons" expands the per-lesson list; each lesson has Play
      + Delete
- [ ] TC-0691 Delete opens a confirm dialog that names the lesson and says it
      CANNOT be undone
- [ ] TC-0692 The "Also delete my learning progress" checkbox shows the REAL
      review-card count of the lesson (cannot be undone)
- [ ] TC-0693 Delete WITHOUT the checkbox: the lesson leaves the list,
      lesson_count drops, sibling lessons are untouched; the deleted
      lesson's progress is kept (orphaned, cleanable later)
- [ ] TC-0694 Delete WITH the checkbox: progress + review cards of ONLY this
      lesson are gone, sibling progress remains
- [ ] TC-0695 No renumbering: the surviving lessons keep their titles/order,
      deep links to them still work
- [ ] TC-0696 Deleting the last lesson of a set removes the WHOLE set from My
      Content
- [ ] TC-0697 Keyboard-operable dialog: the Delete button is focused,
      Escape/Cancel dismisses
- [ ] TC-0698 Check BOTH modes: desktop/server (API) AND GitHub Pages (Dexie)
- [ ] TC-0699 Backup time-point: make a backup (.alb) BEFORE deleting → delete
      the lesson → import the backup → the lesson is back (correct: a
      backup is a snapshot, NOT a bug)

### TS-0095 Delete several lessons at once (#2065)

Location: My Content (`/content?tab=my`) → My Lessons → a set with
SEVERAL lessons → "Manage lessons".

- [ ] TC-0700 Prep: a multi-lesson own set (e.g. a book import); play 2-3 lessons
      to create progress + review cards
- [ ] TC-0701 "Select lessons" turns on a selection MODE: a checkbox appears on
      each row and the per-row actions (move, play, edit, delete) are
      hidden while it is active
- [ ] TC-0702 "Select all" checks every lesson; clicking again clears them;
      "N selected" counts correctly
- [ ] TC-0703 "Delete N" is disabled while nothing is selected
- [ ] TC-0704 Delete opens ONE confirm dialog that names the COUNT and says it
      CANNOT be undone; the dialog visibly RECOMMENDS a backup first
      (without forcing it)
- [ ] TC-0705 The "Also delete my learning progress" checkbox shows the
      AGGREGATED REAL review-card count across the selected lessons
- [ ] TC-0706 Delete WITHOUT the checkbox: exactly the selected lessons disappear
      in ONE step, lesson_count drops accordingly, NON-selected sibling
      lessons are untouched
- [ ] TC-0707 Order: the remaining lessons keep their order (no renumbering),
      deep links to them still work
- [ ] TC-0708 Delete WITH the checkbox: progress + review cards of ONLY the
      selected lessons are gone, sibling progress remains
- [ ] TC-0709 Select and delete ALL lessons: the dialog says BEFOREHAND that the
      WHOLE set will be deleted; afterwards the set is gone from My Content
- [ ] TC-0710 Keyboard-operable dialog: the Delete button is focused,
      Escape/Cancel dismisses; the checkboxes carry an aria-label
- [ ] TC-0711 Check BOTH modes: desktop/server (API) AND GitHub Pages (Dexie)
- [ ] TC-0712 Backup time-point: make a backup (.alb) BEFORE deleting → delete
      several lessons → import the backup → the lessons are back (correct:
      a backup is a snapshot, NOT a bug)
- [ ] TC-0713 iOS standalone (PWA added to the Home Screen, Dexie mode): the
      selection mode, the checkboxes and the confirm dialog are usable by
      touch; the action bar wraps cleanly on a narrow screen (no overflow)

### TS-0096 Disconnect content repo vs. delete progress (#1651 / #1652)

Location: Settings → Data → content-repo list → "Remove".

- [ ] TC-0714 Default (checkbox NOT set): a reassuring note that learning
      progress is KEPT and comes back on reconnect
- [ ] TC-0715 "Delete progress" checkbox set: a warning with REAL counts
      (N lessons + M review cards, cannot be undone)
- [ ] TC-0716 Disconnect only → reconnect the same repo → progress back
- [ ] TC-0717 Disconnect + delete → reconnect → progress empty
- [ ] TC-0718 The checkbox only appears when there IS progress to delete
      (Dexie mode)

### TS-0097 Recommended repositories: per-row buttons (#2558)

Location: Settings → Data → Recommended repositories.

- [ ] TC-0719 Multiple recommendations visible → click "Add repository" on ONE →
      ONLY that button disables, the others stay clickable
- [ ] TC-0720 While adding, a progress indicator (label + bar once the sync
      phase reports numbers) appears right at the clicked row, not
      globally
- [ ] TC-0721 Click a second recommendation while the first is still loading →
      both run through independently, no error
- [ ] TC-0722 After completion: the row disappears from "Recommended" (now
      under "Your content repositories"), the other rows' button state
      is unaffected

### TS-0098 Social sharing (visual + native)
- [ ] TC-0723 Share button visible after a lesson
- [ ] TC-0724 Mobile: native share sheet (WhatsApp/Telegram)
- [ ] TC-0725 Desktop: copies to clipboard + toast
- [ ] TC-0726 PNG share card: looks good (1200x630, theme tokens)

---

## TS-0099 PRIO 5: AI FEATURES (needs a real API key)

- [ ] TC-0727 Provider table: enter key → "Test" → "Connection ok"
- [ ] TC-0728 "Generate exercises" on theory-only: AI returns a result
- [ ] TC-0729 Quality of the generated exercises: sensible? type variety?
- [ ] TC-0730 "Continue session" after chat import: AI knows the context
- [ ] TC-0731 Tutor chat (assistant-ui, #1126): type → send (or Enter), the reply
      streams in; the 7-step cycle progress advances; read-aloud + dictation
      work; resuming a regular session shows the prior conversation
- [ ] TC-0732 Imported session opens with the AI asking the first question on its own
      (no user turn first), the chat starts clean
- [ ] TC-0733 AI content validation: report sensible? provider+model shown?
- [ ] TC-0734 No button without a key leads to an error toast (disabled + tooltip)

### TS-0100 Batch "Generate for all lessons" (#1896)
- [ ] TC-0735 My Content → My Lessons, a set where ALL lessons already have
      exercises: the "Generate for all lessons" button is disabled RIGHT
      AWAY with the tooltip "All lessons already have exercises."
      (no click needed, no info toast)
- [ ] TC-0736 A set with at least ONE lesson without exercises: button active,
      cost confirm → progress → result toast as before
- [ ] TC-0737 After a successful full run: the button turns disabled without a
      reload

### TS-0101 "Ask AI" button in lessons (#2693)
- [ ] TC-0738 Shown by default: the "Ask AI" button appears under every theory
      block and exercise, even without an AI key (then greyed-out with a
      BYOK hint popover instead of being hidden)
- [ ] TC-0739 Settings → Learning → Interaction → turn off "Show 'Ask AI'
      button": the button disappears in the running lesson (theory and
      exercises), no reload needed
- [ ] TC-0740 Turn the toggle back on: the button reappears immediately
- [ ] TC-0741 The toggle state survives a reload (localStorage)

### TS-0102 AI key vault import (#1765 / #1769)
- [ ] TC-0742 Settings → AI → "Configured providers" → "Import" jumps to
      Settings → Data and scrolls the KeyVault import block into view (#1765)
- [ ] TC-0743 Import via "Choose file" OR paste the raw envelope JSON into the
      textarea; passphrase always required
- [ ] TC-0744 Malformed/incomplete JSON → inline error (aria-live), Import
      stays disabled
- [ ] TC-0745 After a successful import (file OR paste): switching to
      Settings → AI shows the key IMMEDIATELY, without a reload (#1769)
- [ ] TC-0746 Passphrase masked with a reveal toggle; key/passphrase never logged

### TS-0103 Cross-app vault import (Topos → Adaptive Learner) (#2512)
- [ ] TC-0747 An .alk file exported from Topos (format "topos-ai-keys") imports
      without a "foreign file" rejection; the FILE's passphrase is asked
- [ ] TC-0748 The Topos key stored under "google" lands on the "Gemini" provider
      after the import (Settings → AI shows it there)
- [ ] TC-0749 Wrong passphrase → warning, no key is written
- [ ] TC-0750 AL export unchanged: an exported file still carries the format
      "adaptive-learner-keys"

### TS-0104 Perplexity provider (OpenAI-compatible, server mode only) (#2512)
- [ ] TC-0751 Settings → AI: "Perplexity" appears in the provider selection
      (after Gemini)
- [ ] TC-0752 Server mode (make dev): store a pplx- key, the model picker shows
      the static sonar list (sonar, sonar-pro, sonar-reasoning)
- [ ] TC-0753 Server mode: a session message with Perplexity active returns a
      response (model sonar-pro as the default)
- [ ] TC-0754 Browser mode (Dexie/PWA): Perplexity is visible but marked
      "desktop only" (no dead menu item, no CORS error)

---

## TS-0105 PRIO 6: THEMES (subjective aesthetics)

Click through once for EACH theme:
- [ ] TC-0755 Light: readable, contrasts
- [ ] TC-0756 Dark: readable, app icon light variant
- [ ] TC-0757 Ocean, Forest, Sepia, High-Contrast
- [ ] TC-0758 Catppuccin Mocha, Soft Pop, Amethyst Haze
- [ ] TC-0759 Buttons high-contrast on ALL themes?
- [ ] TC-0760 Dropdowns: opaque background (not transparent)?
- [ ] TC-0761 Share card: theme tokens correct?

---

## PRIO 7: DEVICE-SPECIFIC (not scriptable)

### TS-0106 iPhone Safari
- [ ] TC-0762 "Add to Home Screen" → app icon correct
- [ ] TC-0763 PWA starts in Dexie mode
- [ ] TC-0764 Safe-area insets respected
- [ ] TC-0765 Mobile nav = hamburger drawer (the bottom tab bar was removed in
      #1512); drawer links 44px, closes after navigation
- [ ] TC-0766 Tap offset on the iPhone (#1569, fixed by #2984 + #3004, device
      reading 7 on 2026-09-10): in a lesson focus a free-text field, type,
      close the keyboard, tap the field again, then tap an MC tile. The
      caret sits in the field and every tap hits the element under the
      finger. On a regression: Settings > Diagnostics & Support > "Tap &
      viewport probe" on, mark the mis-tap with "Daneben!", "Werte
      kopieren", and attach the protocol to the reopened issue #1569.

#### TS-0107 Theory read-aloud on iOS: long text (#1928) - MANDATORY

iOS Safari silently stops an unchunked utterance after ~15 seconds. Since
#1928 a theory block is split into chunks and spoken as a queue. Measured:
617 of 621 theory runs exceed the chunk budget; a median run is 1551
characters.

- [ ] TC-0767 On the iPhone, open a lesson with a long theory text and start
      read-aloud
- [ ] TC-0768 The text is read **completely** and does not break off after ~15
      seconds
- [ ] TC-0769 On a multi-step theory block the lesson auto-advances to the next
      step while reading (chunking must not distort the position in the
      text)
- [ ] TC-0770 No audible stutter between chunks
- [ ] TC-0771 Known platform limit, NOT a bug: pause/resume has no effect on iOS
      Safari (it stops and restarts there)

#### TS-0108 Read-aloud keeps playing when the screen auto-locks (#2666) - MANDATORY

The screen wake lock keeps the display awake while read-aloud is playing so
the device's inactivity timer doesn't interrupt speech synthesis (iOS
Safari and mobile Chrome browsers stop `speechSynthesis` the moment the
screen auto-locks).

- [ ] TC-0772 On the iPhone (Safari), open a lesson, start read-aloud, and do NOT
      touch the device
- [ ] TC-0773 Wait past the device's normal auto-lock timeout (leave the phone
      alone): the screen stays on for as long as read-aloud is playing
- [ ] TC-0774 Read-aloud plays uninterrupted through to the end of the text
- [ ] TC-0775 After "Stop" or the end of read-aloud, the screen is again allowed to
      auto-lock normally (the wake lock is released)
- [ ] TC-0776 Repeat the same flow on an Android device (Chrome)
- [ ] TC-0777 Known platform limit, NOT a bug: manually pressing the lock/power
      button still turns the screen off immediately and stops playback -
      no web API can prevent that

#### TS-0109 App update as an installed iOS PWA (#1357 / #1873) - MANDATORY

The one path no automated test covers: on iOS/WKWebView a new service
worker often does NOT activate through skipWaiting + reload, only after
the app is fully closed and reopened.

- [ ] TC-0778 Install the PWA on the home screen, note the build hash under
      Settings > About
- [ ] TC-0779 Deploy a newer build, bring the app back from the background
      (do not relaunch it): the update banner appears
- [ ] TC-0780 The banner ALSO shows the hint "close the app and reopen it" -
      this hint must never be missing on iOS standalone
- [ ] TC-0781 Tap "Update": the banner disappears and does NOT come back after
      a reload (accept suppression)
- [ ] TC-0782 Fully close and reopen the app: the build hash under About is
      the new one
- [ ] TC-0783 On a NON-iOS device (Android/desktop) run the same flow: the
      restart hint must NOT appear there

#### TS-0110 "What's new" release-notes modal stays closable (#2266)

The desktop/API-mode update banner's "What's new" modal
(`DesktopUpdateHost`) must never trap the user, however tall the release
and installation notes are. Viewport height is most critical on a short
window, so verify the iOS-standalone / phone-portrait shape explicitly.

- [ ] TC-0784 In API/desktop mode with an update available, open the banner's
      "What's new?" - the modal appears with a title, a scrollable body,
      and an always-visible X in the header
- [ ] TC-0785 Long release notes: the body scrolls; the header X and the footer
      "Close" button stay reachable (the notes never push the actions off
      screen)
- [ ] TC-0786 Close it four ways, each works: the header X, the footer "Close"
      button, the Escape key, and a click on the backdrop outside the card
- [ ] TC-0787 A click INSIDE the card does NOT close it
- [ ] TC-0788 Short viewport / iOS-standalone: shrink the window to a
      phone-portrait height (or an installed iOS standalone window) - the X
      stays fixed in the header while the notes scroll; the modal is still
      closable with the X, Escape, and a backdrop tap. Repeat with the
      on-screen keyboard raised
- [ ] TC-0789 Keyboard/SR: focus moves into the modal on open, Tab stays inside
      it, and focus returns to the "What's new?" button on close (no axe
      regression)

### TS-0111 Android Chrome
- [ ] TC-0790 "Install app" → maskable icon not clipped
- [ ] TC-0791 PWA works, Dexie mode

### TS-0112 Desktop PWA
- [ ] TC-0792 Install prompt → app starts standalone
- [ ] TC-0793 Dexie mode (NOT API mode, no 404)

---

## TS-0113 PRIO 8: SERVER MODE (via launcher)

- [ ] TC-0794 Download a set → visible in "My Content" (no cache problem)
- [ ] TC-0795 Backup import: no HTTP 413
- [ ] TC-0796 Play a lesson: no workbox errors in the console
- [ ] TC-0797 Change the port → app reachable on the new port

---

## TS-0114 PRIO 9: LANDING PAGE (static, #2409)

The landing page at `/start/` (DE) and `/start/en/` (EN) is real static
HTML in the Pages artifact - no React, no client-side loading. It carries
no numbers that could go stale, on purpose.

- [ ] TC-0798 `astrapi69.github.io/adaptive-learner/start/en/` loads; the core
      sentence "An app that adapts to you, not the other way around."
      is visible as the heading.
- [ ] TC-0799 "Open the app in your browser" leads into the app; "Download the
      launcher" leads to the release page.
- [ ] TC-0800 Language switch: "Deutsch" (top right on the EN page) leads to
      `/start/`, and "English" there leads back.
- [ ] TC-0801 The bottom links (Documentation, Repository, Learning content) work.
- [ ] TC-0803 Dark system theme: the page follows (prefers-color-scheme), text
      stays readable.
- [ ] TC-0804 Mobile (narrow window): single column, no horizontal scrolling.
- [ ] TC-0802 Footer (#3113): "Legal notice" leads to `astrapi69.github.io/adaptive-learner/docs/en/legal/imprint/`,
      "Privacy policy" to `astrapi69.github.io/adaptive-learner/docs/en/legal/privacy/`; on `/start/` they read
      "Impressum" / "Datenschutz" and lead to `astrapi69.github.io/adaptive-learner/docs/legal/…`.

### TS-0115 Legal texts reachable in the app (#3113)

Legal notice and privacy policy live as help pages on the docs site
(`astrapi69.github.io/adaptive-learner/docs/legal/imprint/`, `astrapi69.github.io/adaptive-learner/docs/legal/privacy/`; other languages under
`astrapi69.github.io/adaptive-learner/docs/<lang>/legal/…`, locales without their own version fall back to German).

- [ ] TC-0805 App start page `/` (no signed-in learner): below "Read the
      documentation" the row "Legal notice · Privacy policy"
      (`landing-imprint-link`, `landing-privacy-link`); both open the docs
      page in a new tab, in the active UI language (German without prefix,
      English under `astrapi69.github.io/adaptive-learner/docs/en/`).
- [ ] TC-0806 Settings → About → card "License & resources": two new rows "Legal
      notice" and "Privacy policy" (`about-imprint-link`,
      `about-privacy-link`), same targets, new tab.
- [ ] TC-0807 Help panel and docs site: section "Legal" with both pages in the
      navigation (DE + EN); the legal notice names name, address, email; the
      privacy policy carries a date and names GitHub Pages, YouTube preview
      images and the AI providers used with the learner's own key.
- [ ] TC-0808 Share preview (e.g. in a messenger): title, description and image
      appear (the landing page's Open Graph data, not the app's).

---

## TS-0116 PRIO 10: Selective data export - speech recordings category (#2840)

Location: Settings > Data > "Export selected data".

- [ ] TC-0809 The "Media" group with the "Speech recordings" category is visible,
      NOT checked by default (unlike Learning projects/Curricula/
      Progress/Subjects, which are pre-selected)
- [ ] TC-0810 Without checking it: the exported file contains NO
      `speech_recordings` rows, even when some exist
- [ ] TC-0811 Checking it + export: the file contains the user's
      `speech_recordings` rows

## TS-0117 PRIO 11: Preset avatar gallery (#2848)

Location: Settings > General > Profile, below the photo upload.

- [ ] TC-0812 "Or pick a figure" row with 8 figures visible (Spark, Robot,
      Star, Cat, Owl, Ghost, Lightning, Heart), each with a speaking
      tooltip/screen-reader name
- [ ] TC-0813 Tapping a figure: success toast, the preview above and the header
      avatar show the figure immediately (no reload)
- [ ] TC-0814 The chosen figure is marked (ring); picking another moves the mark
- [ ] TC-0815 Uploading a photo replaces the figure; afterwards NO figure is
      marked; picking a figure over a photo asks first (see the photo
      stash below)
- [ ] TC-0816 "Remove" clears the avatar; the header falls back to the initials
- [ ] TC-0817 Backup round-trip: pick a figure, export (`.alb`), wipe data,
      import - the figure is set again
- [ ] TC-0818 Both storage modes (server + browser) behave identically

#### TS-0118 Photo stash on figure switch (#2862)

- [ ] TC-0819 Upload and crop a photo, then tap a figure: a confirmation dialog
      appears ("Replace your photo?"); cancel leaves photo and selection
      unchanged
- [ ] TC-0820 Confirm ("Use figure"): the figure is active and a "Restore photo"
      button appears below the gallery
- [ ] TC-0821 "Restore photo": the photo is back (preview + header), the button
      disappears
- [ ] TC-0822 Figure-to-figure switch: NO dialog (only a real photo is guarded)
- [ ] TC-0823 Upload a NEW photo after picking a figure: the old stash is
      cleared (no restore button with a stale photo)
- [ ] TC-0824 Backup round-trip: with a filled stash export -> wipe -> import;
      "Restore photo" still works (both storage modes)

#### TS-0119 Avatar frames (#2850)

Location: Settings > General > Profile, below the figure gallery.

- [ ] TC-0825 "Avatar frame" row with 7 options (None, Bronze, Silver, Gold,
      Flame, Star, Accent); locked ones show a lock and the condition
      ("From level 5", "Needs the 3-day streak badge")
- [ ] TC-0826 Level unlock: with a sufficient level the frame is selectable;
      selecting puts the ring around the preview AND the header avatar
      immediately (no reload)
- [ ] TC-0827 XP purchase (Star 150 / Accent 300): the buy button shows the
      price, first click "Confirm", second click deducts the XP (header
      XP updates live); the frame is permanently unlocked and selected
- [ ] TC-0828 Insufficient XP: the buy button is disabled, no deduction possible
- [ ] TC-0829 Badge frame (Flame): selectable only after earning the 3-day
      streak badge
- [ ] TC-0830 The frame applies to photo avatars AND preset figures alike;
      "None" removes the ring
- [ ] TC-0831 Backup round-trip: pick a frame + buy one, export (`.alb`), wipe
      data, import - selection and purchase are back
- [ ] TC-0832 Both storage modes behave identically (XP deduction included)

### TS-0120 Review: errors only, no endless round (#3170)

- [ ] TC-0833 Play a lesson with NO mistakes: the learning path shows NO "Train
      errors (N)" for the set or the lesson, the header badge "N due" and
      the dashboard card "Due for review" do not count these elements;
      `/review/<set>` reports "All caught up"
- [ ] TC-0834 Play a lesson with some mistakes: "Train errors (N)" counts exactly
      the elements answered wrong (N), not every element played; never-wrong
      elements do not appear in the review session
- [ ] TC-0835 Review session with more due elements than "Questions per review":
      subtitle "{shown} of {due} elements"; after the round "Still N due.
      Keep going?" names EXACTLY the elements not played yet; "Another
      round" presents only those; then it ends ("All caught up"), no further
      "Another round", no endless loop
- [ ] TC-0836 A matching exercise covering several due elements (only ONE question
      in the flow): the subtitle counts the ELEMENTS covered (e.g. "3
      elements", not "1 of 3"), the summary "N of N corrected" uses the same
      basis, and nothing lingers as "Still N due" after the round
- [ ] TC-0837 Settings > Learning > Review: the new toggle "Also review error-free
      elements" sits under "Questions per review", is OFF by default and
      survives a reload
- [ ] TC-0838 Toggle ON: never-wrong elements return for review after 3 and 7 days
      (badge, dashboard card, session). When the session holds such
      elements, the summary reads "N of N reinforced" with the neutral trend
      line (no "corrected", no "weak spots"); "Train errors (N)" still
      counts errors only
- [ ] TC-0839 Learning-path status: a lesson played without mistakes counts as
      mastered while OFF (both directions, SRS status "mastered", not "due"
      for ever); with ON the three-in-a-row rule applies again
- [ ] TC-0840 Check both in browser mode (no server) AND in server mode

### TS-0121 Review session on the runner shell (EXP-052 slice 1, #3169)

- [ ] TC-0841 Open `/review/<set>` with due elements: header with "Back to
      Dashboard", the title "Review session" and the element subtitle; the
      progress bar "Step 1 of N" below; the footer looks like a lesson's
      (chevron "Previous" on the left, "Check" with a check icon on the
      right), no pause, no options bar
- [ ] TC-0842 "Previous" is disabled on the first step; after "Next" it goes one
      step back within the same run (not to the dashboard)
- [ ] TC-0843 Enter in a cloze answer: the first Enter checks, the second Enter
      advances; without an answer Enter does nothing; with the Enter
      shortcut switched off (Settings > Learning) Enter does nothing
- [ ] TC-0844 On the phone after "Next" (or Enter): the view jumps to the top of
      the new step (the header slides away, bar and task are visible, no
      cut-off top); rotate the device: task and footer are back in view
- [ ] TC-0845 Going back to an already answered step: the answer is locked
      (solution visible, no input), the footer shows "Next" instead of
      "Check", Enter advances instead of checking; in Statistics / Train
      errors the element then counts EXACTLY ONCE for this round (no second
      attempt from answering again)
- [ ] TC-0846 Going back to a step NOT answered yet (e.g. after jumping forward
      and back): the step stays answerable, "Check" is there
- [ ] TC-0847 Hints from an earlier run do not count (#3196): reveal a hint in a
      lesson, then open `/review/<set>` and answer the same element without
      a hint: the attempt is NOT marked "with hint" in Statistics; a hint
      revealed IN the session still counts; "Another round" starts without
      hint marks again
- [ ] TC-0848 Summary: unchanged (recap, SRS note, "Another round" while elements
      remain, come-back line); the footer there shows only "Previous" (a
      look back at the last, locked step)
- [ ] TC-0849 Loading, "All caught up", "set not downloaded" and error show the
      same screens as before (Back to Dashboard or Open content browser)
- [ ] TC-0850 Check both in browser mode (no server) AND in server mode

### TS-0122 Shuffle mode on the runner shell (EXP-052 slice 2, #3169)

- [ ] TC-0851 Open `/shuffle-lesson/<set>` for a downloaded set with at least two
      lessons: header with "Back to Dashboard", the title and the subtitle
      "Mixing N questions from M lessons"; the progress bar "Step 1 of N"
      below; the footer looks like a lesson's (chevron "Previous" on the
      left, "Check" with a check icon on the right), no pause, no options
      bar
- [ ] TC-0852 NEW: "Previous" is disabled on the first step; after "Next" it goes
      one step back within the same run
- [ ] TC-0853 NEW: going back to an already answered step: the answer is locked
      (solution visible, no input), the footer shows "Next" instead of
      "Check", Enter advances; in Statistics / Train errors the element
      then counts EXACTLY ONCE for this round (answering again no longer
      records a second attempt, unlike before)
- [ ] TC-0854 Going back to a step NOT answered yet: it stays answerable, "Check"
      is there
- [ ] TC-0855 Enter: the first Enter checks an answered task, the second Enter
      advances; without an answer Enter does nothing; with the Enter
      shortcut switched off (Settings > Learning) Enter does nothing
- [ ] TC-0856 NEW, on the phone: after "Next" (or Enter) the view jumps to the top
      of the new step; rotate the device: task and footer are back in view
- [ ] TC-0857 Hints from an earlier run do not count (#3196): reveal a hint in a
      lesson, then open shuffle mode for the same set and answer the
      element without a hint: NOT marked "with hint" in Statistics; a hint
      revealed IN the session counts; "Shuffle again" starts without hint
      marks and without locked steps
- [ ] TC-0858 NEW: extension exercises (e.g. speak and record, categorization,
      error correction, reading comprehension, graded quiz) and multiple
      choice from the set are shuffled in and played with "Check"
      (previously only the core exercise types)
- [ ] TC-0859 Summary unchanged: score with percentage, "from M different
      lessons", "Shuffle again", "Back to Dashboard"; the footer there shows
      only "Previous"
- [ ] TC-0860 Loading, "too few lessons", "set not downloaded" and error show the
      usual screens
- [ ] TC-0861 Check both in browser mode (no server) AND in server mode

### TS-0123 Endless mode on the runner shell (EXP-052 slice 2, #3169)

- [ ] TC-0862 Open `/endless-lesson/<set>` for a downloaded set: header with "Back
      to Dashboard" and the title "Endless practice"; below it the stat
      line "m:ss | N cards | K correct (P%)"; the clock runs
- [ ] TC-0863 NEW: the stat line is display only (no buttons in it any more);
      "Pause" and "End" sit in the footer on the left, "Check" with a check
      icon on the right; there is NO "Previous" (a stream has no previous
      step)
- [ ] TC-0864 NEW: "Pause" in the footer: the task disappears behind "Paused -
      take a breather.", the clock stops, "Check" is gone, Enter does
      nothing; the same button (now "Resume") continues, a half-typed
      answer is still there, the clock runs again
- [ ] TC-0865 "End" (also while paused) shows the recap: duration, cards, correct
      with percentage, reviews done, new learned, errors practised,
      practice XP; the only button "Back to Dashboard" has focus, Enter goes
      to the dashboard; the recap has no footer
- [ ] TC-0866 Enter: the first Enter checks, the second Enter fetches the next
      card; without an answer Enter does nothing
- [ ] TC-0867 NEW, on the phone: after "Next" the view jumps to the top of the new
      card; rotate the device: card and footer are back in view
- [ ] TC-0868 When the stream brings the same card again, it is freshly answerable
      (no lock) and counts as a new attempt
- [ ] TC-0869 Hints from an earlier run do not count (#3196): reveal a hint in a
      lesson, then open endless mode and answer the element without a hint:
      NOT marked "with hint" in Statistics
- [ ] TC-0870 NEW: extension exercises and multiple choice from the set appear in
      the stream. With a set that contains "speak and record" (e.g.
      adaptive-learner-content or alc-dog-training): the card appears, the
      browser asks for the microphone, start and stop a recording, "Check",
      then "Next": the stream continues with the next card (Visual Device
      Check on a real phone)
- [ ] TC-0871 Loading, "no exercises", "set not downloaded" and error show the
      usual screens
- [ ] TC-0872 Check both in browser mode (no server) AND in server mode

### TS-0124 Adaptive lesson on the runner shell (EXP-052 slice 3, #3169)

- [ ] TC-0873 Open `/adaptive-lesson/<set>` for a set with active errors: header
      with "Back to Dashboard" and the lesson title; right under the title
      the transparency block ("This lesson focuses on: ..." and "Based on N
      active error(s)"); below it the progress bar "Step 1 of N"; the footer
      looks like a lesson's (chevron "Previous" on the left, on an exercise
      "Check" with a check mark on the right), no pause, no options bar
- [ ] TC-0874 NEW (#3224): with at least 3 active errors from the same lesson the
      adaptive lesson opens on a theory page taken from that lesson: its
      text with headings and bold, NOT "This exercise is missing its type";
      the footer shows only "Next", no "Check"; "Next" (or Enter) leads to
      the first exercise, where "Check" appears
- [ ] TC-0875 "Previous" is disabled on the first step; after "Next" it goes one
      step back in the same run
- [ ] TC-0876 NEW: Enter (the adaptive lesson had no Enter shortcut before): the
      first Enter checks an answered exercise, the second Enter moves on;
      without an answer Enter does nothing; with the Enter shortcut switched
      off (Settings > Learning) Enter does nothing
- [ ] TC-0877 NEW: back to an already answered step: the answer is locked
      (solution visible, no input), the footer shows "Next" instead of
      "Check", Enter moves on; in statistics / train errors the element then
      counts EXACTLY ONCE for this round (answering again no longer records
      a second attempt, unlike before)
- [ ] TC-0878 Back to a step NOT YET answered: stays answerable, "Check" is there
- [ ] TC-0879 NEW, on a phone: after "Next" (or Enter) the view jumps to the start
      of the new step; rotate the device: exercise and footer are back in
      view
- [ ] TC-0880 Hints from an earlier run do not count (#3196): reveal a hint in a
      lesson, then open the same set's adaptive lesson and answer that
      element without a hint: NOT marked "with hint" in the statistics; a
      hint revealed IN the session counts
- [ ] TC-0881 Summary unchanged: score with percentage, the line "Improvement: +N
      element(s) mastered this session!" when elements were mastered in the
      session, the SRS note, "Back to Dashboard", below it "Save as Offline
      Lesson"; the footer there shows only "Previous"
- [ ] TC-0882 Loading ("Analyzing your errors..."), "Nothing to adapt yet" and "set
      not downloaded" show the usual screens; NEW: the error screen is the
      shell's shared one (a friendly note, the raw error only in developer
      mode, button "Open content browser" instead of "Back to Dashboard")
- [ ] TC-0883 Check both in browser mode (no server) AND in server mode

### TS-0125 Retry errors on the runner shell (EXP-052 slice 3, #3169)

- [ ] TC-0884 Finish a lesson with at least two mistakes, open "Retry Errors" from
      the summary: header with "Back to lesson" and the title "Retry errors:
      <lesson>"; below it the progress bar "Step 1 of N" (N = the number of
      wrong exercises); the footer looks like a lesson's (chevron "Previous"
      on the left, "Check" with a check mark on the right), no pause
- [ ] TC-0885 NEW: "Previous" in the footer (there was none before). Disabled on
      the first step; after "Next" it goes one step back in the same run,
      as a read-only look back
- [ ] TC-0886 NEW: back to an already answered step: the answer is locked
      (solution visible, no input), the footer shows "Next" instead of
      "Check", Enter moves on; in statistics / train errors the element
      counts EXACTLY ONCE for this round (no second attempt by answering
      again)
- [ ] TC-0887 Back BEFORE the current step is answered, then forward again: that
      step stays answerable, "Check" is there
- [ ] TC-0888 Enter: the first Enter checks an answered exercise, the second Enter
      moves on; without an answer Enter does nothing
- [ ] TC-0889 NEW, on a phone: after "Next" (or Enter) the view jumps to the start
      of the new step; rotate the device: exercise and footer are back in
      view; a very long word in the lesson title wraps instead of widening
      the page sideways (#2761)
- [ ] TC-0890 Hints from an earlier run do not count (#3196): a hint revealed in
      the lesson does NOT mark the replay's attempt "with hint"; a hint
      revealed in round one still counts in the next round ("Try again?")
- [ ] TC-0891 Summary: "X/Y correct now!"; all correct: "All errors corrected!"
      with confetti, "Back to lesson" has the focus, Enter goes to the
      lesson; errors left: "Still N errors. Try again?" and "Back to
      lesson"; NEW: the footer there shows "Previous" (a look back at the
      last, locked step)
- [ ] TC-0892 "Try again?" replays ONLY the still-wrong exercises, and they are
      answerable again (not locked); "Previous" is disabled on their first
      step
- [ ] TC-0893 Flash round (#2888): title "Flash round: <set>", the countdown ring
      sits right under the title and runs per exercise; it stops after
      "Check"; on an answered step reopened through "Previous" it does not
      run; "Back to lesson" and the end of the round lead to the set
      overview; a plain replay shows no ring
- [ ] TC-0894 NEW: open the page directly (reload the address, no exercises): title
      "Retry Errors", "Nothing to retry - ...", button "Back to Dashboard"
      (before: "Open content browser")
- [ ] TC-0895 Check both in browser mode (no server) AND in server mode

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
