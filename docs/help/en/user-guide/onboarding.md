# Onboarding

After the language picker on the Landing page, the Onboarding
flow collects four things about your learning project:

1. **Topic** — what you want to learn. "Spanish grammar",
   "Machine learning fundamentals", "Lead guitar improvisation".
   Be specific; the AI will use this to anchor every session.
2. **Goal** — what success looks like. "Pass the B2 exam",
   "Build a recommendation engine end-to-end", "Solo on a
   12-bar blues over a backing track without losing time."
   Concrete goals produce more useful AI guidance.
3. **Timeframe** — when you want to reach the goal. "6 weeks",
   "End of summer", "By Q3". Used to pace expectations and
   set the streak-tracking target.
4. **Daily minutes** — how much time you can realistically
   give. 15-45 minutes is the sweet spot for adaptive learning;
   the app doesn't reward marathon sessions.

You also pick a **language** for the project. This is the
language the AI will respond in during sessions; it can differ
from the UI language (you might prefer the UI in your native
language but learn Spanish in Spanish).

## Optional: current problem

A "current problem" field lets you bring an open question into
the project right away. If you fill it in, the first session
starts with this concrete obstacle instead of an open-ended
"what do you want to work on?" prompt.

## What happens next

When you submit the form, three things happen in one round-trip:

1. A `User` record is created (or reused — your local browser
   keeps the same user across sessions).
2. A `LearningProject` row gets your topic / goal / timeframe /
   daily-minutes / language.
3. The Assessment route opens automatically. You can skip it
   from here, but the app then defaults to the "deductive"
   learning method until you take it.

## Editing your project

Project details aren't carved in stone. The Curriculum page lets
you adjust the topic and goal as you discover what you actually
want to learn. The Settings page handles language changes.

## What's not stored

- **No email**, no password, no account.
- **No analytics**, no third-party trackers.
- **No telemetry** sent off your device in Local mode.

Your AI provider sees your messages (that's the whole point of
asking the AI). Adaptive Learner itself only stores what you
type — locally or in the FastAPI backend, depending on the
[storage mode](settings.md#storage-mode) you've chosen.
