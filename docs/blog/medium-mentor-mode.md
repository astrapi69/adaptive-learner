# Your Best Lesson Reviewer Is You. Mentor Mode Turns That Into a Workflow.

Every author of learning content knows the moment: you play through your own lesson and spot the typo, the ambiguous
question, the distractor that gives itself away. And then the workflow falls apart. You leave the lesson, hunt for the
set in your library, open the editor, scroll to the exercise - and by the time you found it, you forgot the other three
things you noticed.

Adaptive Learner now ships mentor mode: a complete annotate-while-playing workflow for your own lessons. You play, you
flag, you finish - and your punch list is waiting for you inside the editor, exactly where you fix it.

## The core decision: annotate while playing, edit afterwards

The obvious feature request would have been "let me edit the lesson right there in the player". We deliberately built
something else, and the reason is worth spelling out.

A lesson that mutates underneath a running player is a bug factory. Step indices shift, graded answers refer to
exercises that no longer exist, review scheduling orphans its cards. Whole classes of "ghost progress" bugs in
learning apps trace back to exactly this: two writers on one artifact, one of them mid-session.

So mentor mode separates the two roles cleanly:

- **The player collects observations.** Notes never touch the lesson. Your answers are graded normally, progress and
  spaced repetition continue unchanged.
- **The editor changes content.** Every fix flows through the same proven write path as any other edit - the one that
  re-anchors learning progress to stable exercise identities, so a fixed typo does not orphan your review history.

The result feels like editing-while-playing, without the failure modes of editing while playing.

## What it looks like in practice

Mentor mode appears only on lessons you own - sets you created, imported, or forked from downloaded content via
"Edit as a copy". Learners playing somebody else's set never see any of it.

**1. While playing.** Below every step sits an unobtrusive "Mentor note" button. Tap it, pick a category - typo,
unclear wording, too easy, too hard, answer graded wrong, other - add a line of free text, save, keep playing. A step
that already carries a note shows it prefilled; notes can be edited or removed at any time. There is deliberately no
mode toggle to remember: if the lesson is yours, the affordance is there, and it stays out of the way.

**2. On the summary.** The completion screen shows your punch list: every note from the run with its category and
text, each row removable, plus a one-tap "Edit this lesson in the editor" link that lands in the editor with exactly
this lesson preloaded. The same link is available mid-lesson from the player's Options panel, for the impatient.

**3. In the editor.** Open an annotated lesson for editing and the punch list renders above the wizard - category,
text, and a done-button per note. Removing a note there syncs back to the player and the summary; the list is one
shared store, not three copies.

## The AI part, done conservatively

Each note in the editor offers an "AI suggestion" button. It sends your annotation plus the affected exercise's JSON
to your own configured AI provider and returns a short, concrete revision proposal in your app language - "change the
accepted answer to X, and reword the prompt as Y".

Three design choices matter here:

- **Bring your own key.** Like every AI feature in Adaptive Learner, suggestions run against your provider with your
  key, browser-direct. No key, no call - the button explains itself instead of dying silently.
- **Display, never auto-apply.** The proposal is text next to your note. The author decides what to incorporate, by
  hand, in the same editor. An AI that silently rewrites your teaching content is a trust problem, not a feature.
- **Honest empties.** When nothing usable comes back, the UI says so. Rather one fewer suggestion than one that does
  not hold.

## Engineering notes, for the curious

A few implementation details that carried the design:

**One store, both storage modes.** Adaptive Learner runs on two storage backends - a server mode and a fully
browser-local mode. Features that persist "somewhere per mode" are a recurring bug class: green in the mode you
tested, silently broken in the other. Mentor notes therefore live in one mode-agnostic store (localStorage with a
write-through mirror into the browser database), registered with the backup system so notes survive a restore and
ride along in the export file. The store is keyed by set, lesson and step - and tested for corrupt-storage tolerance
and backup round-trips, not just the happy path.

**Self-gating components.** Every mentor surface decides for itself whether it may render, through one shared
predicate ("is this the author's own editable set?"). The pages that mount them stay dumb; there is no way to forget
a gate on one surface while adding the next.

**Wired-versus-working tests.** Each surface has unit tests, but each mount point also has a wiring pin: a test that
proves the page actually renders the control for an own lesson and actually hides it for a downloaded one. A
component that exists but is never mounted is the oldest false comfort in frontend development.

**The gates did their job.** Mid-implementation, the repository's file-size gate flagged the editor page for crossing
its god-file ceiling - the fix was a small extraction, not a whitelist entry. A testid-reference gate flagged a moved
test hook and forced an explicit, justified escape label instead of a silent pass. Boring stories are exactly what
you want from CI.

## Why this matters beyond one app

The pattern generalises. Any tool where creators consume their own artifacts - course builders, quiz platforms,
documentation sites, even test suites - has the same shape: review happens in the consumption view, fixing happens in
the authoring view, and the gap between them is where feedback dies.

The fix is not merging the two views. It is a first-class channel between them: capture feedback in context, with
near-zero friction, and deliver it to the authoring view with the context still attached. Add AI as a proposer, not
an applier. Keep the artifact's single write path sacred.

Play your own lesson today. The typos are waiting - and now they have nowhere to hide.
