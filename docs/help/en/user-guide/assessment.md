# The learning-type assessment

The assessment is 12 questions about how you tend to approach
new material. Each question takes 5-10 seconds to answer; the
whole test runs under two minutes.

## How it works

Each question shows 3-4 possible answers. Most questions are
**single-select** (radio buttons — pick one). A few are
**multi-select** (checkboxes — pick everything that applies).
The app shows you which type each question is.

On mobile and touch devices, **swipe left or right** to
navigate between questions. The keyboard arrow keys do the
same on desktop. A one-shot hint on the first question
points this out.

Behind each answer sits a weight: how much picking it tilts
you toward one of the six learning methods (deductive,
inductive, error-based, dialogic, contextual, AI-adaptive). The
calculator sums those weights, normalises by question count,
and produces a 6-method profile.

## The six methods at a glance

| Method | Strength |
|---|---|
| Deductive | Rules first, examples after — theory-driven |
| Inductive | Examples first, derive the rule — pattern-driven |
| Error-based | Provoke mistakes, learn from them — friction-driven |
| Dialogic | Low-stress conversation — exchange-driven |
| Contextual | Real-world scenarios — situation-driven |
| AI-adaptive | The AI picks per turn — meta-driven |

[The six methods in depth](../concept/six-methods.md)

## Your profile

After the last question you see a **radar chart**: six axes,
each method's weight as a point on its axis. The shape tells
you a lot:

- **A clear point** sticking out far = one dominant method.
  The app will lean on that method by default.
- **A round shape** = balanced learner. The app starts with
  the "deductive" default but is more willing to switch
  methods between sessions.
- **A flat shape** at low values = you didn't pick strong
  preferences. That's fine; the AI-adaptive method works
  especially well here.

The **dominant method** (highest weight, alphabetical
tie-break) is shown explicitly above the chart. A
**Text-to-Speech** button next to the result reads the
summary aloud (Web Speech API; works in modern browsers).

## Multi-select questions

When a question allows multiple answers, the weight of each
pick is divided by how many you picked. Choosing two answers
contributes the same total weight as choosing one — so you
can't game the test by always picking everything.

## Retaking the assessment

Your view of how you learn changes over time. The Assessment
page is always reachable from the Dashboard's "Retake
assessment" link. Re-evaluating bumps your profile's `version`
field and overwrites the previous weights; the AI's behaviour
changes from the next session onwards.

## Skipping the assessment

If you skip the test, the app uses **deductive** as the
default method and you'll still get useful sessions. Take the
assessment when you're ready — there's no penalty for
delaying.
