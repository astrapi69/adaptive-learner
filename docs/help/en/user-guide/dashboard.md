# The Dashboard

The Dashboard is your home base. It pulls multiple data slices
into one view: who you are as a learner (profile + XP + badges),
how you're doing right now (streak heatmap + session counter),
what you've been doing (recent sessions + method distribution),
and what to do next (tool + spaced recommendations).

At the top sits the **Subjects + Tags filter bar** — pick a
subject (e.g. Languages → Spanish) or a tag to scope every
widget below to projects with that classification. Filters are
shareable via URL query params.

## Profile radar

The radar chart at the top shows your 6-method profile from the
assessment. Same shape as the post-assessment chart on the
Assessment page. The dominant method is highlighted under the
chart with a colored badge.

If you haven't taken the assessment yet, the radar shows an
all-zero shape and links to the Assessment page.

## XP + Streak + Badges

- **XP widget** — current level + total XP + a progress bar to
  the next level. Levels follow an exponential curve
  (`threshold(n) = 50 * n * (n - 1)`); levels 1-5 sit at
  0 / 100 / 300 / 600 / 1000 XP. Base 50 XP per ended session,
  plus per-cycle bonuses + first-method bonus + streak
  multiplier (up to 2.75× at a 7-day streak).
- **Streak heatmap** (GitHub-style) — 365 days of activity in
  weekly columns Mon..Sun. Five tier colors via
  `color-mix` on `var(--accent)`. Toggle weekend mode in
  Settings to skip Sat/Sun gaps; freeze stockpile (1 per 7
  streak days, max 3) acts as pause-not-reset on a missed
  weekday.
- **Badge showcase** — 24 badges across 5 categories
  (getting_started 3, consistency 4, method_explorer 7, depth
  7, polyglot 3). Earned ones light up colored + dated; locked
  ones stay grey.
- **Session counter** — tiles for sessions, minutes, current
  streak, average understanding, average stress.

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

- **Tools** — ranked external tools tailored to your profile.
  Anki + NotebookLM are now first-class with shipped exports
  (no manual handoff). Each shows a one-line "why" in your UI
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
