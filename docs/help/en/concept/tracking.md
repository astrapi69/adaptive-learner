# Tracking: Git for learning

Most learning apps track "percentage complete" or
"streak days." These numbers are easy to compute but tell
you almost nothing about how you're actually learning.
AdaptiveLearner borrows Git's mental model instead.

## The Git analogy

| Git | Learning |
|---|---|
| Commit | One session's snapshot (method, ratings, duration) |
| Diff | Delta from the previous session in the same topic |
| Branch | A method-switch (deductive → dialogic) |
| Log | The full chronological history of commits |
| Blame | Which session introduced a specific pattern |
| Bisect | Find the session where understanding stopped growing |

We don't use Git literally. We use its discipline of
versioned, recoverable, comparable state. Sessions are
durable; they don't disappear when you close the tab. You
can look back, compare, and find patterns.

## What gets committed

Every session that ends with a rating produces one
`ProgressCommit` row:

| Column | What it captures |
|---|---|
| method | Which of the six methods this session used |
| understanding | Your 1-5 rating, rescaled to 0.0-1.0 |
| stress | Same rescaling |
| error_rate | 0.0-1.0 (currently always 0.0; reserved for a future per-step error fraction) |
| duration_minutes | Elapsed time between started_at and ended_at |
| committed_at | When the commit was written |
| project_id | Which learning project |
| session_id | Which session |

That's it. Seven fields, no NULLs (rating values are
required to end with). A handful of bytes per session.

## What you can do with this

### Trend lines

The Dashboard's Progress Timeline plots your last 5
understanding + stress ratings. Five points are enough to
spot direction:

- Both rising: progress + confidence both up. Keep going.
- Understanding rising, stress rising: you're stretching.
  This is good but sustainable only so long.
- Understanding flat, stress rising: stagnation. The
  method-switch heuristic triggers here.
- Understanding falling: something changed. Topic got
  harder? Method stopped fitting? Time to look at the
  history.

### Method distribution

Which methods have you actually used? Many learners discover
they default to one method (often deductive) and never try
the others. The bar chart on the Dashboard is a mirror — not
a competition.

### Streak

Consecutive calendar days with at least one session. Resets
the moment a day passes with no session. This is the only
"gamification" metric in AdaptiveLearner and it's deliberately
low-key. The other side of the chart is more important.

### Step-evaluation aggregates

The dual-prompt evaluator writes a `StepEvaluation` row per
AI round-trip. The tracking aggregator turns these into:

- **Average confidence** — how sure the AI is on average
  that you're ready to advance. Low (< 0.5) means the
  material is genuinely hard for you. That's information,
  not a verdict.
- **Repeat count** — how often the evaluator said "stay
  here." Heavy-repeat phases are normal for dense topics.
- **Time per step** — total wall-clock seconds you've
  spent on each step across the project (clamped to
  exclude > 2h gaps). The step with the most time is
  where the cognitive work is happening for you.

The Progress page renders all of this as bar charts.

## What we don't track

Deliberately:

- **No engagement metrics** — no "minutes per day" guilt,
  no notifications, no daily reminders. Adaptive Learner
  doesn't fight for your attention.
- **No comparison to other users** — you're alone in your
  data (Local mode) or alone with the backend (Server
  mode). No leaderboards, no peer comparison.
- **No "lessons completed"** — there's no fixed curriculum
  to complete. You set your own topic.
- **No "mastery percent"** — what would 100% even mean
  for a learning topic? Mastery is a posture, not a
  finish line.

## Privacy

In Local mode the data is in IndexedDB on your device. Read
it via the browser DevTools or export it for backup. Nobody
else can see it unless they have access to this browser
profile.

In Server mode the data is in SQLite on the backend host.
Encrypted API keys aside, none of the row data is sensitive
in the usual sense — it's just method names, integer ratings,
timestamps. But it's *yours*. Adaptive Learner sends none of
it to any third-party analytics or telemetry service.

## Why this matters for learning

Streak counters in most apps are addictive but shallow. You
learn nothing from a 90-day Duolingo streak about *what*
you learned. The Git model gives you patterns:

- "I switched from deductive to dialogic on May 10 and my
  understanding line shot up that week."
- "I spent 40% of my time on step 3 (Error). The topic has
  more pitfalls than I expected."
- "I haven't done a contextual session in three weeks; the
  spaced recommendation card is right to nudge me."

These are the questions a serious learner asks themselves.
AdaptiveLearner gives you the substrate to ask them.
