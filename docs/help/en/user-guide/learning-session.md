# A learning session

A session is one focused conversation with the AI through the
seven-step learning cycle. Sessions are short — 15-45 minutes
is typical. The Dashboard's "Start session" button creates a
new one; the app picks the learning method (your dominant from
the assessment) and the cycle's starting step (usually 1 = Input).

## The seven steps

| # | Step | What happens |
|---|---|---|
| 1 | Input | The AI presents new material in the active method's style |
| 2 | Attempt | You apply what you just learned — the AI poses a task |
| 3 | Error | A mistake shows up; the AI marks it precisely |
| 4 | Feedback | The AI explains the correction in depth |
| 5 | Adapt | You adjust your approach; the AI may re-frame |
| 6 | Repeat | A fresh task that exercises the same concept |
| 7 | Integrate | The AI connects today's material to broader context |

The cycle is a *framework*, not a conveyor belt. Steps can
repeat, skip forward, or even step backward when your last
turn shows confusion. The AI judges per round-trip and the
app's progress bar updates accordingly.

[The cycle in detail](../concept/seven-steps.md)

## How the AI guides you

Every message you send triggers up to three AI calls:

1. **The learning reply** — streamed token-by-token via SSE.
   You see the inline cursor (▍) while the assistant thinks;
   tokens land in the bubble as they arrive (no "Thinking..."
   placeholder). The system prompt is composed from a 42-cell
   matrix (6 methods × 7 steps), so a deductive Input feels
   very different from a contextual Repeat.
2. **The step evaluator** — a second AI call reads the
   exchange and decides whether you're ready to advance. It
   emits `advance`, `confidence`, `reason`, `suggested_step`.
   The app applies the suggestion when confidence ≥ 0.6.
3. **The topic-transition evaluator** (only at step 7) —
   a third AI call decides whether the topic has been
   integrated. If yes AND `continue_recommended`, a new cycle
   starts automatically with a fresh subtopic (auto-loop,
   max 5 cycles per session).

The verdict is shown discreetly above the chat as a "Step
moved from X to Y because…" notification when it actually
applies. Cycle-transition cards render as dashed-border
"Cycle N" cards in the chat history.

**Voice on / off** — a TTS button (▶) next to each AI reply
reads it aloud; a microphone button (🎤) on the input lets you
dictate; interim transcripts populate the textarea so you can
review before sending. Both are Web Speech API; toggle in
Settings → Voice.

## Cycle-progress indicator

Across the top of the Session page sits a 7-circle progress
strip. The current step is filled in your project's accent
color; passed steps are filled more faintly; future steps are
empty. When the evaluator moves you forward (or backward!),
the strip animates to make the transition visible.

On mobile (≤768px) the strip becomes a single horizontal row
of small circles to save vertical space.

## Method-switch recommendations

Sometimes the active method just doesn't land. After three
sessions where your "understanding" rating doesn't grow and
your "stress" rating stays high, the app surfaces a
**MethodSwitchBanner**: "Want to try [other method] for the
next session?". Accept and the next session starts with the
new method active.

The recommendation reads your profile and prefers your
second-strongest method that you haven't used recently. You
can dismiss the banner; it'll come back if the stagnation
pattern continues.

Both storage modes (Server + Local) support method-switch
recommendations.

## Rating + ending a session

The Session page has an "End session" button. Before the
session closes you fill a short rating: understanding,
stress, and method-fit on a 1-5 scale, plus an optional
**rich-text note** (TipTap: bold, italic, lists, code blocks
with syntax highlighting, links). The note is yours — the AI
doesn't read it.

The ratings + multi-cycle journey summary turn into a
`ProgressCommit` row — the Git-style snapshot of one
session. Completing a session awards XP (50 base × streak
multiplier, plus per-cycle bonuses), checks for newly-earned
badges, and updates your streak. See
[Progress](progress.md), [Dashboard](dashboard.md), and the
[Tracking concept](../concept/tracking.md).
