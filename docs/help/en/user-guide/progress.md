# Progress

The Progress page is the detailed view of your learning data —
everything the Dashboard summarises, with charts and tables
for digging deeper.

## What you see

Four sections, top to bottom:

1. **Trend insights** — mean understanding, mean stress,
   total minutes, streak days. Numbers the Dashboard shows in
   a compact tile here become labelled rows.
2. **Method distribution** — the same horizontal bar chart
   as the Dashboard, with hover tooltips showing the exact
   session count per method.
3. **Step-evaluation insights** — only v0.5.0+ data; reads
   from the StepEvaluation rows the session route produces.
4. **Commit history** — every ProgressCommit row in
   chronological order, newest first.

## Step-evaluation insights

The dual-prompt architecture writes one `StepEvaluation` row
per AI round-trip with the evaluator's verdict (advance,
confidence, suggested_step, fallback_used, reason). The
tracking aggregator reads these and produces four numbers
worth looking at:

- **Total evaluations** — every AI round-trip ever produces
  one. A long-running project will have hundreds.
- **Average confidence** — across all evaluations. A low
  average (< 0.5) means the AI is rarely sure you're ready
  to advance, which is usually a signal that the material
  is genuinely hard for you. Not bad — it's information.
- **Repeat count** — how often the evaluator chose to keep
  you on the same step. Repeat-heavy phases are normal
  when the material is dense.
- **Fallback count** — how often the AI's JSON output
  couldn't be parsed and the deterministic +1 advance was
  substituted. High numbers (> 10% of evaluations) suggest
  the AI is struggling with the JSON-output format; usually
  a model issue, not your fault.

## Time-per-step

A bar chart showing total seconds spent on each cycle step
across the project. The aggregator clamps gaps over 2 hours
(you walked away from your screen — not real learning time)
so single overnight sessions don't dominate.

Which step you spend most time on says a lot. Lots of time on
step 3 (Error) means the material has lots of pitfalls — that
might be exactly what you signed up for. Lots of time on step
1 (Input) means the material is dense and you're reading
slowly.

## Commit history

Each row is one ProgressCommit: method, understanding rating,
stress rating, duration in minutes, committed_at timestamp.
The list is sortable by date or by understanding.

Clicking a commit doesn't currently jump to the underlying
session messages — message history isn't surfaced from the
Progress page in v0.7.0. The dashboard's "Recent sessions"
list is the closest UX in this direction.

## Filtering

A simple filter strip lets you narrow by:

- **Method** — only commits using deductive (or any other).
- **Date range** — last 7 / 30 / 90 days, or all-time.

Filters apply across all four sections (trend insights,
distribution, step-evaluation aggregates, history).

## Privacy reminder

In Local mode the Progress page reads from IndexedDB and
shows you what you've persisted in this browser. In Server
mode it reads from the FastAPI backend's SQLite database.
Either way, nothing here is ever sent to a third-party
analytics service.
