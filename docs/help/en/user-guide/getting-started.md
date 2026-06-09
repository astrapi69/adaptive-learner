# Getting started

Adaptive Learner is a learning companion built on a
research-backed six-method model. You take a short test that finds
out which methods suit you, then run AI-assisted learning sessions
through a seven-step cycle. The app learns with you and adapts how
it teaches.

## Try it now

The fastest way to get to know Adaptive Learner is the public
online version:

[**Open the app**](https://astrapi69.github.io/adaptive-learner/){ .md-button .md-button--primary }

It runs in **local mode** — all your data stays in your browser
(IndexedDB), and AI calls go straight from the page to Anthropic,
OpenAI or Google Gemini using your own API key. No backend in
between.

## Install as a Progressive Web App

Adaptive Learner is installable. Modern browsers show an "Install"
or "Add to home screen" prompt on your first visit. Accept it and
Adaptive Learner becomes a standalone app on your phone or
desktop, launchable without a browser tab.

The app works offline for the Dashboard and past sessions. New AI
sessions need the internet, because the AI provider lives outside
the browser.

## What you need

- **A modern browser** (Chrome 100+, Firefox 100+, Safari 17+,
  Edge 100+). The app uses IndexedDB, service workers and modern
  JavaScript.
- **An AI API key** for at least one of the three supported
  providers (Anthropic, OpenAI or Google Gemini). The free tiers
  are usually enough to get started; see [Settings](settings.md)
  for key setup.

## The first five minutes

1. **Open the app** and choose a language. All 8 UI languages are
   fully translated (DE, EN, ES, FR, EL, PT, TR, JA).
2. **Onboarding: only name + topic.** The quick start asks for
   just these two fields, everything else takes defaults.
   Afterwards you can choose "Jump right in" or optionally set up
   your profile in more detail in the wizard. See
   [Onboarding](onboarding.md).
3. **Start your first lesson** — the fastest way without an AI
   key: open the
   [Content Browser](../features/content-browser.md) at
   `/content`, choose a lesson set and start a lesson. You read
   short theory and do exercises; at the end you see your result
   with stars. See [Lessons and reviews](lessons.md).
4. **Optional: AI sessions.** If you would rather have the guided
   six-method learning conversation, store an **API key**
   (Settings or `~/.config/adaptive-learner/secrets.yaml`), take
   the optional [learning-style assessment](assessment.md) and
   start a [learning session](learning-session.md).
5. **Save your result.** From the lesson summary you can copy the
   result as Markdown or save it as a file, and under
   **Settings → Data** create a [backup](../features/backup.md).

## Where to go next

- [Lessons and reviews](lessons.md) — the lesson flow in detail
- [Content Browser](../features/content-browser.md) — find and filter lessons
- [Multiple content repositories](../features/content-repos.md) — connect your own content sources
- [Backup and restore](../features/backup.md)
- [Understanding your Dashboard](dashboard.md) — progress, streak, XP, badges
- [FAQ — frequently asked questions](faq.md)
- [The pedagogical idea behind the app](../concept/philosophy.md)
