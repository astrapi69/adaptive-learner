# Onboarding

The entry point is deliberately short: the
**quick start** asks for only two fields.

1. **Name** — how the app should address you.
2. **Topic** — what you want to learn. "Spanish grammar",
   "Machine learning basics", "Solo improvisation on the guitar".
   Be specific; this is the anchor for your project.

Everything else (goal, timeframe, minutes per day, language) takes
sensible **defaults** that you can change at any time.

## Jump right in or set up profile

After submitting, the app offers you two paths:

- **Jump right in** — you land straight on the Dashboard and can
  start a lesson or session.
- **Set up profile** — opens the **onboarding wizard**: one
  question per screen (goal → timeframe → minutes per day →
  current problem → optional learning-style assessment), each
  pre-filled so "Next" always works, plus a progress bar and
  "Back". The answers are saved in both storage modes.

The **learning-style assessment is no longer mandatory** — it is
only reachable via the wizard's final step. More on this under
[Learning-style assessment](assessment.md).

## Resumable assessment

If you abandon the learning-style assessment partway, the app
remembers the in-flight progress (current question, answers so
far, start time) per project, so you **continue where you left
off**. The Dashboard and Settings actively invite you to
**continue, create or retake** your learning profile. Once the
profile is computed, the in-flight progress is discarded.

## Optional: current problem

In the "current problem" step you can bring an open question
straight into the project. If you fill it in, the first AI session
starts with this specific obstacle instead of an open "what do you
want to work on?" prompt.

## Subjects and tags

You can optionally assign a **subject** (a field from the seeded
taxonomy tree) and **tags** (comma-separated free-text labels) to
your project. Both appear later in the Dashboard filter bar; the
subject filter lists only your own subjects, sorted by most-used.
Choosing a language subject unlocks the pronunciation exercise.

## Editing the project

Project details are not set in stone. On the Curriculum page you
can adjust the topic and goal once you figure out what you really
want to learn. You change the language in the settings.

## What is not stored

- **No email**, no password, no account.
- **No analytics**, no third-party trackers.
- **No telemetry** leaves your device in local mode.

Your AI provider sees your messages (that is the point of the AI
request). Adaptive Learner itself only stores what you type —
locally or in the FastAPI backend, depending on which
[storage mode](settings.md) is set.
