# The seven-step cycle

Every session walks through a 7-step learning cycle. The
steps come from the *Von Theorie zur Praxis* article series
and reflect the actual cognitive arc of acquiring a new
skill.

## The arc

| # | Step | What's happening cognitively |
|---|---|---|
| 1 | Input | Encountering new material for the first time |
| 2 | Attempt | Trying to apply it |
| 3 | Error | Realising the application missed |
| 4 | Feedback | Processing why the error happened |
| 5 | Adapt | Adjusting your mental model |
| 6 | Repeat | Practising with the adjusted model |
| 7 | Integrate | Connecting to the broader context |

## Why this order

It's not just convenient — each step depends on the previous:

- **Input → Attempt** is non-trivial. Many learners skip
  Attempt and go straight from input to "I'll try later."
  That delay erodes recall. Step 2 forces immediate
  application.
- **Attempt → Error** is the productive friction. The error
  is *information*. A learning session that avoids errors
  by giving you only easy questions tells you nothing
  about your understanding.
- **Error → Feedback** is where the deepest learning
  happens. The same error explained immediately, with
  reference to your specific attempt, lands; the same
  error explained an hour later from a textbook doesn't.
- **Feedback → Adapt** is internal. The AI can't see this
  step happen; you do it in your head. Step 5 in the AI
  prompt deliberately invites you to articulate what
  you've changed in your approach.
- **Adapt → Repeat** verifies adaptation. The new practice
  task uses the same principle in a slightly different
  shape, so the adaptation has to generalise.
- **Repeat → Integrate** lifts the skill out of isolated
  practice and connects it to other things you know. This
  is what makes learning durable.

## What if you skip a step

Each skipped step costs you:

- **Skip Input**: you try to apply something you've never
  seen explained. Usually feels like flailing.
- **Skip Attempt**: you read the rule and assume you
  understand it. Months later you'll find you don't.
- **Skip Error**: you never produce a mistake the AI can
  diagnose. Learning slows to a trickle.
- **Skip Feedback**: you got an error but didn't process
  the explanation. The next session you'll make the same
  mistake.
- **Skip Adapt**: you nodded along to the feedback but
  didn't actually change your mental model. The next
  Attempt will reveal it.
- **Skip Repeat**: you adapted once but didn't verify the
  adaptation generalises. The skill won't transfer to a
  different surface form.
- **Skip Integrate**: the skill stays in a silo. You can
  do it in practice problems but not in a real situation.

The dual-prompt AI evaluator watches your exchanges and can
suggest staying on the current step when you've skipped a
cognitive beat. This is why "stay" suggestions exist —
they're not the AI being annoying.

## How the AI decides

After every `user` message + AI response, a second AI call
fires with this system prompt (paraphrased):

> Read the exchange. Has the learner finished the current
> cycle step? Emit JSON: `{advance, confidence, reason,
> suggested_step}`.

The schema enforces a single JSON object; if the AI returns
unparseable text, a deterministic +1 fallback applies
(capped at step 7).

The suggested_step can be:

- `current + 1` — normal advance (most common).
- `current` — stay; the learner needs more time here.
- A skip forward (e.g. 1 → 3) — the learner already
  grasps the input.
- A step backward (e.g. 4 → 2) — the learner is confused
  and needs to re-attempt.

The route applies the suggestion only when
`confidence >= 0.6` (the default `step_evaluation.confidence_threshold`
in app.yaml). Fallback verdicts always apply the +1 advance.

## Why dual-prompt instead of single

The same AI call could output both the learning reply AND
the step verdict. We don't, because:

1. **Separation of concerns** — the learning prompt is
   composed per (method, step). The evaluator prompt is
   method-aware but step-agnostic.
2. **Token budgets** — the learning reply benefits from
   1024 tokens; the verdict needs only 256.
3. **JSON parse robustness** — asking the AI to produce
   prose AND a JSON tail in one response is fragile. We
   ask twice, parse cleanly.
4. **Replay-ability** — when something goes weird, we have
   the two responses logged separately and can audit.

The cost is two API calls per round-trip. At cheap-tier
pricing (claude-haiku, gpt-4o-mini, gemini-flash) that's a
fraction of a cent per exchange.

## Cycle-progress indicator

The Session page renders a 7-circle strip at the top. Filled
= done; current step's circle is in the project's accent
color and pulses subtly during AI thinking. On step
transitions (forward or backward), the strip animates so
the cycle feels alive.

On mobile (≤768px) the strip becomes a single horizontal
row of small circles to save vertical space. Swipe-to-peek
on the strip shows an informational overlay describing the
previous / next cycle step.

## Auto-loop + topic transitions

Step 7 is no longer a dead end. Once the step-evaluator
moves you to step 7 with `advance=true`, a third AI call —
the topic-transition evaluator — judges whether the topic
has been integrated and whether to start a new cycle.

```
       step 1..7 (normal cycle)
                ↓
         step 7 reached
                ↓
   topic-transition AI call:
       integrated?  continue_recommended?
                ↓                    ↓
              yes ∧ yes            else
                ↓                    ↓
   cycle_step ← 1                cycle_step stays at 7
   cycle_count += 1              (session ready to end)
   cycle_topics ← [..., summary]
   new subtopic picked
```

The hard cap `max_cycles=5` per session prevents runaway
loops. A deterministic fallback keeps the cap-at-7
behaviour on any AI / parse failure.

The chat renders cycle transitions as dashed-border
"Cycle N" cards in the session history. The rating dialog
summarises the multi-cycle journey when `cycle_count > 1`.

## Parallel cycle-boundary evaluation

At the step 6 → 7 transition both the step-evaluator and
the topic-transition evaluator fire concurrently via
`asyncio.gather` (`async_evaluation: true` in `app.yaml`).
This saves ~T₂ of latency at the cycle boundary.

The message response carries a `timings` block with
`learning_ms` / `evaluation_ms` / `topic_transition_ms` /
`total_ms` / `parallel_saved_ms`.
