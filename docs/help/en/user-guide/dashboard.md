# The Dashboard

The Dashboard is your home base. It pulls four data slices into
one view: who you are as a learner (your profile), how you're
doing right now (trend + streak), what you've been doing (recent
sessions + method distribution), and what to do next (tool +
spaced recommendations).

## Profile radar

The radar chart at the top shows your 6-method profile from the
assessment. Same shape as the post-assessment chart on the
Assessment page. The dominant method is highlighted under the
chart with a colored badge.

If you haven't taken the assessment yet, the radar shows an
all-zero shape and links to the Assessment page.

## Streak counter + session counter

Two compact tiles next to the radar:

- **Streak days** — consecutive calendar days with at least one
  ended session. Resets to 0 if today has no session yet.
- **Total sessions** — how many sessions you've completed,
  ever. Counts only sessions that were ended with a rating
  (and so produced a ProgressCommit).

The streak follows the Duolingo / Habitica convention: missing
today drops the streak to 0 the moment the calendar flips.

## Progress timeline

A two-line chart underneath the radar. Two metrics per session:
your **understanding** rating and your **stress** rating, each
rescaled from the 1-5 input to a 0-1 axis. Five most recent
sessions shown by default; ordered oldest-left to newest-right.

What to look for: an upward understanding line is exactly what
you want. A flat understanding line with rising stress is the
exact signal the method-switch heuristic watches for; it'll
nudge you to switch methods.

## Method distribution

A horizontal bar chart showing which of the 6 methods you've
been using. Each bar's length is the percentage of sessions
that used that method. Bars are ordered descending by count;
ties keep the canonical method order.

The point of this chart isn't competition with itself; it's a
mirror. Some learners run 80% deductive sessions and that's
fine. Other learners discover they've never actually used the
contextual method and want to try it.

## Recent sessions

The last 5 sessions as a compact list: method badge, the
session's understanding rating (as a tiny bar), and the
duration in minutes. Clicking a row jumps to the Progress page
filtered to that session — useful when a particular session
felt great or terrible and you want to see what happened.

## Tool + spaced recommendations

Two recommendation cards along the bottom edge:

- **Tools** — 5 external tools (Anki, NotebookLM, Adaptive AI
  Prompt, Excalidraw, Obsidian) ranked by relevance to your
  profile. Each shows a one-line "why" tailored to your
  language.
- **Spaced repetition** — short "do this next" action cards
  driven by which methods you haven't practised recently. A
  five-band policy (first / refresh / review / practice /
  maintain) drives the interval suggestions.

Both lists update on every Dashboard load — they're cheap to
compute and reflect the latest session.

## Start session

The big primary button at the top: "Start session". Opens the
Session page with a new session row created, the active method
pre-picked from your profile, and the cycle at step 1.
