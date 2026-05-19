# Philosophy

> The best learning method is no fixed method.

That's the thesis at the heart of AdaptiveLearner. Most
"learning apps" pick one approach — flashcards, video
lectures, gamified streaks — and assume everyone learns the
same way. They don't.

## Why one method isn't enough

Different topics call for different methods. Even the *same*
topic, at *different stages of mastery*, calls for different
methods:

- You don't approach learning a new grammar rule the same way
  you approach polishing your accent.
- You don't review for a high-stakes exam the same way you
  explore a topic out of curiosity.
- You don't recover from a setback the same way you maintain
  a streak.

A learner who can fluidly switch between methods learns
faster, retains longer, and burns out less. The point of
AdaptiveLearner is not to find your One True Method — it's
to make method-switching cheap, natural, and pedagogically
justified.

## The six methods

We picked six methods that cover the major axes of how
humans actually learn:

| Method | Core stance |
|---|---|
| Deductive | Theory first — rules, then examples |
| Inductive | Examples first — derive rules from patterns |
| Error-based | Provoke mistakes, learn from them |
| Dialogic | Conversational exchange, low pressure |
| Contextual | Real-world scenarios, situated practice |
| AI-adaptive | Let the AI choose per turn |

The first five are pedagogically classical. The sixth is the
honest acknowledgment that AI can do something humans
couldn't: pick a method *per individual exchange* based on
what the learner just did.

[Methods in depth](six-methods.md)

## The seven-step cycle

Each session walks through a 7-step learning cycle: Input,
Attempt, Error, Feedback, Adapt, Repeat, Integrate. Most
learning happens between Error and Feedback (steps 3-4) —
that's where the actual cognitive work lives. The other
steps exist to give errors something to push against and a
place to land.

The cycle isn't a conveyor belt. Steps repeat, skip, or step
back depending on whether you actually grasped the material.
The dual-prompt AI architecture (see
[The seven-step cycle](seven-steps.md)) decides per round-
trip.

## Git for learning

We borrow Git's mental model for tracking progress:

- **Commit** = one session's snapshot (method, ratings,
  duration).
- **Diff** = the delta from the last session in the same
  topic.
- **Branch** = a method-switch (you went from deductive to
  dialogic at session 7).
- **History** = your full learning trail, queryable +
  visualisable.

We don't use Git literally; we use its discipline of
versioned, recoverable, comparable state. ChatGPT forgets
your conversation the moment you close the tab. AdaptiveLearner
keeps a structured snapshot of every session so trends emerge
across weeks and months.

[Tracking](tracking.md)

## The three pillars

Three external tool categories sit alongside AdaptiveLearner
sessions — we don't try to reinvent them:

1. **Spaced repetition** (Anki) — for long-term retention
   of rules + error-corrections.
2. **Active recall** (NotebookLM) — for building knowledge
   from your own sources.
3. **Adaptive AI prompts** (Claude / ChatGPT / Gemini) —
   for one-off explanations + flexible inquiry.

The Dashboard's Tool Recommendations card ranks these five
tools (plus Excalidraw + Obsidian) against your profile, so
you see which one to lean on for your current learning
shape.

[Tools](tools.md)

## Why this matters

The Medium article series *Von Theorie zur Praxis* is the
intellectual foundation. AdaptiveLearner is the engineering
translation: a tool that operationalises the article's
arguments into a daily practice. The articles explain WHY
six methods, WHY seven steps, WHY adaptive switching. This
app gives you a place to actually do the thing.

The articles aren't required reading to use the app. But if
you want to understand why we built it this way, that's the
source. Links live in the README.
